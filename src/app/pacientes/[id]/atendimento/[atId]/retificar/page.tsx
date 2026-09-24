"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfissional, credencialPrincipal } from "@/lib/useProfissional";
import { MOTIVOS_RETIFICACAO, formatarDataHora } from "@/lib/utils";
import { Topo } from "@/components/Topo";
import { Carregando } from "@/components/Carregando";
import { MapaFacial, type Croqui, type Marcacao } from "@/components/MapaFacial";
import {
  CamposProcedimento, dadosComCalculados, unidadeDoMapa, usaMapaFacial, type Dados, type Template,
} from "@/components/CamposProcedimento";

/**
 * Retificação de atendimento.
 * O original NUNCA é alterado: o banco cria uma nova versão com as correções,
 * ligada ao original, e registra motivo, autor, data e valores antigo/novo.
 */

const TEXTOS = [
  ["pe_avaliacao", "Avaliação"], ["pe_diagnostico", "Diagnóstico de enfermagem"], ["pe_planejamento", "Planejamento"],
  ["pe_implementacao", "Implementação"], ["pe_evolucao", "Evolução"], ["regiao", "Região"], ["produto", "Produto"],
  ["fabricante", "Fabricante"], ["lote", "Lote"], ["tecnica", "Técnica"], ["orientacoes", "Orientações"],
  ["intercorrencias", "Intercorrências"], ["conduta_intercorrencia", "Conduta na intercorrência"],
  ["observacoes", "Observações"],
] as const;
type CampoTexto = (typeof TEXTOS)[number][0];

// JSON com chaves em ordem fixa, para comparar se algo mudou
function estavel(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(estavel).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${estavel((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

function paraLocal(iso: string) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function RetificarAtendimentoPage() {
  const { id: pacienteId, atId } = useParams<{ id: string; atId: string }>();
  const router = useRouter();
  const { profissional, carregando } = useProfissional();

  const [original, setOriginal] = useState<Record<string, unknown> | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [textos, setTextos] = useState<Record<CampoTexto, string>>({} as Record<CampoTexto, string>);
  const [datas, setDatas] = useState({ data_atendimento: "", validade_produto: "", retorno_previsto: "" });
  const [dados, setDados] = useState<Dados>({});
  const [mapa, setMapa] = useState<Marcacao[]>([]);
  const [motivo, setMotivo] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!profissional) return;
    supabase.from("atendimentos")
      .select("*, procedure_templates(id, slug, nome, categoria, tipo_mapa, tipo_marcacao, campos)")
      .eq("id", atId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const a = data as Record<string, unknown>;
        setOriginal(a);
        setTemplate((a.procedure_templates as Template) ?? null);
        const t = {} as Record<CampoTexto, string>;
        for (const [k] of TEXTOS) t[k] = (a[k] as string) ?? "";
        setTextos(t);
        setDatas({
          data_atendimento: a.data_atendimento ? paraLocal(a.data_atendimento as string) : "",
          validade_produto: (a.validade_produto as string) ?? "",
          retorno_previsto: (a.retorno_previsto as string) ?? "",
        });
        setDados({ ...((a.dados_procedimento as Dados) ?? {}) });
        setMapa((a.mapa as Marcacao[]) ?? []);
      });
  }, [profissional, atId]);

  if (carregando || !profissional || !original) return <Carregando />;

  if (original.status !== "ativo") {
    return (
      <>
        <Topo titulo="Retificar atendimento" voltar={`/pacientes/${pacienteId}?aba=atendimentos`} />
        <p className="p-8 text-center text-tinta/60">Este atendimento já foi retificado. Retifique a versão mais recente.</p>
      </>
    );
  }

  const cred = credencialPrincipal(profissional);
  const croqui = ((original.dados_procedimento as Dados)?.croqui as Croqui) ?? "desenho";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!original) return;
    setErro("");
    if (!motivo) return setErro("Escolha o motivo da retificação.");
    if (justificativa.trim().length < 15) return setErro("A justificativa precisa ter pelo menos 15 caracteres.");
    if (mapa.some((m) => m.valor === null)) return setErro("Há pontos no mapa sem valor.");

    const campos: Record<string, unknown> = {};
    const nulo = (v: string) => (v.trim() === "" ? null : v.trim());
    for (const [k] of TEXTOS) {
      if (nulo(textos[k]) !== ((original[k] as string) ?? null)) campos[k] = nulo(textos[k]);
    }
    const novaData = datas.data_atendimento ? new Date(datas.data_atendimento).toISOString() : null;
    if (novaData && new Date(novaData).getTime() !== new Date(original.data_atendimento as string).getTime()) {
      campos.data_atendimento = novaData;
    }
    if (nulo(datas.validade_produto) !== (original.validade_produto ?? null)) campos.validade_produto = nulo(datas.validade_produto);
    if (nulo(datas.retorno_previsto) !== (original.retorno_previsto ?? null)) campos.retorno_previsto = nulo(datas.retorno_previsto);

    if (template) {
      const novosDados = dadosComCalculados(template, dados, mapa);
      if (estavel(novosDados) !== estavel(original.dados_procedimento)) campos.dados_procedimento = novosDados;
    }
    if (estavel(mapa) !== estavel(original.mapa)) campos.mapa = mapa;

    if (Object.keys(campos).length === 0) return setErro("Nenhuma alteração feita.");

    setSalvando(true);
    const { error } = await supabase.rpc("retificar_atendimento", {
      p_atendimento: atId, p_campos: campos, p_motivo_tipo: motivo, p_justificativa: justificativa.trim(),
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    router.replace(`/pacientes/${pacienteId}?aba=atendimentos`);
  }

  return (
    <>
      <Topo titulo="Retificar atendimento" voltar={`/pacientes/${pacienteId}?aba=atendimentos`} />
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        <div className="mb-4 rounded-2xl bg-salvia p-4 text-white">
          <p className="font-semibold">{template?.nome ?? "Atendimento"}</p>
          <p className="text-sm opacity-90">Original de {formatarDataHora(original.data_atendimento as string)}</p>
        </div>
        <p className="mb-4 rounded-xl bg-creme p-3 text-sm text-tinta/70">
          O registro original continua guardado sem alterações. Será criada uma nova versão com as correções,
          identificada como retificação.
        </p>

        <form onSubmit={salvar} className="space-y-5">
          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="rotulo">Data e hora</label>
                <input className="campo" type="datetime-local" value={datas.data_atendimento}
                  onChange={(e) => setDatas({ ...datas, data_atendimento: e.target.value })} />
              </div>
              <div>
                <label className="rotulo">Validade do produto</label>
                <input className="campo" type="date" value={datas.validade_produto}
                  onChange={(e) => setDatas({ ...datas, validade_produto: e.target.value })} />
              </div>
              <div>
                <label className="rotulo">Retorno previsto</label>
                <input className="campo" type="date" value={datas.retorno_previsto}
                  onChange={(e) => setDatas({ ...datas, retorno_previsto: e.target.value })} />
              </div>
            </div>
            {TEXTOS.map(([k, rotulo]) => (
              <div key={k}>
                <label className="rotulo">{rotulo}</label>
                <textarea className="campo min-h-12" value={textos[k] ?? ""}
                  onChange={(e) => setTextos({ ...textos, [k]: e.target.value })} />
              </div>
            ))}
          </section>

          {template && (
            <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Detalhes do procedimento</h2>
              <CamposProcedimento template={template} dados={dados} onChange={setDados} mapa={mapa} />
            </section>
          )}

          {template && usaMapaFacial(template) && (
            <section className="space-y-3">
              <h2 className="font-semibold">Mapa de aplicação</h2>
              <MapaFacial marcacoes={mapa} onChange={setMapa} unidade={unidadeDoMapa(template)} croqui={croqui} />
            </section>
          )}

          <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Justificativa da retificação *</p>
            <p className="text-sm text-amber-900/80">
              Ficará registrado: {profissional.nome}
              {cred?.conselho && cred.conselho !== "nenhum" ? ` (${cred.conselho}-${cred.uf ?? ""} ${cred.numero_registro ?? ""})` : ""},
              data e hora, valores antigos e novos.
            </p>
            <select className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
              <option value="">Motivo…</option>
              {MOTIVOS_RETIFICACAO.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}
            </select>
            <textarea className="campo min-h-20" required minLength={15} value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Explique o que foi corrigido e por quê (mínimo 15 caracteres)" />
            <p className="text-right text-xs text-amber-900/60">{justificativa.trim().length}/15</p>
          </section>

          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Registrar retificação"}</button>
        </form>
      </main>
    </>
  );
}
