"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfissional } from "@/lib/useProfissional";
import { calcularIdade, capitalizarNome, mascaraTelefone } from "@/lib/utils";
import { Topo } from "@/components/Topo";
import { Carregando } from "@/components/Carregando";

type Paciente = { id: string; nome: string; data_nascimento: string | null; telefone: string | null };

export default function InicioPage() {
  const { profissional, carregando } = useProfissional();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!profissional) return;
    supabase
      .from("patients")
      .select("id, nome, data_nascimento, telefone")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setPacientes(data ?? []));
  }, [profissional]);

  if (carregando || !profissional) return <Carregando />;

  const filtrados = pacientes.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <>
      <Topo titulo={profissional.clinics?.nome ?? "Lumê"} />
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">
        <p className="mb-4 text-tinta/60">Olá, {capitalizarNome(profissional.nome.split(" ")[0])}!</p>

        <input className="campo mb-4" placeholder="Buscar paciente…" value={busca}
          onChange={(e) => setBusca(e.target.value)} />

        {filtrados.length === 0 ? (
          <p className="py-12 text-center text-tinta/50">
            {pacientes.length === 0 ? "Nenhuma paciente cadastrada ainda." : "Nenhum resultado."}
          </p>
        ) : (
          <ul className="lista-animada divide-y divide-black/5 overflow-hidden rounded-2xl bg-white shadow-sm">
            {filtrados.map((p) => {
              const idade = calcularIdade(p.data_nascimento);
              return (
                <li key={p.id}>
                  <Link href={`/pacientes/${p.id}`} className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-salvia-claro/50 active:bg-salvia-claro">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-salvia-claro font-semibold text-salvia-escuro">
                      {p.nome.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">{p.nome}</span>
                      <span className="text-sm text-tinta/50">
                        {idade !== null ? `${idade} anos` : "Idade não informada"}
                        {p.telefone ? ` · ${mascaraTelefone(p.telefone)}` : ""}
                      </span>
                    </span>
                    <span className="text-tinta/30">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Botão fixo, fácil de alcançar com o polegar no celular */}
      <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-creme/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Link href="/pacientes/novo" className="botao block text-center">+ Nova paciente</Link>
        </div>
      </div>
    </>
  );
}
