// Edge Function: sync-conta-azul
// Autentica via OAuth2 no Conta Azul e sincroniza vendas, cobranças e contratos
// Invoke: POST /functions/v1/sync-conta-azul

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
      await salvarToken(token);
      return token.access_token;
    }

    const errText = await res.text().catch(() => "");
    console.error("Falha ao renovar token:", res.status, errText);
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

// ─── Helper: busca todas as páginas de um endpoint paginado ──────────────────
async function fetchAllPages(baseUrl: string, token: string, pageSize = 200): Promise<unknown[]> {
  const all: unknown[] = [];
  let pagina = 1;
  while (true) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const data = await apiCA(`${baseUrl}${sep}pagina=${pagina}&tamanho_pagina=${pageSize}`, token);
    const items: unknown[] = Array.isArray(data) ? data : data?.itens ?? data?.content ?? data?.items ?? data?.data ?? [];
    all.push(...items);
    const total: number = data?.itens_totais ?? data?.total ?? items.length;
    if (all.length >= total || items.length < pageSize) break;
    pagina++;
    if (pagina > 20) break; // segurança: max 4000 registros
  }
  return all;
}

// ─── Sync: Vendas ─────────────────────────────────────────────────────────────
// Endpoint correto: GET /v1/venda/busca (não /v1/vendas)
async function syncVendas(token: string) {
  let vendas: unknown[] = [];
  try {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1).toISOString().slice(0, 10);
    const fim = hoje.toISOString().slice(0, 10);

    const data = await apiCA(
      `/v1/venda/busca?data_inicio=${inicio}&data_fim=${fim}&pagina=1&tamanho_pagina=200`,
      token
    );
    vendas = Array.isArray(data) ? data : data?.content ?? data?.items ?? data?.vendas ?? data?.data ?? [];
  } catch (e) {
    console.error("Erro ao buscar vendas:", e);
    return 0;
  }

  if (vendas.length === 0) return 0;

  const rows = (vendas as any[]).map((v) => ({
    id: String(v.id ?? v.numero),
    numero: v.numero ?? v.number ?? v.id,
    cliente_nome: v.cliente?.nome ?? v.customer?.name ?? v.cliente_nome ?? "—",
    cliente_documento: v.cliente?.documento ?? v.customer?.document ?? null,
    valor_total: Number(v.valor_total ?? v.total ?? v.totalValue ?? 0),
    status: v.situacao ?? v.status ?? "unknown",
    data_emissao: v.data_emissao ?? v.emission ?? v.emissionDate ?? v.data ?? null,
    data_vencimento: v.data_vencimento ?? v.dueDate ?? null,
    observacao: v.observacao ?? v.observation ?? null,
    sincronizado_em: new Date().toISOString(),
  }));

  const { error } = await supabase.from("ca_vendas").upsert(rows, { onConflict: "id" });
  if (error) console.error("Erro ao salvar vendas:", error);
  return rows.length;
}

// ─── Sync: Cobranças / Recebíveis ────────────────────────────────────────────
// Endpoint correto (OpenAPI oficial): GET /v1/financeiro/eventos-financeiros/contas-a-receber/buscar
async function syncCobrancas(token: string) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 6, 1).toISOString().slice(0, 10);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 6, 0).toISOString().slice(0, 10);

  let cobrancas: unknown[] = [];
  try {
    cobrancas = await fetchAllPages(
      `/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?data_vencimento_de=${inicio}&data_vencimento_ate=${fim}`,
      token
    );
  } catch (e) {
    console.error("Erro ao buscar cobranças:", e);
    return 0;
  }

  if (cobrancas.length === 0) return 0;

  const rows = (cobrancas as any[]).map((c) => ({
    id: String(c.id),
    descricao: c.descricao ?? c.description ?? c.name ?? "—",
    cliente_nome: c.cliente?.nome ?? c.customer?.name ?? c.client?.name ?? null,
    valor: Number(c.total ?? c.valor ?? c.value ?? c.amount ?? 0),
    vencimento: c.data_vencimento ?? c.vencimento ?? c.dueDate ?? c.due_date ?? null,
    status: c.status ?? c.situacao ?? "pending",
    pago_em: c.data_pagamento ?? c.paymentDate ?? c.paid_at ?? null,
    valor_pago: Number(c.pago ?? c.valor_pago ?? c.paidValue ?? c.amountPaid ?? 0),
    tipo: "receita",
    sincronizado_em: new Date().toISOString(),
  }));

  const { error } = await supabase.from("ca_cobrancas").upsert(rows, { onConflict: "id" });
  if (error) console.error("Erro ao salvar cobranças:", error);
  return rows.length;
}

// ─── Sync: Contas a Pagar ─────────────────────────────────────────────────────
// Endpoint correto (OpenAPI oficial): GET /v1/financeiro/eventos-financeiros/contas-a-pagar/buscar
async function syncContasPagar(token: string) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 6, 1).toISOString().slice(0, 10);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 6, 0).toISOString().slice(0, 10);

  let contas: unknown[] = [];
  try {
    contas = await fetchAllPages(
      `/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?data_vencimento_de=${inicio}&data_vencimento_ate=${fim}`,
      token
    );
  } catch (e) {
    console.error("Erro ao buscar contas a pagar:", e);
    return 0;
  }

  if (contas.length === 0) return 0;

  const rows = (contas as any[]).map((c) => ({
    id: String(c.id),
    descricao: c.descricao ?? c.description ?? c.name ?? "—",
    fornecedor_nome: c.fornecedor?.nome ?? c.supplier?.name ?? c.vendor?.name ?? null,
    valor: Number(c.total ?? c.valor ?? c.value ?? c.amount ?? 0),
    vencimento: c.data_vencimento ?? c.vencimento ?? c.dueDate ?? c.due_date ?? null,
    status: c.status ?? c.situacao ?? "pending",
    pago_em: c.data_pagamento ?? c.paymentDate ?? c.paid_at ?? null,
    valor_pago: Number(c.pago ?? c.valor_pago ?? c.paidValue ?? c.amountPaid ?? 0),
    categoria: c.categorias?.[0]?.nome ?? c.categoria?.nome ?? c.category?.name ?? null,
    sincronizado_em: new Date().toISOString(),
  }));

  const { error } = await supabase.from("ca_contas_pagar").upsert(rows, { onConflict: "id" });
  if (error) console.error("Erro ao salvar contas a pagar:", error);
  return rows.length;
}

// ─── Sync: Saldos das contas bancárias ──────────────────────────────────────
// Endpoint: GET /v1/conta-financeira (sem parâmetros obrigatórios; paginação opcional)
// Saldo individual: GET /v1/conta-financeira/{id}/saldo-atual → { saldo_atual: number }
async function syncSaldos(token: string) {
  let contas: unknown[] = [];
  try {
    // Tenta sem paginação primeiro; se não funcionar, tenta com pagina/tamanho_pagina
    let data: unknown;
    try {
      data = await apiCA(`/v1/conta-financeira`, token);
    } catch (e1) {
      console.log("conta-financeira sem params falhou, tentando com paginação:", String(e1));
      data = await apiCA(`/v1/conta-financeira?pagina=1&tamanho_pagina=50`, token);
    }
    contas = Array.isArray(data) ? data : (data as any)?.itens ?? (data as any)?.content ?? (data as any)?.items ?? (data as any)?.data ?? (data as any)?.contasFinanceiras ?? [];
  } catch (e) {
    console.error("Erro ao buscar saldos:", e);
    return 0;
  }

  if (contas.length === 0) return 0;

  // Para cada conta, tenta buscar o saldo atual
  const rows = await Promise.all((contas as any[]).map(async (c) => {
    let saldoAtual = Number(c.saldo ?? c.saldo_atual ?? c.balance ?? c.currentBalance ?? 0);
    try {
      const saldoRes = await apiCA(`/v1/conta-financeira/${c.id}/saldo-atual`, token);
      // A API retorna { saldo_atual: number } conforme documentação
      if (saldoRes?.saldo_atual !== undefined) saldoAtual = Number(saldoRes.saldo_atual);
      else if (saldoRes?.saldo !== undefined) saldoAtual = Number(saldoRes.saldo);
    } catch {
      // usa o saldo do objeto da conta se não conseguir buscar individualmente
    }
    return {
      id: String(c.id),
      nome: c.nome ?? c.name ?? c.descricao ?? c.description ?? "Conta",
      tipo: c.tipo ?? c.type ?? c.bankAccountType ?? "corrente",
      saldo: saldoAtual,
      banco: c.banco ?? c.bankCode ?? c.bank ?? null,
      agencia: c.agencia ?? c.agency ?? c.branchNumber ?? null,
      conta: c.numero_conta ?? c.accountNumber ?? c.account ?? null,
      ativo: c.ativo !== false && c.active !== false,
      sincronizado_em: new Date().toISOString(),
    };
  }));

  const { error } = await supabase.from("ca_saldos").upsert(rows, { onConflict: "id" });
  if (error) console.error("Erro ao salvar saldos:", error);
  return rows.length;
}

// ─── Sync: Contratos ──────────────────────────────────────────────────────────
// Endpoint: GET /v1/contratos — data_inicio e data_fim são OBRIGATÓRIOS
// Nota: a API pode retornar 400 "Data de início da recorrência não pode ser nula"
// se o campo data_inicio_recorrencia for esperado (undocumented). Tentamos ambos.
async function syncContratos(token: string) {
  let contratos: unknown[] = [];
  try {
    const hoje = new Date();
    // Busca contratos com início há 2 anos e fim daqui a 3 anos (cobre ativos e históricos recentes)
    const inicio = new Date(hoje.getFullYear() - 2, hoje.getMonth(), 1).toISOString().slice(0, 10);
    const fim = new Date(hoje.getFullYear() + 3, hoje.getMonth(), 1).toISOString().slice(0, 10);

    // Endpoint documentado: data_inicio e data_fim (data_inicio_recorrencia sempre retorna 400)
    const data = await apiCA(
      `/v1/contratos?data_inicio=${inicio}&data_fim=${fim}&pagina=1&tamanho_pagina=50`,
      token
    );
    contratos = Array.isArray(data) ? data : (data as any)?.itens ?? (data as any)?.content ?? (data as any)?.items ?? (data as any)?.contratos ?? (data as any)?.data ?? [];
  } catch (e) {
    console.error("Erro ao buscar contratos:", e);
    return 0;
  }

  if (contratos.length === 0) return 0;

  // Log do primeiro contrato para diagnóstico de campos
  if (contratos.length > 0) {
    console.log("[syncContratos] Exemplo de contrato recebido:", JSON.stringify(contratos[0], null, 2));
  }

  const rows = (contratos as any[]).map((c) => ({
    id: String(c.id),
    nome: c.nome ?? c.name ?? c.descricao ?? c.description ?? "—",
    cliente_nome: c.cliente?.nome ?? c.customer?.name ?? c.client?.name ?? "—",
    cliente_documento: c.cliente?.documento ?? c.customer?.document ?? c.client?.document ?? null,
    // Campo confirmado via debug: total_proximo_vencimento contém o valor do contrato
    valor: Number(
      c.total_proximo_vencimento ?? c.valor_mensal ?? c.valor_recorrente ??
      c.valor ?? c.value ?? c.totalValue ?? 0
    ),
    periodicidade: c.periodicidade ?? c.periodicity ?? c.frequencia ?? c.frequency ?? null,
    status: c.status ?? c.situacao ?? "ATIVO",
    // data_inicio vem como "2026-03-01" (string simples, sem timezone)
    data_inicio: c.data_inicio ?? c.data_inicio_recorrencia ?? c.startDate ?? null,
    // data_fim está dentro de c.termos.data_fim conforme JSON da API
    data_fim: c.termos?.data_fim ?? c.data_fim ?? c.data_fim_recorrencia ?? c.data_termino ?? null,
    // proximo_vencimento confirmado no JSON
    proximo_vencimento: c.proximo_vencimento ?? c.data_proxima_cobranca ?? null,
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

    // Modo debug: retorna resposta bruta de cada endpoint
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* sem body */ }

    if (body.debug) {
      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear() - 2, hoje.getMonth(), 1).toISOString().slice(0, 10);
      const fim = new Date(hoje.getFullYear() + 3, hoje.getMonth(), 1).toISOString().slice(0, 10);
      const dataInicioCobranca = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1).toISOString().slice(0, 10);
      const dataFimCobranca = new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0).toISOString().slice(0, 10);

      const endpoints = [
        `/v1/venda/busca?data_inicio=${dataInicioCobranca}&data_fim=${hoje.toISOString().slice(0,10)}&pagina=1&tamanho_pagina=5`,
        `/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?data_vencimento_de=${dataInicioCobranca}&data_vencimento_ate=${dataFimCobranca}&pagina=1&tamanho_pagina=5`,
        `/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?data_vencimento_de=${dataInicioCobranca}&data_vencimento_ate=${dataFimCobranca}&pagina=1&tamanho_pagina=5`,
        `/v1/contratos?data_inicio_recorrencia=${inicio}&data_fim_recorrencia=${fim}&pagina=1&tamanho_pagina=5`,
        `/v1/contratos?data_inicio=${inicio}&data_fim=${fim}&pagina=1&tamanho_pagina=5`,
        `/v1/conta-financeira`,
      ];

      const results: Record<string, unknown> = {};
      for (const path of endpoints) {
        try {
          const r = await fetch(`${CONTA_AZUL_BASE}${path}`, {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          });
          const txt = await r.text();
          results[path] = { status: r.status, body: txt.substring(0, 500) };
        } catch (e) {
          results[path] = { error: String(e) };
        }
      }
      return new Response(JSON.stringify(results, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [nVendas, nCobrancas, nContratos, nSaldos, nContasPagar] = await Promise.all([
      syncVendas(token),
      syncCobrancas(token),
      syncContratos(token),
      syncSaldos(token),
      syncContasPagar(token),
    ]);

    await supabase.from("configuracoes").upsert(
      { chave: "ca_ultimo_sync", valor: new Date().toISOString(), descricao: "Última sincronização com Conta Azul" },
      { onConflict: "chave" }
    );

    return new Response(
      JSON.stringify({ ok: true, vendas: nVendas, cobrancas: nCobrancas, contratos: nContratos, saldos: nSaldos, contas_pagar: nContasPagar }),
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
