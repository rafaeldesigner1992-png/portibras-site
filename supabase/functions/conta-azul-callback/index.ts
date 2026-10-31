// Edge Function: conta-azul-callback
// Recebe o authorization code e troca pelo access_token no servidor
// (evita CORS — o browser não pode chamar diretamente a API do Conta Azul)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("CONTA_AZUL_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("CONTA_AZUL_CLIENT_SECRET")!;
const TOKEN_URL = "https://api.contaazul.com/auth/token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, redirect_uri } = await req.json();

    if (!code || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: "code e redirect_uri são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Conta Azul (Cognito) exige JSON no body + Basic Auth no header
    const basicAuth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri,
      }),
    });

    const tokenText = await tokenRes.text();

    if (!tokenRes.ok) {
      console.error("Erro token Conta Azul:", tokenRes.status, tokenText);
      return new Response(
        JSON.stringify({ error: `Conta Azul retornou ${tokenRes.status}: ${tokenText}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = JSON.parse(tokenText);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    // Salva os tokens no Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
