"use client";

import { useEffect, useState } from "react";
import {
  confirmarCodigoApp, confirmarCodigoEmail, enviarCodigoEmail, mascararEmail, sair, temAppAutenticador,
} from "@/lib/seguranca";

/**
 * 2ª etapa do acesso: código (e-mail: 6 a 8 números; app: 6 números).
 * Padrão: código enviado por e-mail. Opcional: app autenticador.
 * Só é pedido na 1ª vez em cada aparelho.
 */
export function VerificacaoAcesso({ email, onConcluido, onVoltar }: {
  email: string;
  onConcluido: () => void | Promise<void>;
  onVoltar?: () => void;
}) {
  const [metodo, setMetodo] = useState<"email" | "app">("email");
  const [temApp, setTemApp] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [espera, setEspera] = useState(0);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [tremer, setTremer] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => { temAppAutenticador().then(setTemApp); }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const t = window.setTimeout(() => setEspera(espera - 1), 1000);
    return () => window.clearTimeout(t);
  }, [espera]);

  function errou(msg: string) {
    setErro(msg);
    setCodigo("");
    setTremer(true);
    window.setTimeout(() => setTremer(false), 450);
  }

  async function enviar() {
    setErro("");
    setOcupado(true);
    const problema = await enviarCodigoEmail(email);
    setOcupado(false);
    if (problema) return setErro(problema);
    setEnviado(true);
    setEspera(60);
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    const problema = metodo === "email" ? await confirmarCodigoEmail(email, codigo) : await confirmarCodigoApp(codigo);
    setOcupado(false);
    if (problema === "SAIU") return onVoltar?.(); // a tela de Entrar mostra o recado
    if (problema) return errou(problema);
    setPronto(true);
    window.setTimeout(() => onConcluido(), 700);
  }

  async function voltar() {
    await sair();
    onVoltar?.();
  }

  if (pronto) {
    return (
      <div className="py-6 text-center">
        <svg viewBox="0 0 52 52" className="check-anim pular mx-auto mb-3 h-16 w-16" aria-hidden>
          <circle cx="26" cy="26" r="24" fill="#e6ede6" />
          <path d="M15 27l7 7 15-15" fill="none" stroke="#5f7a65" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-semibold">Aparelho confirmado!</p>
      </div>
    );
  }

  const precisaEnviar = metodo === "email" && !enviado;
  const tamanho = metodo === "email" ? 8 : 6; // o Supabase pode mandar 6 ou 8 números por e-mail

  return (
    <div className="etapa-entra space-y-4">
      <div className="rounded-xl bg-salvia-claro p-3 text-sm">
        {metodo === "email" ? (
          precisaEnviar ? (
            <>🔐 <b>Primeiro acesso neste aparelho.</b> Para sua segurança, vamos enviar um código de verificação para <b>{mascararEmail(email)}</b>.</>
          ) : (
            <>📧 Enviamos um e-mail para <b>{mascararEmail(email)}</b>. Digite o código abaixo ou,
              se o e-mail trouxer um link, toque nele <b>neste mesmo aparelho</b>. Confira também o spam.</>
          )
        ) : (
          <>📱 Abra o app autenticador no celular e digite o código de 6 números do <b>Lumê</b>.</>
        )}
      </div>

      {precisaEnviar ? (
        <button type="button" className="botao" onClick={enviar} disabled={ocupado}>
          {ocupado ? "Enviando…" : "Enviar código por e-mail"}
        </button>
      ) : (
        <form onSubmit={confirmar} className="space-y-4">
          <div className={tremer ? "tremer" : ""}>
            <label className="rotulo" htmlFor="codigo">Código de verificação</label>
            <input id="codigo" className="campo text-center text-2xl tracking-[0.5em]" required autoFocus
              inputMode="numeric" autoComplete="one-time-code" maxLength={tamanho} pattern={`\\d{6,${tamanho}}`}
              value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, tamanho))} />
          </div>
          <button className="botao" disabled={ocupado || codigo.length < 6}>
            {ocupado ? "Verificando…" : "Confirmar"}
          </button>
          {metodo === "email" && (
            <button type="button" className="w-full text-sm text-salvia-escuro underline disabled:text-tinta/40 disabled:no-underline"
              disabled={espera > 0 || ocupado} onClick={enviar}>
              {espera > 0 ? `Reenviar código em ${espera}s` : "Reenviar código"}
            </button>
          )}
        </form>
      )}

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      <div className="space-y-2 pt-2 text-center text-sm">
        {temApp && (
          <button type="button" className="block w-full text-salvia-escuro underline"
            onClick={() => { setMetodo(metodo === "email" ? "app" : "email"); setErro(""); setCodigo(""); }}>
            {metodo === "email" ? "Usar o app autenticador" : "Receber código por e-mail"}
          </button>
        )}
        <button type="button" onClick={voltar} className="block w-full text-tinta/50 underline">
          Entrar com outra conta
        </button>
      </div>
    </div>
  );
}