import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

/**
 * Thin reactive wrapper around Supabase Auth — same
 * cache-plus-listeners idiom as activityLog.ts/templateFavorites.ts.
 * `loading` is true only until the very first session check resolves
 * (Supabase reads whatever's in localStorage — no network round-trip).
 */
export interface AuthSnapshot {
  session: Session | null;
  loading: boolean;
}

let snapshot: AuthSnapshot = { session: null, loading: true };
const listeners = new Set<() => void>();

function setSnapshot(next: AuthSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

supabase.auth.getSession().then(({ data }) => {
  setSnapshot({ session: data.session, loading: false });
});

supabase.auth.onAuthStateChange((_event, session) => {
  setSnapshot({ session, loading: false });
});

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let justSignedIn = false;

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  justSignedIn = true;
}

/** True once, right after a successful signIn() — false on a page reload that merely restores a session. */
export function consumeJustSignedIn(): boolean {
  const value = justSignedIn;
  justSignedIn = false;
  return value;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
