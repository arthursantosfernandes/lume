/** Enquanto carrega: "esqueleto" da tela com brilho passando */
export function Carregando() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-4" aria-busy="true" aria-label="Carregando">
      <div className="esqueleto mb-6 h-12" />
      <div className="esqueleto mb-3 h-20" />
      <div className="esqueleto mb-3 h-20" />
      <div className="esqueleto mb-3 h-20" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
