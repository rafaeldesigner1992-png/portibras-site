import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "PORTIBRAS <adm@portibras.com.br>";

interface TicketPayload {
  cliente_email: string;
  cliente_nome?: string;
  cliente_empresa?: string;
  ticket_motivo: string;
  ticket_prioridade?: string;
  ticket_sla_at?: string;
  ticket_contato_nome?: string;
  ticket_contato_tel?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function prioridadeLabel(p?: string) {
  if (p === "alta") return "🔴 Alta";
  if (p === "media") return "🟡 Média";
  return "⚪ Baixa";
}

function buildHtml(payload: TicketPayload): string {
  const nome = payload.cliente_empresa || payload.cliente_nome || "Cliente";
  const prazo = payload.ticket_sla_at ? formatDate(payload.ticket_sla_at) : "em até 4 dias úteis";
  const prio = prioridadeLabel(payload.ticket_prioridade);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmação de Ticket — PORTIBRAS</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header verde -->
          <tr>
            <td style="background:#1a6b2f;padding:28px 36px;text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:3px;color:#a8d5b5;text-transform:uppercase;">Sistema de Atendimento</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">PORTIBRAS</h1>
              <p style="margin:4px 0 0;font-size:11px;color:#a8d5b5;">Sistemas Contra Incêndio</p>
            </td>
          </tr>

          <!-- Faixa vermelha de ticket -->
          <tr>
            <td style="background:#dc2626;padding:12px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;font-weight:700;color:#ffffff;letter-spacing:1px;">
                🎫 TICKET DE ATENDIMENTO ABERTO
              </p>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">Olá, <strong>${nome}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
                Recebemos a sua solicitação de atendimento e nossa equipe técnica já foi acionada.
                Você receberá um retorno dentro do prazo estabelecido abaixo.
              </p>

              <!-- Caixa de detalhes -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:2px;color:#991b1b;text-transform:uppercase;">Detalhes do Ticket</p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #fecaca;">
                          <span style="font-size:12px;color:#9ca3af;">Motivo</span>
                          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#1f2937;">${payload.ticket_motivo}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #fecaca;">
                          <span style="font-size:12px;color:#9ca3af;">Prioridade</span>
                          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#1f2937;">${prio}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="font-size:12px;color:#9ca3af;">Prazo de retorno</span>
                          <p style="margin:2px 0 0;font-size:16px;font-weight:800;color:#dc2626;">${prazo}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#6b7280;">
                Caso necessite de informações adicionais ou queira agilizar o atendimento,
                entre em contato diretamente pelo nosso telefone ou e-mail abaixo.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
                <tr>
                  <td style="padding:16px 24px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:12px;color:#166534;font-weight:600;">Entre em contato</p>
                    <p style="margin:0;font-size:14px;color:#166534;">
                      📞 (22) 99104-8162 &nbsp;|&nbsp; ✉️ adm@portibras.com.br
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 36px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                PORTIBRAS SISTEMAS CONTRA INCÊNDIO LTDA · CNPJ 63.823.452/0001-93<br/>
                (22) 99104-8162 · adm@portibras.com.br
              </p>
              <p style="margin:8px 0 0;font-size:10px;color:#d1d5db;">
                Este e-mail foi enviado automaticamente. Por favor, não responda diretamente a esta mensagem.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let payload: TicketPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  if (!payload.cliente_email) {
    return new Response(JSON.stringify({ error: "cliente_email is required" }), { status: 400 });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
  }

  const nome = payload.cliente_empresa || payload.cliente_nome || "Cliente";
  const html = buildHtml(payload);

  const resendBody = {
    from: FROM_EMAIL,
    to: [payload.cliente_email],
    subject: `✅ Ticket de Atendimento Aberto — PORTIBRAS`,
    html,
  };

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resendBody),
  });

  const resendData = await resendRes.json();

  if (!resendRes.ok) {
    console.error("[send-ticket-email] Resend error:", resendData);
    return new Response(JSON.stringify({ error: "Failed to send email", details: resendData }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  console.log(`[send-ticket-email] Email sent to ${payload.cliente_email} for "${nome}"`);
  return new Response(JSON.stringify({ ok: true, id: resendData.id }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
