import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")!;
const REDIRECT_URI = "https://odmuutijqikhzlgzjnwv.supabase.co/functions/v1/google-calendar-callback";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // user_id

  if (!code) {
    return new Response("Código OAuth ausente", { status: 400 });
  }

  // Troca o código pelo token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    return new Response(`Erro OAuth: ${tokenData.error_description}`, { status: 400 });
  }

  // Salva o token no Supabase (tabela configuracoes)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase.from("configuracoes").upsert({
    chave: "google_calendar_token",
    valor: JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
    }),
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "chave" });

  // Redireciona de volta ao painel
  return new Response(null, {
    status: 302,
    headers: {
      Location: "https://painel.portibras.com.br/painel/logistica?google_connected=true",
    },
  });
});
