// Edge Function: analyze-dts
// Lê o PDF do DTS (Documento Técnico de Segurança) via URL do Storage
// e extrai resumo de materiais usando a API do Claude (Anthropic)
// Invoke: POST /functions/v1/analyze-dts
// Body: { vistoria_id: string, dts_url: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { vistoria_id, dts_url } = await req.json();

    if (!vistoria_id || !dts_url) {
      return new Response(
        JSON.stringify({ ok: false, error: "vistoria_id e dts_url são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Baixa o PDF do Supabase Storage
    const pdfRes = await fetch(dts_url);
    if (!pdfRes.ok) {
      throw new Error(`Falha ao baixar PDF: ${pdfRes.status}`);
    }

    const pdfBytes = await pdfRes.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

    // Envia para Claude analisar
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
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
                text: `Você é um assistente especializado em laudos técnicos de portas corta-fogo (PCF) da Portibras.

Analise este DTS (Documento Técnico de Segurança) e extraia:

1. RESUMO GERAL: total de portas vistoriadas, total conformes (C) e não conformes (NC)
2. LISTA DE MATERIAIS: consolide todos os componentes/ferragens identificados em todas as portas com suas quantidades totais
3. SERVIÇOS NECESSÁRIOS: liste os tipos de intervenção necessários

Use o campo "3. RESUMO DE MATERIAIS IDENTIFICADOS" do documento como base principal.

Responda em formato JSON com esta estrutura exata:
{
  "total_portas": número,
  "total_conformes": número,
  "total_nao_conformes": número,
  "materiais": [
    {"item": "nome do material/serviço", "quantidade": número, "tipo": "substituição|manutenção|regulagem|ausência"}
  ],
  "resumo_texto": "texto resumido em 2-3 linhas para mostrar no sistema"
}

Responda APENAS com o JSON, sem texto adicional.`,
              },
            ],
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error ${claudeRes.status}: ${err}`);
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text ?? "{}";

    let analise: any = {};
    try {
      analise = JSON.parse(rawText);
    } catch {
      // Se não parsear como JSON, salva o texto cru
      analise = { resumo_texto: rawText };
    }

    const resumoTexto = analise.resumo_texto ?? rawText;

    // Salva no banco
    const { error } = await supabase
      .from("vistorias")
      .update({
        dts_resumo_ia: resumoTexto,
        dts_materiais: analise,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", vistoria_id);

    if (error) {
      throw new Error(`Erro ao salvar análise: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ ok: true, resumo: resumoTexto, analise }),
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
