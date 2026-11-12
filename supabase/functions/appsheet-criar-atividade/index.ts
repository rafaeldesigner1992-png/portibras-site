import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── IDs das planilhas ────────────────────────────────────────────────────────
const SHEET_SERVICOS_ID  = "1tNahaf_jxhfBqD-ygOg3N_EcvTywqISFTZIBKFVh7dg";
const SHEET_VISTORIA_ID  = "117fo9l7Sw-WlVFm4gL9JerEUHZS_65j71GOYeUQiRFk";
const ABA_SERVICOS       = "EXECUCAO_PAI";
const ABA_VISTORIA       = "VISTORIAS_PAI";

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
      tipo       : "servico" | "vistoria";
      data        : string | null;        // YYYY-MM-DD
      hora_inicio : string | null;        // HH:MM
      endereco    : string | null;
      titulo      : string;              // nome do condomínio / título do atendimento
      id_cliente  : string | null;       // ID_Cliente da MASTER_CLIENTES
      tecnico     : string | null;       // nome do responsável principal
      descricao   : string | null;       // atividade / descrição
      atendimento_id: string;            // ID do atendimento no Supabase (para rastreio)
    };

    const { tipo } = body;
    const token = await getAccessToken();

    if (tipo === "servico") {
      // ── EXECUCAO_PAI ──────────────────────────────────────────────────────
      // Colunas: ID_Execucao, Data, Condominio, Endereco_Completo, Hora_Inicio,
      //          Hora_Termino, Acompanhado, Nome_Acompanhante, Status, Trigger_Bot,
      //          Descricao_servico, Tecnico_Responsavel, Total_Manutencao,
      //          Total_Execucoes, Total_Inviabilidade, Total_Condenacoes, Resumo_Materiais_DTE
      const id = gerarId();
      const row = [
        id,                                                   // ID_Execucao
        formatarData(body.data),                              // Data
        body.id_cliente ?? body.titulo,                      // Condominio (ID_Cliente ou nome)
        body.endereco ?? "",                                  // Endereco_Completo
        formatarHorarioExecucao(body.data, body.hora_inicio), // Hora_Inicio
        "",                                                   // Hora_Termino
        "Selecionar",                                         // Acompanhado
        "",                                                   // Nome_Acompanhante
        "Em Andamento 🚧",                                    // Status
        "",                                                   // Trigger_Bot
        body.descricao ?? body.titulo,                        // Descricao_servico
        body.tecnico ?? "",                                   // Tecnico_Responsavel
        "0", "0", "0", "0",                                   // Totais
        "",                                                   // Resumo_Materiais_DTE
      ];

      await appendRow(token, SHEET_SERVICOS_ID, ABA_SERVICOS, row);

      return new Response(JSON.stringify({ ok: true, tipo: "servico", id_gerado: id }), {
        status : 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });

    } else if (tipo === "vistoria") {
      // ── VISTORIAS_PAI ─────────────────────────────────────────────────────
      // Colunas: Numero_Laudo, ID_Vistoria, ID_Cliente, Data_Vistoria,
      //          Tecnico_Responsavel, Status_DTS, Arquivo_DTS, Gatilho_DTS, Resumo_Materiais_DTS
      const id = gerarId();
      const row = [
        "",                              // Numero_Laudo (AppSheet preenche)
        id,                              // ID_Vistoria
        body.id_cliente ?? body.titulo,  // ID_Cliente
        formatarData(body.data),         // Data_Vistoria
        body.tecnico ?? "",              // Tecnico_Responsavel
        "Aguardando DTS",                // Status_DTS
        "",                              // Arquivo_DTS
        "",                              // Gatilho_DTS
        "",                              // Resumo_Materiais_DTS
      ];

      await appendRow(token, SHEET_VISTORIA_ID, ABA_VISTORIA, row);

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
