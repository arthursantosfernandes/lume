"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profissional } from "@/lib/useProfissional";
import { biometriaAtiva, desbloquearComBiometria } from "@/lib/seguranca";

/**
 * Cobre a tela depois de um tempo parado.
 * Destrava com PIN, digital/Face ID (se ativados neste aparelho) ou senha.
 */
export function TelaBloqueio({ profissional, email, onDesbloquear, onSair }: {
  profissional: Profissional;
  email: string;
  onDesbloquear: () => void;
  onSair: (motivo?: string) => void;
}) {
  const [temPin, setTemPin] = useState<boolean | null>(null);
  const [modo, setModo] = useState<"pin" | "senha">("pin");
  const [pin, setPin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [tremer, setTremer] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const bio = biometriaAtiva(profissional.user_id);
  const primeiroNome = profissional.nome.split(" ")[0];

  useEffect(() => {
    supabase.rpc("tem_pin").then(({ data }) => {
      setTemPin(data === true);
      if (data !== true) setModo("senha");
    });
  }, []);

  function errou(msg: string) {
    setErro(msg);
    setTremer(true);
    window.setTimeout(() => setTremer(false), 450);
  }

  async function conferirPin(valor: string) {
    setVerificando(true);
    const { data } = await supabase.rpc("verificar_pin", { p_pin: valor });
    setVerificando(false);
    if (data === "ok") return onDesbloquear();
    setPin("");
    if (data === "sair") return onSair("bloqueio");
    errou("PIN incorreto.");
  }

  function digitar(n: string) {
    if (verificando) return;
    setErro("");
    const novo = (pin + n).slice(0, 6);
    setPin(novo);
  }

  async function conferirSenha(e: React.FormEvent) {
    e.preventDefault();
    setVerificando(true);
    const { data } = await supabase.rpc("verificar_senha", { p_senha: senha });
    setVerificando(false);
    setSenha("");
    if (data === "ok") return onDesbloquear();
    if (data === "sair") return onSair("bloqueio");
    errou("Senha incorreta.");
  }

  async function usarBiometria() {
    setErro("");
    if (await desbloquearComBiometria(profissional.user_id)) onDesbloquear();
    else setErro("Não foi possível confirmar a digital/Face ID.");
  }

  return (
    <div className="bloqueio-fundo fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true"
      aria-label="Lumê bloqueado">
      <div className="bloqueio-cartao w-full max-w-xs text-center">
        <img src="/icon-192.png" alt="" className="logo-respira mx-auto mb-4 h-16 w-16 rounded-2xl shadow-sm" />
        <p className="text-lg font-semibold">Olá, {primeiroNome}</p>
        <p className="mb-6 text-sm text-tinta/60">O Lumê foi bloqueado por segurança.</p>

        {temPin === null ? null : modo === "pin" ? (
          <>
            <div className={`mb-5 flex justify-center gap-3 ${tremer ? "tremer" : ""}`} aria-live="polite">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span key={i} className={`h-3.5 w-3.5 rounded-full transition-colors ${i < pin.length ? "bg-salvia-escuro" : "bg-tinta/15"}`} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                <button key={n} type="button" className="tecla" onClick={() => digitar(n)}>{n}</button>
              ))}
              <button type="button" className="tecla text-base" onClick={() => setPin(pin.slice(0, -1))} aria-label="Apagar">⌫</button>
              <button type="button" className="tecla" onClick={() => digitar("0")}>0</button>
              <button type="button" className="tecla bg-salvia text-white" disabled={pin.length < 4 || verificando}
                onClick={() => conferirPin(pin)} aria-label="Confirmar">✓</button>
            </div>
          </>
        ) : (
          <form onSubmit={conferirSenha} className={`space-y-3 ${tremer ? "tremer" : ""}`}>
            <input className="campo" type="password" autoFocus required placeholder="Sua senha" autoComplete="current-password"
              value={senha} onChange={(e) => { setSenha(e.target.value); setErro(""); }} />
            <button className="botao" disabled={verificando || !senha}>{verificando ? "Verificando…" : "Desbloquear"}</button>
            {!temPin && <p className="text-xs text-tinta/50">Dica: crie um PIN em Configurações para destravar mais rápido.</p>}
          </form>
        )}

        {erro && <p className="mt-4 text-sm text-red-700">{erro}</p>}

        <div className="mt-6 space-y-2 text-sm">
          {bio && (
            <button type="button" onClick={usarBiometria} className="botao-sec">👆 Usar digital / Face ID</button>
          )}
          {temPin && (
            <button type="button" onClick={() => { setModo(modo === "pin" ? "senha" : "pin"); setErro(""); }}
              className="block w-full text-salvia-escuro underline">
              {modo === "pin" ? "Usar senha" : "Usar PIN"}
            </button>
          )}
          <button type="button" onClick={() => onSair()} className="block w-full text-tinta/50 underline">
            Não é {primeiroNome}? Sair ({email.split("@")[0]})
          </button>
        </div>
      </div>
    </div>
  );
}
