"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSessao, type Profissional } from "@/lib/useProfissional";
import { ativarBiometria, biometriaAtiva, biometriaDisponivel, desativarBiometria } from "@/lib/seguranca";
import { erroCPF, mascaraCPF, soNumeros } from "@/lib/utils";

const TEMPOS = [5, 15, 30, 60];

/** Configurações > Segurança: CPF para login, PIN, digital/Face ID, tempo de bloqueio, app autenticador */
export function ConfigSeguranca({ profissional }: { profissional: Profissional }) {
  const { email, recarregar } = useSessao();
  const [temPin, setTemPin] = useState<boolean | null>(null);
  const [editandoPin, setEditandoPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [bioPossivel, setBioPossivel] = useState(false);
  const [bioAtiva, setBioAtiva] = useState(biometriaAtiva(profissional.user_id));
  const [cpf, setCpf] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    supabase.rpc("tem_pin").then(({ data }) => setTemPin(data === true));
    biometriaDisponivel().then(setBioPossivel);
    if (new URLSearchParams(window.location.search).get("ok") === "app") setMsg("App autenticador ativado!");
  }, []);

  function avisar(texto: string) {
    setErro("");
    setMsg(texto);
    window.setTimeout(() => setMsg(""), 4000);
  }

  async function salvarPin(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!/^\d{4,6}$/.test(pin)) return setErro("O PIN deve ter de 4 a 6 números.");
    if (pin !== pin2) return setErro("Os PINs não são iguais.");
    const { error } = await supabase.rpc("definir_pin", { p_pin: pin });
    if (error) return setErro(error.message);
    setPin(""); setPin2(""); setEditandoPin(false); setTemPin(true);
    avisar("PIN salvo! Use-o para destravar o Lumê.");
  }

  async function alternarBio() {
    if (bioAtiva) {
      desativarBiometria(profissional.user_id);
      setBioAtiva(false);
      return avisar("Digital/Face ID desativado neste aparelho.");
    }
    const problema = await ativarBiometria(profissional.user_id, email ?? "", profissional.nome);
    if (problema) return setErro(problema);
    setBioAtiva(true);
    avisar("Digital/Face ID ativado neste aparelho!");
  }

  async function mudarTempo(min: number) {
    const { error } = await supabase.from("clinics").update({ bloqueio_minutos: min }).eq("id", profissional.clinic_id);
    if (error) return setErro(error.message);
    await recarregar();
    avisar(`O Lumê agora bloqueia após ${min} minutos parado.`);
  }

  async function salvarCpf(e: React.FormEvent) {
    e.preventDefault();
    const problema = erroCPF(cpf);
    if (!cpf || problema) return setErro(problema ?? "Informe o CPF.");
    const { error } = await supabase.from("professionals").update({ cpf: soNumeros(cpf) }).eq("id", profissional.id);
    if (error) {
      return setErro(/unico|unique|duplicate/i.test(error.message) ? "Este CPF já está em uso em outra conta." : error.message);
    }
    await recarregar();
    avisar("CPF salvo! Agora você pode entrar com ele.");
  }

  const cpfMascarado = profissional.cpf
    ? `${profissional.cpf.slice(0, 3)}.•••.•••-${profissional.cpf.slice(9)}` : null;

  return (
    <section className="mt-5 space-y-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">🔐 Segurança</h2>

      {/* CPF para entrar */}
      <div className="rounded-xl bg-creme p-3">
        <p className="text-sm font-medium">Entrar com CPF</p>
        {cpfMascarado ? (
          <p className="text-sm text-tinta/60">Seu CPF {cpfMascarado} pode ser usado no lugar do e-mail.</p>
        ) : (
          <form onSubmit={salvarCpf} className="mt-2 flex gap-2">
            <input className="campo" inputMode="numeric" placeholder="000.000.000-00" value={cpf}
              onChange={(e) => setCpf(mascaraCPF(e.target.value))} />
            <button className="shrink-0 rounded-xl bg-salvia px-4 font-semibold text-white">Salvar</button>
          </form>
        )}
      </div>

      {/* PIN */}
      <div className="rounded-xl bg-creme p-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">PIN de desbloqueio</p>
            <p className="text-sm text-tinta/60">{temPin ? "Ativo" : "Crie um PIN de 4 a 6 números para destravar rápido."}</p>
          </div>
          {!editandoPin && temPin !== null && (
            <button type="button" className="text-sm font-medium text-salvia-escuro underline" onClick={() => setEditandoPin(true)}>
              {temPin ? "Alterar" : "Criar PIN"}
            </button>
          )}
        </div>
        {editandoPin && (
          <form onSubmit={salvarPin} className="etapa-entra mt-3 grid grid-cols-2 gap-2">
            <input className="campo text-center tracking-[0.4em]" type="password" inputMode="numeric" maxLength={6}
              placeholder="PIN" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            <input className="campo text-center tracking-[0.4em]" type="password" inputMode="numeric" maxLength={6}
              placeholder="Repita" autoComplete="off" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} />
            <button className="col-span-2 rounded-xl bg-salvia py-2.5 font-semibold text-white">Salvar PIN</button>
          </form>
        )}
      </div>

      {/* Digital / Face ID */}
      {bioPossivel && (
        <div className="flex items-center gap-3 rounded-xl bg-creme p-3">
          <div className="flex-1">
            <p className="text-sm font-medium">Digital / Face ID</p>
            <p className="text-sm text-tinta/60">Destravar o Lumê com a biometria deste aparelho.</p>
          </div>
          <button type="button" role="switch" aria-checked={bioAtiva} onClick={alternarBio}
            className={`relative h-7 w-12 rounded-full transition-colors ${bioAtiva ? "bg-salvia" : "bg-tinta/20"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${bioAtiva ? "left-6" : "left-1"}`} />
          </button>
        </div>
      )}

      {/* Tempo de bloqueio */}
      <div className="rounded-xl bg-creme p-3">
        <p className="text-sm font-medium">Bloquear a tela depois de</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {TEMPOS.map((m) => {
            const ativo = (profissional.clinics?.bloqueio_minutos ?? 15) === m;
            return (
              <button key={m} type="button" onClick={() => mudarTempo(m)}
                className={`rounded-xl py-2 text-sm font-medium ${ativo ? "bg-salvia text-white" : "bg-white text-tinta/70"}`}>
                {m} min
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-tinta/50">Vale para todos os profissionais da clínica.</p>
      </div>

      {/* App autenticador */}
      <Link href="/seguranca" className="flex items-center gap-3 rounded-xl bg-creme p-3">
        <span className="flex-1">
          <span className="block text-sm font-medium">App autenticador (opcional)</span>
          <span className="text-sm text-tinta/60">Confirmar novos aparelhos sem esperar o e-mail.</span>
        </span>
        <span className="text-tinta/30">›</span>
      </Link>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {msg && <p className="etapa-entra rounded-lg bg-salvia-claro p-3 text-sm">{msg}</p>}
    </section>
  );
}
