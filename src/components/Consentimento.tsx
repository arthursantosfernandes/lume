"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import type { Profissional } from "@/lib/useProfissional";
import { formatarDataHora } from "@/lib/utils";

/**
 * Consentimento de uso de imagem com ASSINATURA DIGITAL.
 * A profissional gera um QR Code; a paciente abre no próprio celular,
 * aceita os termos e assina com o dedo. O comprovante fica aqui.
 * O banco bloqueia fotos de pacientes sem esse consentimento.
 */

type Consent = {
  id: string;
  tipo: string;
  titulo: string;
  texto_termo: string;
  aceito: boolean;
  aceito_em: string;
  revogado_em: string | null;
  assinatura_imagem: string | null;
  assinado_nome: string | null;
  assinado_ip: string | null;
  assinado_dispositivo: string | null;
  canal: string | null;
  hash_verificacao: string | null;
};

type Pedido = { id: string; token: string; expira_em: string; status: string };

// Resumo legível do aparelho a partir do "user agent"
function aparelho(ua: string | null): string {
  if (!ua) return "—";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Celular Android";
  if (/Windows/i.test(ua)) return "Computador Windows";
  if (/Mac OS/i.test(ua)) return "Computador Mac";
  return "Outro aparelho";
}

export function ConsentimentoImagem({
  pacienteId, pacienteTelefone, profissional, onStatus,
}: {
  pacienteId: string;
  pacienteTelefone: string | null;
  profissional: Profissional;
  onStatus?: (autorizado: boolean) => void;
}) {
  const [imagem, setImagem] = useState<Consent | null>(null);
  const [divulgacao, setDivulgacao] = useState<Consent | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [restante, setRestante] = useState("");
  const [verDetalhes, setVerDetalhes] = useState(false);
  const [erro, setErro] = useState("");

  const link = pedido ? `${window.location.origin}/assinar/${pedido.token}` : "";

  async function carregar() {
    const { data } = await supabase
      .from("consents")
      .select("id, tipo, titulo, texto_termo, aceito, aceito_em, revogado_em, assinatura_imagem, assinado_nome, assinado_ip, assinado_dispositivo, canal, hash_verificacao")
      .eq("patient_id", pacienteId)
      .in("tipo", ["uso_imagem", "divulgacao"])
      .is("revogado_em", null)
      .order("aceito_em", { ascending: false });
    const lista = (data ?? []) as Consent[];
    const img = lista.find((c) => c.tipo === "uso_imagem" && c.aceito) ?? null;
    setImagem(img);
    onStatus?.(!!img);
    setDivulgacao(lista.find((c) => c.tipo === "divulgacao") ?? null);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  // Enquanto o QR Code está na tela: atualiza o contador e verifica se já assinou
  useEffect(() => {
    if (!pedido) return;
    const timer = setInterval(async () => {
      const ms = new Date(pedido.expira_em).getTime() - Date.now();
      if (ms <= 0) {
        setRestante("expirado");
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRestante(`${m}:${String(s).padStart(2, "0")}`);
    }, 1000);
    const verificar = setInterval(async () => {
      const { data } = await supabase.from("signature_requests").select("status").eq("id", pedido.id).maybeSingle();
      if (data?.status === "assinado") {
        setPedido(null);
        setQr(null);
        await carregar();
      }
    }, 3000);
    return () => {
      clearInterval(timer);
      clearInterval(verificar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  async function solicitar(canal: "qrcode" | "presencial") {
    setErro("");
    const { data, error } = await supabase
      .from("signature_requests")
      .insert({ clinic_id: profissional.clinic_id, patient_id: pacienteId, criado_por: profissional.id, canal })
      .select("id, token, expira_em, status")
      .single();
    if (error || !data) return setErro(error?.message ?? "Erro ao gerar o pedido.");
    const p = data as Pedido;
    const url = `${window.location.origin}/assinar/${p.token}`;
    setQr(await QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: "#2d3a31" } }));
    setPedido(p);
  }

  async function cancelar() {
    if (pedido) await supabase.from("signature_requests").update({ status: "cancelado" }).eq("id", pedido.id);
    setPedido(null);
    setQr(null);
  }

  async function revogar() {
    if (!imagem) return;
    const motivo = window.prompt("Motivo da revogação (opcional):") ?? null;
    if (!window.confirm("Confirmar a revogação? Novas fotos ficarão bloqueadas.")) return;
    const ids = [imagem.id, divulgacao?.id].filter(Boolean) as string[];
    const { error } = await supabase
      .from("consents")
      .update({ revogado_em: new Date().toISOString(), motivo_revogacao: motivo })
      .in("id", ids);
    if (error) return setErro(error.message);
    await carregar();
  }

  function whatsapp() {
    const tel = (pacienteTelefone ?? "").replace(/\D/g, "");
    const texto = encodeURIComponent(
      `Olá! Para registrarmos suas fotos no prontuário da ${profissional.clinics?.nome ?? "clínica"}, leia e assine os termos por este link (válido por 30 minutos): ${link}`
    );
    window.open(tel ? `https://wa.me/55${tel}?text=${texto}` : `https://wa.me/?text=${texto}`, "_blank");
  }

  if (carregando) return null;

  // ---------- Consentimento assinado ----------
  if (imagem) {
    const assinado = !!imagem.assinatura_imagem;
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl">✅</span>
          <div className="flex-1">
            <p className="font-semibold">Uso de imagem autorizado</p>
            <p className="text-sm text-tinta/60">
              Divulgação:{" "}
              {divulgacao ? (divulgacao.aceito ? "autorizada" : "não autorizada") : imagem.titulo.includes("divulgação") ? "autorizada" : "—"}
            </p>
            <p className="text-xs text-tinta/50">
              {assinado ? "Assinado" : "Registrado"} em {formatarDataHora(imagem.aceito_em)}
              {!assinado && " · sem assinatura digital (versão anterior)"}
            </p>
          </div>
        </div>

        {assinado && (
          <div className="mt-3 rounded-xl border border-black/10 p-3">
            <img src={imagem.assinatura_imagem!} alt="Assinatura da paciente" className="mx-auto max-h-28" />
            <p className="border-t border-black/20 pt-1 text-center text-sm">{imagem.assinado_nome}</p>
          </div>
        )}

        {verDetalhes && (
          <div className="mt-3 space-y-3 text-sm">
            <p className="whitespace-pre-wrap rounded-xl bg-creme p-3">{imagem.texto_termo}</p>
            {divulgacao && <p className="whitespace-pre-wrap rounded-xl bg-creme p-3">{divulgacao.texto_termo}</p>}
            {assinado && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-tinta/70">
                <dt>Canal</dt><dd>{imagem.canal === "presencial" ? "Aparelho da clínica" : "QR Code / link"}</dd>
                <dt>Aparelho</dt><dd>{aparelho(imagem.assinado_dispositivo)}</dd>
                <dt>IP</dt><dd>{imagem.assinado_ip || "—"}</dd>
                <dt>Verificação</dt><dd className="break-all font-mono">{imagem.hash_verificacao}</dd>
              </dl>
            )}
          </div>
        )}

        <div className="mt-3 flex gap-4 text-sm">
          <button className="text-salvia-escuro underline" onClick={() => setVerDetalhes(!verDetalhes)}>
            {verDetalhes ? "Ocultar comprovante" : "Ver comprovante"}
          </button>
          <button className="text-red-700 underline" onClick={revogar}>Revogar</button>
        </div>
        {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
      </div>
    );
  }

  // ---------- QR Code na tela ----------
  if (pedido && qr) {
    const expirado = restante === "expirado";
    return (
      <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
        <p className="font-semibold">Peça para a paciente escanear com a câmera do celular</p>
        <img src={qr} alt="QR Code para assinatura" className={`mx-auto my-4 w-64 max-w-full ${expirado ? "opacity-20" : ""}`} />
        {expirado ? (
          <p className="mb-3 font-medium text-red-700">QR Code expirado.</p>
        ) : (
          <p className="mb-3 text-sm text-tinta/60">
            Aguardando assinatura… <span className="font-mono">{restante}</span>
          </p>
        )}
        <div className="space-y-2">
          {expirado ? (
            <button className="botao" onClick={() => solicitar("qrcode")}>Gerar novo QR Code</button>
          ) : (
            <>
              <button className="botao-sec" onClick={whatsapp}>Enviar link por WhatsApp</button>
              <button className="botao-sec" onClick={() => window.open(link, "_blank")}>Assinar neste aparelho</button>
            </>
          )}
          <button className="text-sm text-tinta/50 underline" onClick={cancelar}>Cancelar</button>
        </div>
        {window.location.hostname === "localhost" && (
          <p className="mt-4 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            Você está em "localhost": o QR Code só abre neste computador. No celular, funciona depois de publicar o app.
          </p>
        )}
      </div>
    );
  }

  // ---------- Sem consentimento ----------
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="font-semibold text-amber-900">Sem consentimento de uso de imagem</p>
      <p className="mb-3 text-sm text-amber-900/80">
        Para registrar fotos, a paciente precisa ler e assinar os termos.
      </p>
      <div className="space-y-2">
        <button className="botao" onClick={() => solicitar("qrcode")}>Gerar QR Code para assinatura</button>
        <button className="botao-sec bg-white" onClick={() => solicitar("presencial")}>Assinar neste aparelho</button>
      </div>
      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
