"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Quadro para assinar com o dedo (celular) ou mouse (computador).
 * Devolve a assinatura como imagem PNG (data URL) pelo onChange.
 */
export function AssinaturaPad({ onChange }: { onChange: (png: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const [vazio, setVazio] = useState(true);
  const tracou = useRef(false);

  // Ajusta o tamanho real do canvas à tela (nitidez em celulares)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1f2a24";
  }, []);

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function inicio(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    desenhando.current = true;
    ultimo.current = ponto(e);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current || !ultimo.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = ponto(e);
    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = p;
    if (!tracou.current) {
      tracou.current = true;
      setVazio(false);
    }
  }

  function fim() {
    if (!desenhando.current) return;
    desenhando.current = false;
    ultimo.current = null;
    if (tracou.current && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  }

  function limpar() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    tracou.current = false;
    setVazio(true);
    onChange(null);
  }

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-black/15 bg-white"
          onPointerDown={inicio}
          onPointerMove={mover}
          onPointerUp={fim}
          onPointerLeave={fim}
          onPointerCancel={fim}
        />
        {vazio && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-tinta/40">
            Assine aqui com o dedo
          </span>
        )}
        <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-black/20" />
      </div>
      <button type="button" onClick={limpar} className="mt-2 text-sm text-salvia-escuro underline">
        Limpar e assinar de novo
      </button>
    </div>
  );
}
