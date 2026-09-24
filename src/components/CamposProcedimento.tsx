"use client";

import type { Marcacao } from "./MapaFacial";

/**
 * Desenha automaticamente os campos específicos de cada procedimento
 * a partir da definição salva no banco (procedure_templates.campos).
 * Assim, um procedimento novo não precisa de tela nova.
 */

export type Campo = {
  chave: string;
  rotulo: string;
  tipo: "numero" | "texto" | "selecao" | "booleano" | "data" | "calculado" | "lista";
  unidade?: string;
  opcoes?: string[];
  obrigatorio?: boolean;
  formula?: string;
  itens?: Campo[];
};

export type Template = {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  tipo_mapa: string;
  tipo_marcacao: string[];
  campos: Campo[];
};

export type Dados = Record<string, unknown>;

/** Unidade usada no mapa para cada procedimento */
export function unidadeDoMapa(t: Template): string {
  return t.slug === "toxina-botulinica" ? "U" : "mL";
}

/** Por enquanto o mapa facial aceita pontos com valor (toxina) e volumes (preenchedores) */
export function usaMapaFacial(t: Template): boolean {
  return (
    (t.tipo_mapa === "facial" || t.tipo_mapa === "facial_corporal") &&
    (t.tipo_marcacao.includes("ponto") || t.tipo_marcacao.includes("volume"))
  );
}

/** Converte texto digitado ("2,5") em número (2.5). Retorna null se vazio/inválido. */
export function paraNumero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.replace(",", ".").trim();
  if (t === "" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Calcula os campos do tipo "calculado" */
export function calcular(campo: Campo, dados: Dados, mapa: Marcacao[]): number | null {
  const n = (k: string) => {
    const v = paraNumero(dados[k]);
    return v !== null && v > 0 ? v : null;
  };
  switch (campo.formula) {
    case "soma(mapa.valor)":
      return mapa.length ? Math.round(mapa.reduce((s, m) => s + (m.valor ?? 0), 0) * 100) / 100 : null;
    case "contar(mapa)":
      return mapa.length || null;
    case "unidades_frasco / diluicao_ml / 10": {
      const u = n("unidades_frasco");
      const d = n("diluicao_ml");
      return u && d ? Math.round((u / d / 10) * 100) / 100 : null;
    }
    default:
      return null;
  }
}

/** Junta os valores digitados + os calculados, pronto para salvar */
export function dadosComCalculados(t: Template, dados: Dados, mapa: Marcacao[]): Dados {
  const final: Dados = { ...dados };
  for (const c of t.campos) {
    if (c.tipo === "calculado") final[c.chave] = calcular(c, dados, mapa);
    // Números digitados como texto ("2,5") são salvos como número (2.5)
    if (c.tipo === "numero" && final[c.chave] !== undefined) final[c.chave] = paraNumero(final[c.chave]);
    if (c.tipo === "lista" && Array.isArray(final[c.chave])) {
      final[c.chave] = (final[c.chave] as Dados[]).map((linha) => {
        const l: Dados = { ...linha };
        for (const item of c.itens ?? []) {
          if (item.tipo === "numero" && l[item.chave] !== undefined) l[item.chave] = paraNumero(l[item.chave]);
        }
        return l;
      });
    }
  }
  return final;
}

/** Texto para exibir um valor salvo */
export function exibirValor(c: Campo, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (c.tipo === "booleano") return v ? "Sim" : "Não";
  if (c.tipo === "data" && typeof v === "string") return new Date(v + "T00:00:00").toLocaleDateString("pt-BR");
  if (c.tipo === "lista" && Array.isArray(v)) {
    return v
      .map((linha: Record<string, unknown>) =>
        (c.itens ?? [])
          .map((i) => (linha[i.chave] ? `${i.rotulo}: ${linha[i.chave]}${i.unidade ? " " + i.unidade : ""}` : ""))
          .filter(Boolean)
          .join(", ")
      )
      .join(" | ");
  }
  const texto = typeof v === "number" ? v.toLocaleString("pt-BR") : String(v);
  return c.unidade ? `${texto} ${c.unidade}` : texto;
}

function CampoSimples({
  c, valor, onChange,
}: { c: Campo; valor: unknown; onChange: (v: unknown) => void }) {
  if (c.tipo === "booleano") {
    return (
      <div className="flex gap-2">
        {[{ v: true, t: "Sim" }, { v: false, t: "Não" }].map((op) => (
          <button type="button" key={op.t} onClick={() => onChange(valor === op.v ? null : op.v)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              valor === op.v ? "bg-salvia text-white" : "bg-creme text-tinta/60"
            }`}>
            {op.t}
          </button>
        ))}
      </div>
    );
  }
  if (c.tipo === "selecao") {
    return (
      <select className="campo" value={(valor as string) ?? ""} required={c.obrigatorio}
        onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Selecione…</option>
        {(c.opcoes ?? []).map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }
  const tipoInput = c.tipo === "data" ? "date" : "text";
  return (
    <div className="flex items-center gap-2">
      <input
        className="campo"
        type={tipoInput}
        inputMode={c.tipo === "numero" ? "decimal" : undefined}
        required={c.obrigatorio}
        value={valor === null || valor === undefined ? "" : String(valor)}
        onChange={(e) => {
          const t = e.target.value;
          // Números ficam como texto enquanto digita (para aceitar "2,5"); viram número ao salvar
          if (c.tipo === "numero") onChange(t.replace(/[^0-9.,]/g, "") || null);
          else onChange(t || null);
        }}
      />
      {c.unidade && <span className="shrink-0 text-sm text-tinta/60">{c.unidade}</span>}
    </div>
  );
}

export function CamposProcedimento({
  template, dados, onChange, mapa,
}: { template: Template; dados: Dados; onChange: (d: Dados) => void; mapa: Marcacao[] }) {
  const set = (k: string, v: unknown) => onChange({ ...dados, [k]: v });

  return (
    <div className="space-y-4">
      {template.campos.map((c) => {
        if (c.tipo === "calculado") {
          const v = calcular(c, dados, mapa);
          return (
            <div key={c.chave} className="flex items-center justify-between rounded-xl bg-salvia-claro/60 px-4 py-3">
              <span className="text-sm font-medium">{c.rotulo}</span>
              <span className="font-semibold">{v === null ? "—" : `${v.toLocaleString("pt-BR")} ${c.unidade ?? ""}`}</span>
            </div>
          );
        }

        if (c.tipo === "lista") {
          const linhas = (Array.isArray(dados[c.chave]) ? dados[c.chave] : []) as Dados[];
          const setLinha = (i: number, k: string, v: unknown) =>
            set(c.chave, linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
          return (
            <div key={c.chave}>
              <label className="rotulo">{c.rotulo}</label>
              <div className="space-y-3">
                {linhas.map((l, i) => (
                  <div key={i} className="space-y-2 rounded-xl border border-black/10 p-3">
                    {(c.itens ?? []).map((item) => (
                      <div key={item.chave}>
                        <label className="text-xs text-tinta/60">{item.rotulo}</label>
                        <CampoSimples c={item} valor={l[item.chave]} onChange={(v) => setLinha(i, item.chave, v)} />
                      </div>
                    ))}
                    <button type="button" className="text-sm text-red-700 underline"
                      onClick={() => set(c.chave, linhas.filter((_, j) => j !== i))}>
                      Remover
                    </button>
                  </div>
                ))}
                <button type="button" className="botao-sec" onClick={() => set(c.chave, [...linhas, {}])}>
                  + Adicionar
                </button>
              </div>
            </div>
          );
        }

        return (
          <div key={c.chave}>
            <label className="rotulo">{c.rotulo}{c.obrigatorio ? " *" : ""}</label>
            <CampoSimples c={c} valor={dados[c.chave]} onChange={(v) => set(c.chave, v)} />
          </div>
        );
      })}
    </div>
  );
}
