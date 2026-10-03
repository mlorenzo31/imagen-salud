import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mensaje legible de un valor capturado en catch (unknown). */
export function getErrorMessage(err: unknown, fallback = 'Error inesperado'): string {
  return err instanceof Error ? err.message : typeof err === 'string' ? err : fallback;
}
