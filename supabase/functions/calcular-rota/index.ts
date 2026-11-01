import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Geocodifica um endereço via Nominatim (OpenStreetMap) → [lon, lat]
async function geocodificar(endereco: string): Promise<[number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(endereco)}&format=json&limit=1&countrycodes=br`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Portibras-Gestao/1.0 (contato@portibras.com.br)" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.length === 0) return null;
  return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
}

// Calcula rota entre dois pontos via OSRM (Open Source Routing Machine)
async function calcularRota(
  origem: [number, number],
  destino: [number, number]
): Promise<{ distancia_km: number; duracao_min: number } | null> {
  const [oLon, oLat] = origem;
  const [dLon, dLat] = destino;
  const url = `https://router.project-osrm.org/route/v1/driving/${oLon},${oLat};${dLon},${dLat}?overview=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Portibras-Gestao/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) return null;
  const rota = data.routes[0];
  return {
    distancia_km: Math.round((rota.distance / 1000) * 10) / 10, // metros → km (1 casa decimal)
    duracao_min: Math.round(rota.duration / 60),                  // segundos → minutos
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { origem, destino } = await req.json() as { origem: string; destino: string };

    if (!origem || !destino) {
      return new Response(
        JSON.stringify({ error: "origem e destino são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Geocodifica os dois endereços em paralelo
    const [coordOrigem, coordDestino] = await Promise.all([
      geocodificar(origem),
      geocodificar(destino),
    ]);

    if (!coordOrigem) {
      return new Response(
        JSON.stringify({ error: `Não foi possível encontrar o endereço de origem: "${origem}"` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!coordDestino) {
      return new Response(
        JSON.stringify({ error: `Não foi possível encontrar o endereço de destino: "${destino}"` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rota = await calcularRota(coordOrigem, coordDestino);
    if (!rota) {
      return new Response(
        JSON.stringify({ error: "Não foi possível calcular a rota entre os endereços" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ida e volta
    return new Response(
      JSON.stringify({
        distancia_km: rota.distancia_km,
        distancia_ida_volta_km: Math.round(rota.distancia_km * 2 * 10) / 10,
        duracao_min: rota.duracao_min,
        origem_encontrada: `${coordOrigem[1].toFixed(5)}, ${coordOrigem[0].toFixed(5)}`,
        destino_encontrado: `${coordDestino[1].toFixed(5)}, ${coordDestino[0].toFixed(5)}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
