"use client";

import { supabase } from "./supabase";
import { soNumeros } from "./utils";

/* ------------------------------------------------------------------
 * Acesso em duas etapas
 *   1. CPF ou e-mail + senha
 *   2. Código de 6 números (e-mail, ou app autenticador se ativado)
 *      -> só na 1ª vez em cada aparelho (vale 30 dias ou até sair)
 * ------------------------------------------------------------------ */

/** O aparelho atual já confirmou o código? (null = sem resposta do servidor) */
export async function sessaoVerificada(): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("sessao_mfa_ok");
  if (error) return null;
  return data === true;
}

/* Recado para mostrar na tela de Entrar (sobrevive à troca de tela) */
const CHAVE_AVISO = "lume.aviso";
export function definirAviso(msg: string) {
  try { sessionStorage.setItem(CHAVE_AVISO, msg); } catch { /* ignora */ }
}
export function pegarAviso(): string | null {
  try {
    const v = sessionStorage.getItem(CHAVE_AVISO);
    sessionStorage.removeItem(CHAVE_AVISO);
    return v;
  } catch {
    return null;
  }
}

/* Chave secreta que liga "digitei a senha" ao "digitei o código" NESTE aparelho.
   Se alguém abrir o e-mail em outro aparelho, lá não existe essa chave. */
const CHAVE_NONCE = "lume.nonce";
function guardarNonce(v: string | null) {
  try {
    if (v) localStorage.setItem(CHAVE_NONCE, v);
    else localStorage.removeItem(CHAVE_NONCE);
  } catch { /* ignora */ }
}
function lerNonce(): string | null {
  try { return localStorage.getItem(CHAVE_NONCE); } catch { return null; }
}

/**
 * Prepara a etapa do código logo após a senha.
 * "ok" = pode pedir o código · "expirada" = precisa digitar a senha de novo · "erro" = sem conexão
 */
export async function prepararVerificacao(): Promise<"ok" | "expirada" | "erro"> {
  const { data, error } = await supabase.rpc("registrar_senha_ok");
  if (error) return "erro";
  if (!data) return "expirada";
  guardarNonce(data as string);
  return "ok";
}

/** Tem app autenticador ativado? */
export async function temAppAutenticador(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors();
  return (data?.totp?.length ?? 0) > 0;
}

/** Entrar com CPF ou e-mail + senha. Devolve mensagem de erro ou null. */
export async function entrarComSenha(login: string, senha: string): Promise<string | null> {
  let email = login.trim().toLowerCase();
  if (!email.includes("@")) {
    const cpf = soNumeros(login);
    if (cpf.length !== 11) return "Digite um CPF com 11 números ou um e-mail.";
    const { data, error } = await supabase.rpc("email_para_login", { p_cpf: cpf, p_senha: senha });
    if (error) return "Não foi possível entrar agora. Tente de novo.";
    if (data === "BLOQUEADO") return "Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.";
    if (!data) return "CPF ou senha incorretos.";
    email = data as string;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    if (/confirm/i.test(error.message)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    return "CPF/e-mail ou senha incorretos.";
  }
  limparAtividade();
  return null;
}

/** E-mail da sessão atual, mascarado (a***@gmail.com) */
export function mascararEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return email;
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}

/** Envia o código de 6 números para o e-mail da conta */
export async function enviarCodigoEmail(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/login` },
  });
  if (!error) return null;
  if (/rate|limit|seconds/i.test(error.message)) {
    return "Muitos e-mails em pouco tempo. Aguarde alguns minutos e tente de novo.";
  }
  return "Não foi possível enviar o código. Tente de novo.";
}

/**
 * Confirma o código recebido por e-mail.
 * Devolve null (deu certo), uma mensagem de erro, ou "SAIU" quando foi
 * preciso encerrar a sessão (a pessoa vai ver o recado na tela de Entrar).
 */
export async function confirmarCodigoEmail(email: string, codigo: string): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({ email, token: codigo.trim(), type: "email" });
  if (error) return "Código incorreto ou expirado. Peça um novo código.";
  const { data, error: e2 } = await supabase.rpc("confirmar_sessao_email", { p_nonce: lerNonce() ?? "" });
  if (!e2 && data === true) {
    guardarNonce(null);
    return null;
  }
  await sair();
  definirAviso("O tempo para confirmar acabou (ou o código foi usado em outro aparelho). Entre com sua senha de novo.");
  return "SAIU";
}

/** Tenta concluir a verificação quando a pessoa clicou no link do e-mail (só no mesmo aparelho) */
export async function tentarConfirmarPeloLink(): Promise<boolean> {
  const nonce = lerNonce();
  if (!nonce) return false;
  const { data } = await supabase.rpc("confirmar_sessao_email", { p_nonce: nonce });
  if (data === true) guardarNonce(null);
  return data === true;
}

/** Confirma o código do app autenticador */
export async function confirmarCodigoApp(codigo: string): Promise<string | null> {
  const { data: fatores, error: e1 } = await supabase.auth.mfa.listFactors();
  if (e1) return e1.message;
  const fator = fatores.totp[0];
  if (!fator) return "Nenhum app autenticador ativado.";
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo.trim() });
  if (error) return "Código incorreto. Confira o app e tente o código mais recente.";
  return null;
}

/* ------------------------------------------------------------------
 * Tela de bloqueio
 *   - Depois de X minutos parado (escolhido pela clínica), o Lumê
 *     cobre a tela e pede PIN, digital/Face ID ou senha.
 *   - A última atividade fica guardada no aparelho, então fechar e
 *     abrir o app depois de muito tempo também cai no bloqueio.
 * ------------------------------------------------------------------ */
const CHAVE_ATIVIDADE = "lume.ultimaAtividade";

export function lerAtividade(): number | null {
  try {
    const v = localStorage.getItem(CHAVE_ATIVIDADE);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
export function marcarAtividade() {
  try {
    localStorage.setItem(CHAVE_ATIVIDADE, String(Date.now()));
  } catch {
    /* navegador sem armazenamento */
  }
}
export function limparAtividade() {
  try {
    localStorage.removeItem(CHAVE_ATIVIDADE);
  } catch {
    /* ignora */
  }
}

/** Sai só neste aparelho */
export async function sair() {
  limparAtividade();
  await supabase.auth.signOut({ scope: "local" });
}

/* ------------------------------------------------------------------
 * Digital / Face ID (biometria do próprio aparelho)
 * Usada só para destravar a tela de bloqueio neste aparelho.
 * ------------------------------------------------------------------ */
const chaveBio = (userId: string) => `lume.bio.${userId}`;

const paraB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function biometriaDisponivel(): Promise<boolean> {
  try {
    return typeof window !== "undefined" && !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export function biometriaAtiva(userId: string): boolean {
  try {
    return !!localStorage.getItem(chaveBio(userId));
  } catch {
    return false;
  }
}

export async function ativarBiometria(userId: string, email: string, nome: string): Promise<string | null> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Lumê", id: window.location.hostname },
        user: { id: new TextEncoder().encode(userId), name: email, displayName: nome },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return "Não foi possível ativar.";
    localStorage.setItem(chaveBio(userId), paraB64(cred.rawId));
    return null;
  } catch {
    return "Não foi possível ativar a digital/Face ID neste aparelho.";
  }
}

export function desativarBiometria(userId: string) {
  try {
    localStorage.removeItem(chaveBio(userId));
  } catch {
    /* ignora */
  }
}

export async function desbloquearComBiometria(userId: string): Promise<boolean> {
  try {
    const id = localStorage.getItem(chaveBio(userId));
    if (!id) return false;
    const r = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: deB64(id) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!r;
  } catch {
    return false;
  }
}
