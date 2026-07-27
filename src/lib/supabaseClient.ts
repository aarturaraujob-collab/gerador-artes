import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas — confira o arquivo .env.local.");
}

/** Single Supabase client for the whole app — auth + Postgres access (Fase 1: clubes/estádios/cidades). */
export const supabase = createClient(url, anonKey);
