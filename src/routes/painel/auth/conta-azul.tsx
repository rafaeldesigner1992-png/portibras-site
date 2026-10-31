import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/painel/auth/conta-azul")({
  component: ContaAzulCallback,
});

const CLIENT_ID = "fmqdoaoovj40498lfpg739pos";
const CLIENT_SECRET = "gseh8ikddi2l7gie3tg2olif2na5oh3d03lfubajfl589d2rgb0";
const REDIRECT_URI = `${window.location.origin}/painel/auth/conta-azul`;
const TOKEN_URL = "https://api.contaazul.com/auth/token";
const AUTH_URL = "https://api.contaazul.com/auth/authorize";

function ContaAzulCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      setStatus("error");
      setMsg("Autorização negada: " + error);
      return;
    }

    if (code) {
      trocarCodigo(code);
    }
  }, []);

  async function trocarCodigo(code: string) {
    setStatus("loading");
    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error("Erro ao trocar código: " + txt);
      }

      const token = await res.json();
      const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

      await supabase.from("configuracoes").upsert([
        { chave: "ca_access_token", valor: token.access_token, descricao: "Conta Azul OAuth2 access token" },
        { chave: "ca_refresh_token", valor: token.refresh_token, descricao: "Conta Azul OAuth2 refresh token" },
        { chave: "ca_token_expires_at", valor: expiresAt, descricao: "Conta Azul token expira em" },
      ], { onConflict: "chave" });

      // Dispara primeiro sync
      await supabase.functions.invoke("sync-conta-azul");

      setStatus("success");
      setMsg("Conta Azul conectado com sucesso! Sincronizando dados…");
      setTimeout(() => navigate({ to: "/painel/financeiro" }), 2500);
    } catch (e: any) {
      setStatus("error");
      setMsg(e.message);
    }
  }

  function iniciarAuth() {
    const url = new URL(AUTH_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    // Conta Azul usa vírgula como separador de escopos
    url.searchParams.set("scope", "sales,receivables,contracts");
    window.location.href = url.toString();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <div className="mb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
            <span className="text-3xl">💙</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Conta Azul</h1>
          <p className="mt-1 text-sm text-gray-500">Integração com o sistema de gestão</p>
        </div>

        {status === "idle" && (
          <>
            <p className="mb-6 text-sm text-gray-600">
              Autorize o acesso ao Conta Azul para sincronizar vendas, cobranças e contratos automaticamente.
            </p>
            <button
              onClick={iniciarAuth}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Conectar Conta Azul
            </button>
          </>
        )}

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600">Conectando ao Conta Azul…</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium text-green-700">{msg}</p>
            <p className="text-xs text-gray-400">Redirecionando para o Financeiro…</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-10 w-10 text-red-500" />
            <p className="text-sm text-red-600">{msg}</p>
            <button
              onClick={iniciarAuth}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
