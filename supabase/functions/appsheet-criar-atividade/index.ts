import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── IDs das planilhas ────────────────────────────────────────────────────────
const SHEET_SERVICOS_ID  = "1tNahaf_jxhfBqD-ygOg3N_EcvTywqISFTZIBKFVh7dg";
const SHEET_VISTORIA_ID  = "117fo9l7Sw-WlVFm4gL9JerEUHZS_65j71GOYeUQiRFk";
const ABA_SERVICOS       = "EXECUCAO_PAI";
const ABA_VISTORIA       = "VISTORIAS_PAI";

const ADMIN_EMAIL        = "rafaeldesigner1992@gmail.com";

// ─── Google Auth via Service Account ─────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado");
  const sa = JSON.parse(saJson);

  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss  : sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud  : "https://oauth2.googleapis.com/token",
    exp  : now + 3600,
    iat  : now,
  };

  const header  = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const payload = btoa(JSON.stringify(claim))
    .replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const sigInput = `${header}.${payload}`;

  const pemKey  = sa.private_key.replace(/\\n/g, "\n");
  const pemBody = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const sigBytes  = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(sigInput));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const jwt = `${sigInput}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method : "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body   : `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

// ─── Append row ───────────────────────────────────────────────────────────────
async function appendRow(token: string, spreadsheetId: string, sheetName: string, row: string[]): Promise<void> {
  const range = `${sheetName}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body   : JSON.stringify({ values: [row] }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets append error: ${err}`);
  }
}

// ─── Enviar e-mail via Resend ─────────────────────────────────────────────────
async function enviarEmail(params: {
  to      : string[];
  subject : string;
  html    : string;
}): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("RESEND_API_KEY não configurado — e-mail não enviado");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method : "POST",
    headers: {
      Authorization : `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from   : "PORTIBRAS Sistema <noreply@portibras.com.br>",
      to     : params.to,
      subject: params.subject,
      html   : params.html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
    // Não lança erro — falha no e-mail não deve bloquear a criação do atendimento
  }
}

// ─── Templates de e-mail ──────────────────────────────────────────────────────
function htmlServico(params: {
  id          : string;
  condominio  : string;
  endereco    : string;
  data        : string;
  horario     : string;
  tecnico     : string;
  descricao   : string;
}): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a3c5e; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
    .badge { display: inline-block; background: #e8a800; color: #fff; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 4px; margin-top: 8px; }
    .body { padding: 28px 32px; }
    .row { display: flex; border-bottom: 1px solid #eee; padding: 10px 0; }
    .row:last-child { border-bottom: none; }
    .label { font-size: 12px; color: #888; min-width: 140px; padding-top: 2px; }
    .value { font-size: 14px; color: #222; flex: 1; }
    .footer { background: #f9f9f9; padding: 16px 32px; font-size: 12px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Novo Serviço Criado — DTE</h1>
      <p>Um novo atendimento foi incluído no sistema PORTIBRAS</p>
      <span class="badge">Em Andamento 🚧</span>
    </div>
    <div class="body">
      <div class="row"><span class="label">ID do Serviço</span><span class="value">${params.id}</span></div>
      <div class="row"><span class="label">Condomínio</span><span class="value">${params.condominio || "—"}</span></div>
      <div class="row"><span class="label">Endereço</span><span class="value">${params.endereco || "—"}</span></div>
      <div class="row"><span class="label">Data</span><span class="value">${params.data || "—"}</span></div>
      <div class="row"><span class="label">Horário Início</span><span class="value">${params.horario || "—"}</span></div>
      <div class="row"><span class="label">Técnico Responsável</span><span class="value">${params.tecnico || "—"}</span></div>
      <div class="row"><span class="label">O que será realizado</span><span class="value">${params.descricao || "—"}</span></div>
    </div>
    <div class="footer">PORTIBRAS · Sistema de Gestão · portibras.com.br</div>
  </div>
</body>
</html>`;
}

function htmlVistoria(params: {
  id        : string;
  condominio: string;
  data      : string;
  tecnico   : string;
}): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a3c5e; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
    .badge { display: inline-block; background: #5b8dd9; color: #fff; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 4px; margin-top: 8px; }
    .body { padding: 28px 32px; }
    .row { display: flex; border-bottom: 1px solid #eee; padding: 10px 0; }
    .row:last-child { border-bottom: none; }
    .label { font-size: 12px; color: #888; min-width: 140px; padding-top: 2px; }
    .value { font-size: 14px; color: #222; flex: 1; }
    .footer { background: #f9f9f9; padding: 16px 32px; font-size: 12px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nova Vistoria Criada — DTS</h1>
      <p>Uma nova vistoria foi incluída no sistema PORTIBRAS</p>
      <span class="badge">Aguardando DTS 📋</span>
    </div>
    <div class="body">
      <div class="row"><span class="label">ID da Vistoria</span><span class="value">${params.id}</span></div>
      <div class="row"><span class="label">Condomínio</span><span class="value">${params.condominio || "—"}</span></div>
      <div class="row"><span class="label">Data</span><span class="value">${params.data || "—"}</span></div>
      <div class="row"><span class="label">Técnico Responsável</span><span class="value">${params.tecnico || "—"}</span></div>
    </div>
    <div class="footer">PORTIBRAS · Sistema de Gestão · portibras.com.br</div>
  </div>
</body>
</html>`;
}

// ─── Gerar ID curto tipo AppSheet (8 hex chars) ───────────────────────────────
function gerarId(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 8);
}

// ─── Formatar data DD/MM/AAAA ─────────────────────────────────────────────────
function formatarData(iso: string | null | undefined): string {
  if (!iso) return "";
  // Aceita "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm"
  const partes = iso.split("T")[0].split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return iso;
}

// ─── Formatar hora HH:MM para "DD/MM/YYYY HH:MM:SS" (Hora_Inicio da planilha usa datetime)
function formatarHorarioExecucao(dataIso: string | null | undefined, hora: string | null | undefined): string {
  if (!dataIso || !hora) return "";
  const data = formatarData(dataIso);
  return `${data} ${hora}:00`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin" : "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
      },
    });
  }

  try {
    const body = await req.json() as {
      tipo          : "servico" | "vistoria";
      data          : string | null;        // YYYY-MM-DD
      hora_inicio   : string | null;        // HH:MM
      endereco      : string | null;
      titulo        : string;               // nome do condomínio / título do atendimento
      id_cliente    : string | null;        // ID_Cliente da MASTER_CLIENTES
      tecnico       : string | null;        // nome do responsável principal (pode ser UUID)
      tecnico_nome  : string | null;        // nome legível do responsável principal
      descricao     : string | null;        // atividade / descrição
      atendimento_id: string;               // ID do atendimento no Supabase (para rastreio)
    };

    const { tipo } = body;
    const token = await getAccessToken();

    if (tipo === "servico") {
      // ── EXECUCAO_PAI ──────────────────────────────────────────────────────
      const id          = gerarId();
      const nomeCondominio = body.titulo;
      const nomeTecnico    = body.tecnico_nome ?? body.tecnico ?? "";
      const horario        = formatarHorarioExecucao(body.data, body.hora_inicio);
      const dataFormatada  = formatarData(body.data);

      const row = [
        id,                   // ID_Execucao
        dataFormatada,        // Data
        nomeCondominio,       // Condominio
        body.endereco ?? "",  // Endereco_Completo
        horario,              // Hora_Inicio
        "",                   // Hora_Termino
        "Selecionar",         // Acompanhado
        "",                   // Nome_Acompanhante
        "Em Andamento 🚧",   // Status
        "",                   // Trigger_Bot
        body.descricao ?? "", // Descricao_servico
        nomeTecnico,          // Tecnico_Responsavel
        "0", "0", "0", "0",  // Totais
        "",                   // Resumo_Materiais_DTE
      ];

      await appendRow(token, SHEET_SERVICOS_ID, ABA_SERVICOS, row);

      // ── E-mail de confirmação ─────────────────────────────────────────────
      await enviarEmail({
        to     : [ADMIN_EMAIL],
        subject: `✅ Novo Serviço (DTE) — ${nomeCondominio}`,
        html   : htmlServico({
          id,
          condominio: nomeCondominio,
          endereco  : body.endereco ?? "",
          data      : dataFormatada,
          horario   : body.hora_inicio ?? "",
          tecnico   : nomeTecnico,
          descricao : body.descricao ?? "",
        }),
      });

      return new Response(JSON.stringify({ ok: true, tipo: "servico", id_gerado: id }), {
        status : 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });

    } else if (tipo === "vistoria") {
      // ── VISTORIAS_PAI ─────────────────────────────────────────────────────
      const id           = gerarId();
      const nomeTecnicoV = body.tecnico_nome ?? body.tecnico ?? "";
      const dataFormatada = formatarData(body.data);

      const row = [
        "",              // Numero_Laudo (AppSheet preenche)
        id,              // ID_Vistoria
        body.titulo,     // ID_Cliente (nome do condomínio)
        dataFormatada,   // Data_Vistoria
        nomeTecnicoV,    // Tecnico_Responsavel
        "Aguardando DTS",// Status_DTS
        "",              // Arquivo_DTS
        "",              // Gatilho_DTS
        "",              // Resumo_Materiais_DTS
      ];

      await appendRow(token, SHEET_VISTORIA_ID, ABA_VISTORIA, row);

      // ── E-mail de confirmação ─────────────────────────────────────────────
      await enviarEmail({
        to     : [ADMIN_EMAIL],
        subject: `📋 Nova Vistoria (DTS) — ${body.titulo}`,
        html   : htmlVistoria({
          id,
          condominio: body.titulo,
          data      : dataFormatada,
          tecnico   : nomeTecnicoV,
        }),
      });

      return new Response(JSON.stringify({ ok: true, tipo: "vistoria", id_gerado: id }), {
        status : 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });

    } else {
      return new Response(JSON.stringify({ error: "tipo deve ser 'servico' ou 'vistoria'" }), { status: 400 });
    }

  } catch (err) {
    console.error("appsheet-criar-atividade error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status : 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
