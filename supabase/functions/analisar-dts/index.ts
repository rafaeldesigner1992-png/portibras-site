import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Converte ArrayBuffer para base64 sem estourar stack
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

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

    // Faz o download do PDF
    const pdfRes = await fetch(pdf_url);
    if (!pdfRes.ok) {
      throw new Error(`Não foi possível baixar o PDF: ${pdfRes.status}`);
    }
    const pdfBuffer = await pdfRes.arrayBuffer();
    const pdfBase64 = arrayBufferToBase64(pdfBuffer);

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
        model: "claude-haiku-4-5",
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
                text: `Analise este DTS de vistoria de portas corta-fogo. Extraia SOMENTE estas informações em JSON:

{
  "total_portas": número do campo "Total de PCF Vistoriadas",
  "conformes": número do campo "Total Conformes (C)",
  "nao_conformes": número do campo "Total Não Conformes (NC)",
  "status_geral": texto do campo "Status Geral das Portas",
  "pecas": [
    { "nome": "nome da peça", "quantidade": número }
  ]
}

Para as peças, use EXATAMENTE o texto da seção "3. RESUMO DE MATERIAIS IDENTIFICADOS".

Responda APENAS com o JSON, sem mais nada.`,
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
      throw new Error(`Claude retornou: ${textoResposta}`);
    }

    const resumo = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ resumo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[analisar-dts] erro:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
