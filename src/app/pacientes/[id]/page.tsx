"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfissional } from "@/lib/useProfissional";
import { calcularIdade, formatarData, mascaraCPF, mascaraTelefone } from "@/lib/utils";
import { Topo } from "@/components/Topo";
import { Carregando } from "@/components/Carregando";
import { AnamneseAba } from "@/components/Anamnese";
import { AtendimentosAba } from "@/components/Atendimentos";
import { ConsentimentoImagem } from "@/components/Consentimento";
import { FotosPaciente } from "@/components/Fotos";
import Link from "next/link";

type Paciente = {
  id: string; nome: string; sexo: string | null; data_nascimento: string | null; cpf: string | null;
  telefone: string | null; email: string | null; endereco: string | null;
  cidade: string | null; uf: string | null; profissao: string | null;
  observacoes: string | null; created_at: string;
};

export default function PacientePage() {
  const { id } = useParams<{ id: string }>();
  const { profissional, carregando } = useProfissional();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [aba, setAba] = useState<"dados" | "anamnese" | "atendimentos" | "fotos">("dados");
  const [fotosLiberadas, setFotosLiberadas] = useState(false);

  // Abre direto numa aba se a URL tiver ?aba=atendimentos (ex: depois de salvar)
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("aba");
    if (a === "anamnese" || a === "atendimentos" || a === "fotos") setAba(a);
  }, []);

  useEffect(() => {
    if (!profissional) return;
    supabase.from("patients").select("*").eq("id", id).maybeSingle()
      .then(({ data }) => setPaciente(data));
  }, [profissional, id]);

  if (carregando || !profissional) return <Carregando />;
  if (!paciente) return <Carregando />;

  const idade = calcularIdade(paciente.data_nascimento);
  const SEXOS: Record<string, string> = { feminino: "Feminino", masculino: "Masculino", outro: "Outro" };
  const linhas: [string, string | null][] = [
    ["Sexo", paciente.sexo ? SEXOS[paciente.sexo] ?? paciente.sexo : null],
    ["Data de nascimento", paciente.data_nascimento ? `${formatarData(paciente.data_nascimento)} (${idade} anos)` : null],
    ["CPF", paciente.cpf ? mascaraCPF(paciente.cpf) : null],
    ["Telefone", paciente.telefone ? mascaraTelefone(paciente.telefone) : null],
    ["E-mail", paciente.email],
    ["Endereço", [paciente.endereco, paciente.cidade, paciente.uf].filter(Boolean).join(", ") || null],
    ["Profissão", paciente.profissao],
    ["Observações", paciente.observacoes],
    ["Cadastro em", formatarData(paciente.created_at)],
  ];

  const abas = [
    { chave: "dados", nome: "Dados" },
    { chave: "anamnese", nome: "Anamnese" },
    { chave: "atendimentos", nome: "Atendimentos" },
    { chave: "fotos", nome: "Fotos" },
  ] as const;

  return (
    <>
      <Topo titulo={paciente.nome} voltar="/" />
      <main className="mx-auto max-w-3xl px-4 py-4">
        {/* Abas roláveis no celular */}
        <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {abas.map((a) => (
            <button key={a.chave} onClick={() => setAba(a.chave)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                aba === a.chave ? "bg-salvia text-white" : "bg-white text-tinta/70"
              }`}>
              {a.nome}
            </button>
          ))}
        </nav>

        {aba === "dados" && (
          <Link href={`/pacientes/${paciente.id}/imprimir`}
            className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-medium text-salvia-escuro shadow-sm">
            🖨 Imprimir / salvar prontuário em PDF
          </Link>
        )}
        {aba === "dados" ? (
          <dl className="divide-y divide-black/5 rounded-2xl bg-white px-4 shadow-sm">
            {linhas.map(([rotulo, valor]) => (
              <div key={rotulo} className="py-3">
                <dt className="text-xs uppercase tracking-wide text-tinta/50">{rotulo}</dt>
                <dd className="mt-0.5">{valor || "—"}</dd>
              </div>
            ))}
          </dl>
        ) : aba === "anamnese" ? (
          <AnamneseAba pacienteId={paciente.id} profissional={profissional} />
        ) : aba === "atendimentos" ? (
          <AtendimentosAba pacienteId={paciente.id} />
        ) : (
          <div className="space-y-4">
            <ConsentimentoImagem pacienteId={paciente.id} pacienteTelefone={paciente.telefone}
              profissional={profissional} onStatus={setFotosLiberadas} />
            {fotosLiberadas && <FotosPaciente pacienteId={paciente.id} profissional={profissional} />}
          </div>
        )}
      </main>
    </>
  );
}
