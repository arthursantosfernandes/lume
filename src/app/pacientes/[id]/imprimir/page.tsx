"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfissional, credencialPrincipal } from "@/lib/useProfissional";
import { calcularIdade, formatarData, formatarDataHora, mascaraCPF, mascaraTelefone } from "@/lib/utils";
import { Carregando } from "@/components/Carregando";
import { MapaFacial, type Croqui, type Marcacao } from "@/components/MapaFacial";
import { exibirValor, unidadeDoMapa, type Campo, type Template } from "@/components/CamposProcedimento";
import { ROTULOS, nomeMotivo, valorLegivel, type Retificacao } from "@/components/Retificacoes";

/**
 * Prontuário para impressão / PDF.
 * Usa o "Imprimir" do navegador; lá dá para escolher "Salvar como PDF".
 */

type Dado = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const CHECK: [string, string][] = [
  ["gestante_lactante", "Gestante ou amamentando"],
  ["doenca_neuromuscular", "Doença neuromuscular"],
  ["disturbio_coagulacao", "Distúrbio de coagulação / anticoagulante"],
  ["historico_queloide", "Histórico de queloide"],
  ["herpes_recorrente", "Herpes labial recorrente"],
];

function Info({ r, v }: { r: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <div className="break-inside-avoid">
      <dt className="text-[10px] uppercase tracking-wide text-gray-500">{r}</dt>
      <dd className="whitespace-pre-wrap text-sm">{v}</dd>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide text-gray-700">{titulo}</h2>
      {children}
    </section>
  );
}

export default function ImprimirPage() {
  const { id } = useParams<{ id: string }>();
  const { profissional, carregando } = useProfissional();
  const [d, setD] = useState<{
    clinica: Dado; logo: string | null; paciente: Dado; anamnese: Dado | null;
    termos: Dado[]; atendimentos: Dado[]; fotos: Dado[]; retificacoes: Retificacao[];
  } | null>(null);
  const [inc, setInc] = useState({ anamnese: true, atendimentos: true, termos: true, fotos: false });
  // Assinatura eletrônica da(o) profissional
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);
  const [assinado, setAssinado] = useState<{ id: string; em: string; hash: string } | null>(null);
  const [assinando, setAssinando] = useState(false);
  const [erroAss, setErroAss] = useState("");
  const [verificado, setVerificado] = useState(false);
  const [alteradoAposAssinatura, setAlteradoAposAssinatura] = useState(false);

  // Mudou o que entra no documento? Confere de novo se esse conteúdo já foi assinado.
  useEffect(() => { setAssinado(null); setVerificado(false); }, [inc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profissional) return;
    supabase.from("professionals").select("assinatura_path").eq("id", profissional.id).maybeSingle()
      .then(async ({ data }) => {
        if (!data?.assinatura_path) return;
        const { data: u } = await supabase.storage.from("clinic-assets").createSignedUrl(data.assinatura_path, 3600);
        setAssinaturaUrl(u?.signedUrl ?? null);
      });
  }, [profissional]);

  /** Código (SHA-256) do conteúdo do prontuário exibido, sem o rodapé da assinatura */
  async function hashConteudo(): Promise<string | null> {
    const el = document.getElementById("prontuario-conteudo");
    if (!el) return null;
    const copia = el.cloneNode(true) as HTMLElement;
    copia.querySelectorAll("footer[data-assinatura], [data-sem-hash]").forEach((n) => n.remove());
    const texto = (copia.textContent ?? "").replace(/\s+/g, " ").trim();
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Ao abrir: se o prontuário já foi assinado e o conteúdo não mudou, mostra a assinatura salva
  useEffect(() => {
    if (!d || verificado) return;
    const t = window.setTimeout(async () => {
      const hash = await hashConteudo();
      const { data } = await supabase.from("assinaturas_prontuario").select("id, assinado_em, hash_documento")
        .eq("patient_id", id).order("assinado_em", { ascending: false }).limit(20);
      const igual = (data ?? []).find((a) => a.hash_documento === hash);
      if (igual && hash) setAssinado({ id: igual.id, em: igual.assinado_em, hash });
      else setAlteradoAposAssinatura((data ?? []).length > 0);
      setVerificado(true);
    }, 600); // espera as imagens/textos aparecerem
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, inc, verificado]);

  /** Registra a assinatura do conteúdo exibido no banco */
  async function assinar() {
    setErroAss("");
    setAssinando(true);
    const hash = await hashConteudo();
    if (!hash) { setAssinando(false); return; }
    const { data, error } = await supabase.rpc("assinar_prontuario", { p_patient: id, p_hash: hash });
    setAssinando(false);
    if (error || !data) return setErroAss(error?.message ?? "Não foi possível assinar.");
    const r = data as { id: string; assinado_em: string };
    setAssinado({ id: r.id, em: r.assinado_em, hash });
  }

  useEffect(() => {
    if (!profissional) return;
    (async () => {
      const [cli, pac, ana, ter, ate, fot, ret] = await Promise.all([
        supabase.from("clinics").select("*").eq("id", profissional.clinic_id).maybeSingle(),
        supabase.from("patients").select("*").eq("id", id).maybeSingle(),
        supabase.from("anamneses").select("*").eq("patient_id", id).order("created_at", { ascending: false }).limit(1),
        supabase.from("consents").select("*").eq("patient_id", id).is("revogado_em", null).order("aceito_em"),
        supabase.from("atendimentos")
          .select("*, procedure_templates(id, slug, nome, categoria, tipo_mapa, tipo_marcacao, campos), professionals(nome), professional_credentials(conselho, numero_registro, uf)")
          .eq("patient_id", id).order("data_atendimento"),
        supabase.from("photos").select("*").eq("patient_id", id).order("tirada_em"),
        supabase.from("retificacoes").select("*").eq("patient_id", id).order("created_at"),
      ]);
      let logo: string | null = null;
      if (cli.data?.logo_path) {
        const { data } = await supabase.storage.from("clinic-assets").createSignedUrl(cli.data.logo_path, 3600);
        logo = data?.signedUrl ?? null;
      }
      const fotos = (fot.data ?? []) as Dado[];
      if (fotos.length) {
        const { data } = await supabase.storage.from("patient-photos").createSignedUrls(fotos.map((f) => f.storage_path), 3600);
        fotos.forEach((f, i) => (f.url = data?.[i]?.signedUrl));
      }
      setD({
        clinica: cli.data ?? {}, logo, paciente: pac.data ?? {}, anamnese: ana.data?.[0] ?? null,
        termos: ter.data ?? [], atendimentos: ate.data ?? [], fotos, retificacoes: (ret.data ?? []) as Retificacao[],
      });
    })();
  }, [profissional, id]);

  if (carregando || !profissional || !d) return <Carregando />;

  const { clinica: c, paciente: p, anamnese: a } = d;
  const cred = credencialPrincipal(profissional);
  const registro = cred?.conselho && cred.conselho !== "nenhum"
    ? `${cred.conselho}-${cred.uf ?? ""} ${cred.numero_registro ?? ""}` : "";
  const endereco = [
    [c.endereco, c.numero].filter(Boolean).join(", "), c.complemento, c.bairro,
    [c.cidade, c.uf].filter(Boolean).join(" - "), c.cep,
  ].filter(Boolean).join(" · ");
  const idade = calcularIdade(p.data_nascimento);

  return (
    <div className="min-h-dvh bg-gray-100 print:bg-white">
      {/* Barra de opções (não sai na impressão) */}
      <div className="sticky top-0 z-10 border-b bg-white p-3 print:hidden">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <Link href={`/pacientes/${id}`} className="text-xl text-salvia-escuro">←</Link>
          <span className="text-sm font-medium">Incluir:</span>
          {([["anamnese", "Anamnese"], ["atendimentos", "Atendimentos"], ["termos", "Termos"], ["fotos", "Fotos"]] as const)
            .map(([k, t]) => (
              <label key={k} className="flex items-center gap-1 text-sm">
                <input type="checkbox" className="accent-salvia" checked={inc[k]}
                  onChange={(e) => setInc({ ...inc, [k]: e.target.checked })} />
                {t}
              </label>
            ))}
          <div className="ml-auto flex gap-2">
            {assinado ? (
              <span className="rounded-xl bg-salvia-claro px-3 py-2 text-sm font-medium text-salvia-escuro">✅ Assinado</span>
            ) : (
              <button onClick={assinar} disabled={assinando}
                className="rounded-xl border border-salvia px-3 py-2 text-sm font-semibold text-salvia-escuro disabled:opacity-50">
                {assinando ? "Assinando…" : "✍️ Assinar eletronicamente"}
              </button>
            )}
            <button onClick={() => window.print()} className="rounded-xl bg-salvia px-4 py-2 text-sm font-semibold text-white">
              🖨 Imprimir / PDF
            </button>
          </div>
        </div>
        {erroAss && <p className="mx-auto mt-2 max-w-3xl rounded-lg bg-red-50 p-2 text-sm text-red-700">{erroAss}</p>}
        {!assinado && !assinaturaUrl && (
          <p className="mx-auto mt-2 max-w-3xl text-xs text-tinta/50">
            Dica: desenhe sua assinatura em ⚙ Configurações → Minha assinatura para ela aparecer no prontuário assinado.
          </p>
        )}
      </div>

      {/* Folha */}
      <article id="prontuario-conteudo" className="mx-auto my-4 max-w-3xl bg-white p-8 text-gray-900 shadow print:my-0 print:max-w-none print:p-0 print:shadow-none">
        {/* Cabeçalho da clínica */}
        <header className="flex items-center gap-4 border-b-2 border-salvia pb-4">
          {d.logo && <img src={d.logo} alt="" className="h-16 w-16 object-contain" />}
          <div className="flex-1">
            <p className="text-lg font-bold">{c.nome}</p>
            {endereco && <p className="text-xs text-gray-600">{endereco}</p>}
            <p className="text-xs text-gray-600">
              {[c.telefone && mascaraTelefone(c.telefone), c.email, c.documento && `CNPJ/CPF ${c.documento}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-wide text-salvia-escuro">Prontuário</p>
            <p data-sem-hash className="text-[10px] text-gray-500">Emitido em {formatarDataHora(new Date().toISOString())}</p>
          </div>
        </header>

        {/* Paciente */}
        <Secao titulo="Identificação da paciente">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 print:grid-cols-3">
            <Info r="Nome" v={p.nome} />
            <Info r="Nascimento" v={p.data_nascimento ? `${formatarData(p.data_nascimento)} (${idade} anos)` : null} />
            <Info r="Sexo" v={p.sexo ? p.sexo.charAt(0).toUpperCase() + p.sexo.slice(1) : null} />
            <Info r="CPF" v={p.cpf ? mascaraCPF(p.cpf) : null} />
            <Info r="Telefone" v={p.telefone ? mascaraTelefone(p.telefone) : null} />
            <Info r="E-mail" v={p.email} />
            <Info r="Endereço" v={[p.endereco, p.cidade, p.uf].filter(Boolean).join(", ") || null} />
            <Info r="Profissão" v={p.profissao} />
          </dl>
        </Secao>

        {/* Anamnese */}
        {inc.anamnese && a && (
          <Secao titulo={`Anamnese (atualizada em ${formatarData(a.created_at)})`}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              <Info r="Queixa principal" v={a.queixa_principal} />
              <Info r="Objetivos" v={a.objetivos} />
              <Info r="Fototipo" v={a.fototipo ? `Fitzpatrick ${a.fototipo}` : null} />
              <Info r="Tipo de pele" v={a.tipo_pele} />
              <Info r="Alergias" v={a.alergias} />
              <Info r="Medicamentos em uso" v={a.medicamentos_em_uso} />
              <Info r="Doenças preexistentes" v={a.doencas_preexistentes} />
              <Info r="Procedimentos anteriores" v={a.procedimentos_anteriores} />
              <Info r="Cirurgias anteriores" v={a.cirurgias_anteriores} />
              <Info r="Hábitos" v={a.habitos} />
              <Info r="Contraindicações / observações" v={a.contraindicacoes} />
            </dl>
            <ul className="mt-3 grid grid-cols-2 gap-x-6 text-sm">
              {CHECK.map(([k, t]) => (
                <li key={k} className="flex justify-between border-b border-dotted border-gray-200 py-0.5">
                  <span>{t}</span>
                  <b>{a[k] === true ? "Sim" : a[k] === false ? "Não" : "—"}</b>
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {/* Atendimentos */}
        {inc.atendimentos && d.atendimentos.length > 0 && (
          <Secao titulo="Atendimentos">
            <div className="space-y-5">
              {d.atendimentos.map((at) => {
                const t = at.procedure_templates as Template | null;
                const cr = at.professional_credentials;
                const mapa = (at.mapa ?? []) as Marcacao[];
                return (
                  <div key={at.id} className="break-inside-avoid rounded-lg border border-gray-200 p-4">
                    <div className="mb-2 flex justify-between">
                      <p className="font-bold">
                        {t?.nome ?? "Procedimento"}
                        {at.status === "retificado" && <span className="ml-2 text-xs font-normal text-gray-500">[ORIGINAL — RETIFICADO]</span>}
                        {at.retifica_id && <span className="ml-2 text-xs font-normal text-amber-700">[VERSÃO RETIFICADA]</span>}
                      </p>
                      <p className="text-sm text-gray-600">{formatarDataHora(at.data_atendimento)}</p>
                    </div>
                    <div className={mapa.length ? "grid grid-cols-[1fr_250px] gap-4" : ""}>
                      <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-2">
                        <Info r="Avaliação" v={at.pe_avaliacao} />
                        <Info r="Diagnóstico de enfermagem" v={at.pe_diagnostico} />
                        <Info r="Planejamento" v={at.pe_planejamento} />
                        <Info r="Implementação" v={at.pe_implementacao} />
                        <Info r="Evolução" v={at.pe_evolucao} />
                        <Info r="Região" v={at.regiao} />
                        <Info r="Produto" v={[at.produto, at.fabricante].filter(Boolean).join(" — ") || null} />
                        <Info r="Lote / validade" v={at.lote ? `${at.lote}${at.validade_produto ? ` · val. ${formatarData(at.validade_produto)}` : ""}` : null} />
                        {(t?.campos ?? []).map((cp: Campo) => (
                          <Info key={cp.chave} r={cp.rotulo}
                            v={at.dados_procedimento?.[cp.chave] != null ? exibirValor(cp, at.dados_procedimento[cp.chave]) : null} />
                        ))}
                        <Info r="Técnica" v={at.tecnica} />
                        <Info r="Orientações" v={at.orientacoes} />
                        <Info r="Intercorrências" v={at.intercorrencias} />
                        <Info r="Conduta" v={at.conduta_intercorrencia} />
                        <Info r="Retorno" v={at.retorno_previsto ? formatarData(at.retorno_previsto) : null} />
                        <Info r="Observações" v={at.observacoes} />
                      </dl>
                      {mapa.length > 0 && t && (
                        <div className="text-xs">
                          <MapaFacial marcacoes={mapa} somenteLeitura compacto unidade={unidadeDoMapa(t)}
                            croqui={(at.dados_procedimento?.croqui as Croqui) ?? "desenho"} />
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Responsável: {at.professionals?.nome}
                      {cr?.conselho && cr.conselho !== "nenhum" ? ` · ${cr.conselho}-${cr.uf ?? ""} ${cr.numero_registro ?? ""}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </Secao>
        )}

        {/* Termos */}
        {inc.termos && d.termos.length > 0 && (
          <Secao titulo="Termos de consentimento">
            <div className="space-y-4">
              {d.termos.map((t) => (
                <div key={t.id} className="break-inside-avoid rounded-lg border border-gray-200 p-4 text-sm">
                  <p className="mb-1 font-bold">{t.titulo} — {t.aceito ? "ACEITO" : "NÃO ACEITO"}</p>
                  <p className="whitespace-pre-wrap text-gray-700">{t.texto_termo}</p>
                  {t.assinatura_imagem ? (
                    <div className="mt-3 flex items-end gap-4">
                      <div className="text-center">
                        <img src={t.assinatura_imagem} alt="Assinatura" className="h-16" />
                        <p className="border-t border-gray-400 px-6 text-xs">{t.assinado_nome}</p>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        Assinado eletronicamente em {formatarDataHora(t.aceito_em)}
                        {t.assinado_ip ? ` · IP ${t.assinado_ip}` : ""}
                        <br />Verificação: <span className="font-mono">{t.hash_verificacao}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">Registrado em {formatarDataHora(t.aceito_em)} (sem assinatura digital)</p>
                  )}
                </div>
              ))}
            </div>
          </Secao>
        )}

        {/* Retificações */}
        {d.retificacoes.length > 0 && (
          <Secao titulo="Retificações">
            {d.termos.some((t) => t.assinatura_imagem && d.retificacoes.some((r) => r.created_at > t.aceito_em)) && (
              <p className="mb-2 text-xs font-medium text-amber-700">
                Este prontuário possui retificações posteriores a assinaturas registradas.
              </p>
            )}
            <div className="space-y-2">
              {d.retificacoes.map((r) => (
                <div key={r.id} className="break-inside-avoid rounded-lg border border-gray-200 p-3 text-xs">
                  <p className="font-medium">
                    {r.tabela === "patients" ? "Dados da paciente" : "Atendimento"} — retificado em {formatarDataHora(r.created_at)} por{" "}
                    {r.profissional_nome}{r.registro_conselho ? ` (${r.registro_conselho.trim()})` : ""}
                  </p>
                  <p><b>{nomeMotivo(r.motivo_tipo)}:</b> {r.justificativa}</p>
                  <ul className="mt-1">
                    {Object.keys(r.dados_depois).map((k) => (
                      <li key={k}>
                        {ROTULOS[k] ?? k}: <s>{valorLegivel(k, r.dados_antes[k])}</s> → {valorLegivel(k, r.dados_depois[k])}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Secao>
        )}

        {/* Fotos */}
        {inc.fotos && d.fotos.length > 0 && (
          <Secao titulo="Registro fotográfico">
            <div className="grid grid-cols-3 gap-3">
              {d.fotos.map((f) => (
                <figure key={f.id} className="break-inside-avoid">
                  <img src={f.url} alt="" className="aspect-[3/4] w-full rounded object-cover" />
                  <figcaption className="mt-1 text-center text-[10px] text-gray-600">
                    {f.tipo} · {f.pose ?? ""} · {formatarData(f.tirada_em)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </Secao>
        )}

        {/* Assinatura da profissional (eletrônica ou para assinar à mão) */}
        <footer data-assinatura className="mt-12 break-inside-avoid text-center">
          {!assinado && (
            <div className="mb-6 rounded-xl border border-dashed border-[#c9a25c] bg-[#c9a25c]/10 p-3 text-sm print:hidden">
              <p className="font-medium">
                {alteradoAposAssinatura
                  ? "⚠️ O prontuário mudou desde a última assinatura. Assine novamente para validar esta versão."
                  : "Este prontuário ainda não foi assinado eletronicamente."}
              </p>
              <button type="button" onClick={assinar} disabled={assinando}
                className="mt-2 rounded-xl bg-salvia px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {assinando ? "Assinando…" : "✍️ Assinar agora"}
              </button>
            </div>
          )}
          {assinado && assinaturaUrl && (
            <img src={assinaturaUrl} alt="Assinatura" className="mx-auto -mb-2 h-16 object-contain" />
          )}
          <div className={`mx-auto w-72 border-t border-gray-500 pt-1 ${assinado && !assinaturaUrl ? "mt-4" : ""}`}>
            <p className="text-sm font-medium">{profissional.nome}</p>
            {registro && <p className="text-xs text-gray-600">{registro}</p>}
          </div>
          {assinado && (
            <div className="mx-auto mt-3 max-w-md rounded-lg border border-[#7e9a83] bg-[#e6ede6]/40 px-3 py-2 text-left text-[10px] leading-snug text-gray-700">
              <p className="font-semibold text-[#5f7a65]">✔ Documento assinado eletronicamente</p>
              <p>
                Assinado por <b>{profissional.nome}</b>{registro ? ` (${registro})` : ""} em{" "}
                {formatarDataHora(assinado.em)}, após acesso com senha e verificação em duas etapas.
              </p>
              <p>
                Código de verificação:{" "}
                <span className="font-mono">{assinado.hash.slice(0, 16).toUpperCase().match(/.{4}/g)?.join("-")}</span>
                {" "}· Registro nº {assinado.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          )}
          <p className="mt-6 text-[10px] text-gray-400">
            Documento gerado pelo Lumê — Prontuário Estético. Dados pessoais protegidos pela LGPD (Lei nº 13.709/2018).
          </p>
        </footer>
      </article>
    </div>
  );
}
