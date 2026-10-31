import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pdf_url, lead_id } = await req.json();

    if (!pdf_url || !lead_id) {
      return new Response(JSON.stringify({ error: "pdf_url e lead_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Responde imediatamente ao frontend (não bloqueia)
    // e processa em background
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Processa de forma assíncrona
    processarDTS(pdf_url, lead_id, supabase).catch((e) => {
      console.error("[analisar-dts] erro no processamento:", e.message);
    });

    return new Response(JSON.stringify({ ok: true, msg: "Análise iniciada" }), {
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

async function processarDTS(pdf_url: string, lead_id: string, supabase: any) {
  // Baixa só os primeiros 200KB do PDF (página 1 tem o resumo)
  const pdfRes = await fetch(pdf_url, {
    headers: { Range: "bytes=0-204800" },
  });
  if (!pdfRes.ok && pdfRes.status !== 206) {
    throw new Error(`Não foi possível baixar o PDF: ${pdfRes.status}`);
  }

  const pdfBuffer = await pdfRes.arrayBuffer();

  // Converte para base64 em chunks
  const bytes = new Uint8Array(pdfBuffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const pdfBase64 = btoa(binary);

  // Envia para Claude API
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 512,
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
              text: `Leia este DTS de vistoria de portas corta-fogo e responda APENAS com este JSON:

{
  "total_portas": número,
  "conformes": número,
  "nao_conformes": número,
  "status_geral": "texto",
  "pecas": [{"nome": "texto", "quantidade": número}]
}

Dados na seção "2. DADOS DA VISTORIA" e "3. RESUMO DE MATERIAIS IDENTIFICADOS". Nenhum texto além do JSON.`,
            },
          ],
        },
      ],
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    throw new Error(`Erro Claude API: ${err}`);
  }

  const claudeData = await claudeRes.json();
  const texto = claudeData.content?.[0]?.text ?? "";
  console.log("[analisar-dts] resposta Claude:", texto);

  const jsonMatch = texto.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`JSON não encontrado na resposta: ${texto}`);

  const resumo = JSON.parse(jsonMatch[0]);

  const linhasPecas = (resumo.pecas ?? [])
    .map((p: { nome: string; quantidade: number }) => `  • ${p.nome}: **${p.quantidade} un**`)
    .join("\n");

  const textoResumo =
    `📊 **Resumo do DTS:**\n` +
    `  • Total de portas vistoriadas: **${resumo.total_portas}**\n` +
    `  • Conformes: **${resumo.conformes}** | Não conformes: **${resumo.nao_conformes}**\n` +
    `  • Status geral: **${resumo.status_geral}**\n\n` +
    `🔧 **Peças / Manutenção:**\n${linhasPecas}`;

  await supabase.from("crm_conversas").insert({
    lead_id,
    texto: textoResumo,
    autor: "Sistema",
  });

  console.log("[analisar-dts] resumo salvo para lead:", lead_id);
}
