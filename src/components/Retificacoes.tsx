"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MOTIVOS_RETIFICACAO, formatarData, formatarDataHora, mascaraCPF, mascaraTelefone } from "@/lib/utils";

/**
 * Histórico de retificações (nada é apagado: mostra valor antigo → novo,
 * quem fez, quando e por quê).
 */

export type Retificacao = {
  id: string;
  tabela: "patients" | "atendimentos";
  registro_id: string;
  registro_novo_id: string | null;
  motivo_tipo: string;
  justificativa: string;
  dados_antes: Record<string, unknown>;
  dados_depois: Record<string, unknown>;
  profissional_nome: string | null;
  registro_conselho: string | null;
  created_at: string;
};

export const ROTULOS: Record<string, string> = {
  nome: "Nome", sexo: "Sexo", data_nascimento: "Data de nascimento", cpf: "CPF", telefone: "Telefone",
  email: "E-mail", cep: "CEP", endereco: "Endereço", cidade: "Cidade", uf: "UF", profissao: "Profissão",
  como_conheceu: "Como conheceu", observacoes: "Observações", foto_path: "Foto",
  data_atendimento: "Data do atendimento", pe_avaliacao: "Avaliação", pe_diagnostico: "Diagnóstico de enfermagem",
  pe_planejamento: "Planejamento", pe_implementacao: "Implementação", pe_evolucao: "Evolução", regiao: "Região",
  produto: "Produto", fabricante: "Fabricante", lote: "Lote", validade_produto: "Validade do produto",
  tecnica: "Técnica", dados_procedimento: "Detalhes do procedimento", mapa: "Mapa de aplicação",
  orientacoes: "Orientações", intercorrencias: "Intercorrências", conduta_intercorrencia: "Conduta",
  sessao_numero: "Sessão nº", sessoes_previstas: "Sessões previstas", retorno_previsto: "Retorno previsto",
};

export const nomeMotivo = (v: string) => MOTIVOS_RETIFICACAO.find((m) => m.v === v)?.t ?? v;

export function valorLegivel(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vazio)";
  if (typeof v === "object") return "(alterado)";
  const s = String(v);
  if (campo === "cpf") return mascaraCPF(s);
  if (campo === "telefone") return mascaraTelefone(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatarData(s);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return formatarDataHora(s);
  return s;
}

export function CartaoRetificacao({ r }: { r: Retificacao }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
      <p className="font-medium text-amber-900">
        Retificado em {formatarDataHora(r.created_at)} por {r.profissional_nome ?? "—"}
        {r.registro_conselho ? ` (${r.registro_conselho.trim()})` : ""}
      </p>
      <p className="text-amber-900/80">
        <b>{nomeMotivo(r.motivo_tipo)}:</b> {r.justificativa}
      </p>
      <ul className="mt-2 space-y-1">
        {Object.keys(r.dados_depois).map((k) => (
          <li key={k}>
            <span className="text-tinta/60">{ROTULOS[k] ?? k}: </span>
            <span className="line-through decoration-red-400">{valorLegivel(k, r.dados_antes[k])}</span>
            {" → "}
            <span className="font-medium">{valorLegivel(k, r.dados_depois[k])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HistoricoRetificacoes({ pacienteId, tabela }: { pacienteId: string; tabela: "patients" | "atendimentos" }) {
  const [lista, setLista] = useState<Retificacao[]>([]);

  useEffect(() => {
    supabase.from("retificacoes").select("*").eq("patient_id", pacienteId).eq("tabela", tabela)
      .order("created_at", { ascending: false })
      .then(({ data }) => setLista((data ?? []) as Retificacao[]));
  }, [pacienteId, tabela]);

  if (lista.length === 0) return null;
  return (
    <section className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold text-tinta/70">Histórico de retificações</h3>
      {lista.map((r) => <CartaoRetificacao key={r.id} r={r} />)}
    </section>
  );
}
