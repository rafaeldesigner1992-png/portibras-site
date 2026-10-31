// Edge Function: notify-vistoria
// Envia emails de notificação nos eventos do fluxo de vistoria
// Eventos: 'enviada' (CRM → Logística) | 'concluida' (Logística → CRM)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const EMAIL_RAFAEL = "rafaeldesigner1992@gmail.com";
const EMAIL_MARILIA = "vendas@portibras.com.br";
const FROM_EMAIL = "sistema@portibras.com.br"; // domínio verificado no Resend

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function enviarEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Portibras Sistema <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { evento, vistoria } = await req.json();
    // vistoria: { id, cliente_nome, cliente_endereco, cliente_telefone, cliente_email,
    //             data_agendada, dts_resumo_ia, enviado_por }

    if (evento === "enviada") {
      // Marilia enviou cliente para vistoria → notifica Rafael
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a6b3c;padding:20px;border-radius:8px 8px 0 0">
            <h1 style="color:white;margin:0;font-size:20px">🔍 Nova Vistoria Solicitada</h1>
          </div>
          <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
            <p style="color:#333;font-size:16px">
              <strong>${vistoria.enviado_por || "Marilia"}</strong> enviou um novo cliente para vistoria.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr style="background:#e8f5e9">
                <td style="padding:10px;font-weight:bold;color:#1a6b3c;width:140px">Cliente</td>
                <td style="padding:10px;color:#333">${vistoria.cliente_nome}</td>
              </tr>
              <tr>
                <td style="padding:10px;font-weight:bold;color:#555">Endereço</td>
                <td style="padding:10px;color:#333">${vistoria.cliente_endereco || "—"}</td>
              </tr>
              <tr style="background:#e8f5e9">
                <td style="padding:10px;font-weight:bold;color:#1a6b3c">Telefone</td>
                <td style="padding:10px;color:#333">${vistoria.cliente_telefone || "—"}</td>
              </tr>
              <tr>
                <td style="padding:10px;font-weight:bold;color:#555">Email</td>
                <td style="padding:10px;color:#333">${vistoria.cliente_email || "—"}</td>
              </tr>
            </table>
            <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:16px;margin:16px 0">
              <p style="margin:0;color:#856404;font-size:14px">
                ⏰ <strong>Ação necessária:</strong> Agende a vistoria e registre no sistema em Logística → Vistorias.
              </p>
            </div>
            <a href="https://www.portibras.com.br/painel/logistica"
               style="display:inline-block;background:#1a6b3c;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
              Ir para Logística
            </a>
          </div>
          <p style="color:#999;font-size:12px;text-align:center;margin-top:16px">
            Portibras • Sistema Interno
          </p>
        </div>
      `;
      await enviarEmail(EMAIL_RAFAEL, `🔍 Nova vistoria: ${vistoria.cliente_nome}`, html);

    } else if (evento === "concluida") {
      // Rafael concluiu vistoria + fez upload DTS → notifica Marilia
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a6b3c;padding:20px;border-radius:8px 8px 0 0">
            <h1 style="color:white;margin:0;font-size:20px">✅ Vistoria Concluída — Pronto para Orçar</h1>
          </div>
          <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
            <p style="color:#333;font-size:16px">
              A vistoria do cliente abaixo foi concluída. O DTS está disponível no sistema para você elaborar o orçamento.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr style="background:#e8f5e9">
                <td style="padding:10px;font-weight:bold;color:#1a6b3c;width:140px">Cliente</td>
                <td style="padding:10px;color:#333">${vistoria.cliente_nome}</td>
              </tr>
              <tr>
                <td style="padding:10px;font-weight:bold;color:#555">Endereço</td>
                <td style="padding:10px;color:#333">${vistoria.cliente_endereco || "—"}</td>
              </tr>
              <tr style="background:#e8f5e9">
                <td style="padding:10px;font-weight:bold;color:#1a6b3c">Telefone</td>
                <td style="padding:10px;color:#333">${vistoria.cliente_telefone || "—"}</td>
              </tr>
              <tr>
                <td style="padding:10px;font-weight:bold;color:#555">Email</td>
                <td style="padding:10px;color:#333">${vistoria.cliente_email || "—"}</td>
              </tr>
            </table>
            ${vistoria.dts_resumo_ia ? `
            <div style="background:#e8f5e9;border:1px solid #1a6b3c;border-radius:6px;padding:16px;margin:16px 0">
              <h3 style="margin:0 0 8px;color:#1a6b3c;font-size:14px">📋 Prévia de Materiais (DTS)</h3>
              <p style="margin:0;color:#333;font-size:14px;white-space:pre-line">${vistoria.dts_resumo_ia}</p>
            </div>` : ""}
            <div style="background:#d1ecf1;border:1px solid #0dcaf0;border-radius:6px;padding:16px;margin:16px 0">
              <p style="margin:0;color:#0c5460;font-size:14px">
                📁 O documento DTS completo está anexado no card do cliente no sistema.
              </p>
            </div>
            <a href="https://www.portibras.com.br/painel/crm"
               style="display:inline-block;background:#1a6b3c;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
              Abrir CRM e Orçar
            </a>
          </div>
          <p style="color:#999;font-size:12px;text-align:center;margin-top:16px">
            Portibras • Sistema Interno
          </p>
        </div>
      `;
      await enviarEmail(EMAIL_MARILIA, `✅ Vistoria concluída: ${vistoria.cliente_nome} — pronto para orçar`, html);

    } else {
      return new Response(
        JSON.stringify({ ok: false, error: `Evento desconhecido: ${evento}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, evento }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
