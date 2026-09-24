/**
 * Envolve cada tela: toda vez que você muda de página,
 * o conteúdo entra com um movimento suave (ver .entrada-pagina no globals.css).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="entrada-pagina">{children}</div>;
}
