"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

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
  nome: string;
  clinic_id: string;
  papel: string;
  clinics: { nome: string } | null;
  professional_credentials: Credencial[];
};

/** Registro profissional principal (o que aparece nos atendimentos e na impressão) */
export function credencialPrincipal(p: Profissional | null): Credencial | null {
  if (!p) return null;
  return p.professional_credentials.find((c) => c.principal) ?? p.professional_credentials[0] ?? null;
}

/**
 * Garante que há alguém logado e com cadastro completo.
 * - Sem login -> manda para /login
 * - Logado mas sem cadastro -> manda para /cadastro
 */
export function useProfissional() {
  const router = useRouter();
  const [profissional, setProfissional] = useState<Profissional | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("professionals")
        .select(
          "id, nome, clinic_id, papel, clinics(nome), professional_credentials(id, profissao, conselho, numero_registro, uf, principal)"
        )
        .eq("user_id", sessao.session.user.id)
        .maybeSingle();

      if (!ativo) return;
      if (!data) {
        router.replace("/cadastro");
        return;
      }
      setProfissional(data as unknown as Profissional);
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [router]);

  return { profissional, carregando };
}
