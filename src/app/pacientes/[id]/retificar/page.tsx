"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfissional } from "@/lib/useProfissional";
import { UFS, capitalizarNome, mascaraCEP, mascaraCPF, mascaraTelefone, erroCPF, soNumeros, mensagemErro, MOTIVOS_RETIFICACAO } from "@/lib/utils";
import { Topo } from "@/components/Topo";
import { Carregando } from "@/components/Carregando";

const CAMPOS = ["nome", "sexo", "data_nascimento", "cpf", "telefone", "email", "cep", "endereco",
  "cidade", "uf", "profissao", "como_conheceu", "observacoes"] as const;
type Form = Record<(typeof CAMPOS)[number], string>;

/**
 * Retificação dos dados cadastrais da paciente.
 * Nada é editado livremente: a alteração exige motivo e justificativa,
 * e fica registrada com valor antigo, valor novo, autor e data.
 */
export default function RetificarPacientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profissional, carregando } = useProfissional();
  const [form, setForm] = useState<Form | null>(null);
  const [original, setOriginal] = useState<Form | null>(null);
  const [motivo, setMotivo] = useState("");
  const [justificativa, setJustificativa] = useState("");
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
      setForm(f);
      setOriginal(f);
    });
  }, [profissional, id]);

  if (carregando || !profissional || !form) return <Carregando />;

  const campo = (chave: keyof Form, mascara?: (v: string) => string) => ({
    value: form[chave],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [chave]: mascara ? mascara(e.target.value) : e.target.value }),
  });

  // Valor como vai para o banco (CPF só números, nome capitalizado, vazio = null)
  const paraBanco = (k: keyof Form, v: string): string | null => {
    const t = v.trim();
    if (t === "") return null;
    if (k === "cpf" || k === "telefone" || k === "cep") return soNumeros(t) || null;
    if (k === "nome") return capitalizarNome(t);
    return t;
  };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !original) return;
    setErro("");
    const cpfErro = erroCPF(form.cpf);
    if (cpfErro) return setErro(cpfErro);
    if (!motivo) return setErro("Escolha o motivo da retificação.");
    if (justificativa.trim().length < 15) return setErro("A justificativa precisa ter pelo menos 15 caracteres.");

    // Envia só o que mudou
    const campos: Record<string, string | null> = {};
    for (const k of CAMPOS) {
      const novo = paraBanco(k, form[k]);
      const antigo = paraBanco(k, original[k]);
      if (novo !== antigo) campos[k] = novo;
    }
    if (Object.keys(campos).length === 0) return setErro("Nenhuma alteração feita.");

    setSalvando(true);
    const { error } = await supabase.rpc("retificar_paciente", {
      p_patient: id, p_campos: campos, p_motivo_tipo: motivo, p_justificativa: justificativa.trim(),
    });
    setSalvando(false);
    if (error) return setErro(mensagemErro(error.message));
    router.replace(`/pacientes/${id}`);
  }

  return (
    <>
      <Topo titulo="Retificar dados" voltar={`/pacientes/${id}`} />
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
              {form.cpf.length >= 14 && erroCPF(form.cpf) && (
                <p className="mt-1 text-sm text-red-700">{erroCPF(form.cpf)}</p>
              )}
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
                <option value="">—</option>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="rotulo">Observações</label>
            <textarea className="campo min-h-24" {...campo("observacoes")} />
          </div>
          <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Justificativa da retificação *</p>
            <p className="text-sm text-amber-900/80">
              A alteração fica registrada no prontuário com o valor antigo, o novo, seu nome, registro, data e hora.
            </p>
            <select className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
              <option value="">Motivo…</option>
              {MOTIVOS_RETIFICACAO.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}
            </select>
            <textarea className="campo min-h-20" required minLength={15} value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Explique o que foi corrigido e por quê (mínimo 15 caracteres)" />
            <p className="text-right text-xs text-amber-900/60">{justificativa.trim().length}/15</p>
          </section>
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Registrar retificação"}</button>
        </form>
      </main>
    </>
  );
}
