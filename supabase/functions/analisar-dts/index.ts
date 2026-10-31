import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pdf_url } = await req.json();

    if (!pdf_url) {
      return new Response(JSON.stringify({ error: "pdf_url é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Faz o download do PDF como base64
    const pdfRes = await fetch(pdf_url);
    if (!pdfRes.ok) {
      throw new Error(`Não foi possível baixar o PDF: ${pdfRes.status}`);
    }
    const pdfBuffer = await pdfRes.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    // Envia para Claude API com o PDF em base64
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                type: "text",
                text: `Analise este DTS (Documento Técnico de Segurança) de vistoria de portas corta-fogo e extraia APENAS as informações a seguir em formato JSON:

{
  "total_portas": número total de PCF vistoriadas,
  "conformes": número de portas conformes (C),
  "nao_conformes": número de portas não conformes (NC),
  "status_geral": "CONFORME" ou "NÃO CONFORME",
  "pecas": [
    { "nome": "nome da peça em português claro", "quantidade": número }
  ]
}

Para as peças, use o campo "3. RESUMO DE MATERIAIS IDENTIFICADOS" do documento. Converta os nomes técnicos para português claro:
- MANUTENCAO → Manutenção preventiva
- DOBRADICA_SEM_PRESSAO ou Dobradiça com mola → Dobradiça com mola
- FECHADURA_QUEBRADA ou Fechadura sobrepor sem chave → Fechadura sobrepor sem chave
- Fechadura sobrepor com chave invertida → Fechadura sobrepor c/ chave invertida
- MOLA_DESREGULADA ou Mola aérea → Mola aérea
- Contramarco → Contramarco

Responda APENAS com o JSON, sem texto adicional.`,
              },
            ],
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Erro na API Claude: ${err}`);
    }

    const claudeData = await claudeRes.json();
    const textoResposta = claudeData.content?.[0]?.text ?? "";

    // Extrai o JSON da resposta
    const jsonMatch = textoResposta.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Claude não retornou JSON válido");
    }

    const resumo = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ resumo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
