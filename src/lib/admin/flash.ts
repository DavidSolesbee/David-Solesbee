import "server-only";
import { cookies } from "next/headers";

/**
 * Tiny server-side flash message helper. Used to surface one-time results of
 * governance actions (e.g. a generated temporary password, or an error) after a
 * server action re-renders the page.
 */
const FLASH_COOKIE = "perseus_flash";

export interface Flash {
  kind: "success" | "error" | "secret";
  message: string;
}

/**
 * Set from a Server Action only (cookie mutation is not allowed during render).
 * Uses a short TTL so the message behaves like a one-time flash — it is read
 * (never mutated) during render, then expires on its own.
 */
export async function setFlash(flash: Flash): Promise<void> {
  const jar = await cookies();
  jar.set(FLASH_COOKIE, JSON.stringify(flash), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8,
  });
}

/**
 * Read the flash WITHOUT mutating cookies (safe to call during render). The
 * cookie expires shortly on its own (see setFlash TTL).
 */
export async function readFlash(): Promise<Flash | null> {
  const jar = await cookies();
  const raw = jar.get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Flash;
  } catch {
    return null;
  }
}
