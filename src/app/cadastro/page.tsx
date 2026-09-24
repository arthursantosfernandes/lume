"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PROFISSOES, UFS, capitalizarNome } from "@/lib/utils";

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [clinica, setClinica] = useState("");
  const [profissao, setProfissao] = useState("enfermeiro");
  const [numero, setNumero] = useState("");
  const [uf, setUf] = useState("SP");
  const [especialidade, setEspecialidade] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const conselho = PROFISSOES.find((p) => p.valor === profissao)?.conselho ?? "outro";
  const temConselho = conselho !== "nenhum";

  // Precisa estar logado para cadastrar
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
    });
  }, [router]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const { error } = await supabase.rpc("onboard_professional", {
      p_clinic_nome: clinica,
      p_nome: capitalizarNome(nome),
      p_profissao: profissao,
      p_conselho: conselho,
      p_numero_registro: temConselho ? numero : null,
      p_uf: temConselho ? uf : null,
      p_especialidade: especialidade || null,
    });
    setEnviando(false);
    if (error) return setErro(error.message);
    router.replace("/");
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="text-2xl font-semibold">Bem-vinda ao Lumê</h1>
      <p className="mb-6 text-tinta/60">Conte um pouco sobre você e sua clínica.</p>

      <form onSubmit={salvar} className="space-y-4">
        <div>
          <label className="rotulo">Seu nome completo</label>
          <input className="campo" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className="rotulo">Nome da clínica</label>
          <input className="campo" required value={clinica} onChange={(e) => setClinica(e.target.value)} />
        </div>
        <div>
          <label className="rotulo">Profissão</label>
          <select className="campo" value={profissao} onChange={(e) => setProfissao(e.target.value)}>
            {PROFISSOES.map((p) => (
              <option key={p.valor} value={p.valor}>{p.nome}</option>
            ))}
          </select>
        </div>

        {temConselho && (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="rotulo">Nº {conselho}</label>
              <input className="campo" required inputMode="numeric" value={numero}
                onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div>
              <label className="rotulo">UF</label>
              <select className="campo" value={uf} onChange={(e) => setUf(e.target.value)}>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="rotulo">Especialização (opcional)</label>
          <input className="campo" placeholder="Ex: Pós-graduação em Estética"
            value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} />
        </div>

        <p className="text-xs text-tinta/50">
          Os dados da clínica (endereço, logo, telefone) podem ser completados depois em Configurações.
        </p>

        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        <button className="botao" disabled={enviando}>{enviando ? "Salvando…" : "Começar"}</button>
      </form>
    </main>
  );
}
