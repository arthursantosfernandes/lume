"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfissional } from "@/lib/useProfissional";
import { UFS, capitalizarNome, mascaraCEP, mascaraCPF, mascaraTelefone } from "@/lib/utils";
import { Topo } from "@/components/Topo";
import { Carregando } from "@/components/Carregando";

const CAMPOS = ["nome", "sexo", "data_nascimento", "cpf", "telefone", "email", "cep", "endereco",
  "cidade", "uf", "profissao", "como_conheceu", "observacoes"] as const;
type Form = Record<(typeof CAMPOS)[number], string>;

/** Edição dos dados cadastrais da paciente (fica registrado na auditoria). */
export default function EditarPacientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profissional, carregando } = useProfissional();
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!profissional) return;
    supabase.from("patients").select(CAMPOS.join(", ")).eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) return;
      const d = data as unknown as Record<string, string | null>;
      const f = {} as Form;
      for (const k of CAMPOS) f[k] = d[k] ?? "";
      f.cpf = f.cpf ? mascaraCPF(f.cpf) : "";
      f.telefone = f.telefone ? mascaraTelefone(f.telefone) : "";
      f.cep = f.cep ? mascaraCEP(f.cep) : "";
      if (!f.uf) f.uf = "SP";
      setForm(f);
    });
  }, [profissional, id]);

  if (carregando || !profissional || !form) return <Carregando />;

  const campo = (chave: keyof Form, mascara?: (v: string) => string) => ({
    value: form[chave],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [chave]: mascara ? mascara(e.target.value) : e.target.value }),
  });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErro("");
    setSalvando(true);
    const dados = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()])
    );
    dados.nome = capitalizarNome(form.nome);
    const { error } = await supabase.from("patients").update(dados).eq("id", id);
    setSalvando(false);
    if (error) return setErro(error.message);
    router.replace(`/pacientes/${id}`);
  }

  return (
    <>
      <Topo titulo="Editar paciente" voltar={`/pacientes/${id}`} />
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
              <input className="campo" inputMode="numeric" {...campo("cpf", mascaraCPF)} />
            </div>
            <div>
              <label className="rotulo">Telefone / WhatsApp</label>
              <input className="campo" type="tel" {...campo("telefone", mascaraTelefone)} />
            </div>
            <div>
              <label className="rotulo">E-mail</label>
              <input className="campo" type="email" {...campo("email")} />
            </div>
            <div>
              <label className="rotulo">CEP</label>
              <input className="campo" inputMode="numeric" {...campo("cep", mascaraCEP)} />
            </div>
            <div>
              <label className="rotulo">Profissão</label>
              <input className="campo" {...campo("profissao")} />
            </div>
            <div>
              <label className="rotulo">Como conheceu a clínica</label>
              <input className="campo" {...campo("como_conheceu")} />
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
            <label className="rotulo">Observações</label>
            <textarea className="campo min-h-24" {...campo("observacoes")} />
          </div>
          <p className="text-xs text-tinta/50">As alterações ficam registradas no histórico (auditoria).</p>
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Salvar alterações"}</button>
        </form>
      </main>
    </>
  );
}
