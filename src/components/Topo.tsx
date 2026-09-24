"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { sair as encerrarSessao } from "@/lib/seguranca";

export function Topo({ titulo, voltar }: { titulo: string; voltar?: string }) {
  const router = useRouter();

  async function sair() {
    await encerrarSessao();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-creme/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        {voltar ? (
          <Link href={voltar} className="rounded-lg px-2 py-1 text-xl text-salvia-escuro" aria-label="Voltar">
            ←
          </Link>
        ) : (
          <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
        )}
        <h1 className="flex-1 truncate text-lg font-semibold">{titulo}</h1>
        <Link href="/configuracoes" className="rounded-lg px-2 py-1 text-lg text-tinta/60 hover:text-tinta"
          aria-label="Configurações" title="Configurações">
          ⚙
        </Link>
        <button onClick={sair} className="text-sm text-tinta/60 hover:text-tinta">
          Sair
        </button>
      </div>
    </header>
  );
}
