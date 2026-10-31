import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Processa de forma assíncrona (responde imediatamente ao frontend)
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
  console.log("[analisar-dts] iniciando análise para lead:", lead_id);

  // Baixa o PDF e converte para base64 para enviar à OpenAI
  const pdfRes = await fetch(pdf_url);
  if (!pdfRes.ok) {
    throw new Error(`Não foi possível baixar o PDF: ${pdfRes.status}`);
  }

  const pdfBuffer = await pdfRes.arrayBuffer();
  const bytes = new Uint8Array(pdfBuffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const pdfBase64 = btoa(binary);

  console.log("[analisar-dts] PDF baixado, tamanho base64:", pdfBase64.length);

  // OpenAI Chat Completions com PDF em base64
  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Leia este DTS de vistoria de portas corta-fogo e responda APENAS com este JSON (sem markdown, sem texto extra):

{
  "total_portas": número,
  "conformes": número,
  "nao_conformes": número,
  "status_geral": "texto",
  "pecas": [{"nome": "texto", "quantidade": número}]
}

Extraia os dados das seções "2. DADOS DA VISTORIA" e "3. RESUMO DE MATERIAIS IDENTIFICADOS". Responda somente o JSON.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 512,
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.text();
    throw new Error(`Erro OpenAI API: ${err}`);
  }

  const openaiData = await openaiRes.json();
  const texto = openaiData.choices?.[0]?.message?.content ?? "";
  console.log("[analisar-dts] resposta OpenAI:", texto);

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
