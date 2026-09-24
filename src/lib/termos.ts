// Textos dos termos de consentimento (versão 2.0 — com assinatura digital)

export function textoTermoImagem(paciente: string, clinica: string) {
  return `Eu, ${paciente}, autorizo a clínica ${clinica} a registrar fotografias da minha face e/ou corpo antes, durante e após os procedimentos estéticos, para fins de documentação no meu prontuário e acompanhamento da evolução do tratamento.

As imagens serão armazenadas de forma segura e sigilosa, com acesso restrito aos profissionais responsáveis pelo meu atendimento, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

Estou ciente de que posso revogar esta autorização a qualquer momento, mediante solicitação.`;
}

export function textoTermoDivulgacao(paciente: string, clinica: string, aceita: boolean) {
  return aceita
    ? `Eu, ${paciente}, AUTORIZO a clínica ${clinica} a utilizar minhas fotografias de antes e depois para divulgação (redes sociais, site e materiais da clínica), sem identificação do meu nome. Posso revogar esta autorização a qualquer momento.`
    : `Eu, ${paciente}, NÃO AUTORIZO o uso das minhas fotografias para divulgação. As imagens serão usadas somente no meu prontuário.`;
}

// ---------- TCLE por procedimento ----------

export type ConteudoTCLE = {
  descricao: string;
  beneficios: string[];
  riscos: string[];
  contraindicacoes: string[];
  cuidados: string[];
  alternativas: string;
};

const lista = (itens: string[]) => itens.map((i) => `• ${i}`).join("\n");

export function textoTCLE(d: {
  procedimento: string;
  tcle: ConteudoTCLE;
  paciente: string;
  clinica: string;
  profissional?: string | null;
  registro?: string | null;
}) {
  const prof = d.profissional ? `pela profissional ${d.profissional}${d.registro ? ` (${d.registro.trim()})` : ""}, ` : "";
  return `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO — ${d.procedimento.toUpperCase()}

Eu, ${d.paciente}, declaro que fui informada(o) de forma clara ${prof}da clínica ${d.clinica}, sobre o procedimento de ${d.procedimento}, e que tive a oportunidade de fazer perguntas, que foram respondidas de forma satisfatória.

1. O PROCEDIMENTO
${d.tcle.descricao}

2. BENEFÍCIOS ESPERADOS
${lista(d.tcle.beneficios)}

3. RISCOS E POSSÍVEIS COMPLICAÇÕES
Fui informada(o) de que, como todo procedimento, este pode apresentar riscos e complicações, entre eles:
${lista(d.tcle.riscos)}

4. CONTRAINDICAÇÕES
Declaro que informei à profissional todas as minhas condições de saúde, medicamentos em uso, alergias, gestação ou amamentação, sem omitir informações. Fui informada(o) das principais contraindicações:
${lista(d.tcle.contraindicacoes)}

5. CUIDADOS APÓS O PROCEDIMENTO
Comprometo-me a seguir as orientações recebidas, incluindo:
${lista(d.tcle.cuidados)}

6. ALTERNATIVAS
${d.tcle.alternativas}

7. RESULTADOS
Estou ciente de que a estética não é uma ciência exata, de que os resultados variam de pessoa para pessoa e de que não há garantia de um resultado específico. Podem ser necessárias sessões complementares ou retoques.

8. DECLARAÇÃO
Declaro que li e compreendi este termo, que minhas dúvidas foram esclarecidas e que consinto, de forma livre e voluntária, com a realização do procedimento. Sei que posso desistir a qualquer momento antes de sua realização. Autorizo o registro deste atendimento no meu prontuário, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).`;
}
