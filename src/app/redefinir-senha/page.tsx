"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSessao } from "@/lib/useProfissional";
import { confirmarCodigoApp, definirAviso, sair } from "@/lib/seguranca";
import { TelaAcesso } from "@/components/TelaAcesso";
import { Carregando } from "@/components/Carregando";

/** Aberta pelo link do e-mail "Esqueci minha senha" */
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const { estado } = useSessao();
  const [precisaApp, setPrecisaApp] = useState<boolean | null>(null);
  const [codigoApp, setCodigoApp] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Quem ativou o app autenticador precisa confirmar o código dele antes de trocar a senha
  useEffect(() => {
    if (estado === "carregando" || estado === "sem-sessao") return;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      setPrecisaApp(!!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2");
    });
  }, [estado]);

  if (estado === "carregando") return <Carregando />;

  if (estado === "sem-sessao") {
    return (
      <TelaAcesso titulo="Link expirado" subtitulo="Peça um novo link">
        <div className="space-y-4 text-center">
          <p className="text-tinta/70">Este link de redefinição não é mais válido.</p>
          <Link href="/esqueci-senha" className="botao block">Pedir novo link</Link>
        </div>
      </TelaAcesso>
    );
  }

  if (precisaApp === null) return <Carregando />;

  async function confirmarApp(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    const problema = await confirmarCodigoApp(codigoApp);
    setSalvando(false);
    if (problema) return setErro(problema);
    setPrecisaApp(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha.length < 10 || !/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) {
      return setErro("A senha precisa ter pelo menos 10 caracteres, com letras e números.");
    }
    if (senha !== senha2) return setErro("As senhas não são iguais.");
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      if (/aal|mfa/i.test(error.message)) return setErro("Confirme primeiro o código do seu app autenticador.");
      if (/same|different/i.test(error.message)) return setErro("A nova senha precisa ser diferente da anterior.");
      return setErro("Não foi possível salvar a senha. Peça um novo link e tente de novo.");
    }
    definirAviso("Senha alterada! Entre com a nova senha.");
    await sair();
    router.replace("/login");
  }

  if (precisaApp) {
    return (
      <TelaAcesso titulo="Confirme que é você" subtitulo="Sua conta usa app autenticador">
        <form onSubmit={confirmarApp} className="etapa-entra space-y-4">
          <p className="rounded-xl bg-salvia-claro p-3 text-sm">📱 Digite o código de 6 números do app autenticador.</p>
          <input className="campo text-center text-2xl tracking-[0.5em]" required autoFocus inputMode="numeric"
            autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={codigoApp}
            onChange={(e) => setCodigoApp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <button className="botao" disabled={salvando || codigoApp.length !== 6}>{salvando ? "Verificando…" : "Continuar"}</button>
        </form>
      </TelaAcesso>
    );
  }

  return (
    <TelaAcesso titulo="Nova senha" subtitulo="Crie uma senha forte">
      <form onSubmit={salvar} className="etapa-entra space-y-4">
        <div>
          <label className="rotulo" htmlFor="senha">Nova senha</label>
          <input id="senha" type="password" required autoFocus autoComplete="new-password" className="campo"
            value={senha} onChange={(e) => setSenha(e.target.value)} />
          <p className="mt-1 text-xs text-tinta/50">Mínimo 10 caracteres, com letras e números.</p>
        </div>
        <div>
          <label className="rotulo" htmlFor="senha2">Repita a nova senha</label>
          <input id="senha2" type="password" required autoComplete="new-password" className="campo"
            value={senha2} onChange={(e) => setSenha2(e.target.value)} />
        </div>
        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Salvar nova senha"}</button>
      </form>
    </TelaAcesso>
  );
}
