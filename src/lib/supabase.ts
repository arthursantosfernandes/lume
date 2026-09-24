import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Faltam as variáveis do Supabase. Crie o arquivo .env.local (veja .env.local.example)."
  );
}

// Cliente único do Supabase usado em todo o app
export const supabase = createClient(url, key);
