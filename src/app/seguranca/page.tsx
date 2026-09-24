"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfissional } from "@/lib/useProfissional";
import { Topo } from "@/components/Topo";
import { Carregando } from "@/components/Carregando";

/**
 * OPCIONAL: ativar app autenticador (Google/Microsoft Authenticator).
 * Quem ativar pode usar o código do app no lugar do código por e-mail.
 */
export default function AppAutenticadorPage() {
  const router = useRouter();
  const { profissional, carregando } = useProfissional();
  const iniciou = useRef(false);
  const [jaAtivo, setJaAtivo] = useState<boolean | null>(null);
  const [fator, setFator] = useState<{ id: string; qr: string; chave: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [verChave, setVerChave] = useState(false);

  useEffect(() => {
    if (!profissional || iniciou.current) return;
    iniciou.current = true;
    (async () => {
      const { data: lista } = await supabase.auth.mfa.listFactors();
      if ((lista?.totp?.length ?? 0) > 0) return setJaAtivo(true);
      setJaAtivo(false);
      for (const f of lista?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Celular ${new Date().toISOString()}`,
      });
      if (error || !data) return setErro(error?.message ?? "Não foi possível gerar o QR Code.");
      setFator({ id: data.id, qr: data.totp.qr_code, chave: data.totp.secret });
    })();
  }, [profissional]);

  if (carregando || !profissional || jaAtivo === null) return <Carregando />;

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!fator) return;
    setErro("");
    setEnviando(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo });
    setEnviando(false);
    if (error) {
      setCodigo("");
      return setErro("Código incorreto. Confira se o relógio do celular está certo e use o código mais recente.");
    }
    router.replace("/configuracoes?ok=app");
  }

  return (
    <>
      <Topo titulo="App autenticador" voltar="/configuracoes" />
      <main className="mx-auto max-w-md px-4 pb-10 pt-4">
        {jaAtivo ? (
          <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <p className="text-4xl">✅</p>
            <p className="mt-2 font-semibold">App autenticador já está ativo nesta conta.</p>
            <p className="mt-1 text-sm text-tinta/60">No login, toque em “Usar o app autenticador” para usar o código do app.</p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-tinta/70">
              Opcional: com um app autenticador, você pode confirmar novos aparelhos sem esperar o e-mail.
            </p>
            <ol className="space-y-4">
              <li className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-semibold">1. Instale um app autenticador</p>
                <p className="text-sm text-tinta/70">
                  <b>Google Authenticator</b> ou <b>Microsoft Authenticator</b> (grátis). No Google Authenticator,
                  entre com sua conta Google para ter backup dos códigos.
                </p>
              </li>
              <li className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-semibold">2. No app, toque em “+” e leia o QR Code</p>
                {fator && (
                  <>
                    <img src={fator.qr} alt="QR Code do app autenticador" className="mx-auto my-4 w-52 rounded-lg bg-white" />
                    <button type="button" onClick={() => setVerChave(!verChave)} className="text-sm text-salvia-escuro underline">
                      Está no mesmo celular? Copiar a chave
                    </button>
                    {verChave && (
                      <p className="mt-2 select-all break-all rounded-lg bg-creme p-2 font-mono text-sm">{fator.chave}</p>
                    )}
                  </>
                )}
                <p className="mt-3 text-xs text-tinta/50">Não mostre este QR Code para ninguém.</p>
              </li>
              <li className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="mb-2 font-semibold">3. Digite o código de 6 números do app</p>
                <form onSubmit={confirmar} className="space-y-3">
                  <input className="campo text-center text-2xl tracking-[0.5em]" required inputMode="numeric"
                    autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                  {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
                  <button className="botao" disabled={enviando || codigo.length !== 6 || !fator}>
                    {enviando ? "Verificando…" : "Ativar"}
                  </button>
                </form>
              </li>
            </ol>
          </>
        )}
      </main>
    </>
  );
}
