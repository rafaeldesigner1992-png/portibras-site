// Edge Function: buscar-orcamento-conta-azul
// Recebe o ID de um orçamento do Conta Azul e retorna um resumo formatado
// Invoke: POST /functions/v1/buscar-orcamento-conta-azul  { "orcamento_id": "uuid" }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONTA_AZUL_BASE = "https://api-v2.contaazul.com";
const TOKEN_URL = "https://api-v2.contaazul.com/oauth/token";
const CLIENT_ID = Deno.env.get("CONTA_AZUL_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("CONTA_AZUL_CLIENT_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── OAuth2: busca/renova access token ──────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const { data: cfg } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "ca_access_token")
    .single();

  const { data: cfgExpiry } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "ca_token_expires_at")
    .single();

  const expiresAt = cfgExpiry?.valor ? new Date(cfgExpiry.valor) : null;
  const agora = new Date();

  if (cfg?.valor && expiresAt && expiresAt > new Date(agora.getTime() + 5 * 60 * 1000)) {
    return cfg.valor;
  }

  const { data: cfgRefresh } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "ca_refresh_token")
    .single();

  if (cfgRefresh?.valor) {
    const basicAuth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: cfgRefresh.valor,
      }),
    });

    if (res.ok) {
      const token = await res.json();
      const expiresAtNew = new Date(Date.now() + token.expires_in * 1000).toISOString();
      await supabase.from("configuracoes").upsert([
        { chave: "ca_access_token", valor: token.access_token },
        { chave: "ca_token_expires_at", valor: expiresAtNew },
        ...(token.refresh_token ? [{ chave: "ca_refresh_token", valor: token.refresh_token }] : []),
      ], { onConflict: "chave" });
      return token.access_token;
    }
  }

  throw new Error("Conta Azul não autorizado. Acesse /painel/auth/conta-azul para autorizar.");
}

// ─── Extrai UUID de um link do Conta Azul ────────────────────────────────────
// Suporta formatos:
//   https://app.contaazul.com/sales/quotes/UUID
//   https://app.contaazul.com/#/sales/quotes/UUID
//   UUID puro
function extrairUUID(input: string): string | null {
  const limpo = input.trim();
  // UUID puro
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(limpo)) return limpo;

  // Extrai de URL
  const match = limpo.match(/\/quotes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (match) return match[1];

  // Tenta pegar qualquer UUID na string
  const anyUUID = limpo.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (anyUUID) return anyUUID[1];

  return null;
}

// ─── Handler principal ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawInput: string = body.orcamento_id ?? body.link ?? "";

    if (!rawInput) {
      return new Response(
        JSON.stringify({ error: "Informe o campo 'orcamento_id' com o ID ou link do orçamento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orcamentoId = extrairUUID(rawInput);
    if (!orcamentoId) {
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair um UUID válido do valor informado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getAccessToken();

    // Busca o orçamento na API do Conta Azul
    // Endpoint: GET /v1/sale/quotes/{id}
    const res = await fetch(`${CONTA_AZUL_BASE}/v1/sale/quotes/${orcamentoId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 404) {
        return new Response(
          JSON.stringify({ error: "Orçamento não encontrado no Conta Azul" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Conta Azul API ${res.status}: ${txt.substring(0, 300)}`);
    }

    const data = await res.json();

    // Mapeia os itens/serviços do orçamento
    const itens = (data.items ?? data.itens ?? data.products ?? data.services ?? []).map((item: any) => ({
      descricao: item.description ?? item.descricao ?? item.name ?? item.nome ?? "Item",
      quantidade: Number(item.quantity ?? item.quantidade ?? 1),
      valor_unitario: Number(item.unit_value ?? item.valor_unitario ?? item.price ?? item.valor ?? 0),
      valor_total: Number(item.total ?? item.valor_total ?? 0),
    }));

    // Monta o resumo formatado
    const orcamento = {
      id: orcamentoId,
      numero: data.number ?? data.numero ?? data.id,
      status: data.status ?? data.situacao ?? "PENDENTE",
      cliente_nome: data.customer?.name ?? data.cliente?.nome ?? data.client?.name ?? "—",
      cliente_documento: data.customer?.document ?? data.cliente?.documento ?? null,
      valor_total: Number(data.total ?? data.valor_total ?? data.totalValue ?? 0),
      data_emissao: data.emission_date ?? data.data_emissao ?? data.created_at ?? null,
      data_validade: data.expiration_date ?? data.validade ?? data.valid_until ?? null,
      observacao: data.notes ?? data.observacao ?? data.observation ?? null,
      itens,
      link: `https://app.contaazul.com/sales/quotes/${orcamentoId}`,
    };

    return new Response(
      JSON.stringify({ ok: true, orcamento }),
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
