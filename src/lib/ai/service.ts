import "server-only";
import type { AuthUser } from "@/lib/auth/authz";
import { audit } from "@/lib/auth/audit";
import { canAsk, getQuestion, matchQuestion, QUESTIONS, type QuestionKey } from "@/lib/ai/catalog";
import { computeAsk, computeBriefingFindings, type AskPayload, type Finding } from "@/lib/ai/findings";
import { narrateFindings, narrateReport } from "@/lib/ai/narrate";
import { resolveScope, scopeLabel } from "@/lib/analytics/scope";
import { bindViewerTenant, type ResolvedSection } from "@/lib/reports/resolve";
import { reportAsOf } from "@/lib/reports/metrics";
import { config } from "@/lib/config";

export interface AskResult extends AskPayload {
  narrative: string;
  followUps: { key: QuestionKey; label: string }[];
  unmatched?: boolean;
}

export function authorizedQuestions(user: AuthUser) {
  if (!user.permissions.has("feature.use_ai") || !user.permissions.has("module.ai_insights")) {
    return [];
  }
  return QUESTIONS.filter((q) => canAsk(user.permissions, q));
}

export function askPerseus(user: AuthUser, key: string): AskResult {
  const allowed = authorizedQuestions(user);
  const matched = matchQuestion(key, allowed);
  if (!matched) {
    const bound = bindViewerTenant(user);
    const scope = resolveScope(bound);
    return {
      questionKey: "revenue_change",
      question: key,
      authorized: false,
      unmatched: true,
      restrictedReason:
        "I can answer the suggested questions from your authorized data. I will not invent a finding.",
      findings: [],
      scopeLabel: scopeLabel(scope),
      asOf: (reportAsOf(scope) || config.dataAsOfFallback).slice(0, 10),
      narrative:
        "I can answer the suggested questions from your authorized data. I will not invent a finding.",
      followUps: allowed.map((q) => ({ key: q.key, label: q.prompt })),
    };
  }
  const payload = computeAsk(user, matched.key);
  const def = getQuestion(payload.questionKey);
  const followUps = (def?.followUps ?? [])
    .map((k) => getQuestion(k))
    .filter((q): q is NonNullable<typeof q> => !!q && canAsk(user.permissions, q))
    .map((q) => ({ key: q.key, label: q.prompt }));

  if (payload.authorized) {
    audit({
      actorUserId: user.id,
      actorLabel: user.email,
      action: "ai.ask",
      targetType: "question",
      targetId: payload.questionKey,
      detail: payload.question,
    });
  }

  return {
    ...payload,
    narrative: payload.authorized
      ? narrateFindings(payload.findings)
      : payload.restrictedReason ?? "Not authorized.",
    followUps: payload.authorized ? followUps : [],
  };
}

export interface Briefing {
  narrative: string;
  findings: Finding[];
  asOf: string;
}

export function perseusBriefing(user: AuthUser): Briefing | null {
  if (!user.permissions.has("feature.use_ai") || !user.permissions.has("module.ai_insights")) {
    return null;
  }
  const findings = computeBriefingFindings(user);
  if (!findings.length) return null;
  const asOf = (reportAsOf(resolveScope(bindViewerTenant(user))) || config.dataAsOfFallback).slice(0, 10);
  return {
    narrative: narrateFindings(findings),
    findings,
    asOf,
  };
}

export function reportAiNarrative(sections: ResolvedSection[]): string {
  return narrateReport(sections);
}

export type { Finding };
