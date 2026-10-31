// Edge Function: sync-conta-azul
// Autentica via OAuth2 no Conta Azul e sincroniza vendas, cobranças e contratos
// Invoke: POST /functions/v1/sync-conta-azul
// Ou via pg_cron: SELECT net.http_post(url, headers, body) uma vez por dia

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONTA_AZUL_BASE = "https://api.contaazul.com/v1";
const TOKEN_URL = "https://api.contaazul.com/auth/token";

const CLIENT_ID = Deno.env.get("CONTA_AZUL_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("CONTA_AZUL_CLIENT_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─── OAuth2: busca/renova access token ──────────────────────────────────────
async function getAccessToken(): Promise<string> {
  // Tenta buscar token salvo
  const { data: cfg } = await supabase
    .from("configuracoes")
    .select("valor, atualizado_em")
    .eq("chave", "ca_access_token")
    .single();

  const { data: cfgExpiry } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "ca_token_expires_at")
    .single();

  const expiresAt = cfgExpiry?.valor ? new Date(cfgExpiry.valor) : null;
  const agora = new Date();

  // Se token válido (com 5 min de margem), retorna
  if (cfg?.valor && expiresAt && expiresAt > new Date(agora.getTime() + 5 * 60 * 1000)) {
    return cfg.valor;
  }

  // Tenta refresh com refresh_token
  const { data: cfgRefresh } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "ca_refresh_token")
    .single();

  if (cfgRefresh?.valor) {
    // Conta Azul exige Basic Auth no header
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
      await salvarToken(token);
      return token.access_token;
    }
  }

  throw new Error("Conta Azul não autorizado. Acesse /painel/auth/conta-azul para autorizar.");
}

async function salvarToken(token: { access_token: string; refresh_token?: string; expires_in: number }) {
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  await supabase.from("configuracoes").upsert([
    { chave: "ca_access_token", valor: token.access_token, descricao: "Conta Azul OAuth2 access token" },
    { chave: "ca_token_expires_at", valor: expiresAt, descricao: "Conta Azul token expira em" },
  ], { onConflict: "chave" });

  if (token.refresh_token) {
    await supabase.from("configuracoes").upsert(
      { chave: "ca_refresh_token", valor: token.refresh_token, descricao: "Conta Azul OAuth2 refresh token" },
      { onConflict: "chave" }
    );
  }
}

// ─── Chamada genérica à API ──────────────────────────────────────────────────
async function apiCA(path: string, token: string) {
  const res = await fetch(`${CONTA_AZUL_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Conta Azul API error ${res.status}: ${txt}`);
  }
  return res.json();
}

// ─── Sync: Vendas (faturamento) ──────────────────────────────────────────────
async function syncVendas(token: string) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1).toISOString().slice(0, 10);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

  let vendas: unknown[] = [];
  try {
    const data = await apiCA(`/sales?startDate=${inicio}&endDate=${fim}&size=200`, token);
    vendas = Array.isArray(data) ? data : data?.content ?? data?.items ?? [];
  } catch (e) {
    console.error("Erro ao buscar vendas:", e);
    return 0;
  }

  if (vendas.length === 0) return 0;

  const rows = vendas.map((v: any) => ({
    id: String(v.id ?? v.number),
    numero: v.number ?? v.id,
    cliente_nome: v.customer?.name ?? v.client?.name ?? "—",
    cliente_documento: v.customer?.document ?? v.client?.document ?? null,
    valor_total: Number(v.total ?? v.totalValue ?? 0),
    status: v.status ?? "unknown",
    data_emissao: v.emission ?? v.emissionDate ?? v.createdAt ?? null,
    data_vencimento: v.dueDate ?? null,
    observacao: v.observation ?? v.notes ?? null,
    sincronizado_em: new Date().toISOString(),
  }));

  const { error } = await supabase.from("ca_vendas").upsert(rows, { onConflict: "id" });
  if (error) console.error("Erro ao salvar vendas:", error);
  return rows.length;
}

// ─── Sync: Cobranças / Recebíveis ────────────────────────────────────────────
async function syncCobrancas(token: string) {
  const hoje = new Date();
  // Janela: 2 meses atrás até 3 meses à frente (visão futura)
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1).toISOString().slice(0, 10);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0).toISOString().slice(0, 10);

  let cobrancas: unknown[] = [];
  try {
    const data = await apiCA(`/receivables?startDate=${inicio}&endDate=${fim}&size=200`, token);
    cobrancas = Array.isArray(data) ? data : data?.content ?? data?.items ?? [];
  } catch (e) {
    console.error("Erro ao buscar cobranças:", e);
    return 0;
  }

  if (cobrancas.length === 0) return 0;

  const rows = cobrancas.map((c: any) => ({
    id: String(c.id),
    descricao: c.description ?? c.name ?? "—",
    cliente_nome: c.customer?.name ?? c.client?.name ?? null,
    valor: Number(c.value ?? c.amount ?? c.total ?? 0),
    vencimento: c.dueDate ?? c.due_date ?? null,
    status: c.status ?? "pending",
    pago_em: c.paymentDate ?? c.paid_at ?? null,
    valor_pago: Number(c.paidValue ?? c.amountPaid ?? 0),
    tipo: c.type ?? "receita",
    sincronizado_em: new Date().toISOString(),
  }));

  const { error } = await supabase.from("ca_cobrancas").upsert(rows, { onConflict: "id" });
  if (error) console.error("Erro ao salvar cobranças:", error);
  return rows.length;
}

// ─── Sync: Contratos recorrentes ─────────────────────────────────────────────
async function syncContratos(token: string) {
  let contratos: unknown[] = [];
  try {
    const data = await apiCA(`/contracts?size=200`, token);
    contratos = Array.isArray(data) ? data : data?.content ?? data?.items ?? [];
  } catch (e) {
    console.error("Erro ao buscar contratos:", e);
    return 0;
  }

  if (contratos.length === 0) return 0;

  const rows = contratos.map((c: any) => ({
    id: String(c.id),
    nome: c.name ?? c.description ?? "—",
    cliente_nome: c.customer?.name ?? c.client?.name ?? "—",
    cliente_documento: c.customer?.document ?? c.client?.document ?? null,
    valor: Number(c.value ?? c.totalValue ?? c.amount ?? 0),
    periodicidade: c.periodicity ?? c.frequency ?? null,
    status: c.status ?? "active",
    data_inicio: c.startDate ?? c.start_date ?? null,
    data_fim: c.endDate ?? c.end_date ?? null,
    sincronizado_em: new Date().toISOString(),
  }));

  const { error } = await supabase.from("ca_contratos").upsert(rows, { onConflict: "id" });
  if (error) console.error("Erro ao salvar contratos:", error);
  return rows.length;
}

// ─── Handler principal ───────────────────────────────────────────────────────
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = await getAccessToken();

    const [nVendas, nCobrancas, nContratos] = await Promise.all([
      syncVendas(token),
      syncCobrancas(token),
      syncContratos(token),
    ]);

    // Registrar última sincronização
    await supabase.from("configuracoes").upsert(
      { chave: "ca_ultimo_sync", valor: new Date().toISOString(), descricao: "Última sincronização com Conta Azul" },
      { onConflict: "chave" }
    );

    return new Response(
      JSON.stringify({ ok: true, vendas: nVendas, cobrancas: nCobrancas, contratos: nContratos }),
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
