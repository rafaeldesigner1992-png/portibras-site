// Edge Function: listar-orcamentos-conta-azul
// Busca orçamentos do Conta Azul pelo nome ou CNPJ do cliente
// POST { "nome": "string" } ou { "cnpj": "string" }

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

async function getAccessToken(): Promise<string> {
  const { data: cfg } = await supabase
    .from("configuracoes").select("valor").eq("chave", "ca_access_token").single();
  const { data: cfgExpiry } = await supabase
    .from("configuracoes").select("valor").eq("chave", "ca_token_expires_at").single();

  const expiresAt = cfgExpiry?.valor ? new Date(cfgExpiry.valor) : null;
  const agora = new Date();

  if (cfg?.valor && expiresAt && expiresAt > new Date(agora.getTime() + 5 * 60 * 1000)) {
    return cfg.valor;
  }

  const { data: cfgRefresh } = await supabase
    .from("configuracoes").select("valor").eq("chave", "ca_refresh_token").single();

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const nome: string = (body.nome ?? "").trim();
    const cnpj: string = (body.cnpj ?? "").trim().replace(/\D/g, "");

    if (!nome && !cnpj) {
      return new Response(
        JSON.stringify({ error: "Informe 'nome' ou 'cnpj' para buscar orçamentos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getAccessToken();

    // Estratégia: busca orçamentos com paginação e filtra pelo cliente
    // A API do Conta Azul suporta GET /v1/sale/quotes com parâmetros de busca
    const orcamentos: any[] = [];

    // Tenta buscar via customer_name se tiver nome
    if (nome) {
      const params = new URLSearchParams({
        page: "0",
        size: "50",
      });

      const res = await fetch(`${CONTA_AZUL_BASE}/v1/sale/quotes?${params}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        const lista = Array.isArray(data) ? data : (data.content ?? data.items ?? data.data ?? []);

        // Filtra pelo nome do cliente (case-insensitive, parcial)
        const nomeNorm = nome.toLowerCase();
        for (const orc of lista) {
          const clienteNome = (
            orc.customer?.name ?? orc.cliente?.nome ?? orc.client?.name ?? ""
          ).toLowerCase();
          if (clienteNome.includes(nomeNorm)) {
            orcamentos.push(orc);
          }
        }

        // Se não encontrou nada, retorna todos (pode ser busca geral)
        if (orcamentos.length === 0 && nome.length <= 3) {
          orcamentos.push(...lista.slice(0, 20));
        }
      }
    }

    // Se tem CNPJ, busca por documento
    if (cnpj && orcamentos.length === 0) {
      const res = await fetch(`${CONTA_AZUL_BASE}/v1/sale/quotes?page=0&size=50`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        const lista = Array.isArray(data) ? data : (data.content ?? data.items ?? data.data ?? []);

        for (const orc of lista) {
          const doc = (
            orc.customer?.document ?? orc.cliente?.documento ?? orc.client?.document ?? ""
          ).replace(/\D/g, "");
          if (doc === cnpj || doc.includes(cnpj) || cnpj.includes(doc)) {
            orcamentos.push(orc);
          }
        }
      }
    }

    // Mapeia para formato padronizado
    const resultado = orcamentos.map((orc: any) => {
      const id = orc.id ?? orc.uuid;
      return {
        id,
        numero: orc.number ?? orc.numero ?? orc.id,
        status: orc.status ?? orc.situacao ?? "PENDENTE",
        cliente_nome: orc.customer?.name ?? orc.cliente?.nome ?? orc.client?.name ?? "—",
        valor_total: Number(orc.total ?? orc.valor_total ?? orc.totalValue ?? 0),
        data_emissao: orc.emission_date ?? orc.data_emissao ?? orc.created_at ?? null,
        data_validade: orc.expiration_date ?? orc.validade ?? orc.valid_until ?? null,
        link: `https://app.contaazul.com/sales/quotes/${id}`,
      };
    });

    // Ordena do mais recente para o mais antigo
    resultado.sort((a, b) => {
      const da = a.data_emissao ? new Date(a.data_emissao).getTime() : 0;
      const db = b.data_emissao ? new Date(b.data_emissao).getTime() : 0;
      return db - da;
    });

    return new Response(
      JSON.stringify({ ok: true, orcamentos: resultado, total: resultado.length }),
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
