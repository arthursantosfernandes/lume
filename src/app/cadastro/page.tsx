"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSessao } from "@/lib/useProfissional";
import {
  PROFISSOES, UFS, buscarCEP, capitalizarNome, erroCPF, mascaraCEP, mascaraCNPJ, mascaraCPF, mascaraTelefone, soNumeros,
} from "@/lib/utils";
import { TelaAcesso } from "@/components/TelaAcesso";
import { Carregando } from "@/components/Carregando";

/**
 * Criar conta (separado do "Entrar"):
 *   A. Acesso: e-mail liberado? -> senha. Não liberado? -> lista de espera.
 *   B. Confirmar o aparelho (código por e-mail)
 *   C. Cadastro completo em 3 etapas + revisão
 */

type Dados = {
  nome: string; cpf: string; data_nascimento: string; telefone: string;
  profissao: string; numero_registro: string; registro_uf: string; especialidade: string;
  clinica_nome: string; clinica_cnpj: string; clinica_telefone: string; clinica_cep: string;
  clinica_endereco: string; clinica_numero: string; clinica_complemento: string; clinica_bairro: string;
  clinica_cidade: string; clinica_uf: string;
};

const VAZIO: Dados = {
  nome: "", cpf: "", data_nascimento: "", telefone: "",
  profissao: "enfermeiro", numero_registro: "", registro_uf: "SP", especialidade: "",
  clinica_nome: "", clinica_cnpj: "", clinica_telefone: "", clinica_cep: "", clinica_endereco: "", clinica_numero: "",
  clinica_complemento: "", clinica_bairro: "", clinica_cidade: "", clinica_uf: "SP",
};

const RASCUNHO = "lume.rascunhoCadastro";
const ETAPAS = ["Seus dados", "Registro profissional", "Sua clínica", "Revisar"];

function erroSenha(s: string): string | null {
  if (s.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(s) || !/\d/.test(s)) return "A senha precisa ter letras e números.";
  return null;
}

export default function CriarContaPage() {
  const router = useRouter();
  const { estado, recarregar } = useSessao();

  // Já tem tudo -> início. Falta confirmar o aparelho -> tela de Entrar (que pede o código).
  useEffect(() => {
    if (estado === "ok") router.replace("/");
    else if (estado === "nao-verificado") router.replace("/login");
  }, [estado, router]);

  if (estado === "carregando" || estado === "ok" || estado === "nao-verificado") return <Carregando />;

  if (estado === "sem-cadastro") return <CadastroCompleto onConcluido={recarregar} />;

  return <CriarAcesso onCriado={recarregar} />;
}

/* ------------------------------------------------------------------ */
/* A. Criar o acesso (e-mail + senha) ou entrar na lista de espera      */
/* ------------------------------------------------------------------ */
function CriarAcesso({ onCriado }: { onCriado: () => Promise<void> }) {
  const [passo, setPasso] = useState<"email" | "senha" | "espera" | "espera-ok" | "confirme">("email");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [espera, setEspera] = useState({ nome: "", telefone: "", profissao: "", cidade: "" });
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function conferirEmail(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    const { data, error } = await supabase.rpc("cadastro_liberado", { p_email: email });
    setOcupado(false);
    if (error) return setErro("Não foi possível continuar agora. Tente de novo.");
    setPasso(data === true ? "senha" : "espera");
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const problema = erroSenha(senha);
    if (problema) return setErro(problema);
    if (senha !== senha2) return setErro("As senhas não são iguais.");
    setOcupado(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) {
      setOcupado(false);
      return setErro(/registered|already/i.test(error.message) ? "Este e-mail já tem conta. Vá em Entrar." : error.message);
    }
    if (data.session) {
      await onCriado();
    } else {
      setPasso("confirme");
    }
    setOcupado(false);
  }

  async function entrarNaEspera(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    const { error } = await supabase.rpc("entrar_lista_espera", {
      p_nome: espera.nome, p_email: email, p_telefone: espera.telefone, p_profissao: espera.profissao, p_cidade: espera.cidade,
    });
    setOcupado(false);
    if (error) return setErro(error.message);
    setPasso("espera-ok");
  }

  if (passo === "confirme") {
    return (
      <TelaAcesso titulo="Quase lá!" subtitulo="Confirme seu e-mail">
        <div className="etapa-entra space-y-4 text-center">
          <p className="text-5xl">📧</p>
          <p>Enviamos um link para <b>{email}</b>.</p>
          <p className="text-sm text-tinta/60">Abra o e-mail, clique no link de confirmação e depois entre com seu e-mail e senha para terminar o cadastro.</p>
          <Link href="/login" className="botao block">Ir para Entrar</Link>
        </div>
      </TelaAcesso>
    );
  }

  if (passo === "espera-ok") {
    return (
      <TelaAcesso titulo="Você está na lista!" subtitulo="Obrigado pelo interesse">
        <div className="etapa-entra space-y-4 text-center">
          <svg viewBox="0 0 52 52" className="check-anim pular mx-auto h-16 w-16" aria-hidden>
            <circle cx="26" cy="26" r="24" fill="#e6ede6" />
            <path d="M15 27l7 7 15-15" fill="none" stroke="#5f7a65" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p>Assim que o Lumê abrir para novos profissionais, avisamos você em <b>{email}</b>.</p>
          <Link href="/login" className="botao-sec block">Voltar</Link>
        </div>
      </TelaAcesso>
    );
  }

  return (
    <TelaAcesso titulo="Criar conta" subtitulo="Prontuário estético para profissionais">
      {passo === "email" && (
        <form onSubmit={conferirEmail} className="etapa-entra space-y-4">
          <div>
            <label className="rotulo" htmlFor="email">Seu e-mail profissional</label>
            <input id="email" type="email" required autoFocus autoComplete="email" className="campo"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <button className="botao" disabled={ocupado}>{ocupado ? "Aguarde…" : "Continuar"}</button>
        </form>
      )}

      {passo === "senha" && (
        <form onSubmit={criar} className="etapa-entra space-y-4">
          <p className="rounded-xl bg-salvia-claro p-3 text-sm">✨ Acesso liberado para <b>{email}</b>. Crie sua senha.</p>
          <div>
            <label className="rotulo" htmlFor="senha">Senha</label>
            <input id="senha" type="password" required autoFocus autoComplete="new-password" className="campo"
              value={senha} onChange={(e) => setSenha(e.target.value)} />
            <p className="mt-1 text-xs text-tinta/50">Mínimo 10 caracteres, com letras e números.</p>
          </div>
          <div>
            <label className="rotulo" htmlFor="senha2">Repita a senha</label>
            <input id="senha2" type="password" required autoComplete="new-password" className="campo"
              value={senha2} onChange={(e) => setSenha2(e.target.value)} />
          </div>
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <button className="botao" disabled={ocupado}>{ocupado ? "Criando…" : "Criar conta"}</button>
          <button type="button" className="w-full text-sm text-tinta/50 underline" onClick={() => setPasso("email")}>Usar outro e-mail</button>
        </form>
      )}

      {passo === "espera" && (
        <form onSubmit={entrarNaEspera} className="etapa-entra space-y-4">
          <p className="rounded-xl bg-dourado/15 p-3 text-sm">
            🌱 O Lumê está em <b>fase de testes</b> e abrirá em breve para novos profissionais.
            Deixe seus dados que avisamos você primeiro.
          </p>
          <input className="campo" required placeholder="Nome completo" value={espera.nome}
            onChange={(e) => setEspera({ ...espera, nome: e.target.value })} />
          <input className="campo" type="tel" placeholder="WhatsApp" value={espera.telefone}
            onChange={(e) => setEspera({ ...espera, telefone: mascaraTelefone(e.target.value) })} />
          <select className="campo" value={espera.profissao} onChange={(e) => setEspera({ ...espera, profissao: e.target.value })}>
            <option value="">Profissão…</option>
            {PROFISSOES.map((p) => <option key={p.valor} value={p.nome}>{p.nome}</option>)}
          </select>
          <input className="campo" placeholder="Cidade / UF" value={espera.cidade}
            onChange={(e) => setEspera({ ...espera, cidade: e.target.value })} />
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <button className="botao" disabled={ocupado}>{ocupado ? "Enviando…" : "Entrar na lista de espera"}</button>
          <button type="button" className="w-full text-sm text-tinta/50 underline" onClick={() => setPasso("email")}>Voltar</button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-tinta/60">
        Já tem conta? <Link href="/login" className="font-medium text-salvia-escuro underline">Entrar</Link>
      </p>
    </TelaAcesso>
  );
}

/* ------------------------------------------------------------------ */
/* C. Cadastro completo do profissional (3 etapas + revisão)           */
/* ------------------------------------------------------------------ */
function CadastroCompleto({ onConcluido }: { onConcluido: () => Promise<void> }) {
  const [etapa, setEtapa] = useState(0);
  const [d, setD] = useState<Dados>(VAZIO);
  const [declaro, setDeclaro] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  // Rascunho: se sair no meio, os dados continuam aqui (neste aparelho)
  useEffect(() => {
    try {
      const r = localStorage.getItem(RASCUNHO);
      if (r) setD({ ...VAZIO, ...JSON.parse(r) });
    } catch { /* ignora */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(RASCUNHO, JSON.stringify(d)); } catch { /* ignora */ }
  }, [d]);

  const conselho = PROFISSOES.find((p) => p.valor === d.profissao)?.conselho ?? "outro";
  const temConselho = conselho !== "nenhum";

  const campo = (k: keyof Dados, mascara?: (v: string) => string) => ({
    value: d[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setD({ ...d, [k]: mascara ? mascara(e.target.value) : e.target.value }),
  });

  async function preencherCEP(v: string) {
    const cep = mascaraCEP(v);
    setD((x) => ({ ...x, clinica_cep: cep }));
    const r = await buscarCEP(cep);
    if (r) {
      setD((x) => ({
        ...x,
        clinica_endereco: x.clinica_endereco || r.endereco,
        clinica_bairro: x.clinica_bairro || r.bairro,
        clinica_cidade: x.clinica_cidade || r.cidade,
        clinica_uf: r.uf || x.clinica_uf,
      }));
    }
  }

  function validar(): string | null {
    if (etapa === 0) {
      if (d.nome.trim().split(/\s+/).length < 2) return "Informe seu nome completo.";
      const c = erroCPF(d.cpf);
      if (!d.cpf || c) return c ?? "Informe seu CPF.";
      if (!d.data_nascimento) return "Informe sua data de nascimento.";
      if (soNumeros(d.telefone).length < 10) return "Informe seu telefone com DDD.";
    }
    if (etapa === 1 && temConselho && !d.numero_registro.trim()) return `Informe seu número no ${conselho}.`;
    if (etapa === 2) {
      if (!d.clinica_nome.trim()) return "Informe o nome da clínica (ou o seu nome, se atende sozinho/a).";
      if (d.clinica_cnpj && soNumeros(d.clinica_cnpj).length !== 14) return "CNPJ incompleto (ou deixe em branco).";
    }
    return null;
  }

  function avancar(e: React.FormEvent) {
    e.preventDefault();
    const problema = validar();
    if (problema) return setErro(problema);
    setErro("");
    setEtapa(etapa + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function concluir() {
    if (!declaro) return setErro("Confirme a declaração para concluir.");
    setErro("");
    setEnviando(true);
    const { error } = await supabase.rpc("cadastrar_profissional", {
      p: {
        ...d,
        nome: capitalizarNome(d.nome),
        cpf: soNumeros(d.cpf),
        conselho: temConselho ? conselho : "nenhum",
        numero_registro: temConselho ? d.numero_registro.trim() : "",
        registro_uf: temConselho ? d.registro_uf : "",
        clinica_cnpj: soNumeros(d.clinica_cnpj),
        clinica_telefone: soNumeros(d.clinica_telefone),
        clinica_cep: soNumeros(d.clinica_cep),
        telefone: soNumeros(d.telefone),
      },
    });
    setEnviando(false);
    if (error) return setErro(error.message);
    try { localStorage.removeItem(RASCUNHO); } catch { /* ignora */ }
    setPronto(true);
    window.setTimeout(() => onConcluido(), 1400);
  }

  if (pronto) {
    return (
      <TelaAcesso titulo="Tudo pronto!" subtitulo="Boas-vindas ao Lumê">
        <div className="text-center">
          <svg viewBox="0 0 52 52" className="check-anim pular mx-auto h-20 w-20" aria-hidden>
            <circle cx="26" cy="26" r="24" fill="#e6ede6" />
            <path d="M15 27l7 7 15-15" fill="none" stroke="#5f7a65" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </TelaAcesso>
    );
  }

  const nomeProfissao = PROFISSOES.find((p) => p.valor === d.profissao)?.nome ?? d.profissao;

  return (
    <TelaAcesso titulo="Seu cadastro" subtitulo={`Etapa ${etapa + 1} de ${ETAPAS.length} · ${ETAPAS[etapa]}`} largo>
      {/* Barra de progresso */}
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-tinta/10">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${((etapa + 1) / ETAPAS.length) * 100}%`, background: "linear-gradient(90deg, #7e9a83, #c9a25c)" }} />
      </div>

      <form key={etapa} onSubmit={avancar} className="etapa-entra space-y-4">
        {etapa === 0 && (
          <>
            <div>
              <label className="rotulo">Nome completo *</label>
              <input className="campo" required autoFocus autoComplete="name" {...campo("nome")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="rotulo">CPF *</label>
                <input className={`campo ${d.cpf.length >= 14 && erroCPF(d.cpf) ? "border-red-400" : ""}`} required
                  inputMode="numeric" placeholder="000.000.000-00" {...campo("cpf", mascaraCPF)} />
                {d.cpf.length >= 14 && erroCPF(d.cpf) && <p className="mt-1 text-sm text-red-700">{erroCPF(d.cpf)}</p>}
                <p className="mt-1 text-xs text-tinta/50">Você também poderá entrar com o CPF.</p>
              </div>
              <div>
                <label className="rotulo">Data de nascimento *</label>
                <input className="campo" type="date" required {...campo("data_nascimento")} />
              </div>
            </div>
            <div>
              <label className="rotulo">Telefone / WhatsApp *</label>
              <input className="campo" type="tel" required autoComplete="tel" placeholder="(11) 90000-0000" {...campo("telefone", mascaraTelefone)} />
            </div>
          </>
        )}

        {etapa === 1 && (
          <>
            <div>
              <label className="rotulo">Profissão *</label>
              <select className="campo" {...campo("profissao")}>
                {PROFISSOES.map((p) => <option key={p.valor} value={p.valor}>{p.nome}</option>)}
              </select>
            </div>
            {temConselho && (
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="rotulo">Número no {conselho === "outro" ? "conselho" : conselho} *</label>
                  <input className="campo" required inputMode="numeric" {...campo("numero_registro")} />
                </div>
                <div>
                  <label className="rotulo">UF</label>
                  <select className="campo" {...campo("registro_uf")}>
                    {UFS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className="rotulo">Especialização</label>
              <input className="campo" placeholder="Ex.: Pós-graduação em Estética" {...campo("especialidade")} />
            </div>
          </>
        )}

        {etapa === 2 && (
          <>
            <div>
              <label className="rotulo">Nome da clínica *</label>
              <input className="campo" required {...campo("clinica_nome")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="rotulo">CNPJ (se tiver)</label>
                <input className="campo" inputMode="numeric" placeholder="00.000.000/0000-00" {...campo("clinica_cnpj", mascaraCNPJ)} />
              </div>
              <div>
                <label className="rotulo">Telefone da clínica</label>
                <input className="campo" type="tel" {...campo("clinica_telefone", mascaraTelefone)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="rotulo">CEP</label>
                <input className="campo" inputMode="numeric" placeholder="00000-000" value={d.clinica_cep}
                  onChange={(e) => preencherCEP(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="rotulo">Endereço</label>
                <input className="campo" {...campo("clinica_endereco")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="rotulo">Número</label>
                <input className="campo" {...campo("clinica_numero")} />
              </div>
              <div className="col-span-2">
                <label className="rotulo">Complemento</label>
                <input className="campo" {...campo("clinica_complemento")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="rotulo">Bairro</label>
                <input className="campo" {...campo("clinica_bairro")} />
              </div>
              <div>
                <label className="rotulo">Cidade</label>
                <input className="campo" {...campo("clinica_cidade")} />
              </div>
              <div>
                <label className="rotulo">UF</label>
                <select className="campo" {...campo("clinica_uf")}>
                  {UFS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {etapa === 3 && (
          <>
            <dl className="space-y-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
              <Resumo titulo="Você" linhas={[capitalizarNome(d.nome), `CPF ${d.cpf}`, d.telefone]} onEditar={() => setEtapa(0)} />
              <Resumo titulo="Registro" onEditar={() => setEtapa(1)} linhas={[
                nomeProfissao,
                temConselho ? `${conselho}-${d.registro_uf} ${d.numero_registro}` : "",
                d.especialidade,
              ]} />
              <Resumo titulo="Clínica" onEditar={() => setEtapa(2)} linhas={[
                d.clinica_nome, d.clinica_cnpj ? `CNPJ ${d.clinica_cnpj}` : "",
                [d.clinica_endereco, d.clinica_numero, d.clinica_bairro].filter(Boolean).join(", "),
                [d.clinica_cidade, d.clinica_uf].filter(Boolean).join(" - "),
              ]} />
            </dl>
            <label className="flex items-start gap-3 rounded-xl bg-white p-4 text-sm shadow-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#7e9a83]" checked={declaro}
                onChange={(e) => setDeclaro(e.target.checked)} />
              <span>Declaro que as informações acima são verdadeiras e que sou responsável pelos registros que fizer no Lumê.</span>
            </label>
          </>
        )}

        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

        <div className="flex gap-3 pt-2">
          {etapa > 0 && (
            <button type="button" className="botao-sec" onClick={() => { setErro(""); setEtapa(etapa - 1); }}>Voltar</button>
          )}
          {etapa < 3 ? (
            <button className="botao">Continuar</button>
          ) : (
            <button type="button" className="botao" onClick={concluir} disabled={enviando}>
              {enviando ? "Salvando…" : "Concluir cadastro"}
            </button>
          )}
        </div>
      </form>
    </TelaAcesso>
  );
}

function Resumo({ titulo, linhas, onEditar }: { titulo: string; linhas: string[]; onEditar: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-black/5 pb-3 last:border-0 last:pb-0">
      <div className="flex-1">
        <dt className="text-xs uppercase tracking-wide text-tinta/50">{titulo}</dt>
        {linhas.filter(Boolean).map((l, i) => <dd key={i}>{l}</dd>)}
      </div>
      <button type="button" onClick={onEditar} className="text-salvia-escuro underline">Editar</button>
    </div>
  );
}
