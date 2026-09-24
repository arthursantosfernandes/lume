"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";

/**
 * Mostra o QR Code de um pedido de assinatura, com contador,
 * envio por WhatsApp e "assinar neste aparelho".
 * Verifica a cada 3 s se a paciente já assinou.
 */
export type Pedido = { id: string; token: string; expira_em: string };

export function PainelQRCode({
  pedido, telefone, textoWhatsApp, onAssinado, onCancelar, onNovo,
}: {
  pedido: Pedido;
  telefone: string | null;
  textoWhatsApp: string;
  onAssinado: () => void;
  onCancelar: () => void;
  onNovo: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [restante, setRestante] = useState("");
  const link = `${window.location.origin}/assinar/${pedido.token}`;
  const expirado = restante === "expirado";

  useEffect(() => {
    QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: "#2d3a31" } }).then(setQr);
  }, [link]);

  useEffect(() => {
    const timer = setInterval(() => {
      const ms = new Date(pedido.expira_em).getTime() - Date.now();
      if (ms <= 0) return setRestante("expirado");
      setRestante(`${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`);
    }, 1000);
    const verificar = setInterval(async () => {
      const { data } = await supabase.from("signature_requests").select("status").eq("id", pedido.id).maybeSingle();
      if (data?.status === "assinado") onAssinado();
    }, 3000);
    return () => {
      clearInterval(timer);
      clearInterval(verificar);
    };
  }, [pedido, onAssinado]);

  async function cancelar() {
    await supabase.from("signature_requests").update({ status: "cancelado" }).eq("id", pedido.id);
    onCancelar();
  }

  function whatsapp() {
    const tel = (telefone ?? "").replace(/\D/g, "");
    const texto = encodeURIComponent(`${textoWhatsApp} ${link}`);
    window.open(tel ? `https://wa.me/55${tel}?text=${texto}` : `https://wa.me/?text=${texto}`, "_blank");
  }

  return (
    <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
      <p className="font-semibold">Peça para a paciente escanear com a câmera do celular</p>
      {qr && <img src={qr} alt="QR Code para assinatura" className={`mx-auto my-4 w-64 max-w-full ${expirado ? "opacity-20" : ""}`} />}
      {expirado ? (
        <p className="mb-3 font-medium text-red-700">QR Code expirado.</p>
      ) : (
        <p className="mb-3 text-sm text-tinta/60">
          Aguardando assinatura… <span className="font-mono">{restante}</span>
        </p>
      )}
      <div className="space-y-2">
        {expirado ? (
          <button className="botao" onClick={onNovo}>Gerar novo QR Code</button>
        ) : (
          <>
            <button className="botao-sec" onClick={whatsapp}>Enviar link por WhatsApp</button>
            <button className="botao-sec" onClick={() => window.open(link, "_blank")}>Assinar neste aparelho</button>
          </>
        )}
        <button className="text-sm text-tinta/50 underline" onClick={cancelar}>Cancelar</button>
      </div>
    </div>
  );
}
