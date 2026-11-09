import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── Configurações ───────────────────────────────────────────────
const SPREADSHEET_ID = "1XzaUutzCIzvE2Kzl-r0qCRci66qZEh_P9SQ5NG4fd1k";
const SHEET_NAME     = "BASE_CLIENTES";

// Colunas na ordem exata da planilha
const COLUMNS = [
  "ID_Cliente",
  "Nome_Condominio",
  "Endereco_Completo",
  "CNPJ",
  "Sindico_Responsavel",
  "WhatsApp",
  "Telefone_Contato",
  "Email_Principal",
  "Email_Financeiro",
  "Data_Ultima_Vistoria",
  "Status_Contrato",
  "Perfil_Tecnico",
];

// Mapeamento Supabase → Sheets
function clienteToRow(c: Record<string, unknown>): string[] {
  return [
    String(c.id              ?? ""),
    String(c.nome            ?? c.nome_condominio ?? ""),
    String(c.endereco        ?? c.endereco_completo ?? ""),
    String(c.cnpj            ?? ""),
    String(c.sindico         ?? c.sindico_responsavel ?? ""),
    String(c.whatsapp        ?? ""),
    String(c.telefone        ?? c.telefone_contato ?? ""),
    String(c.email           ?? c.email_principal ?? ""),
    String(c.email_financeiro ?? ""),
    String(c.data_ultima_vistoria ?? ""),
    String(c.status          ?? ""),
    String(c.perfil_tecnico  ?? ""),
  ];
}

// ─── Google Sheets Auth via Service Account ───────────────────────
async function getAccessToken(): Promise<string> {
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado");

  const sa = JSON.parse(serviceAccountJson);

  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss  : sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud  : "https://oauth2.googleapis.com/token",
    exp  : now + 3600,
    iat  : now,
  };

  // Assinar JWT com RSA-SHA256
  const header  = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const sigInput = `${header}.${payload}`;

  // Importar chave privada PEM
  const pemKey = sa.private_key.replace(/\\n/g, "\n");
  const pemBody = pemKey.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\n/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBytes   = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(sigInput));
  const signature  = btoa(String.fromCharCode(...new Uint8Array(sigBytes))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt        = `${sigInput}.${signature}`;

  // Trocar JWT por access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method : "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body   : `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

// ─── Helpers Sheets API ────────────────────────────────────────────
async function getSheetRows(token: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`;
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return (data.values as string[][]) ?? [];
}

async function appendRow(token: string, row: string[]): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  await fetch(url, {
    method : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body   : JSON.stringify({ values: [row] }),
  });
}

async function updateRow(token: string, rowIndex: number, row: string[]): Promise<void> {
  // rowIndex é 0-based; linha 1 é header, dados começam na 2
  const sheetRow = rowIndex + 2; // +1 header +1 para 1-based
  const range    = `${SHEET_NAME}!A${sheetRow}:L${sheetRow}`;
  const url      = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  await fetch(url, {
    method : "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body   : JSON.stringify({ range, majorDimension: "ROWS", values: [row] }),
  });
}

async function deleteRow(token: string, rowIndex: number): Promise<void> {
  // rowIndex é 0-based relativo aos dados (sem header)
  const sheetRowIndex = rowIndex + 1; // +1 pelo header (0-based do sheetId)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;

  // Precisa do sheetId numérico da aba BASE_CLIENTES
  const metaRes  = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meta     = await metaRes.json();
  const sheet    = meta.sheets?.find((s: { properties: { title: string } }) => s.properties.title === SHEET_NAME);
  const sheetId  = sheet?.properties?.sheetId ?? 0;

  await fetch(url, {
    method : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body   : JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: sheetRowIndex, endIndex: sheetRowIndex + 1 },
        },
      }],
    }),
  });
}

// ─── Handler principal ─────────────────────────────────────────────
serve(async (req) => {
  try {
    // Aceita chamada direta (POST com body) ou webhook do Supabase
    const body = await req.json() as {
      type?  : string;         // "INSERT" | "UPDATE" | "DELETE"
      record?: Record<string, unknown>;
      old_record?: Record<string, unknown>;
      // Ou chamada manual passando cliente diretamente
      cliente?: Record<string, unknown>;
      action? : string;
    };

    const eventType = body.type ?? body.action ?? "UPSERT";
    const cliente   = body.record ?? body.cliente;

    if (!cliente && eventType !== "DELETE") {
      return new Response(JSON.stringify({ error: "Nenhum cliente no payload" }), { status: 400 });
    }

    const token    = await getAccessToken();
    const allRows  = await getSheetRows(token);
    const dataRows = allRows.slice(1); // remove header

    // ID a localizar (Supabase usa 'id', planilha usa 'ID_Cliente')
    const clienteId = String(cliente?.id ?? body.old_record?.id ?? "");

    // Encontrar linha existente pelo ID_Cliente (coluna A = índice 0)
    const existingIdx = dataRows.findIndex(r => r[0] === clienteId);

    if (eventType === "DELETE") {
      if (existingIdx >= 0) await deleteRow(token, existingIdx);
    } else if (eventType === "INSERT" || existingIdx < 0) {
      // Novo cliente — append
      await appendRow(token, clienteToRow(cliente!));
    } else {
      // UPDATE — atualizar linha existente
      await updateRow(token, existingIdx, clienteToRow(cliente!));
    }

    return new Response(JSON.stringify({ ok: true, event: eventType, id: clienteId }), {
      status : 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("sync-google-sheets error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
