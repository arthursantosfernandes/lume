/** Moldura das telas de entrada (login, cadastro, senha): fundo animado + logo */
export function TelaAcesso({ titulo, subtitulo, children, largo }: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  largo?: boolean;
}) {
  return (
    <div className="fundo-aurora min-h-dvh">
      <main className={`mx-auto flex min-h-dvh flex-col justify-center px-6 py-10 ${largo ? "max-w-lg" : "max-w-sm"}`}>
        <div className="mb-8 text-center">
          <img src="/icon-192.png" alt="Lumê" className="logo-respira mx-auto mb-4 h-20 w-20 rounded-2xl shadow-sm" />
          <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-tinta/60">{subtitulo}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
