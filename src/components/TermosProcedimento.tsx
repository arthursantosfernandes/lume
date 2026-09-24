"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profissional } from "@/lib/useProfissional";
import { formatarDataHora } from "@/lib/utils";
import { PainelQRCode, type Pedido } from "./PainelQRCode";

/**
 * TCLE por procedimento.
 * Lista os procedimentos com termo, mostra quais já foram assinados
 * e permite coletar a assinatura por QR Code.
 */

type Tpl = { id: string; nome: string };
type Assinado = {
  id: string;
  procedure_template_id: string;
  texto_termo: string;
  aceito_em: string;
  assinatura_imagem: string | null;
  assinado_nome: string | null;
  assinado_ip: string | null;
  hash_verificacao: string | null;
};

export function TermosProcedimento({
  pacienteId, pacienteTelefone, profissional,
}: { pacienteId: string; pacienteTelefone: string | null; profissional: Profissional }) {
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [assinados, setAssinados] = useState<Assinado[]>([]);
  const [pedido, setPedido] = useState<(Pedido & { tpl: Tpl }) | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const [t, c] = await Promise.all([
      supabase.from("procedure_templates").select("id, nome").not("tcle", "is", null).eq("ativo", true).order("nome"),
      supabase.from("consents")
        .select("id, procedure_template_id, texto_termo, aceito_em, assinatura_imagem, assinado_nome, assinado_ip, hash_verificacao")
        .eq("patient_id", pacienteId).eq("tipo", "procedimento").eq("aceito", true).is("revogado_em", null)
        .order("aceito_em", { ascending: false }),
    ]);
    setTemplates((t.data ?? []) as Tpl[]);
    setAssinados((c.data ?? []) as Assinado[]);
  }, [pacienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function solicitar(tpl: Tpl) {
    setErro("");
    const { data, error } = await supabase
      .from("signature_requests")
      .insert({
        clinic_id: profissional.clinic_id, patient_id: pacienteId, criado_por: profissional.id,
        canal: "qrcode", tipo: "tcle", procedure_template_id: tpl.id,
      })
      .select("id, token, expira_em")
      .single();
    if (error || !data) return setErro(error?.message ?? "Erro ao gerar o pedido.");
    setPedido({ ...(data as Pedido), tpl });
  }

  const aoAssinar = useCallback(() => {
    setPedido(null);
    carregar();
  }, [carregar]);
  const aoCancelar = useCallback(() => setPedido(null), []);

  // ---------- QR Code na tela ----------
  if (pedido) {
    return (
      <div className="space-y-3">
        <p className="text-center font-semibold">TCLE — {pedido.tpl.nome}</p>
        <PainelQRCode
          pedido={pedido}
          telefone={pacienteTelefone}
          textoWhatsApp={`Olá! Antes do seu procedimento de ${pedido.tpl.nome} na ${profissional.clinics?.nome ?? "clínica"}, leia e assine o termo de consentimento por este link (válido por 30 minutos):`}
          onAssinado={aoAssinar}
          onCancelar={aoCancelar}
          onNovo={() => solicitar(pedido.tpl)}
        />
      </div>
    );
  }

  // ---------- Lista ----------
  return (
    <div className="space-y-3">
      <p className="text-sm text-tinta/60">
        Termo de Consentimento Livre e Esclarecido (TCLE) de cada procedimento, com riscos e cuidados.
        Colete a assinatura antes de realizar o procedimento.
      </p>
      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl bg-white shadow-sm">
        {templates.map((t) => {
          const assinado = assinados.find((a) => a.procedure_template_id === t.id);
          const expandido = aberto === t.id;
          return (
            <li key={t.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="text-lg">{assinado ? "✅" : "📝"}</span>
                <div className="flex-1">
                  <p className="font-medium">{t.nome}</p>
                  <p className="text-xs text-tinta/50">
                    {assinado ? `Assinado em ${formatarDataHora(assinado.aceito_em)}` : "Não assinado"}
                  </p>
                </div>
                {assinado ? (
                  <button className="text-sm text-salvia-escuro underline" onClick={() => setAberto(expandido ? null : t.id)}>
                    {expandido ? "Ocultar" : "Ver"}
                  </button>
                ) : (
                  <button className="rounded-xl bg-salvia px-3 py-2 text-sm font-semibold text-white" onClick={() => solicitar(t)}>
                    Coletar assinatura
                  </button>
                )}
              </div>

              {assinado && expandido && (
                <div className="mt-3 space-y-3 text-sm">
                  <p className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-creme p-3">{assinado.texto_termo}</p>
                  {assinado.assinatura_imagem && (
                    <div className="rounded-xl border border-black/10 p-3 text-center">
                      <img src={assinado.assinatura_imagem} alt="Assinatura" className="mx-auto max-h-24" />
                      <p className="border-t border-black/20 pt-1">{assinado.assinado_nome}</p>
                    </div>
                  )}
                  <p className="break-all text-xs text-tinta/50">
                    IP {assinado.assinado_ip || "—"} · Verificação: <span className="font-mono">{assinado.hash_verificacao}</span>
                  </p>
                  <button className="text-sm text-salvia-escuro underline" onClick={() => solicitar(t)}>
                    Coletar nova assinatura (ex.: termo desatualizado)
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
