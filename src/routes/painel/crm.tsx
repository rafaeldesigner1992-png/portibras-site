import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Search, Phone, Mail, MoreVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/crm")({
  component: CrmPage,
});

type Etapa = "prospecto" | "contato" | "proposta" | "negociacao" | "fechado" | "perdido";
interface Lead {
  id: string;
  nome: string;
  empresa: string;
  telefone: string;
  email: string;
  etapa: Etapa;
  valor_estimado: number | null;
  observacoes: string;
  criado_em: string;
}

const ETAPAS: Record<Etapa, { label: string; cor: string; bg: string }> = {
  prospecto:   { label: "Prospecto",   cor: "text-gray-600",   bg: "bg-gray-100" },
  contato:     { label: "Em Contato",  cor: "text-blue-700",   bg: "bg-blue-100" },
  proposta:    { label: "Proposta",    cor: "text-purple-700", bg: "bg-purple-100" },
  negociacao:  { label: "Negociação",  cor: "text-orange-700", bg: "bg-orange-100" },
  fechado:     { label: "Fechado ✓",   cor: "text-green-700",  bg: "bg-green-100" },
  perdido:     { label: "Perdido",     cor: "text-red-700",    bg: "bg-red-100" },
};

function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [selecionado, setSelecionado] = useState<Lead | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Lead>>({
    nome: "", empresa: "", telefone: "", email: "",
    etapa: "prospecto", valor_estimado: null, observacoes: ""
  });

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from("crm_leads").select("*").order("criado_em", { ascending: false });
    if (data) setLeads(data as Lead[]);
    setCarregando(false);
  }

  function abrir(lead?: Lead) {
    if (lead) {
      setSelecionado(lead);
      setForm({ ...lead });
    } else {
      setSelecionado(null);
      setForm({ nome: "", empresa: "", telefone: "", email: "", etapa: "prospecto", valor_estimado: null, observacoes: "" });
    }
    setModal(true);
    setMenuAberto(null);
  }

  async function salvar() {
    if (!form.nome?.trim()) return;
    if (selecionado) {
      await supabase.from("crm_leads").update(form).eq("id", selecionado.id);
    } else {
      await supabase.from("crm_leads").insert(form);
    }
    setModal(false);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este lead?")) return;
    await supabase.from("crm_leads").delete().eq("id", id);
    setMenuAberto(null);
    carregar();
  }

  const filtrados = leads.filter(l =>
    l.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    l.empresa?.toLowerCase().includes(busca.toLowerCase())
  );

  // Contagem por etapa
  const porEtapa = Object.keys(ETAPAS).reduce((acc, e) => {
    acc[e as Etapa] = filtrados.filter(l => l.etapa === e).length;
    return acc;
  }, {} as Record<Etapa, number>);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Comercial</h1>
          <p className="mt-1 text-sm text-gray-500">{leads.length} lead{leads.length !== 1 ? "s" : ""} na pipeline</p>
        </div>
        <button
          onClick={() => abrir()}
          className="flex items-center gap-2 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#155824]"
        >
          <Plus className="h-4 w-4" />
          Novo Lead
        </button>
      </div>

      {/* Etapas resumo */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {(Object.entries(ETAPAS) as [Etapa, typeof ETAPAS[Etapa]][]).map(([etapa, cfg]) => (
          <div key={etapa} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", cfg.bg, cfg.cor)}>
            {cfg.label} <span className="font-bold">({porEtapa[etapa] || 0})</span>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="mb-4 relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar lead…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
        />
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {carregando ? (
          <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <p className="text-sm">Nenhum lead encontrado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Lead</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Contato</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Etapa</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Valor Est.</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map((lead) => {
                const cfg = ETAPAS[lead.etapa];
                return (
                  <tr key={lead.id} className="hover:bg-gray-50/60">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{lead.nome}</p>
                      <p className="text-xs text-gray-400">{lead.empresa}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {lead.telefone && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone className="h-3 w-3" />{lead.telefone}</span>}
                        {lead.email && <span className="flex items-center gap-1 text-xs text-gray-500"><Mail className="h-3 w-3" />{lead.email}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", cfg.bg, cfg.cor)}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {lead.valor_estimado
                        ? lead.valor_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative flex justify-end">
                        <button onClick={() => setMenuAberto(menuAberto === lead.id ? null : lead.id)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuAberto === lead.id && (
                          <div className="absolute right-0 top-8 z-10 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                            <button onClick={() => abrir(lead)} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Editar</button>
                            <button onClick={() => excluir(lead.id)} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50">Excluir</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selecionado ? "Editar Lead" : "Novo Lead"}</h2>
              <button onClick={() => setModal(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: "Nome do cliente *", field: "nome", type: "text" },
                { label: "Empresa", field: "empresa", type: "text" },
                { label: "Telefone / WhatsApp", field: "telefone", type: "tel" },
                { label: "E-mail", field: "email", type: "email" },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
                  <input
                    type={type}
                    value={(form as Record<string, unknown>)[field] as string || ""}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] focus:ring-2 focus:ring-[#1a6b2f]/20"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Etapa</label>
                <select
                  value={form.etapa}
                  onChange={(e) => setForm({ ...form, etapa: e.target.value as Etapa })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]"
                >
                  {(Object.entries(ETAPAS) as [Etapa, typeof ETAPAS[Etapa]][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Valor estimado (R$)</label>
                <input
                  type="number"
                  value={form.valor_estimado ?? ""}
                  onChange={(e) => setForm({ ...form, valor_estimado: e.target.value ? Number(e.target.value) : null })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Observações</label>
                <textarea
                  rows={3}
                  value={form.observacoes ?? ""}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1a6b2f] resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={salvar} className="flex-1 rounded-lg bg-[#1a6b2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155824]">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {menuAberto && <div className="fixed inset-0 z-0" onClick={() => setMenuAberto(null)} />}
    </div>
  );
}
