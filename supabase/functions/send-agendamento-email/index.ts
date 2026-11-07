import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "PORTIBRAS <adm@portibras.com.br>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatarData(data: string): string {
  // data pode ser "2024-12-15" ou ISO string
  const d = new Date(data.includes("T") ? data : data + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatarHora(hora: string | null): string {
  if (!hora) return "";
  // hora no formato "HH:MM" ou "HH:MM:SS"
  const partes = hora.split(":");
  return `${partes[0]}:${partes[1]}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = await req.json();
    const {
      cliente_email,
      cliente_nome,
      data_agendada,
      hora_inicio,
      hora_fim,
      endereco,
      tecnico_nome,
      tipo,        // "vistoria" | "atendimento"
      titulo,      // para atendimentos
      observacoes,
    } = body;

    if (!cliente_email) {
      return new Response(
        JSON.stringify({ ok: false, error: "cliente_email é obrigatório" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const dataFormatada = data_agendada ? formatarData(data_agendada) : "A confirmar";
    const horaStr = hora_inicio
      ? hora_fim
        ? `${formatarHora(hora_inicio)} às ${formatarHora(hora_fim)}`
        : `a partir das ${formatarHora(hora_inicio)}`
      : "";

    const tipoLabel = tipo === "vistoria" ? "Vistoria Técnica" : "Atendimento";
    const assunto = `${tipoLabel} Agendada – ${dataFormatada}`;
    const tituloEmail = tipo === "vistoria"
      ? "Sua vistoria técnica foi agendada"
      : `Seu atendimento foi agendado${titulo ? `: ${titulo}` : ""}`;

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${assunto}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1a6b2f;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">
                PORTIBRAS
              </h1>
              <p style="margin:6px 0 0;color:#a8d5b5;font-size:13px;">
                Portões e Automatizadores
              </p>
            </td>
          </tr>

          <!-- Título da mensagem -->
          <tr>
            <td style="padding:36px 40px 20px;text-align:center;">
              <div style="display:inline-block;background:#e8f5ec;border-radius:50px;padding:8px 20px;margin-bottom:16px;">
                <span style="color:#1a6b2f;font-weight:600;font-size:13px;">✓ CONFIRMAÇÃO DE AGENDAMENTO</span>
              </div>
              <h2 style="margin:0;color:#1a1a1a;font-size:22px;font-weight:600;">
                ${tituloEmail}
              </h2>
              <p style="margin:12px 0 0;color:#555555;font-size:15px;">
                Olá${cliente_nome ? `, <strong>${cliente_nome}</strong>` : ""}! Seu agendamento foi registrado com sucesso.
              </p>
            </td>
          </tr>

          <!-- Detalhes do agendamento -->
          <tr>
            <td style="padding:0 40px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td colspan="2" style="background:#1a6b2f;padding:14px 20px;">
                    <span style="color:#ffffff;font-weight:600;font-size:14px;">📋 Detalhes do Agendamento</span>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 20px 8px;width:40%;">
                    <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Data</span>
                    <p style="margin:4px 0 0;color:#111827;font-size:15px;font-weight:600;">${dataFormatada}</p>
                  </td>
                  ${horaStr ? `
                  <td style="padding:16px 20px 8px;">
                    <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Horário</span>
                    <p style="margin:4px 0 0;color:#111827;font-size:15px;font-weight:600;">${horaStr}</p>
                  </td>
                  ` : "<td></td>"}
                </tr>

                ${endereco ? `
                <tr>
                  <td colspan="2" style="padding:8px 20px;">
                    <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Local</span>
                    <p style="margin:4px 0 0;color:#111827;font-size:15px;">${endereco}</p>
                  </td>
                </tr>
                ` : ""}

                ${tecnico_nome ? `
                <tr>
                  <td colspan="2" style="padding:8px 20px;">
                    <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Técnico Responsável</span>
                    <p style="margin:4px 0 0;color:#111827;font-size:15px;">${tecnico_nome}</p>
                  </td>
                </tr>
                ` : ""}

                ${observacoes ? `
                <tr>
                  <td colspan="2" style="padding:8px 20px 16px;">
                    <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Observações</span>
                    <p style="margin:4px 0 0;color:#111827;font-size:14px;">${observacoes}</p>
                  </td>
                </tr>
                ` : `<tr><td colspan="2" style="padding:0 0 8px;"></td></tr>`}

              </table>
            </td>
          </tr>

          <!-- Aviso -->
          <tr>
            <td style="padding:0 40px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef9ec;border:1px solid #fcd34d;border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;color:#92400e;font-size:14px;">
                      <strong>⚠️ Importante:</strong> Caso precise remarcar ou cancelar, entre em contato conosco com antecedência.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contato -->
          <tr>
            <td style="padding:0 40px 36px;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:14px;">Dúvidas? Entre em contato:</p>
              <p style="margin:8px 0 0;color:#1a6b2f;font-size:15px;font-weight:600;">adm@portibras.com.br</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f3f4f6;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                © ${new Date().getFullYear()} PORTIBRAS – Portões e Automatizadores
              </p>
              <p style="margin:6px 0 0;color:#d1d5db;font-size:11px;">
                Este email foi enviado automaticamente pelo nosso sistema.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [cliente_email],
        subject: assunto,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return new Response(
        JSON.stringify({ ok: false, error: data }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, id: data.id }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
