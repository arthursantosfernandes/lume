"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SessaoContexto, type EstadoAcesso, type Profissional } from "@/lib/useProfissional";
import { definirAviso, lerAtividade, marcarAtividade, sair, sessaoVerificada } from "@/lib/seguranca";
import { TelaBloqueio } from "./TelaBloqueio";

// Páginas que funcionam sem login (e nunca são bloqueadas)
const PUBLICAS = ["/login", "/cadastro", "/assinar", "/esqueci-senha", "/redefinir-senha"];
const ehPublica = (p: string) => PUBLICAS.some((x) => p === x || p.startsWith(`${x}/`));

const SELECT_PROF =
  "id, user_id, nome, clinic_id, papel, cpf, clinics(nome, bloqueio_minutos), professional_credentials(id, profissao, conselho, numero_registro, uf, principal)";

export function ProvedorSessao({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<EstadoAcesso>("carregando");
  const [profissional, setProfissional] = useState<Profissional | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const seq = useRef(0); // só vale o resultado da chamada mais recente
  const estadoRef = useRef<EstadoAcesso>("carregando");
  const usuarioRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  estadoRef.current = estado;
  usuarioRef.current = profissional?.user_id ?? null;

  const recarregar = useCallback(async () => {
    const minha = ++seq.current;
    const atual = () => minha === seq.current;
    const { data: s } = await supabase.auth.getSession();
    const sessao = s.session;
    if (!atual()) return;
    if (!sessao) {
      setProfissional(null);
      setEmail(null);
      setEstado("sem-sessao");
      return;
    }
    setEmail(sessao.user.email ?? null);
    // Sem resposta do servidor? Tenta de novo antes de concluir qualquer coisa
    let verificada = await sessaoVerificada();
    for (let i = 0; verificada === null && i < 2; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      if (!atual()) return;
      verificada = await sessaoVerificada();
    }
    if (!atual()) return;
    if (verificada === null) {
      setEstado("erro"); // não desloga: só mostra "sem conexão"
      return;
    }
    if (!verificada) {
      setProfissional(null);
      setEstado("nao-verificado");
      return;
    }
    const { data, error } = await supabase.from("professionals").select(SELECT_PROF)
      .eq("user_id", sessao.user.id).maybeSingle();
    if (!atual()) return;
    if (error) {
      setEstado("erro");
      return;
    }
    if (!data) {
      setProfissional(null);
      setEstado("sem-cadastro");
      return;
    }
    setProfissional(data as unknown as Profissional);
    setEstado("ok");
  }, []);

  // Carrega uma vez e acompanha entrar/sair
  useEffect(() => {
    recarregar();
    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "TOKEN_REFRESHED" || evento === "INITIAL_SESSION") return;
      // O Supabase repete "SIGNED_IN" ao voltar para a aba: se nada mudou, não recarrega
      if (evento === "SIGNED_IN" && estadoRef.current === "ok" && sessao?.user.id === usuarioRef.current
          && sessao?.access_token === tokenRef.current) return;
      tokenRef.current = sessao?.access_token ?? null;
      // fora do callback (recomendação do Supabase)
      setTimeout(() => recarregar(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [recarregar]);

  /* ---------------- Tela de bloqueio ---------------- */
  const protegida = estado === "ok" && !ehPublica(pathname);
  const limiteMs = (profissional?.clinics?.bloqueio_minutos ?? 15) * 60_000;

  useEffect(() => {
    if (!protegida) return;
    // Voltou depois de muito tempo? Já abre bloqueado
    const ultima = lerAtividade();
    if (ultima && Date.now() - ultima > limiteMs) setBloqueado(true);
    else marcarAtividade();
  }, [protegida, limiteMs]);

  useEffect(() => {
    if (!protegida || bloqueado) return;
    let local = Date.now();
    let gravado = 0;
    const mexeu = () => {
      local = Date.now();
      if (local - gravado > 15_000) {
        gravado = local;
        marcarAtividade();
      }
    };
    const conferir = () => {
      const ultima = Math.max(local, lerAtividade() ?? 0); // considera outras abas abertas
      if (Date.now() - ultima > limiteMs) setBloqueado(true);
    };
    const aoVoltar = () => { if (document.visibilityState === "visible") conferir(); };
    const eventos = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    eventos.forEach((ev) => window.addEventListener(ev, mexeu, { passive: true }));
    document.addEventListener("visibilitychange", aoVoltar);
    const t = window.setInterval(conferir, 15_000);
    return () => {
      eventos.forEach((ev) => window.removeEventListener(ev, mexeu));
      document.removeEventListener("visibilitychange", aoVoltar);
      window.clearInterval(t);
    };
  }, [protegida, bloqueado, limiteMs]);

  const desbloquear = useCallback(() => {
    marcarAtividade();
    setBloqueado(false);
  }, []);

  const sairDaConta = useCallback(async (motivo?: string) => {
    if (motivo === "bloqueio") definirAviso("Muitas tentativas erradas no desbloqueio. Por segurança, entre novamente.");
    await sair();
    setBloqueado(false);
    router.replace("/login");
  }, [router]);

  const mostrarBloqueio = protegida && bloqueado && profissional;

  return (
    <SessaoContexto.Provider value={{ estado, profissional, email, recarregar }}>
      <BarraNavegacao />
      <div inert={mostrarBloqueio ? true : undefined} aria-hidden={mostrarBloqueio ? true : undefined}
        className={mostrarBloqueio ? "pointer-events-none select-none blur-md" : undefined}>
        {children}
      </div>
      {estado === "erro" && !pathname.startsWith("/assinar") && (
        <div className="bloqueio-fundo fixed inset-0 z-50 flex items-center justify-center p-6" role="alert">
          <div className="bloqueio-cartao max-w-xs text-center">
            <p className="text-5xl">📡</p>
            <p className="mt-3 font-semibold">Sem conexão com o servidor</p>
            <p className="mb-5 text-sm text-tinta/60">Confira a internet. Seus dados estão seguros.</p>
            <button type="button" className="botao" onClick={() => { setEstado("carregando"); recarregar(); }}>
              Tentar de novo
            </button>
          </div>
        </div>
      )}
      {mostrarBloqueio && (
        <TelaBloqueio profissional={profissional} email={email ?? ""}
          onDesbloquear={desbloquear} onSair={sairDaConta} />
      )}
    </SessaoContexto.Provider>
  );
}

/**
 * Barrinha no topo que aparece assim que você toca em um link,
 * para dar resposta imediata enquanto a próxima tela abre.
 */
function BarraNavegacao() {
  const pathname = usePathname();
  const [ativa, setAtiva] = useState(false);

  useEffect(() => {
    setAtiva(false);
  }, [pathname]);

  useEffect(() => {
    const clique = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      setAtiva(true);
    };
    document.addEventListener("click", clique);
    return () => document.removeEventListener("click", clique);
  }, []);

  useEffect(() => {
    if (!ativa) return;
    const t = window.setTimeout(() => setAtiva(false), 10_000); // segurança
    return () => window.clearTimeout(t);
  }, [ativa]);

  return ativa ? <div className="barra-navegacao" aria-hidden /> : null;
}
