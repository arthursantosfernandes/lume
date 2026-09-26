"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profissional } from "@/lib/useProfissional";
import { AssinaturaPad } from "./AssinaturaPad";

/** Configurações > Minha assinatura: desenhada uma vez, usada no prontuário assinado eletronicamente */
export function ConfigAssinatura({ profissional }: { profissional: Profissional }) {
  const [url, setUrl] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [png, setPng] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    supabase.from("professionals").select("assinatura_path").eq("id", profissional.id).maybeSingle()
      .then(async ({ data }) => {
        if (!data?.assinatura_path) return;
        const { data: u } = await supabase.storage.from("clinic-assets").createSignedUrl(data.assinatura_path, 3600);
        setUrl(u?.signedUrl ?? null);
      });
  }, [profissional.id]);

  async function salvar() {
    if (!png) return setErro("Assine no quadro antes de salvar.");
    setErro("");
    setSalvando(true);
    // data URL -> arquivo PNG (sem fetch, que a política de segurança do site bloqueia para "data:")
    const bin = atob(png.split(",")[1] ?? "");
    const blob = new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: "image/png" });
    const caminho = `${profissional.clinic_id}/assinaturas/${profissional.id}-${Date.now()}.png`;
    const up = await supabase.storage.from("clinic-assets").upload(caminho, blob, { contentType: "image/png" });
    if (up.error) {
      setSalvando(false);
      return setErro(up.error.message);
    }
    const { error } = await supabase.from("professionals").update({ assinatura_path: caminho }).eq("id", profissional.id);
    setSalvando(false);
    if (error) return setErro(error.message);
    setUrl(png);
    setEditando(false);
    setPng(null);
    setMsg("Assinatura salva! Ela aparece quando você assina um prontuário eletronicamente.");
  }

  return (
    <section className="mt-5 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">✍️ Minha assinatura</h2>
      <p className="text-sm text-tinta/60">
        Desenhe sua assinatura uma vez. Ela é usada quando você assina o prontuário eletronicamente
        (em “Imprimir / PDF” do paciente), sem precisar imprimir.
      </p>

      {!editando ? (
        <div className="flex items-center gap-4">
          <div className="flex h-20 flex-1 items-center justify-center rounded-xl border border-dashed border-black/15 bg-creme">
            {url ? <img src={url} alt="Sua assinatura" className="max-h-16 object-contain" />
              : <span className="text-sm text-tinta/40">Nenhuma assinatura cadastrada</span>}
          </div>
          <button type="button" onClick={() => { setEditando(true); setMsg(""); }}
            className="shrink-0 rounded-xl bg-salvia px-4 py-2 text-sm font-semibold text-white">
            {url ? "Refazer" : "Desenhar"}
          </button>
        </div>
      ) : (
        <div className="etapa-entra space-y-3">
          <AssinaturaPad onChange={setPng} />
          <div className="flex gap-3">
            <button type="button" className="botao-sec" onClick={() => { setEditando(false); setPng(null); }}>Cancelar</button>
            <button type="button" className="botao" disabled={salvando || !png} onClick={salvar}>
              {salvando ? "Salvando…" : "Salvar assinatura"}
            </button>
          </div>
        </div>
      )}

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {msg && <p className="etapa-entra rounded-lg bg-salvia-claro p-3 text-sm">{msg}</p>}
    </section>
  );
}
