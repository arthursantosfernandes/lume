# Lumê — Prontuário Estético

App (PWA) em Next.js + TypeScript + Tailwind + Supabase.

## Como rodar no seu computador

1. Instale **Node.js (LTS)**, **VS Code** e **Git**.
2. Descompacte esta pasta e abra no VS Code (Arquivo > Abrir pasta).
3. Copie o arquivo `.env.local.example` e renomeie a cópia para `.env.local`.
   Cole nele a chave **anon / publishable** do Supabase
   (Supabase > Project Settings > API Keys).
4. No terminal do VS Code (Terminal > Novo terminal), rode:

   ```
   npm install
   npm run dev
   ```

5. Abra http://localhost:3000 no navegador.

## Testar no celular

Com o `npm run dev` rodando, o celular precisa estar no mesmo Wi-Fi.
Rode `npm run dev -- -H 0.0.0.0` e acesse `http://IP-DO-SEU-PC:3000` no celular.

## O que já funciona

- Login e criação de conta (Supabase Auth)
- Cadastro da profissional + clínica + registro no conselho
- Lista de pacientes com busca
- Cadastro de paciente
- Ficha da paciente (dados, idade calculada) com abas

## Próximas etapas

Anamnese → Atendimentos (toxina + mapa facial) → Consentimento de imagem → Fotos → Impressão.

## Banco de dados

O arquivo `supabase_schema.sql` é o que já foi rodado no Supabase (não rode de novo).
