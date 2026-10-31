import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Busca token salvo
  const { data: config } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "google_calendar_token")
    .single();

  if (!config) {
    return new Response(JSON.stringify({ error: "not_connected" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let tokenData = JSON.parse(config.valor);
  let accessToken = tokenData.access_token;

  // Verifica se expirou e renova
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt <= new Date()) {
    accessToken = await refreshAccessToken(tokenData.refresh_token);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "token_expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Atualiza token no banco
    const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    await supabase.from("configuracoes").upsert({
      chave: "google_calendar_token",
      valor: JSON.stringify({ ...tokenData, access_token: accessToken, expires_at: newExpiresAt }),
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "chave" });
  }

  // Busca eventos dos próximos 30 dias
  const now = new Date().toISOString();
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/adm.rfiresistemas%40gmail.com/events?timeMin=${now}&timeMax=${thirtyDays}&singleEvents=true&orderBy=startTime&maxResults=50`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const calData = await calRes.json();

  if (!calRes.ok) {
    return new Response(JSON.stringify({ error: calData.error?.message }), {
      status: calRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventos = (calData.items || []).map((e: any) => ({
    id: e.id,
    titulo: e.summary || "(Sem título)",
    inicio: e.start?.dateTime || e.start?.date,
    fim: e.end?.dateTime || e.end?.date,
    local: e.location || null,
    descricao: e.description || null,
    cor: e.colorId || null,
    link: e.htmlLink,
    dia_todo: !e.start?.dateTime,
  }));

  return new Response(JSON.stringify({ eventos }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
