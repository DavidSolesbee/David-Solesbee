import "server-only";
import { createHash } from "node:crypto";

/**
 * Minimal, dependency-free user-agent parsing for security intelligence.
 * We deliberately extract ONLY what is needed to recognize a device and assess
 * risk (browser family, OS family, device type) — no invasive fingerprinting.
 */

export interface DeviceInfo {
  browser: string;
  os: string;
  deviceType: "Desktop" | "Mobile" | "Tablet" | "Bot" | "Unknown";
  raw: string;
}

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const raw = (ua ?? "").trim();
  if (!raw) {
    return { browser: "Unknown", os: "Unknown", deviceType: "Unknown", raw: "" };
  }
  const s = raw.toLowerCase();

  // Browser (order matters — Edge/Chrome/Safari overlap)
  let browser = "Unknown";
  if (s.includes("edg/") || s.includes("edga") || s.includes("edgios")) browser = "Edge";
  else if (s.includes("opr/") || s.includes("opera")) browser = "Opera";
  else if (s.includes("firefox")) browser = "Firefox";
  else if (s.includes("chrome") || s.includes("crios")) browser = "Chrome";
  else if (s.includes("safari")) browser = "Safari";
  else if (s.includes("curl")) browser = "curl";
  else if (s.includes("headlesschrome")) browser = "HeadlessChrome";

  // OS
  let os = "Unknown";
  if (s.includes("windows nt 10")) os = "Windows 10/11";
  else if (s.includes("windows")) os = "Windows";
  else if (s.includes("iphone") || s.includes("ipad") || s.includes("ios")) os = "iOS";
  else if (s.includes("mac os x") || s.includes("macintosh")) os = "macOS";
  else if (s.includes("android")) os = "Android";
  else if (s.includes("linux")) os = "Linux";

  // Device type
  let deviceType: DeviceInfo["deviceType"] = "Desktop";
  if (s.includes("bot") || s.includes("crawler") || s.includes("spider") || s.includes("curl"))
    deviceType = "Bot";
  else if (s.includes("ipad") || s.includes("tablet")) deviceType = "Tablet";
  else if (s.includes("mobile") || s.includes("iphone") || s.includes("android"))
    deviceType = "Mobile";

  return { browser, os, deviceType, raw };
}

/**
 * Stable device fingerprint for a user. Derived from user + coarse device
 * signature only (not IP, which changes). Deterministic so a returning device
 * is recognized.
 */
export function deviceFingerprint(userId: number, info: DeviceInfo): string {
  return createHash("sha256")
    .update(`${userId}|${info.browser}|${info.os}|${info.deviceType}`)
    .digest("hex")
    .slice(0, 24);
}

export function deviceLabel(info: DeviceInfo): string {
  return `${info.browser} on ${info.os}`;
}
