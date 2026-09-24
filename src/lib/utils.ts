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
