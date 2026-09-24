"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfissional, credencialPrincipal } from "@/lib/useProfissional";
import { PROFISSOES, UFS, capitalizarNome, mascaraCEP, mascaraTelefone } from "@/lib/utils";
import { Topo } from "@/components/Topo";
import { Carregando } from "@/components/Carregando";

type Clinica = {
  nome: string; documento: string; telefone: string; email: string; cep: string; endereco: string;
  numero: string; complemento: string; bairro: string; cidade: string; uf: string; logo_path: string | null;
};

const VAZIA: Clinica = {
  nome: "", documento: "", telefone: "", email: "", cep: "", endereco: "", numero: "",
  complemento: "", bairro: "", cidade: "", uf: "SP", logo_path: null,
};

export default function ConfiguracoesPage() {
  const { profissional, carregando } = useProfissional();
  const [clinica, setClinica] = useState<Clinica>(VAZIA);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [prof, setProf] = useState({ nome: "", telefone: "" });
  const [cred, setCred] = useState({ profissao: "enfermeiro", numero_registro: "", uf: "SP", especialidade: "" });
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const inputLogo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profissional) return;
    (async () => {
      const { data } = await supabase.from("clinics").select("*").eq("id", profissional.clinic_id).maybeSingle();
      if (data) {
        const c = { ...VAZIA } as Record<string, unknown>;
        for (const k of Object.keys(VAZIA)) c[k] = data[k] ?? (k === "logo_path" ? null : "");
        setClinica(c as Clinica);
        if (data.logo_path) {
          const { data: u } = await supabase.storage.from("clinic-assets").createSignedUrl(data.logo_path, 3600);
          setLogoUrl(u?.signedUrl ?? null);
        }
      }
      const { data: p } = await supabase.from("professionals").select("nome, telefone").eq("id", profissional.id).maybeSingle();
      setProf({ nome: p?.nome ?? "", telefone: p?.telefone ?? "" });
      const c = credencialPrincipal(profissional);
      if (c) {
        const { data: cd } = await supabase.from("professional_credentials").select("especialidade").eq("id", c.id).maybeSingle();
        setCred({
          profissao: c.profissao, numero_registro: c.numero_registro ?? "", uf: c.uf ?? "SP",
          especialidade: cd?.especialidade ?? "",
        });
      }
    })();
  }, [profissional]);

  if (carregando || !profissional) return <Carregando />;

  const credencial = credencialPrincipal(profissional);
  const conselho = PROFISSOES.find((p) => p.valor === cred.profissao)?.conselho ?? "outro";

  const campoC = (k: keyof Clinica, mascara?: (v: string) => string) => ({
    value: (clinica[k] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setClinica({ ...clinica, [k]: mascara ? mascara(e.target.value) : e.target.value }),
  });

  async function enviarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq || !profissional) return;
    setErro("");
    const ext = arq.name.split(".").pop()?.toLowerCase() || "png";
    const caminho = `${profissional.clinic_id}/logo-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("clinic-assets").upload(caminho, arq, { contentType: arq.type });
    if (up.error) return setErro(up.error.message);
    const { error } = await supabase.from("clinics").update({ logo_path: caminho }).eq("id", profissional.clinic_id);
    if (error) return setErro(error.message);
    setClinica({ ...clinica, logo_path: caminho });
    setLogoUrl(URL.createObjectURL(arq));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!profissional) return;
    setErro("");
    setMsg("");
    setSalvando(true);
    const nulo = (v: string) => (v.trim() === "" ? null : v.trim());
    const { logo_path: _ignora, ...resto } = clinica;
    void _ignora;
    const dadosClinica = Object.fromEntries(Object.entries(resto).map(([k, v]) => [k, nulo(v as string)]));
    dadosClinica.nome = clinica.nome.trim() || "Minha clínica";

    const r1 = await supabase.from("clinics").update(dadosClinica).eq("id", profissional.clinic_id);
    const r2 = await supabase.from("professionals")
      .update({ nome: capitalizarNome(prof.nome), telefone: nulo(prof.telefone) }).eq("id", profissional.id);
    const r3 = credencial
      ? await supabase.from("professional_credentials").update({
          profissao: cred.profissao, conselho,
          numero_registro: conselho === "nenhum" ? null : nulo(cred.numero_registro),
          uf: conselho === "nenhum" ? null : cred.uf,
          especialidade: nulo(cred.especialidade),
        }).eq("id", credencial.id)
      : { error: null };
    setSalvando(false);
    const falha = r1.error || r2.error || r3.error;
    if (falha) return setErro(falha.message);
    setMsg("Alterações salvas!");
  }

  return (
    <>
      <Topo titulo="Configurações" voltar="/" />
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        <form onSubmit={salvar} className="space-y-5">
          {/* Logo */}
          <section className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-creme">
              {logoUrl ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                : <span className="text-xs text-tinta/40">sem logo</span>}
            </div>
            <div className="flex-1">
              <p className="font-semibold">Logo da clínica</p>
              <p className="mb-2 text-xs text-tinta/50">Aparece no prontuário impresso. PNG ou JPG.</p>
              <button type="button" className="text-sm text-salvia-escuro underline" onClick={() => inputLogo.current?.click()}>
                {logoUrl ? "Trocar logo" : "Enviar logo"}
              </button>
              <input ref={inputLogo} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={enviarLogo} />
            </div>
          </section>

          {/* Clínica */}
          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Clínica</h2>
            <div>
              <label className="rotulo">Nome da clínica</label>
              <input className="campo" required {...campoC("nome")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="rotulo">CNPJ ou CPF</label>
                <input className="campo" inputMode="numeric" {...campoC("documento")} />
              </div>
              <div>
                <label className="rotulo">Telefone / WhatsApp</label>
                <input className="campo" type="tel" {...campoC("telefone", mascaraTelefone)} />
              </div>
              <div>
                <label className="rotulo">E-mail</label>
                <input className="campo" type="email" {...campoC("email")} />
              </div>
              <div>
                <label className="rotulo">CEP</label>
                <input className="campo" inputMode="numeric" {...campoC("cep", mascaraCEP)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="rotulo">Endereço</label>
                <input className="campo" {...campoC("endereco")} />
              </div>
              <div>
                <label className="rotulo">Número</label>
                <input className="campo" {...campoC("numero")} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="rotulo">Complemento</label>
                <input className="campo" {...campoC("complemento")} />
              </div>
              <div>
                <label className="rotulo">Bairro</label>
                <input className="campo" {...campoC("bairro")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="rotulo">Cidade</label>
                <input className="campo" {...campoC("cidade")} />
              </div>
              <div>
                <label className="rotulo">UF</label>
                <select className="campo" {...campoC("uf")}>
                  {UFS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Profissional */}
          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Profissional</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="rotulo">Seu nome</label>
                <input className="campo" required value={prof.nome} onChange={(e) => setProf({ ...prof, nome: e.target.value })} />
              </div>
              <div>
                <label className="rotulo">Seu telefone</label>
                <input className="campo" type="tel" value={prof.telefone}
                  onChange={(e) => setProf({ ...prof, telefone: mascaraTelefone(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="rotulo">Profissão</label>
              <select className="campo" value={cred.profissao} onChange={(e) => setCred({ ...cred, profissao: e.target.value })}>
                {PROFISSOES.map((p) => <option key={p.valor} value={p.valor}>{p.nome}</option>)}
              </select>
            </div>
            {conselho !== "nenhum" && (
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="rotulo">Nº {conselho}</label>
                  <input className="campo" value={cred.numero_registro}
                    onChange={(e) => setCred({ ...cred, numero_registro: e.target.value })} />
                </div>
                <div>
                  <label className="rotulo">UF</label>
                  <select className="campo" value={cred.uf} onChange={(e) => setCred({ ...cred, uf: e.target.value })}>
                    {UFS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className="rotulo">Especialização</label>
              <input className="campo" value={cred.especialidade}
                onChange={(e) => setCred({ ...cred, especialidade: e.target.value })} />
            </div>
          </section>

          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          {msg && <p className="rounded-lg bg-salvia-claro p-3 text-sm">{msg}</p>}
          <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Salvar alterações"}</button>
        </form>
      </main>
    </>
  );
}
