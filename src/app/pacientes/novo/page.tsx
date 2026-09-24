"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfissional } from "@/lib/useProfissional";
import { UFS, capitalizarNome, mascaraCPF, mascaraTelefone, mascaraCEP } from "@/lib/utils";
import { Topo } from "@/components/Topo";
import { Carregando } from "@/components/Carregando";

export default function NovaPacientePage() {
  const router = useRouter();
  const { profissional, carregando } = useProfissional();
  const [form, setForm] = useState({
    nome: "", sexo: "", data_nascimento: "", cpf: "", telefone: "", email: "",
    cep: "", endereco: "", cidade: "", uf: "SP", profissao: "", como_conheceu: "", observacoes: "",
  });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (carregando || !profissional) return <Carregando />;

  // mascara (opcional) formata o valor enquanto a pessoa digita
  const campo = (chave: keyof typeof form, mascara?: (v: string) => string) => ({
    value: form[chave],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [chave]: mascara ? mascara(e.target.value) : e.target.value }),
  });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!profissional) return;
    setErro("");
    setEnviando(true);

    // Campos vazios viram null no banco
    const dados = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()])
    );
    dados.nome = capitalizarNome(form.nome);

    const { data, error } = await supabase
      .from("patients")
      .insert({ ...dados, clinic_id: profissional.clinic_id, created_by: profissional.id })
      .select("id")
      .single();

    setEnviando(false);
    if (error) return setErro(error.message);
    router.replace(`/pacientes/${data.id}`);
  }

  return (
    <>
      <Topo titulo="Nova paciente" voltar="/" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="rotulo">Nome completo *</label>
            <input className="campo" required {...campo("nome")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo">Sexo *</label>
              <select className="campo" required {...campo("sexo")}>
                <option value="">Selecione…</option>
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="rotulo">Data de nascimento</label>
              <input className="campo" type="date" {...campo("data_nascimento")} />
            </div>
            <div>
              <label className="rotulo">CPF</label>
              <input className="campo" inputMode="numeric" placeholder="000.000.000-00" {...campo("cpf", mascaraCPF)} />
            </div>
            <div>
              <label className="rotulo">Telefone / WhatsApp</label>
              <input className="campo" type="tel" placeholder="(11) 90000-0000" {...campo("telefone", mascaraTelefone)} />
            </div>
            <div>
              <label className="rotulo">E-mail</label>
              <input className="campo" type="email" {...campo("email")} />
            </div>
            <div>
              <label className="rotulo">CEP</label>
              <input className="campo" inputMode="numeric" placeholder="00000-000" {...campo("cep", mascaraCEP)} />
            </div>
            <div>
              <label className="rotulo">Profissão</label>
              <input className="campo" {...campo("profissao")} />
            </div>
          </div>
          <div>
            <label className="rotulo">Endereço</label>
            <input className="campo" {...campo("endereco")} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="rotulo">Cidade</label>
              <input className="campo" {...campo("cidade")} />
            </div>
            <div>
              <label className="rotulo">UF</label>
              <select className="campo" {...campo("uf")}>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="rotulo">Como conheceu a clínica</label>
            <input className="campo" {...campo("como_conheceu")} />
          </div>
          <div>
            <label className="rotulo">Observações</label>
            <textarea className="campo min-h-24" {...campo("observacoes")} />
          </div>

          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <button className="botao" disabled={enviando}>{enviando ? "Salvando…" : "Salvar paciente"}</button>
        </form>
      </main>
    </>
  );
}
