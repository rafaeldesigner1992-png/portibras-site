/**
 * hunter-scrape — Edge Function
 * Busca empresas no Google Maps via Apify (run-sync-get-dataset-items).
 * Usa o endpoint síncrono do Apify: retorna os itens direto, sem polling.
 *
 * POST /functions/v1/hunter-scrape
 * Body: { query: string, cidade: string, bairro?: string, maxItems?: number }
 * Retorna: { results: Resultado[] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APIFY_ACTOR = "compass~crawler-google-places";
const APIFY_BASE  = "https://api.apify.com/v2";

interface ApifyPlace {
  title?: string;
  name?: string;
  totalScore?: number;
  reviewsCount?: number;
  categoryName?: string;
  address?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  phoneUnformatted?: string;
  phone?: string;
  website?: string;
  url?: string;
  emails?: string[];
  location?: { lat: number; lng: number };
}

interface Resultado {
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  categoria: string;
  rating: number | null;
  reviews: number | null;
  website: string;
  maps_url: string;
  lat: number | null;
  lon: number | null;
}

function mapPlace(p: ApifyPlace): Resultado {
  const endFull = p.street || p.address || "";
  return {
    nome:      p.title || p.name || "",
    telefone:  p.phoneUnformatted || p.phone || "",
    email:     p.emails?.[0] || "",
    endereco:  endFull,
    categoria: p.categoryName || "",
    rating:    p.totalScore ?? null,
    reviews:   p.reviewsCount ?? null,
    website:   p.website || "",
    maps_url:  p.url || "",
    lat:       p.location?.lat ?? null,
    lon:       p.location?.lng ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const token = Deno.env.get("APIFY_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "APIFY_TOKEN não configurado no Supabase." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const rawText = await req.text();
    if (!rawText || rawText.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Body vazio recebido pela Edge Function." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    const body = JSON.parse(rawText);
    const { query, cidade, bairro, maxItems = 20 } = body;

    if (!query || !cidade) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: query, cidade." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const searchQuery = bairro
      ? `${query} em ${bairro}, ${cidade}, Brasil`
      : `${query} em ${cidade}, Brasil`;

    const max = Math.min(maxItems, 50);

    // Endpoint síncrono: bloqueia até terminar e retorna os itens diretamente
    // timeout=120 segundos (limite seguro para Edge Function do Supabase Free)
    const url = `${APIFY_BASE}/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=120&memory=256`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStringsArray: [searchQuery],
        maxCrawledPlacesPerSearch: max,
        language: "pt-BR",
        countryCode: "BR",
        includeHistogram: false,
        includeOpeningHours: false,
        includePeopleAlsoSearch: false,
        maxImages: 0,
        exportPlaceUrls: false,
        additionalInfo: false,
        scrapeDirectories: false,
        deeperCityScrape: false,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({ error: `Apify retornou ${resp.status}: ${errText}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const items: ApifyPlace[] = await resp.json();
    const results = items.map(mapPlace).filter(r => r.nome);

    return new Response(
      JSON.stringify({ results, total: results.length }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
