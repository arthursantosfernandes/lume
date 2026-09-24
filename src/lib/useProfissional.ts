"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";

export type Credencial = {
  id: string;
  profissao: string;
  conselho: string | null;
  numero_registro: string | null;
  uf: string | null;
  principal: boolean;
};

export type Profissional = {
  id: string;
  user_id: string;
  nome: string;
  clinic_id: string;
  papel: string;
  cpf: string | null;
  clinics: { nome: string; bloqueio_minutos: number } | null;
  professional_credentials: Credencial[];
};

/** Registro profissional principal (o que aparece nos atendimentos e na impressão) */
export function credencialPrincipal(p: Profissional | null): Credencial | null {
  if (!p) return null;
  return p.professional_credentials.find((c) => c.principal) ?? p.professional_credentials[0] ?? null;
}

/**
 * Estado do acesso, carregado UMA vez e compartilhado por todas as telas
 * (antes cada tela buscava de novo — por isso demorava ao clicar).
 */
export type EstadoAcesso = "carregando" | "sem-sessao" | "nao-verificado" | "sem-cadastro" | "ok" | "erro";

export type Sessao = {
  estado: EstadoAcesso;
  profissional: Profissional | null;
  email: string | null;
  recarregar: () => Promise<void>;
};

export const SessaoContexto = createContext<Sessao>({
  estado: "carregando",
  profissional: null,
  email: null,
  recarregar: async () => {},
});

export function useSessao() {
  return useContext(SessaoContexto);
}

/**
 * Para telas que exigem login completo.
 * - Sem login ou sem código confirmado -> /login
 * - Sem cadastro -> /cadastro
 */
export function useProfissional() {
  const router = useRouter();
  const { estado, profissional } = useSessao();

  useEffect(() => {
    if (estado === "sem-sessao" || estado === "nao-verificado") router.replace("/login");
    else if (estado === "sem-cadastro") router.replace("/cadastro");
  }, [estado, router]);

  return { profissional: estado === "ok" ? profissional : null, carregando: estado !== "ok" };
}
