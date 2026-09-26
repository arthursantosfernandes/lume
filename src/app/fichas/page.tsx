"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfissional, credencialPrincipal } from "@/lib/useProfissional";
import { mascaraTelefone } from "@/lib/utils";
import type { ConteudoTCLE } from "@/lib/termos";
import { Carregando } from "@/components/Carregando";

/**
 * FICHAS DE CONTINGÊNCIA (papel, A4)
 * Para os dias sem energia ou sem internet: a profissional imprime antes,
 * preenche à mão e depois transcreve para o Lumê.
 * O cabeçalho sai com os dados de QUEM está logado (clínica, logo, nome, registro).
 */

type Dado = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Croqui = "desenho" | "feminino" | "masculino";

const DOCUMENTOS = [
  { id: "anamnese", titulo: "Ficha de anamnese" },
  { id: "toxina", titulo: "Ficha — Toxina botulínica" },
  { id: "preenchimento", titulo: "Ficha — Preenchimento com ácido hialurônico" },
  { id: "bioestimulador", titulo: "Ficha — Bioestimulador de colágeno" },
  { id: "imagem", titulo: "Termo de autorização de uso de imagem" },
  { id: "tcle", titulo: "TCLE — procedimento minimamente invasivo (+ anexos)" },
] as const;
type IdDoc = (typeof DOCUMENTOS)[number]["id"];

const ANEXOS = [
  { slug: "toxina-botulinica", nome: "Toxina botulínica" },
  { slug: "preenchimento-acido-hialuronico", nome: "Preenchimento com ácido hialurônico" },
  { slug: "bioestimulador-colageno", nome: "Bioestimulador de colágeno" },
];

/* ------------------------------------------------------------------ */
/* Peças reutilizáveis                                                  */
/* ------------------------------------------------------------------ */

type Cab = { clinica: Dado; logo: string | null; profissional: string; registro: string };

function Cabecalho({ cab, titulo, subtitulo }: { cab: Cab; titulo: string; subtitulo?: string }) {
  const c = cab.clinica;
  const endereco = [
    [c.endereco, c.numero].filter(Boolean).join(", "), c.bairro, [c.cidade, c.uf].filter(Boolean).join(" - "),
  ].filter(Boolean).join(" · ");
  return (
    <header className="mb-3 border-b-2 border-[#7e9a83] pb-2">
      <div className="flex items-center gap-3">
        {cab.logo && <img src={cab.logo} alt="" className="h-12 w-12 object-contain" />}
        <div className="flex-1 leading-tight">
          <p className="text-[13px] font-bold">{c.nome}</p>
          {endereco && <p className="text-[9px] text-gray-600">{endereco}</p>}
          <p className="text-[9px] text-gray-600">
            {[c.telefone && mascaraTelefone(c.telefone), c.email, c.documento && `CNPJ/CPF ${c.documento}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right leading-tight">
          <p className="text-[10px] font-semibold">{cab.profissional}</p>
          {cab.registro && <p className="text-[9px] text-gray-600">{cab.registro}</p>}
        </div>
      </div>
      <h1 className="mt-2 text-center text-[14px] font-bold uppercase tracking-wide">{titulo}</h1>
      {subtitulo && <p className="text-center text-[9px] text-gray-500">{subtitulo}</p>}
    </header>
  );
}

function Rodape() {
  return (
    <footer className="mt-3 flex justify-between border-t border-gray-300 pt-1 text-[8px] text-gray-500">
      <span>Ficha de contingência (registro manual) · transcrever para o Lumê assim que possível</span>
      <span>Transcrito em ___/___/______ por ____________________</span>
    </footer>
  );
}

/** Campo com rótulo pequeno e linha para escrever */
function C({ r, className = "" }: { r: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[8px] uppercase tracking-wide text-gray-500">{r}</p>
      <div className="h-[18px] border-b border-gray-400" />
    </div>
  );
}

/** Caixinhas de marcar */
function Caixas({ r, opcoes, className = "" }: { r?: string; opcoes: string[]; className?: string }) {
  return (
    <div className={className}>
      {r && <p className="text-[8px] uppercase tracking-wide text-gray-500">{r}</p>}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9.5px]">
        {opcoes.map((o) => (
          <span key={o} className="inline-flex items-center gap-1">
            <span className="inline-block h-[9px] w-[9px] border border-gray-600" />{o}
          </span>
        ))}
      </div>
    </div>
  );
}

function Secao({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <section className="mt-2.5 break-inside-avoid">
      <h2 className="mb-1 bg-[#e6ede6] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">{t}</h2>
      {children}
    </section>
  );
}

/** Linhas em branco para texto livre */
function Linhas({ n }: { n: number }) {
  return <div>{Array.from({ length: n }).map((_, i) => <div key={i} className="h-[17px] border-b border-gray-300" />)}</div>;
}

function Assinaturas({ paciente = true }: { paciente?: boolean }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-10 break-inside-avoid text-center text-[9px]">
      {paciente && (
        <div>
          <div className="border-t border-gray-700 pt-1">Assinatura da(o) paciente ou responsável</div>
        </div>
      )}
      <div className={paciente ? "" : "col-start-2"}>
        <div className="border-t border-gray-700 pt-1">Assinatura e carimbo da(o) profissional</div>
      </div>
    </div>
  );
}

/** Croqui para marcar à caneta (sem pontos) */
function CroquiImpresso({ croqui }: { croqui: Croqui }) {
  if (croqui !== "desenho") {
    return <img src={`/croquis/${croqui}.jpg`} alt="Croqui facial" className="mx-auto h-[300px] object-contain opacity-90" />;
  }
  return (
    <svg viewBox="0 0 300 400" className="mx-auto h-[300px]" aria-label="Croqui facial">
      <g fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
        <ellipse cx="150" cy="200" rx="108" ry="150" />
        <ellipse cx="40" cy="200" rx="10" ry="26" />
        <ellipse cx="260" cy="200" rx="10" ry="26" />
        <path d="M78 152 Q104 138 132 148" />
        <path d="M168 148 Q196 138 222 152" />
        <path d="M84 176 Q106 162 128 176 Q106 186 84 176 Z" />
        <path d="M172 176 Q194 162 216 176 Q194 186 172 176 Z" />
        <circle cx="106" cy="175" r="4" fill="#555" />
        <circle cx="194" cy="175" r="4" fill="#555" />
        <path d="M146 170 L138 232 Q150 244 162 232 L154 170" />
        <path d="M118 282 Q134 270 150 276 Q166 270 182 282 Q150 300 118 282 Z" />
        <path d="M118 282 Q150 288 182 282" />
      </g>
      <text x="14" y="392" fontSize="14" fill="#555">D</text>
      <text x="276" y="392" fontSize="14" fill="#555">E</text>
    </svg>
  );
}

/** Tabela de pontos/regiões */
function TabelaPontos({ linhas, colunas }: { linhas: number; colunas: string[] }) {
  return (
    <table className="w-full border-collapse text-[9px]">
      <thead>
        <tr>
          <th className="w-6 border border-gray-400 bg-gray-50 px-1">Nº</th>
          {colunas.map((c) => <th key={c} className="border border-gray-400 bg-gray-50 px-1 text-left font-semibold">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: linhas }).map((_, i) => (
          <tr key={i}>
            <td className="h-[16px] border border-gray-400 text-center text-gray-500">{i + 1}</td>
            {colunas.map((c) => <td key={c} className="border border-gray-400" />)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Uma folha A4. Margem maior do lado dos furos do fichário:
 * frente = furos à esquerda; verso = furos à direita.
 */
function Folha({ children, lado = "frente" }: { children: React.ReactNode; lado?: "frente" | "verso" }) {
  return (
    <div className={`folha-a4 mx-auto mb-6 bg-white py-[11mm] text-gray-900 shadow print:mb-0 print:shadow-none ${
      lado === "frente" ? "pl-[20mm] pr-[11mm]" : "pl-[11mm] pr-[20mm]"}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Blocos comuns às três fichas de procedimento                         */
/* ------------------------------------------------------------------ */

function Identificacao() {
  return (
    <Secao t="1. Identificação">
      <div className="grid grid-cols-12 gap-x-3 gap-y-1">
        <C r="Paciente (nome completo)" className="col-span-8" />
        <C r="Data de nascimento" className="col-span-4" />
        <C r="CPF" className="col-span-4" />
        <C r="Telefone" className="col-span-4" />
        <Caixas r="Sexo" opcoes={["Feminino", "Masculino", "Outro"]} className="col-span-4" />
        <C r="Data do atendimento" className="col-span-3" />
        <C r="Horário (início / fim)" className="col-span-3" />
        <C r="Sessão nº / previstas" className="col-span-3" />
        <C r="Retorno previsto" className="col-span-3" />
      </div>
    </Secao>
  );
}

function ChecagemPre({ extras }: { extras: string[] }) {
  return (
    <Secao t="2. Checagem antes do procedimento">
      <Caixas opcoes={[
        "Anamnese preenchida/atualizada", "TCLE assinado", "Termo de imagem assinado", "Fotos de antes registradas",
        "Pele íntegra, sem infecção no local", ...extras,
      ]} />
      <div className="mt-1 grid grid-cols-2 gap-x-3">
        <Caixas r="Gestante ou amamentando?" opcoes={["Não", "Sim (não realizar)"]} />
        <Caixas r="Uso de anticoagulante / AAS?" opcoes={["Não", "Sim"]} />
        <C r="Alergias" />
        <C r="Medicamentos em uso" />
      </div>
    </Secao>
  );
}

function Produto({ extra }: { extra?: React.ReactNode }) {
  return (
    <Secao t="3. Produto utilizado">
      <div className="grid grid-cols-12 gap-x-3 gap-y-1">
        <C r="Produto / marca comercial" className="col-span-5" />
        <C r="Fabricante" className="col-span-3" />
        <C r="Lote" className="col-span-2" />
        <C r="Validade" className="col-span-2" />
        {extra}
      </div>
      <p className="mt-1 text-[8px] text-gray-500">Dica: cole a etiqueta de rastreabilidade do produto no verso, quando houver.</p>
    </Secao>
  );
}

const NOME_CROQUI: Record<Croqui, string> = { feminino: "rosto feminino", masculino: "rosto masculino", desenho: "desenho" };

type Procedimento = {
  titulo: string;
  checagem: string[];
  produto: React.ReactNode;
  mapaTitulo: string;
  linhas: number;
  colunas: string[];
  totais: [string, string];
  legenda?: string;
  seguranca?: React.ReactNode;
  orientacoes: string[];
};

/** Ficha de procedimento = FRENTE + VERSO (imprimir em frente e verso) */
function FichaProcedimento({ cab, croqui, p }: { cab: Cab; croqui: Croqui; p: Procedimento }) {
  return (
    <>
      {/* FRENTE */}
      <Folha>
        <Cabecalho cab={cab} titulo={`Ficha de atendimento — ${p.titulo}`}
          subtitulo={`Registro manual de contingência · frente · ${NOME_CROQUI[croqui]}`} />
        <Identificacao />
        <ChecagemPre extras={p.checagem} />
        <Produto extra={p.produto} />
        <Secao t={`4. ${p.mapaTitulo}`}>
          <div className="grid grid-cols-[41%_59%] gap-3">
            <CroquiImpresso croqui={croqui} />
            <div>
              <TabelaPontos linhas={p.linhas} colunas={p.colunas} />
              <div className="mt-1 grid grid-cols-2 gap-3">
                <C r={p.totais[0]} />
                <C r={p.totais[1]} />
              </div>
              {p.legenda && <p className="mt-1 text-[8px] text-gray-500">{p.legenda}</p>}
            </div>
          </div>
        </Secao>
        {p.seguranca}
        <Secao t="Intercorrências">
          <Caixas opcoes={["Nenhuma", "Dor intensa", "Hematoma", "Edema importante", "Reação vasovagal", "Outra (descrever no verso)"]} />
        </Secao>
        <footer className="mt-3 flex justify-between border-t border-gray-300 pt-1 text-[8px] text-gray-500">
          <span>Continua no verso →</span>
          <span>Rubrica da(o) profissional: ____________________</span>
        </footer>
      </Folha>

      {/* VERSO */}
      <Folha lado="verso">
        <div className="mb-2 flex items-end justify-between gap-4 border-b-2 border-[#7e9a83] pb-2">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide">{p.titulo} · verso</p>
            <p className="text-[9px] text-gray-500">{cab.clinica.nome} · {cab.profissional}{cab.registro ? ` · ${cab.registro}` : ""}</p>
          </div>
          <div className="grid w-[55%] grid-cols-3 gap-3">
            <C r="Paciente" className="col-span-2" />
            <C r="Data" />
          </div>
        </div>
        <Secao t="Orientações pós-procedimento entregues">
          <Caixas opcoes={p.orientacoes} />
        </Secao>
        <Secao t="Intercorrências: descrição e conduta">
          <Linhas n={3} />
        </Secao>
        <Secao t="Evolução / processo de enfermagem (SAE)">
          <div className="grid grid-cols-2 gap-x-3">
            <div><p className="text-[8px] uppercase text-gray-500">Avaliação</p><Linhas n={3} /></div>
            <div><p className="text-[8px] uppercase text-gray-500">Diagnóstico</p><Linhas n={3} /></div>
            <div><p className="text-[8px] uppercase text-gray-500">Planejamento / implementação</p><Linhas n={3} /></div>
            <div><p className="text-[8px] uppercase text-gray-500">Evolução</p><Linhas n={3} /></div>
          </div>
        </Secao>
        <Secao t="Anotações da(o) profissional">
          <Linhas n={19} />
        </Secao>
        <div className="mt-2 grid grid-cols-[1fr_1fr_38mm] items-end gap-6 break-inside-avoid text-center text-[9px]">
          <div className="border-t border-gray-700 pt-1">Assinatura da(o) paciente ou responsável</div>
          <div className="border-t border-gray-700 pt-1">Assinatura da(o) profissional</div>
          <div className="flex h-[24mm] items-end justify-center border border-dashed border-gray-400 pb-1 text-gray-500">Carimbo</div>
        </div>
        <Rodape />
      </Folha>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* As fichas                                                            */
/* ------------------------------------------------------------------ */

const TOXINA: Procedimento = {
  titulo: "Toxina botulínica",
  checagem: ["Sem doença neuromuscular (ex.: miastenia)", "Sem uso de aminoglicosídeos"],
  produto: <>
    <C r="Unidades do frasco (U)" className="col-span-3" />
    <C r="Diluição (mL de SF 0,9%)" className="col-span-3" />
    <C r="Concentração (U por 0,1 mL)" className="col-span-3" />
    <C r="Reconstituído em (data/hora)" className="col-span-3" />
    <Caixas r="Frasco compartilhado?" opcoes={["Não", "Sim"]} className="col-span-4" />
    <C r="Agulha / seringa" className="col-span-8" />
  </>,
  mapaTitulo: "Mapa de aplicação (marque os pontos numerados no rosto)",
  linhas: 15,
  colunas: ["Região / músculo", "Unidades (U)"],
  totais: ["Total aplicado (U)", "Retoque previsto para"],
  orientacoes: [
    "Não deitar por 4 horas", "Não massagear/manipular a área", "Evitar atividade física intensa por 24 h",
    "Evitar calor intenso (sauna, sol) por 24–48 h", "Retorno para avaliação em 15 dias", "Sinais de alerta explicados",
  ],
};

const PREENCHIMENTO: Procedimento = {
  titulo: "Preenchimento com ácido hialurônico",
  checagem: ["Hialuronidase disponível na sala (kit de intercorrência)", "Sem herpes ativo (se região perioral)"],
  produto: <>
    <C r="Volume da seringa (mL)" className="col-span-3" />
    <C r="Nº de seringas usadas" className="col-span-3" />
    <Caixas r="Com lidocaína?" opcoes={["Sim", "Não"]} className="col-span-3" />
    <C r="Anestesia (tipo / volume)" className="col-span-3" />
  </>,
  mapaTitulo: "Mapa de aplicação (marque os pontos numerados no rosto)",
  linhas: 12,
  colunas: ["Região", "Volume (mL)", "Plano", "Agulha/cânula · G"],
  totais: ["Volume total aplicado (mL)", "Técnica (bolus, retroinjeção, leque…)"],
  legenda: "Plano: SP = supraperiosteal · SC = subcutâneo · D = dérmico",
  seguranca: (
    <Secao t="Segurança vascular (monitorar durante e após)">
      <Caixas opcoes={[
        "Sem palidez/branqueamento", "Sem livedo (manchas arroxeadas)", "Sem dor desproporcional",
        "Sem alteração visual", "Enchimento capilar normal",
      ]} />
      <div className="mt-1 grid grid-cols-3 gap-x-3">
        <Caixas r="Hialuronidase utilizada?" opcoes={["Não", "Sim"]} />
        <C r="Hialuronidase: produto / lote" />
        <C r="Quantidade (UI) e horário" />
      </div>
    </Secao>
  ),
  orientacoes: [
    "Compressas frias nas primeiras 24 h", "Não massagear, salvo orientação", "Evitar maquiagem por 12 h",
    "Evitar atividade física e calor por 24–48 h", "Procurar a profissional se dor intensa ou mancha na pele",
    "Retorno em 15–30 dias",
  ],
};

const BIOESTIMULADOR: Procedimento = {
  titulo: "Bioestimulador de colágeno",
  checagem: ["Sem doença autoimune ativa", "Sem histórico de queloide/granuloma"],
  produto: <>
    <Caixas r="Tipo" opcoes={["Ácido poli-L-lático (PLLA)", "Hidroxiapatita de cálcio (CaHA)", "Policaprolactona (PCL)", "Outro"]} className="col-span-12" />
    <C r="Reconstituição / diluição (volume e diluente)" className="col-span-6" />
    <C r="Reconstituído em (data/hora)" className="col-span-3" />
    <C r="Tempo de hidratação" className="col-span-3" />
    <C r="Anestesia (tipo / volume)" className="col-span-6" />
    <C r="Agulha / cânula · calibre (G)" className="col-span-6" />
  </>,
  mapaTitulo: "Mapa de aplicação (marque regiões, vetores ou pontos no rosto)",
  linhas: 11,
  colunas: ["Região", "Volume (mL)", "Técnica (leque, vetores, retroinjeção)"],
  totais: ["Volume total aplicado (mL)", "Próxima sessão / intervalo"],
  orientacoes: [
    "Massagem orientada (ex.: regra 5-5-5, quando PLLA)", "Compressas frias se edema", "Evitar calor intenso por 48 h",
    "Evitar atividade física intensa por 24 h", "Resultado gradual (semanas a meses) explicado", "Retorno agendado",
  ],
};

const PROCEDIMENTOS = { toxina: TOXINA, preenchimento: PREENCHIMENTO, bioestimulador: BIOESTIMULADOR } as const;

/** Linha Sim/Não com espaço para "qual?" */
function SimNao({ perguntas }: { perguntas: string[] }) {
  return (
    <table className="w-full border-collapse text-[9px]">
      <thead>
        <tr>
          <th className="border border-gray-400 bg-gray-50 px-1 text-left font-semibold">Pergunta</th>
          <th className="w-9 border border-gray-400 bg-gray-50">Não</th>
          <th className="w-9 border border-gray-400 bg-gray-50">Sim</th>
          <th className="w-[38%] border border-gray-400 bg-gray-50 px-1 text-left font-semibold">Qual? / observação</th>
        </tr>
      </thead>
      <tbody>
        {perguntas.map((q) => (
          <tr key={q}>
            <td className="h-[16px] border border-gray-400 px-1">{q}</td>
            <td className="border border-gray-400 text-center"><span className="inline-block h-[8px] w-[8px] border border-gray-600" /></td>
            <td className="border border-gray-400 text-center"><span className="inline-block h-[8px] w-[8px] border border-gray-600" /></td>
            <td className="border border-gray-400" />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** FICHA DE ANAMNESE (frente e verso) — para o fichário */
function FichaAnamnese({ cab }: { cab: Cab }) {
  return (
    <>
      <Folha>
        <Cabecalho cab={cab} titulo="Ficha de anamnese" subtitulo="Frente · preencher na primeira consulta e atualizar quando houver mudanças" />
        <Secao t="1. Dados pessoais">
          <div className="grid grid-cols-12 gap-x-3 gap-y-1">
            <C r="Nome completo" className="col-span-8" />
            <C r="Data de nascimento / idade" className="col-span-4" />
            <C r="CPF" className="col-span-4" />
            <C r="RG" className="col-span-3" />
            <Caixas r="Sexo" opcoes={["Feminino", "Masculino", "Outro"]} className="col-span-5" />
            <C r="Telefone / WhatsApp" className="col-span-4" />
            <C r="E-mail" className="col-span-5" />
            <C r="Profissão" className="col-span-3" />
            <C r="Endereço" className="col-span-8" />
            <C r="CEP" className="col-span-4" />
            <C r="Cidade / UF" className="col-span-5" />
            <C r="Contato de emergência (nome e telefone)" className="col-span-7" />
            <Caixas r="Como conheceu a clínica" opcoes={["Instagram", "Indicação", "Google", "Passou em frente", "Outro"]} className="col-span-12" />
          </div>
        </Secao>
        <Secao t="2. Queixa principal e objetivos">
          <p className="text-[8px] uppercase text-gray-500">O que incomoda / o que deseja melhorar</p>
          <Linhas n={3} />
          <p className="mt-1 text-[8px] uppercase text-gray-500">Expectativas com o tratamento</p>
          <Linhas n={2} />
        </Secao>
        <Secao t="3. Avaliação da pele">
          <Caixas r="Fototipo (Fitzpatrick)" opcoes={[
            "I — muito clara", "II — clara", "III — morena clara", "IV — morena moderada", "V — morena escura", "VI — negra",
          ]} />
          <Caixas r="Tipo de pele" opcoes={["Normal", "Seca", "Oleosa", "Mista", "Sensível"]} className="mt-1" />
          <Caixas r="Condições observadas" opcoes={[
            "Acne ativa", "Rosácea", "Melasma / manchas", "Flacidez", "Rugas dinâmicas", "Rugas estáticas", "Cicatrizes", "Outra",
          ]} className="mt-1" />
        </Secao>
        <Secao t="4. Histórico de saúde">
          <SimNao perguntas={[
            "Gestante, amamentando ou tentando engravidar?",
            "Doença neuromuscular (ex.: miastenia gravis)?",
            "Distúrbio de coagulação ou uso de anticoagulante / AAS?",
            "Histórico de queloide ou cicatriz hipertrófica?",
            "Herpes labial recorrente?",
            "Doença autoimune (lúpus, artrite reumatoide…)?",
            "Diabetes?",
            "Hipertensão ou doença cardíaca?",
            "Epilepsia / convulsões?",
            "Câncer ou tratamento oncológico (atual ou anterior)?",
            "Uso de isotretinoína (Roacutan) nos últimos 6 meses?",
            "Alergia a anestésicos (ex.: lidocaína)?",
            "Alergia a medicamentos, alimentos ou látex?",
            "Infecção ou lesão ativa na região a tratar?",
          ]} />
        </Secao>
        <footer className="mt-2 flex justify-between border-t border-gray-300 pt-1 text-[8px] text-gray-500">
          <span>Continua no verso →</span>
          <span>Rubrica da(o) paciente: ____________ · da(o) profissional: ____________</span>
        </footer>
      </Folha>

      <Folha lado="verso">
        <div className="mb-2 flex items-end justify-between gap-4 border-b-2 border-[#7e9a83] pb-2">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide">Ficha de anamnese · verso</p>
            <p className="text-[9px] text-gray-500">{cab.clinica.nome} · {cab.profissional}{cab.registro ? ` · ${cab.registro}` : ""}</p>
          </div>
          <div className="grid w-[55%] grid-cols-3 gap-3">
            <C r="Paciente" className="col-span-2" />
            <C r="Data" />
          </div>
        </div>
        <Secao t="5. Medicamentos, alergias e doenças">
          <div className="grid grid-cols-2 gap-x-3">
            <div><p className="text-[8px] uppercase text-gray-500">Medicamentos em uso (nome e dose)</p><Linhas n={3} /></div>
            <div><p className="text-[8px] uppercase text-gray-500">Alergias</p><Linhas n={3} /></div>
            <div><p className="text-[8px] uppercase text-gray-500">Doenças preexistentes</p><Linhas n={2} /></div>
            <div><p className="text-[8px] uppercase text-gray-500">Cirurgias anteriores (inclusive plásticas)</p><Linhas n={2} /></div>
          </div>
        </Secao>
        <Secao t="6. Procedimentos estéticos anteriores">
          <Caixas opcoes={["Nunca fez", "Toxina", "Ácido hialurônico", "Bioestimulador", "Fios", "PMMA / preenchimento permanente", "Peeling / laser", "Outro"]} />
          <table className="mt-1 w-full border-collapse text-[9px]">
            <thead>
              <tr>{["Procedimento", "Produto", "Região", "Quando", "Teve intercorrência?"].map((c) => (
                <th key={c} className="border border-gray-400 bg-gray-50 px-1 text-left font-semibold">{c}</th>
              ))}</tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((__, j) => <td key={j} className="h-[16px] border border-gray-400" />)}</tr>
              ))}
            </tbody>
          </table>
        </Secao>
        <Secao t="7. Hábitos">
          <Caixas opcoes={[
            "Tabagismo", "Consumo de álcool", "Atividade física regular", "Exposição solar frequente",
            "Usa protetor solar diariamente", "Dorme bem (7 h ou mais)", "Bebe bastante água",
          ]} />
        </Secao>
        <Secao t="8. Avaliação da profissional / contraindicações">
          <Linhas n={4} />
        </Secao>
        <Secao t="Atualizações da anamnese">
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>{["Data", "O que mudou", "Rubrica"].map((c, i) => (
                <th key={c} className={`border border-gray-400 bg-gray-50 px-1 text-left font-semibold ${i === 1 ? "" : "w-[18%]"}`}>{c}</th>
              ))}</tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 3 }).map((__, j) => <td key={j} className="h-[16px] border border-gray-400" />)}</tr>
              ))}
            </tbody>
          </table>
        </Secao>
        <p className="mt-3 text-[9.5px] leading-relaxed">
          Declaro que as informações acima são verdadeiras e que não omiti nenhum dado sobre minha saúde. Comprometo-me a
          informar a profissional sobre qualquer mudança (novos medicamentos, gestação, doenças). Autorizo o registro destas
          informações no meu prontuário, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
        </p>
        <div className="mt-8 grid grid-cols-[1fr_1fr_38mm] items-end gap-6 break-inside-avoid text-center text-[9px]">
          <div className="border-t border-gray-700 pt-1">Assinatura da(o) paciente ou responsável</div>
          <div className="border-t border-gray-700 pt-1">Assinatura da(o) profissional</div>
          <div className="flex h-[22mm] items-end justify-center border border-dashed border-gray-400 pb-1 text-gray-500">Carimbo</div>
        </div>
        <Rodape />
      </Folha>
    </>
  );
}

function TermoImagem({ cab }: { cab: Cab }) {
  const clinica = cab.clinica.nome ?? "";
  return (
    <Folha>
      <Cabecalho cab={cab} titulo="Termo de autorização de uso de imagem" />
      <div className="space-y-3 text-[11px] leading-relaxed">
        <p>Eu, ______________________________________________________________, CPF ____________________,</p>
        <p>autorizo a clínica <b>{clinica}</b> a registrar fotografias da minha face e/ou corpo antes, durante e após os procedimentos estéticos, para fins de documentação no meu prontuário e acompanhamento da evolução do tratamento.</p>
        <p>As imagens serão armazenadas de forma segura e sigilosa, com acesso restrito aos profissionais responsáveis pelo meu atendimento, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</p>
        <p>Estou ciente de que posso revogar esta autorização a qualquer momento, mediante solicitação.</p>
        <div className="rounded border border-gray-400 p-3">
          <p className="mb-2 font-semibold">Uso das imagens para divulgação (marque UMA opção):</p>
          <p className="mb-1"><span className="mr-2 inline-block h-[11px] w-[11px] border border-gray-700 align-middle" />
            <b>AUTORIZO</b> o uso das minhas fotografias de antes e depois para divulgação (redes sociais, site e materiais da clínica), <b>sem identificação do meu nome</b>. Posso revogar a qualquer momento.</p>
          <p><span className="mr-2 inline-block h-[11px] w-[11px] border border-gray-700 align-middle" />
            <b>NÃO AUTORIZO</b> o uso das minhas fotografias para divulgação. As imagens serão usadas somente no meu prontuário.</p>
        </div>
        <p className="pt-4">Local e data: ______________________________, ____/____/________</p>
      </div>
      <Assinaturas />
      <div className="mt-8 text-[9px] text-gray-600">
        <p className="font-semibold">Revogação (preencher somente se a paciente pedir para cancelar):</p>
        <p>Em ____/____/________ a paciente revogou esta autorização. Motivo: __________________________________________</p>
        <p className="mt-4">Assinatura da paciente: ______________________________</p>
      </div>
      <Rodape />
    </Folha>
  );
}

function TCLEGeral({ cab }: { cab: Cab }) {
  const clinica = cab.clinica.nome ?? "";
  const prof = [cab.profissional, cab.registro].filter(Boolean).join(" — ");
  return (
    <Folha>
      <Cabecalho cab={cab} titulo="Termo de consentimento livre e esclarecido" subtitulo="Procedimento estético minimamente invasivo" />
      <div className="space-y-2 text-[10px] leading-relaxed">
        <p>Eu, ______________________________________________________________, CPF ____________________,
          declaro que fui informada(o) de forma clara pela profissional <b>{prof}</b>, da clínica <b>{clinica}</b>,
          sobre o procedimento de ____________________________________________ (ver anexo específico), e que tive a oportunidade
          de fazer perguntas, que foram respondidas de forma satisfatória.</p>
        <p><b>1. Natureza do procedimento.</b> Trata-se de procedimento estético minimamente invasivo, realizado por meio de injeções
          ou dispositivos na pele e tecidos, sem cirurgia. O procedimento específico, seus benefícios, riscos, contraindicações e
          cuidados estão descritos no <b>anexo</b> deste termo, que faz parte dele.</p>
        <p><b>2. Riscos gerais.</b> Fui informada(o) de que todo procedimento injetável pode causar, entre outros: dor ou ardor no local,
          vermelhidão, inchaço (edema), manchas roxas (hematomas), sensibilidade, assimetria, infecção, reação alérgica e, mais
          raramente, complicações que exigem tratamento adicional. Os riscos específicos estão no anexo.</p>
        <p><b>3. Informações de saúde.</b> Declaro que informei à profissional, sem omitir nada, minhas condições de saúde, doenças,
          medicamentos em uso, alergias, procedimentos anteriores, gestação ou amamentação. Estou ciente de que omitir informações
          pode aumentar os riscos.</p>
        <p><b>4. Resultados.</b> Estou ciente de que a estética não é uma ciência exata, de que os resultados variam de pessoa para pessoa,
          dependem da resposta do meu organismo e dos cuidados após o procedimento, e de que não há garantia de um resultado
          específico. Podem ser necessárias sessões complementares ou retoques.</p>
        <p><b>5. Cuidados.</b> Comprometo-me a seguir as orientações recebidas antes e depois do procedimento e a comparecer aos retornos
          agendados. Em caso de dor intensa, alteração de cor da pele, febre ou qualquer sinal fora do esperado, devo procurar a
          profissional imediatamente.</p>
        <p><b>6. Alternativas e desistência.</b> Fui informada(o) das alternativas existentes, inclusive a de não realizar o procedimento.
          Sei que posso desistir a qualquer momento antes da sua realização, sem qualquer prejuízo.</p>
        <p><b>7. Registro e dados.</b> Autorizo o registro deste atendimento no meu prontuário, físico e eletrônico, conforme a Lei Geral de
          Proteção de Dados (Lei nº 13.709/2018).</p>
        <p><b>8. Declaração.</b> Declaro que li e compreendi este termo e seu anexo, que minhas dúvidas foram esclarecidas e que consinto,
          de forma livre e voluntária, com a realização do procedimento.</p>
        <p className="pt-2">Local e data: ______________________________, ____/____/________</p>
      </div>
      <Assinaturas />
      <Rodape />
    </Folha>
  );
}

function AnexoTCLE({ cab, nome, tcle }: { cab: Cab; nome: string; tcle: ConteudoTCLE | null }) {
  const lista = (itens?: string[]) => (
    <ul className="ml-4 list-disc">{(itens ?? []).map((i) => <li key={i}>{i}</li>)}</ul>
  );
  return (
    <Folha>
      <Cabecalho cab={cab} titulo={`Anexo do TCLE — ${nome}`} subtitulo="Parte integrante do Termo de Consentimento Livre e Esclarecido" />
      {!tcle ? (
        <p className="text-[10px] text-gray-500">Texto deste procedimento não encontrado no sistema.</p>
      ) : (
        <div className="space-y-2 text-[10px] leading-relaxed">
          <p><b>O procedimento.</b> {tcle.descricao}</p>
          <div><b>Benefícios esperados</b>{lista(tcle.beneficios)}</div>
          <div><b>Riscos e possíveis complicações</b>{lista(tcle.riscos)}</div>
          <div><b>Contraindicações</b>{lista(tcle.contraindicacoes)}</div>
          <div><b>Cuidados após o procedimento</b>{lista(tcle.cuidados)}</div>
          <p><b>Alternativas.</b> {tcle.alternativas}</p>
        </div>
      )}
      <div className="mt-4 text-[10px]">
        <p>Paciente: ______________________________________________ Data: ____/____/________</p>
      </div>
      <Assinaturas />
      <Rodape />
    </Folha>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                               */
/* ------------------------------------------------------------------ */

export default function FichasPage() {
  const { profissional, carregando } = useProfissional();
  const [cab, setCab] = useState<Cab | null>(null);
  const [tcles, setTcles] = useState<Record<string, ConteudoTCLE | null>>({});
  const [sel, setSel] = useState<Record<IdDoc, boolean>>({
    anamnese: true, toxina: true, preenchimento: true, bioestimulador: true, imagem: true, tcle: true,
  });
  const [anexos, setAnexos] = useState<Record<string, boolean>>({
    "toxina-botulinica": true, "preenchimento-acido-hialuronico": true, "bioestimulador-colageno": true,
  });
  // Versões de cada ficha: uma por rosto (padrão: feminino e masculino)
  const [versoes, setVersoes] = useState<Record<Croqui, boolean>>({ feminino: true, masculino: true, desenho: false });

  useEffect(() => {
    if (!profissional) return;
    (async () => {
      const [cli, tpl] = await Promise.all([
        supabase.from("clinics").select("*").eq("id", profissional.clinic_id).maybeSingle(),
        supabase.from("procedure_templates").select("slug, tcle").in("slug", ANEXOS.map((a) => a.slug)),
      ]);
      let logo: string | null = null;
      if (cli.data?.logo_path) {
        const { data } = await supabase.storage.from("clinic-assets").createSignedUrl(cli.data.logo_path, 3600);
        logo = data?.signedUrl ?? null;
      }
      const cred = credencialPrincipal(profissional);
      const registro = cred?.conselho && cred.conselho !== "nenhum"
        ? `${cred.conselho}-${cred.uf ?? ""} ${cred.numero_registro ?? ""}`.trim() : "";
      setCab({ clinica: cli.data ?? {}, logo, profissional: profissional.nome, registro });
      // Nome do arquivo ao salvar em PDF (sem "Lumê — Prontuário Estético")
      document.title = `Fichas - ${cli.data?.nome ?? "clinica"}`;
      const t: Record<string, ConteudoTCLE | null> = {};
      for (const r of tpl.data ?? []) t[r.slug as string] = (r.tcle as ConteudoTCLE) ?? null;
      setTcles(t);
    })();
  }, [profissional]);

  if (carregando || !profissional || !cab) return <Carregando />;

  const nenhum = !Object.values(sel).some(Boolean);

  // Imprime só um grupo (fichas em frente e verso; termos só na frente)
  function imprimirSo(ids: IdDoc[]) {
    setSel({
      anamnese: ids.includes("anamnese"), toxina: ids.includes("toxina"), preenchimento: ids.includes("preenchimento"),
      bioestimulador: ids.includes("bioestimulador"), imagem: ids.includes("imagem"), tcle: ids.includes("tcle"),
    });
    window.setTimeout(() => window.print(), 300);
  }

  return (
    <div className="min-h-dvh bg-gray-100 print:bg-white">
      {/* Opções (não saem na impressão) */}
      <div className="sticky top-0 z-10 border-b bg-white/95 p-3 backdrop-blur print:hidden">
        <div className="mx-auto max-w-3xl space-y-2">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl text-salvia-escuro" aria-label="Voltar">←</Link>
            <h1 className="flex-1 font-semibold">Fichas para impressão</h1>
            <button onClick={() => window.print()} disabled={nenhum}
              className="rounded-xl bg-salvia px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              🖨 Imprimir selecionados
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" className="rounded-lg bg-creme px-3 py-1.5"
              onClick={() => imprimirSo(["anamnese", "toxina", "preenchimento", "bioestimulador"])}>
              🖨 Só as fichas (frente e verso)
            </button>
            <button type="button" className="rounded-lg bg-creme px-3 py-1.5"
              onClick={() => imprimirSo(["imagem", "tcle"])}>
              🖨 Só os termos (só frente)
            </button>
          </div>
          <p className="text-xs text-tinta/60">
            Para dias sem energia ou internet: imprima com antecedência, preencha à mão e depois transcreva para o Lumê.
            O cabeçalho sai com os dados da sua clínica (edite em ⚙ Configurações).
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {DOCUMENTOS.map((d) => (
              <label key={d.id} className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-[#7e9a83]" checked={sel[d.id]}
                  onChange={(e) => setSel({ ...sel, [d.id]: e.target.checked })} />
                {d.titulo}
              </label>
            ))}
          </div>
          {sel.tcle && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-tinta/60">Anexos do TCLE:</span>
              {ANEXOS.map((a) => (
                <label key={a.slug} className="flex items-center gap-1.5">
                  <input type="checkbox" className="accent-[#7e9a83]" checked={anexos[a.slug]}
                    onChange={(e) => setAnexos({ ...anexos, [a.slug]: e.target.checked })} />
                  {a.nome}
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-tinta/60">Fichas com rosto:</span>
            {(["feminino", "masculino", "desenho"] as Croqui[]).map((c) => (
              <label key={c} className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-[#7e9a83]" checked={versoes[c]}
                  onChange={(e) => setVersoes({ ...versoes, [c]: e.target.checked })} />
                {c === "feminino" ? "Feminino" : c === "masculino" ? "Masculino" : "Desenho neutro"}
              </label>
            ))}
          </div>
          <p className="rounded-lg bg-salvia-claro px-3 py-2 text-xs">
            📄 Cada ficha de procedimento tem <b>frente e verso</b> (verso com anotações e assinatura): imprima as fichas com
            <b> “Frente e verso”</b> ligado e os termos separados, só na frente. Em “Mais configurações”, desmarque
            <b> “Cabeçalhos e rodapés”</b>.
          </p>
        </div>
      </div>

      {/* Folhas */}
      <div className="py-6 print:py-0">
        {sel.anamnese && <FichaAnamnese cab={cab} />}
        {(["toxina", "preenchimento", "bioestimulador"] as const).filter((k) => sel[k]).map((k) =>
          (["feminino", "masculino", "desenho"] as Croqui[]).filter((c) => versoes[c]).map((c) => (
            <FichaProcedimento key={`${k}-${c}`} cab={cab} croqui={c} p={PROCEDIMENTOS[k]} />
          )))}
        {sel.imagem && <TermoImagem cab={cab} />}
        {sel.tcle && <TCLEGeral cab={cab} />}
        {sel.tcle && ANEXOS.filter((a) => anexos[a.slug]).map((a) => (
          <AnexoTCLE key={a.slug} cab={cab} nome={a.nome} tcle={tcles[a.slug] ?? null} />
        ))}
      </div>
    </div>
  );
}
