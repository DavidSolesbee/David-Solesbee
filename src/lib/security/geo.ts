import "server-only";

/**
 * APPROXIMATE geo-IP.
 *
 * Real geolocation requires an external IP intelligence service, which is not
 * configured (and not available offline). We therefore return an explicitly
 * APPROXIMATE label and never claim a verified physical location. Localhost and
 * private ranges are identified locally. This function is the single seam where
 * a real provider (MaxMind, ipinfo, etc.) can later be plugged in.
 *
 * Callers MUST present the result as approximate, per the privacy requirements.
 */

export interface GeoApprox {
  label: string;
  country: string | null;
  region: string | null;
  approximate: true;
  isPrivate: boolean;
}

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("127.")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.toLowerCase() === "unknown" || ip === "") return true;
  return false;
}

export function approximateGeo(ip: string | null | undefined): GeoApprox {
  const addr = (ip ?? "").trim();
  if (isPrivateIp(addr)) {
    return {
      label: "Local / Private network",
      country: null,
      region: null,
      approximate: true,
      isPrivate: true,
    };
  }
  // Public IP but no provider configured — be honest about the limitation.
  return {
    label: "Approximate location unavailable",
    country: null,
    region: null,
    approximate: true,
    isPrivate: false,
  };
}

/** Coarse network key used for "new region/impossible-travel" heuristics
 * without a geo provider: the IP's /16 (or full IPv6 prefix). */
export function networkKey(ip: string | null | undefined): string {
  const addr = (ip ?? "").trim();
  if (!addr) return "unknown";
  if (addr.includes(".")) return addr.split(".").slice(0, 2).join(".") + ".x";
  return addr.split(":").slice(0, 3).join(":") + ":x";
}
