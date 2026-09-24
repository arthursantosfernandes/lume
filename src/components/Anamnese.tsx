"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profissional } from "@/lib/useProfissional";
import { formatarDataHora } from "@/lib/utils";

/**
 * Anamnese estética.
 * Cada vez que salva, cria uma NOVA versão (a anterior fica guardada no histórico).
 * Assim nada é apagado e dá para ver como a paciente estava em cada época.
 */

type Anamnese = {
  id?: string;
  created_at?: string;
  queixa_principal: string;
  objetivos: string;
  fototipo: string;
  tipo_pele: string;
  alergias: string;
  medicamentos_em_uso: string;
  doencas_preexistentes: string;
  gestante_lactante: boolean | null;
  doenca_neuromuscular: boolean | null;
  disturbio_coagulacao: boolean | null;
  historico_queloide: boolean | null;
  herpes_recorrente: boolean | null;
  procedimentos_anteriores: string;
  cirurgias_anteriores: string;
  habitos: string;
  contraindicacoes: string;
};

const VAZIA: Anamnese = {
  queixa_principal: "", objetivos: "", fototipo: "", tipo_pele: "", alergias: "",
  medicamentos_em_uso: "", doencas_preexistentes: "", gestante_lactante: null,
  doenca_neuromuscular: null, disturbio_coagulacao: null, historico_queloide: null,
  herpes_recorrente: null, procedimentos_anteriores: "", cirurgias_anteriores: "",
  habitos: "", contraindicacoes: "",
};

const CHECKLIST: { chave: keyof Anamnese; pergunta: string }[] = [
  { chave: "gestante_lactante", pergunta: "Gestante ou amamentando?" },
  { chave: "doenca_neuromuscular", pergunta: "Doença neuromuscular (ex: miastenia)?" },
  { chave: "disturbio_coagulacao", pergunta: "Distúrbio de coagulação ou usa anticoagulante?" },
  { chave: "historico_queloide", pergunta: "Histórico de queloide / cicatriz hipertrófica?" },
  { chave: "herpes_recorrente", pergunta: "Herpes labial recorrente?" },
];

const FOTOTIPOS = [
  { v: "I", d: "I — muito clara, sempre queima" },
  { v: "II", d: "II — clara, queima fácil" },
  { v: "III", d: "III — morena clara" },
  { v: "IV", d: "IV — morena moderada" },
  { v: "V", d: "V — morena escura" },
  { v: "VI", d: "VI — negra" },
];

const TIPOS_PELE = ["Normal", "Seca", "Oleosa", "Mista", "Sensível"];

// Converte os dados do banco (null) para o formulário ("")
function paraFormulario(dados: Record<string, unknown>): Anamnese {
  const f = { ...VAZIA } as Record<string, unknown>;
  for (const k of Object.keys(VAZIA)) {
    const v = dados[k];
    f[k] = typeof (VAZIA as Record<string, unknown>)[k] === "string" ? (v ?? "") : (v ?? null);
  }
  f.id = dados.id;
  f.created_at = dados.created_at;
  return f as Anamnese;
}

export function AnamneseAba({ pacienteId, profissional }: { pacienteId: string; profissional: Profissional }) {
  const [form, setForm] = useState<Anamnese>(VAZIA);
  const [ultima, setUltima] = useState<Anamnese | null>(null);
  const [versoes, setVersoes] = useState(0);
  const [editando, setEditando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function carregar() {
    const { data } = await supabase
      .from("anamneses")
      .select("*")
      .eq("patient_id", pacienteId)
      .order("created_at", { ascending: false });
    const lista = data ?? [];
    setVersoes(lista.length);
    if (lista.length > 0) {
      const a = paraFormulario(lista[0]);
      setUltima(a);
      setForm(a);
    } else {
      setEditando(true);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const texto = (chave: keyof Anamnese) => ({
    value: (form[chave] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [chave]: e.target.value }),
  });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    const registro: Record<string, unknown> = {
      clinic_id: profissional.clinic_id,
      patient_id: pacienteId,
      created_by: profissional.id,
    };
    for (const k of Object.keys(VAZIA) as (keyof Anamnese)[]) {
      const v = form[k];
      registro[k] = typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v;
    }
    const { error } = await supabase.from("anamneses").insert(registro);
    setSalvando(false);
    if (error) return setErro(error.message);
    setEditando(false);
    await carregar();
  }

  if (carregando) return <p className="py-8 text-center text-tinta/50">Carregando…</p>;

  // ---------- Modo visualização ----------
  if (!editando && ultima) {
    const alertas = CHECKLIST.filter((c) => ultima[c.chave] === true);
    const linhas: [string, string][] = [
      ["Queixa principal", ultima.queixa_principal],
      ["Objetivos / necessidades", ultima.objetivos],
      ["Fototipo", ultima.fototipo ? `Fitzpatrick ${ultima.fototipo}` : ""],
      ["Tipo de pele", ultima.tipo_pele],
      ["Alergias", ultima.alergias],
      ["Medicamentos em uso", ultima.medicamentos_em_uso],
      ["Doenças preexistentes", ultima.doencas_preexistentes],
      ["Procedimentos anteriores", ultima.procedimentos_anteriores],
      ["Cirurgias anteriores", ultima.cirurgias_anteriores],
      ["Hábitos", ultima.habitos],
      ["Contraindicações / observações", ultima.contraindicacoes],
    ];
    return (
      <div className="space-y-4">
        {alertas.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="mb-1 font-semibold">⚠ Atenção</p>
            <ul className="list-inside list-disc">
              {alertas.map((a) => <li key={a.chave}>{a.pergunta.replace("?", "")}: sim</li>)}
            </ul>
          </div>
        )}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs uppercase tracking-wide text-tinta/50">Checklist de saúde</p>
          <ul className="space-y-1 text-sm">
            {CHECKLIST.map((c) => {
              const v = ultima[c.chave];
              return (
                <li key={c.chave} className="flex justify-between gap-3">
                  <span>{c.pergunta}</span>
                  <span className={`shrink-0 font-medium ${v === true ? "text-amber-700" : v === false ? "text-salvia-escuro" : "text-tinta/40"}`}>
                    {v === true ? "Sim" : v === false ? "Não" : "Não respondido"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <dl className="divide-y divide-black/5 rounded-2xl bg-white px-4 shadow-sm">
          {linhas.map(([r, v]) => (
            <div key={r} className="py-3">
              <dt className="text-xs uppercase tracking-wide text-tinta/50">{r}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap">{v || "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="text-center text-xs text-tinta/50">
          Atualizada em {ultima.created_at ? formatarDataHora(ultima.created_at) : "—"}
          {versoes > 1 ? ` · ${versoes} versões no histórico` : ""}
        </p>
        <button className="botao-sec" onClick={() => setEditando(true)}>Atualizar anamnese</button>
      </div>
    );
  }

  // ---------- Modo edição ----------
  return (
    <form onSubmit={salvar} className="space-y-5">
      <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Queixa e objetivos</h2>
        <div>
          <label className="rotulo">Queixa principal</label>
          <textarea className="campo min-h-20" {...texto("queixa_principal")} />
        </div>
        <div>
          <label className="rotulo">Objetivos / necessidades da paciente</label>
          <textarea className="campo min-h-20" {...texto("objetivos")} />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Pele</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo">Fototipo (Fitzpatrick)</label>
            <select className="campo" {...texto("fototipo")}>
              <option value="">Selecione…</option>
              {FOTOTIPOS.map((f) => <option key={f.v} value={f.v}>{f.d}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo">Tipo de pele</label>
            <select className="campo" {...texto("tipo_pele")}>
              <option value="">Selecione…</option>
              {TIPOS_PELE.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Checklist de saúde</h2>
        {CHECKLIST.map((c) => (
          <div key={c.chave} className="flex items-center justify-between gap-3 border-b border-black/5 pb-3 last:border-0">
            <span className="text-sm">{c.pergunta}</span>
            <div className="flex shrink-0 gap-1">
              {[
                { v: true, t: "Sim" },
                { v: false, t: "Não" },
              ].map((op) => (
                <button type="button" key={op.t}
                  onClick={() => setForm({ ...form, [c.chave]: form[c.chave] === op.v ? null : op.v })}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    form[c.chave] === op.v
                      ? op.v ? "bg-amber-500 text-white" : "bg-salvia text-white"
                      : "bg-creme text-tinta/60"
                  }`}>
                  {op.t}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div>
          <label className="rotulo">Alergias</label>
          <input className="campo" placeholder="Medicamentos, látex, lidocaína, albumina…" {...texto("alergias")} />
        </div>
        <div>
          <label className="rotulo">Medicamentos em uso</label>
          <input className="campo" {...texto("medicamentos_em_uso")} />
        </div>
        <div>
          <label className="rotulo">Doenças preexistentes</label>
          <input className="campo" {...texto("doencas_preexistentes")} />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Histórico e hábitos</h2>
        <div>
          <label className="rotulo">Procedimentos estéticos anteriores</label>
          <textarea className="campo min-h-20" placeholder="O quê, quando e onde" {...texto("procedimentos_anteriores")} />
        </div>
        <div>
          <label className="rotulo">Cirurgias anteriores</label>
          <input className="campo" {...texto("cirurgias_anteriores")} />
        </div>
        <div>
          <label className="rotulo">Hábitos</label>
          <input className="campo" placeholder="Tabagismo, álcool, exposição solar, atividade física…" {...texto("habitos")} />
        </div>
        <div>
          <label className="rotulo">Contraindicações / observações</label>
          <textarea className="campo min-h-20" {...texto("contraindicacoes")} />
        </div>
      </section>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <div className="flex gap-3">
        {ultima && (
          <button type="button" className="botao-sec" onClick={() => { setForm(ultima); setEditando(false); }}>
            Cancelar
          </button>
        )}
        <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Salvar anamnese"}</button>
      </div>
    </form>
  );
}
