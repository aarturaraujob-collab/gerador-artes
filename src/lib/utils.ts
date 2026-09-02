import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts a human-readable message from a caught value — including
 * Supabase's PostgrestError, which is a plain `{message, code, ...}` object
 * and NOT an `Error` instance, so `error instanceof Error` misses it and
 * silently falls back to a generic message everywhere that check is used.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}