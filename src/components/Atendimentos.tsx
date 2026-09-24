"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatarData, formatarDataHora } from "@/lib/utils";
import { MapaFacial, type Marcacao, type Croqui } from "./MapaFacial";
import { CartaoRetificacao, type Retificacao } from "./Retificacoes";
import { exibirValor, unidadeDoMapa, type Campo, type Template } from "./CamposProcedimento";

type Atendimento = {
  id: string;
  data_atendimento: string;
  regiao: string | null;
  produto: string | null;
  fabricante: string | null;
  lote: string | null;
  validade_produto: string | null;
  tecnica: string | null;
  orientacoes: string | null;
  intercorrencias: string | null;
  conduta_intercorrencia: string | null;
  sessao_numero: number | null;
  sessoes_previstas: number | null;
  retorno_previsto: string | null;
  observacoes: string | null;
  status: string;
  retifica_id: string | null;
  pe_avaliacao: string | null;
  pe_diagnostico: string | null;
  pe_planejamento: string | null;
  pe_implementacao: string | null;
  pe_evolucao: string | null;
  dados_procedimento: Record<string, unknown>;
  mapa: Marcacao[];
  procedure_templates: Template | null;
  professionals: { nome: string } | null;
  professional_credentials: { conselho: string | null; numero_registro: string | null; uf: string | null } | null;
};

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <div className="py-2">
      <dt className="text-xs uppercase tracking-wide text-tinta/50">{rotulo}</dt>
      <dd className="whitespace-pre-wrap">{valor}</dd>
    </div>
  );
}

// Resumo curto para o card (ex: "Total aplicado: 24 U")
function resumo(a: Atendimento): string | null {
  const campos = a.procedure_templates?.campos ?? [];
  const principal = campos.find((c) => c.tipo === "calculado" && c.formula === "soma(mapa.valor)");
  if (principal && a.dados_procedimento[principal.chave] != null) {
    return `${principal.rotulo}: ${exibirValor(principal, a.dados_procedimento[principal.chave])}`;
  }
  return a.regiao;
}

export function AtendimentosAba({ pacienteId }: { pacienteId: string }) {
  const [lista, setLista] = useState<Atendimento[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [retificacoes, setRetificacoes] = useState<Retificacao[]>([]);

  useEffect(() => {
    supabase
      .from("atendimentos")
      .select(
        "*, procedure_templates(id, slug, nome, categoria, tipo_mapa, tipo_marcacao, campos), professionals(nome), professional_credentials(conselho, numero_registro, uf)"
      )
      .eq("patient_id", pacienteId)
      .order("data_atendimento", { ascending: false })
      .then(({ data }) => {
        setLista((data ?? []) as unknown as Atendimento[]);
        setCarregando(false);
      });
    supabase.from("retificacoes").select("*").eq("patient_id", pacienteId).eq("tabela", "atendimentos")
      .then(({ data }) => setRetificacoes((data ?? []) as Retificacao[]));
  }, [pacienteId]);

  return (
    <div className="lista-animada space-y-3">
      <Link href={`/pacientes/${pacienteId}/atendimento/novo`} className="botao block text-center">
        + Novo atendimento
      </Link>

      {carregando ? (
        <p className="py-8 text-center text-tinta/50">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="py-8 text-center text-tinta/50">Nenhum atendimento registrado.</p>
      ) : (
        lista.map((a) => {
          const t = a.procedure_templates;
          const cred = a.professional_credentials;
          const expandido = aberto === a.id;
          const retificado = a.status === "retificado";
          const ret = retificacoes.find((r) => r.registro_novo_id === a.id); // esta versão veio de uma retificação
          return (
            <article key={a.id} className={`cartao-vivo overflow-hidden rounded-2xl bg-white shadow-sm ${retificado ? "opacity-60" : ""}`}>
              <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setAberto(expandido ? null : a.id)}>
                <div className="flex-1">
                  <p className="font-semibold">
                    {t?.nome ?? "Procedimento"}
                    {retificado && (
                      <span className="ml-2 rounded-md bg-tinta/10 px-1.5 py-0.5 text-xs font-medium">Original · retificado</span>
                    )}
                    {ret && (
                      <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">Versão retificada</span>
                    )}
                  </p>
                  <p className="text-sm text-tinta/60">{formatarDataHora(a.data_atendimento)}</p>
                  {resumo(a) && <p className="mt-1 text-sm">{resumo(a)}</p>}
                  {a.retorno_previsto && (
                    <p className="mt-1 text-xs text-salvia-escuro">Retorno: {formatarData(a.retorno_previsto)}</p>
                  )}
                </div>
                <span className="text-tinta/40">{expandido ? "▲" : "▼"}</span>
              </button>

              {expandido && (
                <div className="border-t border-black/5 p-4">
                  {ret && <div className="mb-4"><CartaoRetificacao r={ret} /></div>}
                  {retificado && (
                    <p className="mb-4 rounded-xl bg-tinta/5 p-3 text-sm">
                      Este é o registro original. Ele foi retificado e continua guardado sem alterações.
                    </p>
                  )}
                  {a.mapa?.length > 0 && t && (
                    <div className="mb-4">
                      <MapaFacial marcacoes={a.mapa} somenteLeitura unidade={unidadeDoMapa(t)}
                        croqui={(a.dados_procedimento?.croqui as Croqui) ?? "desenho"} />
                    </div>
                  )}
                  <dl className="divide-y divide-black/5">
                    <Linha rotulo="Avaliação" valor={a.pe_avaliacao} />
                    <Linha rotulo="Diagnóstico de enfermagem" valor={a.pe_diagnostico} />
                    <Linha rotulo="Planejamento" valor={a.pe_planejamento} />
                    <Linha rotulo="Implementação" valor={a.pe_implementacao} />
                    <Linha rotulo="Evolução" valor={a.pe_evolucao} />
                    <Linha rotulo="Região" valor={a.regiao} />
                    <Linha rotulo="Produto"
                      valor={[a.produto, a.fabricante].filter(Boolean).join(" — ") || null} />
                    <Linha rotulo="Lote / validade"
                      valor={a.lote ? `${a.lote}${a.validade_produto ? ` · val. ${formatarData(a.validade_produto)}` : ""}` : null} />
                    {(t?.campos ?? []).map((c: Campo) => (
                      <Linha key={c.chave} rotulo={c.rotulo}
                        valor={a.dados_procedimento?.[c.chave] != null ? exibirValor(c, a.dados_procedimento[c.chave]) : null} />
                    ))}
                    <Linha rotulo="Técnica" valor={a.tecnica} />
                    <Linha rotulo="Orientações" valor={a.orientacoes} />
                    <Linha rotulo="Intercorrências" valor={a.intercorrencias} />
                    <Linha rotulo="Conduta" valor={a.conduta_intercorrencia} />
                    <Linha rotulo="Sessão"
                      valor={a.sessao_numero ? `${a.sessao_numero}${a.sessoes_previstas ? ` de ${a.sessoes_previstas}` : ""}` : null} />
                    <Linha rotulo="Observações" valor={a.observacoes} />
                  </dl>
                  <p className="mt-3 text-xs text-tinta/50">
                    {a.professionals?.nome}
                    {cred?.conselho && cred.conselho !== "nenhum"
                      ? ` · ${cred.conselho}-${cred.uf ?? ""} ${cred.numero_registro ?? ""}` : ""}
                  </p>
                  {!retificado && (
                    <Link href={`/pacientes/${pacienteId}/atendimento/${a.id}/retificar`}
                      className="mt-3 inline-block text-sm font-medium text-salvia-escuro underline">
                      ✏️ Retificar este atendimento
                    </Link>
                  )}
                </div>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}
