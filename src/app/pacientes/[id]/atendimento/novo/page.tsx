"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfissional, credencialPrincipal } from "@/lib/useProfissional";
import { hojeISO } from "@/lib/utils";
import { Topo } from "@/components/Topo";
import { Carregando } from "@/components/Carregando";
import { MapaFacial, type Marcacao, type Croqui } from "@/components/MapaFacial";
import {
  CamposProcedimento, dadosComCalculados, unidadeDoMapa, usaMapaFacial,
  type Dados, type Template,
} from "@/components/CamposProcedimento";

// Data e hora atuais no formato do campo datetime-local
function agoraLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const ALERTAS_ANAMNESE: [string, string][] = [
  ["gestante_lactante", "Gestante ou amamentando"],
  ["doenca_neuromuscular", "Doença neuromuscular"],
  ["disturbio_coagulacao", "Distúrbio de coagulação / anticoagulante"],
  ["historico_queloide", "Histórico de queloide"],
  ["herpes_recorrente", "Herpes recorrente"],
];

export default function NovoAtendimentoPage() {
  const { id: pacienteId } = useParams<{ id: string }>();
  const router = useRouter();
  const { profissional, carregando } = useProfissional();

  const [paciente, setPaciente] = useState<{ nome: string; sexo: string | null } | null>(null);
  const [croqui, setCroqui] = useState<Croqui>("feminino");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [alergias, setAlergias] = useState<string | null>(null);
  const [semAnamnese, setSemAnamnese] = useState(false);

  const [comum, setComum] = useState({
    data_atendimento: agoraLocal(),
    regiao: "", produto: "", fabricante: "", lote: "", validade_produto: "", tecnica: "",
    orientacoes: "", intercorrencias: "", conduta_intercorrencia: "",
    sessao_numero: "", sessoes_previstas: "", retorno_previsto: "", observacoes: "",
    pe_avaliacao: "", pe_diagnostico: "", pe_planejamento: "", pe_implementacao: "", pe_evolucao: "",
  });
  const [dados, setDados] = useState<Dados>({});
  const [mapa, setMapa] = useState<Marcacao[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!profissional) return;
    (async () => {
      const [pac, tpl, ana] = await Promise.all([
        supabase.from("patients").select("nome, sexo").eq("id", pacienteId).maybeSingle(),
        supabase.from("procedure_templates").select("id, slug, nome, categoria, tipo_mapa, tipo_marcacao, campos")
          .eq("ativo", true).order("nome"),
        supabase.from("anamneses").select("*").eq("patient_id", pacienteId)
          .order("created_at", { ascending: false }).limit(1),
      ]);
      setPaciente(pac.data);
      // Croqui do mapa conforme o sexo cadastrado da paciente
      if (pac.data?.sexo === "masculino") setCroqui("masculino");
      setTemplates((tpl.data ?? []) as Template[]);
      const a = ana.data?.[0] as Record<string, unknown> | undefined;
      if (!a) setSemAnamnese(true);
      else {
        setAlertas(ALERTAS_ANAMNESE.filter(([k]) => a[k] === true).map(([, t]) => t));
        setAlergias((a.alergias as string) || null);
      }
    })();
  }, [profissional, pacienteId]);

  if (carregando || !profissional) return <Carregando />;

  const credencial = credencialPrincipal(profissional);
  const ehEnfermagem = credencial?.profissao === "enfermeiro";
  const injetavel = template?.categoria === "injetavel";
  const validadeVencida = comum.validade_produto !== "" && comum.validade_produto < hojeISO();

  const campo = (k: keyof typeof comum) => ({
    value: comum[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setComum({ ...comum, [k]: e.target.value }),
  });

  function escolher(t: Template) {
    setTemplate(t);
    setDados({});
    setMapa([]);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!template || !profissional) return;
    setErro("");

    if (usaMapaFacial(template) && mapa.some((m) => m.valor === null)) {
      return setErro("Há pontos no mapa sem valor. Preencha ou remova antes de salvar.");
    }

    setSalvando(true);
    const vazioParaNull = (v: string) => (v.trim() === "" ? null : v.trim());
    // Se a região não foi digitada, usa as regiões marcadas no mapa
    const regioesMapa = [...new Set(mapa.map((m) => m.regiao))].join(", ");

    const registro = {
      clinic_id: profissional.clinic_id,
      patient_id: pacienteId,
      professional_id: profissional.id,
      credential_id: credencial?.id ?? null,
      procedure_template_id: template.id,
      data_atendimento: new Date(comum.data_atendimento).toISOString(),
      regiao: vazioParaNull(comum.regiao) ?? (regioesMapa || null),
      produto: vazioParaNull(comum.produto),
      fabricante: vazioParaNull(comum.fabricante),
      lote: vazioParaNull(comum.lote),
      validade_produto: vazioParaNull(comum.validade_produto),
      tecnica: vazioParaNull(comum.tecnica),
      orientacoes: vazioParaNull(comum.orientacoes),
      intercorrencias: vazioParaNull(comum.intercorrencias),
      conduta_intercorrencia: vazioParaNull(comum.conduta_intercorrencia),
      sessao_numero: comum.sessao_numero ? Number(comum.sessao_numero) : null,
      sessoes_previstas: comum.sessoes_previstas ? Number(comum.sessoes_previstas) : null,
      retorno_previsto: vazioParaNull(comum.retorno_previsto),
      observacoes: vazioParaNull(comum.observacoes),
      pe_avaliacao: ehEnfermagem ? vazioParaNull(comum.pe_avaliacao) : null,
      pe_diagnostico: ehEnfermagem ? vazioParaNull(comum.pe_diagnostico) : null,
      pe_planejamento: ehEnfermagem ? vazioParaNull(comum.pe_planejamento) : null,
      pe_implementacao: ehEnfermagem ? vazioParaNull(comum.pe_implementacao) : null,
      pe_evolucao: ehEnfermagem ? vazioParaNull(comum.pe_evolucao) : null,
      dados_procedimento: {
        ...dadosComCalculados(template, dados, mapa),
        ...(usaMapaFacial(template) ? { croqui } : {}),
      },
      mapa,
    };

    const { error } = await supabase.from("atendimentos").insert(registro);
    setSalvando(false);
    if (error) return setErro(error.message);
    router.replace(`/pacientes/${pacienteId}?aba=atendimentos`);
  }

  return (
    <>
      <Topo titulo={paciente ? `Atendimento · ${paciente.nome}` : "Novo atendimento"} voltar={`/pacientes/${pacienteId}`} />
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        {/* Avisos vindos da anamnese */}
        {semAnamnese && (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Esta paciente ainda não tem anamnese registrada.
          </div>
        )}
        {(alertas.length > 0 || alergias) && (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="mb-1 font-semibold">⚠ Da anamnese</p>
            <ul className="list-inside list-disc">
              {alertas.map((a) => <li key={a}>{a}</li>)}
              {alergias && <li>Alergias: {alergias}</li>}
            </ul>
          </div>
        )}

        {/* 1. Escolher procedimento */}
        {!template ? (
          <section>
            <h2 className="mb-3 font-semibold">Qual procedimento?</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((t) => (
                <button key={t.id} onClick={() => escolher(t)}
                  className="rounded-2xl bg-white p-4 text-left shadow-sm hover:bg-salvia-claro/50">
                  <span className="font-medium">{t.nome}</span>
                  {usaMapaFacial(t) && <span className="ml-2 text-xs text-salvia-escuro">com mapa facial</span>}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <form onSubmit={salvar} className="space-y-5">
            <div className="flex items-center justify-between rounded-2xl bg-salvia p-4 text-white">
              <span className="font-semibold">{template.nome}</span>
              <button type="button" className="text-sm underline" onClick={() => setTemplate(null)}>Trocar</button>
            </div>

            <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
              <div>
                <label className="rotulo">Data e hora</label>
                <input className="campo" type="datetime-local" required
                  value={comum.data_atendimento}
                  onChange={(e) => setComum({ ...comum, data_atendimento: e.target.value })} />
              </div>
              {credencial && (
                <p className="text-xs text-tinta/50">
                  Responsável: {profissional.nome}
                  {credencial.conselho && credencial.conselho !== "nenhum"
                    ? ` · ${credencial.conselho}-${credencial.uf ?? ""} ${credencial.numero_registro ?? ""}` : ""}
                </p>
              )}
            </section>

            {/* Processo de Enfermagem (Res. COFEN 736/2024) */}
            {ehEnfermagem && (
              <details className="rounded-2xl bg-white p-4 shadow-sm" open>
                <summary className="cursor-pointer font-semibold">Processo de Enfermagem</summary>
                <div className="mt-4 space-y-4">
                  {([
                    ["pe_avaliacao", "Avaliação", "Dados coletados, exame da região, queixa atual"],
                    ["pe_diagnostico", "Diagnóstico de enfermagem", ""],
                    ["pe_planejamento", "Planejamento", "Resultados esperados e o que será feito"],
                    ["pe_implementacao", "Implementação", "O que foi realizado (detalhes técnicos abaixo)"],
                    ["pe_evolucao", "Evolução", "Como a paciente respondeu / estado ao final"],
                  ] as [keyof typeof comum, string, string][]).map(([k, r, dica]) => (
                    <div key={k}>
                      <label className="rotulo">{r}</label>
                      <textarea className="campo min-h-20" placeholder={dica} {...campo(k)} />
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Produto */}
            <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Produto</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="rotulo">Produto (nome comercial){injetavel ? " *" : ""}</label>
                  <input className="campo" required={injetavel} {...campo("produto")} />
                </div>
                <div>
                  <label className="rotulo">Fabricante</label>
                  <input className="campo" {...campo("fabricante")} />
                </div>
                <div>
                  <label className="rotulo">Lote{injetavel ? " *" : ""}</label>
                  <input className="campo" required={injetavel} {...campo("lote")} />
                </div>
                <div>
                  <label className="rotulo">Validade{injetavel ? " *" : ""}</label>
                  <input className="campo" type="date" required={injetavel} {...campo("validade_produto")} />
                </div>
              </div>
              {validadeVencida && (
                <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
                  ⚠ A validade informada já passou. Confira o produto.
                </p>
              )}
            </section>

            {/* Campos específicos + mapa */}
            <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Detalhes do procedimento</h2>
              <CamposProcedimento template={template} dados={dados} onChange={setDados} mapa={mapa} />
            </section>

            {usaMapaFacial(template) ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Mapa de aplicação</h2>
                  <div className="flex rounded-xl bg-white p-1 text-sm shadow-sm">
                    {(["feminino", "masculino"] as Croqui[]).map((c) => (
                      <button type="button" key={c}
                        onClick={() => {
                          if (c === croqui) return;
                          if (mapa.length && !window.confirm("Trocar o croqui apaga os pontos marcados. Continuar?")) return;
                          setMapa([]);
                          setCroqui(c);
                        }}
                        className={`rounded-lg px-3 py-1.5 ${croqui === c ? "bg-salvia text-white" : "text-tinta/60"}`}>
                        {c === "feminino" ? "Feminino" : "Masculino"}
                      </button>
                    ))}
                  </div>
                </div>
                <MapaFacial key={croqui} marcacoes={mapa} onChange={setMapa} unidade={unidadeDoMapa(template)} croqui={croqui} />
              </section>
            ) : (
              <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
                <div>
                  <label className="rotulo">Região tratada</label>
                  <input className="campo" {...campo("regiao")} />
                </div>
                <p className="text-xs text-tinta/50">Mapa corporal e marcação de vetores chegam nas próximas versões.</p>
              </section>
            )}

            {/* Finalização */}
            <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Finalização</h2>
              <div>
                <label className="rotulo">Técnica / observações técnicas</label>
                <textarea className="campo min-h-20" {...campo("tecnica")} />
              </div>
              <div>
                <label className="rotulo">Orientações pós-procedimento</label>
                <textarea className="campo min-h-20" {...campo("orientacoes")} />
              </div>
              <div>
                <label className="rotulo">Intercorrências</label>
                <textarea className="campo min-h-16" placeholder="Nenhuma" {...campo("intercorrencias")} />
              </div>
              {comum.intercorrencias.trim() !== "" && (
                <div>
                  <label className="rotulo">Conduta na intercorrência</label>
                  <textarea className="campo min-h-16" {...campo("conduta_intercorrencia")} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="rotulo">Sessão nº</label>
                  <input className="campo" inputMode="numeric" {...campo("sessao_numero")} />
                </div>
                <div>
                  <label className="rotulo">De (total previsto)</label>
                  <input className="campo" inputMode="numeric" {...campo("sessoes_previstas")} />
                </div>
              </div>
              <div>
                <label className="rotulo">Retorno previsto</label>
                <input className="campo" type="date" {...campo("retorno_previsto")} />
              </div>
              <div>
                <label className="rotulo">Observações</label>
                <textarea className="campo min-h-16" {...campo("observacoes")} />
              </div>
            </section>

            {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
            <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Salvar atendimento"}</button>
            <p className="text-center text-xs text-tinta/50">
              Depois de salvo, o atendimento não pode ser apagado — apenas retificado.
            </p>
          </form>
        )}
      </main>
    </>
  );
}
