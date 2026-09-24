"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { TelaAcesso } from "@/components/TelaAcesso";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setEnviando(false);
    if (error && /rate|limit|seconds/i.test(error.message)) {
      return setErro("Muitos pedidos em pouco tempo. Aguarde alguns minutos.");
    }
    // Mesmo se o e-mail não existir, mostramos a mesma mensagem (ninguém descobre quem tem conta)
    setEnviado(true);
  }

  return (
    <TelaAcesso titulo="Esqueci minha senha" subtitulo="Vamos te ajudar a criar uma nova">
      {enviado ? (
        <div className="etapa-entra space-y-4 text-center">
          <p className="text-5xl">📧</p>
          <p>Se <b>{email}</b> tiver conta no Lumê, você vai receber um link para criar uma nova senha.</p>
          <p className="text-sm text-tinta/60">Confira também a caixa de spam. O link vale por pouco tempo.</p>
          <Link href="/login" className="botao-sec block">Voltar para Entrar</Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="etapa-entra space-y-4">
          <div>
            <label className="rotulo" htmlFor="email">E-mail da sua conta</label>
            <input id="email" type="email" required autoFocus autoComplete="email" className="campo"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <button className="botao" disabled={enviando}>{enviando ? "Enviando…" : "Enviar link"}</button>
          <Link href="/login" className="block text-center text-sm text-tinta/50 underline">Voltar</Link>
        </form>
      )}
    </TelaAcesso>
  );
}
