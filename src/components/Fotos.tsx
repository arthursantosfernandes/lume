"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profissional } from "@/lib/useProfissional";
import { formatarData } from "@/lib/utils";

/**
 * Fotos antes/depois.
 * - Tira pela câmera (celular) ou escolhe da galeria
 * - Comprime antes de enviar (economiza espaço e internet)
 * - Guarda no bucket PRIVADO "patient-photos" em <clinica>/<paciente>/<arquivo>.jpg
 * - Exibe com links temporários (expiram em 1 hora)
 */

type Foto = {
  id: string;
  tipo: string;
  pose: string | null;
  regiao: string | null;
  storage_path: string;
  tirada_em: string;
  observacao: string | null;
  url?: string;
};

const TIPOS = [
  { v: "antes", t: "Antes" },
  { v: "depois", t: "Depois" },
  { v: "retorno", t: "Retorno" },
  { v: "intercorrencia", t: "Intercorrência" },
  { v: "outro", t: "Outro" },
];
const POSES = ["Frontal repouso", "Frontal sorrindo", "Frontal franzindo", "Testa elevada", "Perfil direito",
  "Perfil esquerdo", "Oblíqua direita", "Oblíqua esquerda", "Outra"];

// Reduz a foto para no máximo 1600px e JPEG 82% (~200–400 KB)
async function comprimir(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const max = 1600;
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao comprimir"))), "image/jpeg", 0.82)
  );
}

export function FotosPaciente({ pacienteId, profissional }: { pacienteId: string; profissional: Profissional }) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [tipo, setTipo] = useState("antes");
  const [pose, setPose] = useState(POSES[0]);
  const [regiao, setRegiao] = useState("");
  const [ampliada, setAmpliada] = useState<Foto | null>(null);
  const [comparar, setComparar] = useState<string[]>([]);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  async function carregar() {
    const { data } = await supabase
      .from("photos")
      .select("id, tipo, pose, regiao, storage_path, tirada_em, observacao")
      .eq("patient_id", pacienteId)
      .order("tirada_em", { ascending: false });
    const lista = (data ?? []) as Foto[];
    if (lista.length) {
      const { data: urls } = await supabase.storage
        .from("patient-photos")
        .createSignedUrls(lista.map((f) => f.storage_path), 3600);
      lista.forEach((f, i) => (f.url = urls?.[i]?.signedUrl ?? undefined));
    }
    setFotos(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!arquivos.length) return;
    setErro("");
    setEnviando(true);
    try {
      for (const arq of arquivos) {
        const blob = await comprimir(arq);
        const caminho = `${profissional.clinic_id}/${pacienteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const up = await supabase.storage.from("patient-photos").upload(caminho, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const { error } = await supabase.from("photos").insert({
          clinic_id: profissional.clinic_id,
          patient_id: pacienteId,
          tipo,
          pose,
          regiao: regiao.trim() || null,
          storage_path: caminho,
          created_by: profissional.id,
        });
        if (error) throw error;
      }
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar a foto.");
    }
    setEnviando(false);
  }

  function alternarComparar(id: string) {
    setComparar((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));
  }

  const nomeTipo = (v: string) => TIPOS.find((t) => t.v === v)?.t ?? v;
  const fotosComparar = comparar.map((id) => fotos.find((f) => f.id === id)).filter(Boolean) as Foto[];

  // Agrupa por data
  const grupos = new Map<string, Foto[]>();
  for (const f of fotos) {
    const d = formatarData(f.tirada_em);
    grupos.set(d, [...(grupos.get(d) ?? []), f]);
  }

  return (
    <div className="space-y-4">
      {/* Enviar */}
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Nova foto</h2>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button key={t.v} type="button" onClick={() => setTipo(t.v)}
              className={`rounded-full px-3 py-1.5 text-sm ${tipo === t.v ? "bg-salvia text-white" : "bg-creme text-tinta/70"}`}>
              {t.t}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="campo" value={pose} onChange={(e) => setPose(e.target.value)}>
            {POSES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input className="campo" placeholder="Região (opcional)" value={regiao} onChange={(e) => setRegiao(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="botao" disabled={enviando} onClick={() => camera.current?.click()}>📷 Tirar foto</button>
          <button className="botao-sec" disabled={enviando} onClick={() => galeria.current?.click()}>🖼 Galeria</button>
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={enviar} />
        <input ref={galeria} type="file" accept="image/*" multiple className="hidden" onChange={enviar} />
        {enviando && <p className="text-sm text-tinta/60">Enviando…</p>}
        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      </section>

      {/* Comparação lado a lado */}
      {fotosComparar.length === 2 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Comparação</h2>
            <button className="text-sm text-tinta/50 underline" onClick={() => setComparar([])}>Fechar</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {fotosComparar
              .sort((a, b) => a.tirada_em.localeCompare(b.tirada_em))
              .map((f) => (
                <figure key={f.id}>
                  <img src={f.url} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
                  <figcaption className="mt-1 text-center text-xs text-tinta/60">
                    {nomeTipo(f.tipo)} · {formatarData(f.tirada_em)}
                  </figcaption>
                </figure>
              ))}
          </div>
        </section>
      )}

      {/* Galeria */}
      {carregando ? null : fotos.length === 0 ? (
        <p className="py-6 text-center text-sm text-tinta/50">Nenhuma foto ainda.</p>
      ) : (
        <>
          <p className="text-xs text-tinta/50">Toque em ⇄ em duas fotos para comparar lado a lado.</p>
          {[...grupos.entries()].map(([data, lista]) => (
            <section key={data}>
              <h3 className="mb-2 text-sm font-medium text-tinta/60">{data}</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {lista.map((f) => (
                  <div key={f.id} className="relative">
                    <button className="block w-full" onClick={() => setAmpliada(f)}>
                      <img src={f.url} alt="" className="aspect-square w-full rounded-xl object-cover" />
                    </button>
                    <span className="absolute left-1 top-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                      {nomeTipo(f.tipo)}
                    </span>
                    <button onClick={() => alternarComparar(f.id)} aria-label="Comparar"
                      className={`absolute right-1 top-1 rounded-md px-1.5 py-0.5 text-xs ${
                        comparar.includes(f.id) ? "bg-dourado text-white" : "bg-white/85 text-tinta"
                      }`}>
                      ⇄
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {/* Foto ampliada */}
      {ampliada && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" onClick={() => setAmpliada(null)}>
          <img src={ampliada.url} alt="" className="m-auto max-h-[80vh] max-w-full rounded-lg" />
          <p className="text-center text-sm text-white/80">
            {nomeTipo(ampliada.tipo)} · {ampliada.pose ?? ""} {ampliada.regiao ? `· ${ampliada.regiao}` : ""} ·{" "}
            {formatarData(ampliada.tirada_em)}
          </p>
          <p className="mt-1 text-center text-xs text-white/50">Toque para fechar</p>
        </div>
      )}
    </div>
  );
}
