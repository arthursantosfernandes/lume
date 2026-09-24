"use client";

import { useRef, useState } from "react";

/**
 * Mapa facial (vista frontal).
 * A profissional toca no rosto para marcar um ponto e informa o valor
 * (unidades de toxina, mL de preenchedor…). O app soma por região.
 * As coordenadas são salvas de 0 a 1, então funcionam em qualquer tamanho de tela.
 */

export type Marcacao = {
  id: string;
  x: number; // 0 a 1
  y: number; // 0 a 1
  valor: number | null;
  regiao: string;
};

export type Croqui = "feminino" | "masculino" | "desenho";

// Pontos de referência de cada croqui (proporções de 0 a 1 da imagem)
type Referencias = {
  sobrancelha: number; olho: number; narizBase: number; boca: number; queixo: number;
  rostoEsq: number; rostoDir: number; glabela: [number, number]; labios: [number, number];
};

const CROQUIS: Record<Croqui, { src?: string; w: number; h: number; ref: Referencias }> = {
  feminino: {
    src: "/croquis/feminino.jpg", w: 600, h: 824,
    ref: { sobrancelha: 0.36, olho: 0.435, narizBase: 0.61, boca: 0.72, queixo: 0.885,
      rostoEsq: 0.12, rostoDir: 0.87, glabela: [0.42, 0.57], labios: [0.36, 0.64] },
  },
  masculino: {
    src: "/croquis/masculino.jpg", w: 600, h: 683,
    ref: { sobrancelha: 0.36, olho: 0.44, narizBase: 0.605, boca: 0.705, queixo: 0.89,
      rostoEsq: 0.19, rostoDir: 0.81, glabela: [0.43, 0.56], labios: [0.38, 0.61] },
  },
  desenho: {
    w: 300, h: 400,
    ref: { sobrancelha: 0.37, olho: 0.44, narizBase: 0.6, boca: 0.705, queixo: 0.87,
      rostoEsq: 0.14, rostoDir: 0.86, glabela: [0.43, 0.57], labios: [0.39, 0.61] },
  },
};

// Descobre a região do rosto a partir da posição do toque.
// Vista frontal: o lado DIREITO da paciente aparece à ESQUERDA da tela.
export function regiaoDoPonto(x: number, y: number, croqui: Croqui = "desenho"): string {
  const r = CROQUIS[croqui].ref;
  const lado = x < 0.5 ? "D" : "E";
  const largura = r.rostoDir - r.rostoEsq;
  const lateral = x < r.rostoEsq + largura * 0.18 || x > r.rostoDir - largura * 0.18;

  if (x >= r.glabela[0] && x <= r.glabela[1] && y >= r.sobrancelha - 0.04 && y <= r.olho) return "Glabela";
  if (y < r.sobrancelha - 0.01) return "Frontal (testa)";
  if (y < r.olho + 0.06) return lateral ? `Periorbital lateral ${lado}` : `Periorbital ${lado}`;
  if (x >= 0.44 && x <= 0.56 && y < r.narizBase) return "Nariz";
  if (y < r.narizBase + 0.02) return `Terço médio / malar ${lado}`;
  if (y < r.boca + 0.05 && x >= r.labios[0] - 0.04 && x <= r.labios[1] + 0.04) return "Perioral / lábios";
  if (y >= r.boca + 0.05 && x >= 0.39 && x <= 0.61) return "Mento (queixo)";
  return `Mandíbula / masseter ${lado}`;
}

function novoId() {
  return Math.random().toString(36).slice(2, 10);
}

// "0,3" -> 0.3 ; "" -> null ; "0," -> 0 (ainda digitando)
function paraNumero(texto: string): number | null {
  const t = texto.replace(",", ".").trim();
  if (t === "" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("pt-BR");

export function MapaFacial({
  marcacoes,
  onChange,
  unidade = "U",
  somenteLeitura = false,
  croqui = "desenho",
}: {
  marcacoes: Marcacao[];
  onChange?: (m: Marcacao[]) => void;
  unidade?: string;
  somenteLeitura?: boolean;
  croqui?: Croqui;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  // Texto exatamente como a pessoa digitou (para aceitar "0," enquanto digita "0,3")
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});

  const c = CROQUIS[croqui];
  const W = c.w;
  const H = c.h;
  const raio = W / 30;

  function tocar(e: React.MouseEvent<SVGSVGElement>) {
    if (somenteLeitura || !onChange || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    const m: Marcacao = { id: novoId(), x, y, valor: null, regiao: regiaoDoPonto(x, y, croqui) };
    onChange([...marcacoes, m]);
    setSelecionado(m.id);
  }

  function alterarValor(id: string, texto: string) {
    if (!onChange) return;
    const limpo = texto.replace(/[^0-9.,]/g, "");
    setRascunhos({ ...rascunhos, [id]: limpo });
    onChange(marcacoes.map((m) => (m.id === id ? { ...m, valor: paraNumero(limpo) } : m)));
  }

  function remover(id: string) {
    if (!onChange) return;
    onChange(marcacoes.filter((m) => m.id !== id));
    if (selecionado === id) setSelecionado(null);
  }

  const textoDoValor = (m: Marcacao) =>
    rascunhos[m.id] ?? (m.valor === null ? "" : String(m.valor).replace(".", ","));

  // Totais por região
  const porRegiao = new Map<string, { qtd: number; total: number }>();
  for (const m of marcacoes) {
    const atual = porRegiao.get(m.regiao) ?? { qtd: 0, total: 0 };
    atual.qtd += 1;
    atual.total += m.valor ?? 0;
    porRegiao.set(m.regiao, atual);
  }
  const total = marcacoes.reduce((s, m) => s + (m.valor ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-sm">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          onClick={tocar}
          className={`w-full touch-manipulation select-none overflow-hidden rounded-2xl bg-white ${somenteLeitura ? "" : "cursor-crosshair"}`}
          role="img"
          aria-label="Mapa facial"
        >
          {c.src ? (
            <image href={c.src} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid slice" />
          ) : (
            <g fill="none" stroke="#b9a58a" strokeWidth="2" strokeLinecap="round">
              <ellipse cx="150" cy="200" rx="108" ry="150" fill="#fbf6ef" />
              <ellipse cx="40" cy="200" rx="10" ry="26" />
              <ellipse cx="260" cy="200" rx="10" ry="26" />
              <path d="M78 152 Q104 138 132 148" />
              <path d="M168 148 Q196 138 222 152" />
              <path d="M84 176 Q106 162 128 176 Q106 186 84 176 Z" />
              <path d="M172 176 Q194 162 216 176 Q194 186 172 176 Z" />
              <circle cx="106" cy="175" r="4" fill="#b9a58a" />
              <circle cx="194" cy="175" r="4" fill="#b9a58a" />
              <path d="M146 170 L138 232 Q150 244 162 232 L154 170" />
              <path d="M118 282 Q134 270 150 276 Q166 270 182 282 Q150 300 118 282 Z" />
              <path d="M118 282 Q150 288 182 282" />
            </g>
          )}
          <text x={W * 0.05} y={H * 0.97} fontSize={W / 22} fill="#8a7f70">D</text>
          <text x={W * 0.92} y={H * 0.97} fontSize={W / 22} fill="#8a7f70">E</text>

          {/* Pontos */}
          {marcacoes.map((m, i) => {
            const cx = m.x * W;
            const cy = m.y * H;
            const ativo = selecionado === m.id;
            return (
              <g key={m.id} onClick={(e) => { e.stopPropagation(); setSelecionado(m.id); }}>
                <circle cx={cx} cy={cy} r={ativo ? raio * 1.25 : raio}
                  fill={ativo ? "#c9a25c" : "#7e9a83"} fillOpacity="0.92" stroke="white" strokeWidth={raio / 5} />
                <text x={cx} y={cy + raio * 0.38} textAnchor="middle" fontSize={raio * 1.05}
                  fontWeight="700" fill="white">
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
        {!somenteLeitura && (
          <p className="mt-1 text-center text-xs text-tinta/50">
            Toque no rosto para marcar um ponto · D = lado direito da paciente
          </p>
        )}
      </div>

      {/* Lista de pontos (edição) */}
      {!somenteLeitura && marcacoes.length > 0 && (
        <ul className="divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
          {marcacoes.map((m, i) => (
            <li key={m.id}
              className={`flex items-center gap-3 px-3 py-2 ${selecionado === m.id ? "bg-salvia-claro/60" : ""}`}
              onClick={() => setSelecionado(m.id)}>
              <span className="w-6 text-center text-sm font-semibold text-tinta/50">{i + 1}</span>
              <span className="flex-1 text-sm">{m.regiao}</span>
              <input
                className="w-20 rounded-lg border border-black/10 px-2 py-1.5 text-right"
                inputMode="decimal"
                value={textoDoValor(m)}
                placeholder={unidade === "mL" ? "0,0" : "0"}
                onChange={(e) => alterarValor(m.id, e.target.value)}
                aria-label={`Valor do ponto ${i + 1}`}
              />
              <span className="w-8 text-sm text-tinta/60">{unidade}</span>
              <button type="button" className="px-2 text-lg text-tinta/40 hover:text-red-600"
                onClick={(e) => { e.stopPropagation(); remover(m.id); }} aria-label="Remover ponto">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Lista numerada (visualização) */}
      {somenteLeitura && marcacoes.length > 0 && (
        <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {marcacoes.map((m, i) => (
            <li key={m.id} className="flex justify-between">
              <span><b>{i + 1}.</b> {m.regiao}</span>
              <span>{m.valor !== null ? `${fmt(m.valor)} ${unidade}` : "—"}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Totais */}
      {marcacoes.length > 0 && (
        <div className="rounded-2xl bg-salvia-claro/60 p-4 text-sm">
          <ul className="space-y-1">
            {[...porRegiao.entries()].map(([r, t]) => (
              <li key={r} className="flex justify-between">
                <span>{r} <span className="text-tinta/50">({t.qtd} {t.qtd === 1 ? "ponto" : "pontos"})</span></span>
                <span className="font-medium">{fmt(t.total)} {unidade}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-black/10 pt-2 font-semibold">
            <span>Total ({marcacoes.length} {marcacoes.length === 1 ? "ponto" : "pontos"})</span>
            <span>{fmt(total)} {unidade}</span>
          </p>
        </div>
      )}
    </div>
  );
}
