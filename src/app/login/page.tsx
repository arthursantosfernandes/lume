"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    setEnviando(true);

    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      setEnviando(false);
      if (error) return setErro("E-mail ou senha incorretos.");
      router.replace("/");
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: senha });
      setEnviando(false);
      if (error) return setErro(error.message);
      if (data.session) router.replace("/cadastro");
      else setAviso("Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <img src="/icon-192.png" alt="Lumê" className="mx-auto mb-4 h-20 w-20 rounded-2xl shadow-sm" />
        <h1 className="text-3xl font-semibold tracking-tight">Lumê</h1>
        <p className="text-tinta/60">Prontuário estético</p>
      </div>

      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" type="email" required autoComplete="email" className="campo"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input id="senha" type="password" required minLength={8} className="campo"
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>

        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {aviso && <p className="rounded-lg bg-salvia-claro p-3 text-sm">{aviso}</p>}

        <button className="botao" disabled={enviando}>
          {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <button
        className="mt-6 text-sm text-salvia-escuro underline"
        onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
      >
        {modo === "entrar" ? "Ainda não tem conta? Criar conta" : "Já tenho conta. Entrar"}
      </button>
    </main>
  );
}
