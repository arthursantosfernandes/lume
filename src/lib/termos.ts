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
