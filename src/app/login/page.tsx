"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "@/lib/useProfissional";
import { entrarComSenha, pegarAviso, prepararVerificacao, sair, tentarConfirmarPeloLink } from "@/lib/seguranca";
import { mascaraCPF } from "@/lib/utils";
import { TelaAcesso } from "@/components/TelaAcesso";
import { VerificacaoAcesso } from "@/components/VerificacaoAcesso";
import { Carregando } from "@/components/Carregando";

export default function EntrarPage() {
  const router = useRouter();
  const { estado, email, recarregar } = useSessao();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [conferindoLink, setConferindoLink] = useState(false);

  // Recado deixado por outra tela (ex.: saiu por segurança, senha alterada)
  useEffect(() => {
    if (estado === "sem-sessao") {
      const a = pegarAviso();
      if (a) setAviso(a);
    }
  }, [estado]);

  // Já está dentro? Vai direto. Veio pelo link do e-mail? Tenta confirmar.
  useEffect(() => {
    if (estado === "ok") router.replace("/");
    else if (estado === "sem-cadastro") router.replace("/cadastro");
    else if (estado === "nao-verificado") {
      setConferindoLink(true);
      (async () => {
        // 1) Veio pelo link do e-mail? Conclui sozinho.
        if (await tentarConfirmarPeloLink()) {
          await recarregar();
          return setConferindoLink(false);
        }
        // 2) A senha foi digitada há pouco? Então pede o código.
        //    Sessão antiga -> pede a senha de novo. Sem conexão -> não desloga.
        const r = await prepararVerificacao();
        if (r === "expirada") {
          await sair();
          setAviso("Por segurança, entre novamente com sua senha para confirmar este aparelho.");
          await recarregar();
        } else if (r === "erro") {
          setErro("Sem conexão com o servidor. Confira a internet e toque em Entrar de novo.");
          await sair();
          await recarregar();
        }
        setConferindoLink(false);
      })();
    }
  }, [estado, router, recarregar]);

  // CPF ganha máscara; e-mail fica como digitado
  function mudarLogin(v: string) {
    setLogin(/^[\d.\-\s]*$/.test(v) && v.replace(/\D/g, "").length <= 11 ? mascaraCPF(v) : v);
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    setEnviando(true);
    const problema = await entrarComSenha(login, senha);
    setEnviando(false);
    if (problema) return setErro(problema);
    setSenha("");
    await recarregar();
  }

  async function concluido() {
    await recarregar();
  }

  if (estado === "carregando" || estado === "ok" || estado === "sem-cadastro" || conferindoLink) return <Carregando />;

  if (estado === "nao-verificado" && email) {
    return (
      <TelaAcesso titulo="Confirme que é você" subtitulo="Só na primeira vez neste aparelho">
        <VerificacaoAcesso email={email} onConcluido={concluido} onVoltar={() => recarregar()} />
      </TelaAcesso>
    );
  }

  return (
    <TelaAcesso titulo="Lumê" subtitulo="Prontuário estético">
      <form onSubmit={entrar} className="etapa-entra space-y-4">
        <div>
          <label className="rotulo" htmlFor="login">CPF ou e-mail</label>
          <input id="login" required className="campo" autoComplete="username" placeholder="000.000.000-00"
            value={login} onChange={(e) => mudarLogin(e.target.value)} />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="rotulo" htmlFor="senha">Senha</label>
            <Link href="/esqueci-senha" className="text-sm text-salvia-escuro underline">Esqueci minha senha</Link>
          </div>
          <div className="relative">
            <input id="senha" type={verSenha ? "text" : "password"} required className="campo pr-16"
              autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <button type="button" onClick={() => setVerSenha(!verSenha)}
              className="absolute inset-y-0 right-3 text-sm text-tinta/50">{verSenha ? "Ocultar" : "Mostrar"}</button>
          </div>
        </div>

        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {aviso && <p className="rounded-lg bg-salvia-claro p-3 text-sm">{aviso}</p>}

        <button className="botao" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
      </form>

      <div className="mt-10 border-t border-black/5 pt-6 text-center">
        <p className="mb-3 text-sm text-tinta/60">Primeira vez no Lumê?</p>
        <Link href="/cadastro" className="botao-sec block">Criar minha conta</Link>
      </div>
    </TelaAcesso>
  );
}
