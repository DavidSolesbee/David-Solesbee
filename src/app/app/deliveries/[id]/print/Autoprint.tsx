"use client";

import { useEffect } from "react";

/** Opens the system print dialog so Print / Save as PDF can use the OS sheet. */
export function Autoprint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => window.print(), 50);
    return () => window.clearTimeout(timer);
  }, [enabled]);
  return null;
}
