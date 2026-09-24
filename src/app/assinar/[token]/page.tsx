"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { textoTermoDivulgacao, textoTermoImagem, textoTCLE, type ConteudoTCLE } from "@/lib/termos";
import { AssinaturaPad } from "@/components/AssinaturaPad";

/**
 * Página PÚBLICA de assinatura (abre no celular da paciente pelo QR Code).
 * Serve para dois tipos de pedido:
 *  - "imagem": termos de uso de imagem (prontuário + divulgação)
 *  - "tcle": Termo de Consentimento Livre e Esclarecido de um procedimento
 * Não precisa de login. Só funciona com um token válido e dentro do prazo.
 */

type Info = {
  tipo: "imagem" | "tcle";
  clinica: string;
  primeiro_nome: string;
  procedimento: string | null;
  tcle: ConteudoTCLE | null;
  profissional: string | null;
  registro: string | null;
};

export default function AssinarPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [erroLink, setErroLink] = useState("");
  const [nome, setNome] = useState("");
  const [aceite, setAceite] = useState(false);
  const [divulgacao, setDivulgacao] = useState<boolean | null>(null);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("obter_pedido_assinatura", { p_token: token }).then(({ data, error }) => {
      if (error) return setErroLink("Não foi possível abrir o link. Tente novamente.");
      if (data?.erro) return setErroLink(data.erro);
      setInfo({ ...data, tipo: data.tipo ?? "imagem" });
    });
  }, [token]);

  const ehTCLE = info?.tipo === "tcle";
  const nomeLimpo = nome.trim();
  const nomeTermo = nomeLimpo || "[seu nome completo]";
  const clinica = info?.clinica ?? "";
  const nomeOk = nomeLimpo.split(/\s+/).length >= 2;
  const pronto = nomeOk && aceite && !!assinatura && (ehTCLE || divulgacao !== null);

  const tcleTexto = (paciente: string) =>
    info?.tcle && info.procedimento
      ? textoTCLE({
          procedimento: info.procedimento, tcle: info.tcle, paciente, clinica,
          profissional: info.profissional, registro: info.registro,
        })
      : "";

  async function concluir() {
    if (!pronto || !info) return;
    setErro("");
    setEnviando(true);
    const { data, error } = ehTCLE
      ? await supabase.rpc("assinar_tcle", {
          p_token: token,
          p_nome: nomeLimpo,
          p_texto: tcleTexto(nomeLimpo),
          p_assinatura: assinatura,
          p_dispositivo: navigator.userAgent,
        })
      : await supabase.rpc("assinar_termos", {
          p_token: token,
          p_nome: nomeLimpo,
          p_aceita_divulgacao: divulgacao,
          p_texto_imagem: textoTermoImagem(nomeLimpo, clinica),
          p_texto_divulgacao: textoTermoDivulgacao(nomeLimpo, clinica, !!divulgacao),
          p_assinatura: assinatura,
          p_dispositivo: navigator.userAgent,
        });
    setEnviando(false);
    if (error) return setErro(error.message);
    setConcluido(data?.hash ?? "");
    window.scrollTo(0, 0);
  }

  // ---------- Telas de estado ----------
  if (erroLink) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center p-6 text-center">
        <img src="/icon-192.png" alt="" className="mb-4 h-14 w-14 rounded-xl" />
        <p className="text-lg font-semibold">{erroLink}</p>
      </main>
    );
  }
  if (!info) return <main className="flex min-h-dvh items-center justify-center text-tinta/60">Carregando…</main>;

  if (concluido !== null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 text-6xl">✅</div>
        <h1 className="mb-2 text-2xl font-semibold">Assinatura enviada!</h1>
        <p className="text-tinta/70">
          Obrigada, {info.primeiro_nome}. Seu consentimento {ehTCLE ? `para ${info.procedimento}` : ""} foi registrado na {clinica}.
        </p>
        <p className="mt-6 break-all text-xs text-tinta/40">Código de verificação: {concluido}</p>
        <p className="mt-2 text-sm text-tinta/60">Você já pode fechar esta página.</p>
      </main>
    );
  }

  // ---------- Formulário ----------
  return (
    <main className="mx-auto max-w-md px-5 pb-12 pt-6">
      <header className="mb-6 text-center">
        <p className="text-sm text-tinta/50">{clinica}</p>
        <h1 className="text-2xl font-semibold">Olá, {info.primeiro_nome}!</h1>
        <p className="text-tinta/60">
          {ehTCLE ? `Leia com atenção o termo do procedimento de ${info.procedimento} e assine.` : "Leia e assine os termos abaixo."}
        </p>
      </header>

      <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <label className="rotulo">Seu nome completo</label>
        <input className="campo" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Como está no seu cadastro" />
      </section>

      {ehTCLE ? (
        <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">Termo de Consentimento Livre e Esclarecido</h2>
          <div className="mb-3 max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-creme p-3 text-sm leading-relaxed">
            {tcleTexto(nomeTermo)}
          </div>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-salvia" checked={aceite}
              onChange={(e) => setAceite(e.target.checked)} />
            <span className="font-medium">Li e compreendi o termo, incluindo os riscos, e concordo com a realização do procedimento</span>
          </label>
        </section>
      ) : (
        <>
          <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">1. Uso de imagem no prontuário</h2>
            <p className="mb-3 whitespace-pre-wrap rounded-xl bg-creme p-3 text-sm">{textoTermoImagem(nomeTermo, clinica)}</p>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-6 w-6 accent-salvia" checked={aceite}
                onChange={(e) => setAceite(e.target.checked)} />
              <span className="font-medium">Li e aceito</span>
            </label>
          </section>

          <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-1 font-semibold">2. Uso de imagem para divulgação</h2>
            <p className="mb-3 text-sm text-tinta/60">Opcional. Você escolhe.</p>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: true, t: "Autorizo" }, { v: false, t: "Não autorizo" }].map((op) => (
                <button key={op.t} type="button" onClick={() => setDivulgacao(op.v)}
                  className={`rounded-xl px-3 py-3 font-medium ${
                    divulgacao === op.v ? "bg-salvia text-white" : "bg-creme text-tinta/70"
                  }`}>
                  {op.t}
                </button>
              ))}
            </div>
            {divulgacao !== null && (
              <p className="mt-3 rounded-xl bg-creme p-3 text-sm">{textoTermoDivulgacao(nomeTermo, clinica, divulgacao)}</p>
            )}
          </section>
        </>
      )}

      {/* Assinatura */}
      <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Sua assinatura</h2>
        <AssinaturaPad onChange={setAssinatura} />
      </section>

      {erro && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <button className="botao" disabled={!pronto || enviando} onClick={concluir}>
        {enviando ? "Enviando…" : "Concluir e assinar"}
      </button>
      {!pronto && (
        <p className="mt-2 text-center text-xs text-tinta/50">
          {ehTCLE
            ? "Preencha seu nome completo, marque que leu o termo e assine."
            : "Preencha seu nome completo, aceite o termo 1, escolha no termo 2 e assine."}
        </p>
      )}
      <p className="mt-6 text-center text-xs text-tinta/40">
        Ao concluir, registramos data, hora e aparelho usado, como comprovante da sua assinatura.
      </p>
    </main>
  );
}
