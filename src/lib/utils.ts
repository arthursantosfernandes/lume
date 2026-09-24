// Calcula a idade a partir da data de nascimento (AAAA-MM-DD)
export function calcularIdade(dataNascimento: string | null): number | null {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento + "T00:00:00");
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

export function formatarData(data: string | null): string {
  if (!data) return "—";
  return new Date(data.length === 10 ? data + "T00:00:00" : data).toLocaleDateString("pt-BR");
}

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const PROFISSOES: { valor: string; nome: string; conselho: string }[] = [
  { valor: "enfermeiro", nome: "Enfermeiro(a)", conselho: "COREN" },
  { valor: "medico", nome: "Médico(a)", conselho: "CRM" },
  { valor: "farmaceutico", nome: "Farmacêutico(a)", conselho: "CRF" },
  { valor: "biomedico", nome: "Biomédico(a)", conselho: "CRBM" },
  { valor: "dentista", nome: "Cirurgião(ã)-dentista", conselho: "CRO" },
  { valor: "fisioterapeuta", nome: "Fisioterapeuta", conselho: "CREFITO" },
  { valor: "esteticista", nome: "Esteticista", conselho: "nenhum" },
  { valor: "outro", nome: "Outra", conselho: "outro" },
];

// ---------- Formatação ----------

// "SUELI DOS SANTOS" -> "Sueli dos Santos"
export function capitalizarNome(nome: string): string {
  const minusculas = ["da", "das", "de", "do", "dos", "e"];
  return nome
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && minusculas.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

const soDigitos = (v: string) => v.replace(/\D/g, "");

// 48940051823 -> 489.400.518-23
export function mascaraCPF(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

// 11948862648 -> (11) 94886-2648
export function mascaraTelefone(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// 09400000 -> 09400-000
export function mascaraCEP(v: string): string {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function formatarDataHora(data: string): string {
  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function hojeISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// ---------- CPF ----------

export const soNumeros = (v: string) => v.replace(/\D/g, "");

// 00.000.000/0000-00
export function mascaraCNPJ(v: string): string {
  const d = soNumeros(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** Busca endereço pelo CEP (ViaCEP, gratuito). Devolve null se não achar. */
export async function buscarCEP(cep: string): Promise<{ endereco: string; bairro: string; cidade: string; uf: string } | null> {
  const d = soNumeros(cep);
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (j.erro) return null;
    return { endereco: j.logradouro ?? "", bairro: j.bairro ?? "", cidade: j.localidade ?? "", uf: j.uf ?? "" };
  } catch {
    return null;
  }
}

/** Valida os dígitos verificadores do CPF (não confirma titularidade). */
export function validarCPF(v: string): boolean {
  const d = soNumeros(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export const MOTIVOS_RETIFICACAO: { v: string; t: string }[] = [
  { v: "erro_digitacao", t: "Erro de digitação" },
  { v: "informacao_complementar", t: "Informação complementar" },
  { v: "correcao_documental", t: "Correção documental" },
  { v: "solicitacao_paciente", t: "Solicitação da paciente" },
  { v: "outro", t: "Outro" },
];

/** Mensagem de erro do CPF para mostrar embaixo do campo (null = ok ou vazio) */
export function erroCPF(v: string): string | null {
  const d = soNumeros(v);
  if (d.length === 0) return null;
  if (d.length < 11) return "CPF incompleto.";
  return validarCPF(d) ? null : "CPF inválido. Confira os números.";
}

/** Traduz erros do banco para mensagens amigáveis */
export function mensagemErro(msg: string): string {
  if (msg.includes("patients_cpf_unico")) return "Já existe uma paciente com este CPF cadastrada nesta clínica.";
  if (msg.includes("patients_cpf_valido")) return "CPF inválido. Confira os números.";
  return msg;
}
