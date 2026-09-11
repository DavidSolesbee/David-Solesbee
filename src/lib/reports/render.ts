import type { DeliverySnapshot } from "@/lib/reports/types";
import type { ResolvedSection } from "@/lib/reports/resolve";
import { BAND_COPY } from "@/lib/reports/catalog";

/**
 * HTML email + print-ready document. Inline styles so the digest is useful
 * inside the inbox. The secure link is a normal authenticated route — never
 * a credential or reusable token.
 */

export function renderEmailHtml(
  snap: DeliverySnapshot,
  opts: { deliveryId: number; includeLink: boolean; preview?: boolean },
): string {
  const banner = snap.test || opts.preview
    ? `<div style="background:#C2410C;color:#fff;text-align:center;padding:8px 16px;font:600 12px/1.4 ui-sans-serif,system-ui;letter-spacing:.14em;text-transform:uppercase">${
        opts.preview ? "PREVIEW — NOT SENT" : "TEST REPORT"
      }</div>`
    : "";

  const kpis = snap.sections
    .filter((s) => s.authorized && s.kpis?.length)
    .flatMap((s) => s.kpis ?? [])
    .slice(0, 6);

  const alerts = snap.sections
    .filter((s) => s.authorized && s.alerts?.length)
    .flatMap((s) => s.alerts ?? [])
    .slice(0, 5);

  const kpiHtml = kpis
    .map(
      (k) => `
      <td style="padding:12px 16px;border-right:1px solid #E7E4DC;vertical-align:top">
        <div style="font:600 11px/1.3 ui-sans-serif,system-ui;color:#6B7280;text-transform:uppercase;letter-spacing:.08em">${esc(k.label)}</div>
        <div style="font:600 22px/1.2 ui-sans-serif,system-ui;color:#1C1917;margin-top:4px">${esc(k.value)}</div>
        ${k.deltaLabel ? `<div style="font:13px/1.4 ui-sans-serif,system-ui;color:#6B7280;margin-top:4px">${esc(k.deltaLabel)}</div>` : ""}
      </td>`,
    )
    .join("");

  const alertHtml = alerts
    .map(
      (a) =>
        `<li style="margin:0 0 6px;font:14px/1.5 ui-sans-serif,system-ui;color:#1C1917">${esc(a.text)}</li>`,
    )
    .join("");

  const summary = snap.sections.find((s) => s.key === "executive_summary" && s.authorized)?.narrative;

  const link =
    opts.includeLink && opts.deliveryId
      ? `<p style="margin:24px 0 0"><a href="/app/deliveries/${opts.deliveryId}" style="display:inline-block;background:#3F6F4E;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font:600 14px ui-sans-serif,system-ui">View in Perseus</a></p>
         <p style="margin:8px 0 0;font:12px/1.4 ui-sans-serif,system-ui;color:#6B7280">Sign in required. This link does not contain credentials.</p>`
      : "";

  return `<!DOCTYPE html><html><body style="margin:0;background:#F4F1EA">
  ${banner}
  <div style="max-width:640px;margin:0 auto;padding:28px 20px;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif">
    <div style="font:600 11px/1.4 ui-sans-serif,system-ui;color:#3F6F4E;letter-spacing:.18em;text-transform:uppercase">Perseus Equipment Intelligence</div>
    <h1 style="margin:8px 0 4px;font:600 26px/1.2 ui-sans-serif,system-ui;color:#1C1917">${esc(snap.reportName)}</h1>
    <p style="margin:0 0 4px;font:14px/1.5 ui-sans-serif,system-ui;color:#57534E">${esc(snap.periodLabel)}</p>
    <p style="margin:0 0 20px;font:13px/1.5 ui-sans-serif,system-ui;color:#78716C">Prepared for ${esc(snap.recipientName)}${snap.recipientRole ? ` · ${esc(snap.recipientRole)}` : ""} · ${esc(snap.recipientEmail)}</p>
    ${summary ? `<p style="margin:0 0 20px;font:16px/1.55 ui-sans-serif,system-ui;color:#1C1917">${esc(summary)}</p>` : ""}
    ${kpiHtml ? `<table style="width:100%;border-collapse:collapse;background:#FFFdf8;border:1px solid #E7E4DC;border-radius:12px"><tr>${kpiHtml}</tr></table>` : ""}
    ${alertHtml ? `<div style="margin-top:20px"><div style="font:600 12px/1.3 ui-sans-serif,system-ui;color:#C2410C;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">Needs attention</div><ul style="padding-left:18px;margin:0">${alertHtml}</ul></div>` : ""}
    ${link}
    <p style="margin:28px 0 0;font:12px/1.5 ui-sans-serif,system-ui;color:#A8A29E">Each copy is generated from this recipient’s current permissions. Restricted measures are omitted, not redacted after the fact.</p>
  </div>
</body></html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sectionBandOrder(sections: ResolvedSection[]): {
  band: ResolvedSection["band"];
  title: string;
  question: string;
  sections: ResolvedSection[];
}[] {
  const order: ResolvedSection["band"][] = ["performance", "movement", "attention", "detail"];
  return order
    .map((band) => ({
      band,
      title: BAND_COPY[band].title,
      question: BAND_COPY[band].question,
      sections: sections.filter((s) => s.band === band),
    }))
    .filter((g) => g.sections.length > 0);
}
