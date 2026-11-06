import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function escIcal(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  // RFC 5545: fold lines > 75 octets
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < line.length) {
    if (start === 0) {
      parts.push(line.slice(0, 75));
      start = 75;
    } else {
      parts.push(" " + line.slice(start, start + 74));
      start += 74;
    }
  }
  return parts.join("\r\n");
}

// Converte data/hora de Brasília (UTC-3) para UTC com sufixo Z
// Google Calendar interpreta TZID= de forma inconsistente; UTC+Z é universal
function toIcalUtc(dateStr: string, timeStr?: string | null): { value: string; allDay: boolean } {
  if (!timeStr) {
    return { value: dateStr.replace(/-/g, ""), allDay: true };
  }
  // Monta a data como se fosse horário local de Brasília (UTC-3) e converte para UTC
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  // UTC = Brasília + 3h
  const utc = new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  const value =
    `${utc.getUTCFullYear()}${pad(utc.getUTCMonth() + 1)}${pad(utc.getUTCDate())}` +
    `T${pad(utc.getUTCHours())}${pad(utc.getUTCMinutes())}00Z`;
  return { value, allDay: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Verifica token opcional de segurança (query param ?token=xxx)
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expectedToken = Deno.env.get("ICAL_SECRET_TOKEN");
  if (expectedToken && token !== expectedToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Busca atendimentos dos últimos 60 dias e próximos 365 dias
  const desde = new Date();
  desde.setDate(desde.getDate() - 60);
  const ate = new Date();
  ate.setDate(ate.getDate() + 365);

  const { data: atendimentos, error } = await supabase
    .from("atendimentos")
    .select("*")
    .gte("data_agendada", desde.toISOString().slice(0, 10))
    .lte("data_agendada", ate.toISOString().slice(0, 10))
    .order("data_agendada", { ascending: true });

  if (error) {
    console.error("[ical-feed] DB error:", error);
    return new Response("Internal error", { status: 500 });
  }

  const now = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PORTIBRAS//Sistema de Atendimentos//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:PORTIBRAS - Atendimentos",
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "X-WR-CALDESC:Agenda técnica de atendimentos PORTIBRAS",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    // Bloco VTIMEZONE obrigatório para Google Calendar reconhecer TZID=America/Sao_Paulo
    "BEGIN:VTIMEZONE",
    "TZID:America/Sao_Paulo",
    "X-LIC-LOCATION:America/Sao_Paulo",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0200",
    "TZOFFSETTO:-0300",
    "TZNAME:BRT",
    "DTSTART:19701018T000000",
    "RRULE:FREQ=YEARLY;BYDAY=3SU;BYMONTH=2",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0200",
    "TZNAME:BRST",
    "DTSTART:19701004T000000",
    "RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
  ];

  for (const a of (atendimentos ?? [])) {
    if (!a.data_agendada) continue;

    const uid = `atend-${a.id}@portibras.com.br`;
    const start = toIcalUtc(a.data_agendada, a.hora_inicio);
    const endVal = a.hora_fim
      ? toIcalUtc(a.data_agendada, a.hora_fim)
      : start.allDay
        ? { value: a.data_agendada.replace(/-/g, ""), allDay: true }
        : toIcalUtc(a.data_agendada, a.hora_inicio
            ? String(Number(a.hora_inicio.split(":")[0]) + 2).padStart(2, "0") + ":" + a.hora_inicio.split(":")[1]
            : "02:00");

    const summary = [a.titulo, a.classificacao].filter(Boolean).join(" — ");
    const descParts: string[] = [];
    if (a.status) descParts.push(`Status: ${a.status}`);
    if (a.atividade) descParts.push(`Atividade: ${a.atividade}`);
    if (a.responsaveis?.length) descParts.push(`Responsáveis: ${a.responsaveis.join(", ")}`);
    if (a.descricao) descParts.push(a.descricao);

    // Status → VEVENT STATUS
    const vcalStatus =
      a.status === "Concluído" ? "CONFIRMED" :
      a.status === "Cancelado" ? "CANCELLED" :
      a.status === "Em andamento" ? "CONFIRMED" : "TENTATIVE";

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`LAST-MODIFIED:${now}`);
    if (start.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${start.value}`);
      lines.push(`DTEND;VALUE=DATE:${endVal.value}`);
    } else {
      // UTC com Z — universalmente aceito, sem dependência de VTIMEZONE
      lines.push(`DTSTART:${start.value}`);
      lines.push(`DTEND:${endVal.value}`);
    }
    lines.push(foldLine(`SUMMARY:${escIcal(summary)}`));
    if (descParts.length) lines.push(foldLine(`DESCRIPTION:${escIcal(descParts.join("\\n"))}`));
    if (a.endereco) lines.push(foldLine(`LOCATION:${escIcal(a.endereco)}`));
    lines.push(`STATUS:${vcalStatus}`);
    // Cor por classificação (Google Calendar suporta X-APPLE-CALENDAR-COLOR e X-MICROSOFT-CDO-BUSYSTATUS mas não cores por evento via iCal padrão)
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const icsBody = lines.map(foldLine).join("\r\n") + "\r\n";

  return new Response(icsBody, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="portibras-atendimentos.ics"',
      "Cache-Control": "no-cache, max-age=3600",
    },
  });
});
