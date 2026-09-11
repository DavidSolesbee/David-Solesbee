import Link from "next/link";
import { redirect } from "next/navigation";
import { guardModule } from "@/lib/auth/guards";
import { askPerseus, authorizedQuestions } from "@/lib/ai/service";
import { AskForm } from "@/components/ai/AskForm";
import { askAction } from "@/app/app/ask/actions";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

export default async function AskAiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await guardModule("module.ai_insights");
  if (!user.permissions.has("feature.use_ai")) redirect("/app");

  const questions = authorizedQuestions(user);
  const { q } = await searchParams;
  const answer = q ? askPerseus(user, q) : null;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-caption font-semibold uppercase tracking-[0.22em] text-forest-600">
          Ask AI
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          Questions, answered from your data
        </h1>
        <p className="mt-1 max-w-2xl text-ink-soft">
          Perseus computes findings from the semantic layer in your authorized scope, then
          explains those findings. It cannot see cost, margin, contacts, or departments you
          are not allowed to see — and it will not invent a number.
        </p>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          title="No questions available"
          description="Your role does not currently authorize any Ask AI questions."
        />
      ) : (
        <AskForm questions={questions} current={q} action={askAction} />
      )}

      {answer && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  intent={
                    answer.unmatched ? "info" : answer.authorized ? "positive" : "attention"
                  }
                  dot={false}
                >
                  {answer.unmatched
                    ? "I can answer these"
                    : answer.authorized
                      ? "Authorized finding"
                      : "Restricted"}
                </StatusBadge>
                <span className="text-caption text-ink-faint">{answer.scopeLabel}</span>
              </div>
              <h2 className="text-xl font-semibold text-ink">{answer.question}</h2>
              <p className="text-[17px] leading-relaxed text-ink">{answer.narrative}</p>
              {answer.authorized && (
                <p className="text-caption text-ink-faint">
                  Calculated from posted operational data as of {answer.asOf}. Every figure
                  below is a finding, not a model guess.
                </p>
              )}
            </CardContent>
          </Card>

          {answer.findings.map((f) => (
            <Card key={f.id}>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold text-ink">{f.label}</h3>
                  {f.value && <span className="text-lg font-semibold tabular-nums text-ink">{f.value}</span>}
                </div>
                {f.deltaPct !== null && f.deltaPct !== undefined && (
                  <p className="text-sm text-ink-soft">
                    {f.deltaPct > 0 ? "+" : ""}
                    {f.deltaPct.toFixed(1)}% vs comparison
                  </p>
                )}
                {f.items && (
                  <ol className="divide-y divide-line">
                    {f.items.map((item, i) => (
                      <li key={`${item.label}-${i}`} className="flex justify-between gap-3 py-2 text-sm">
                        <span className="text-ink">{item.label}</span>
                        <span className="tabular-nums text-ink-soft">{item.value}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="text-caption text-ink-faint">Methodology: {f.methodology}</p>
              </CardContent>
            </Card>
          ))}

          {answer.followUps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-ink-soft">Follow up</h3>
              <div className="flex flex-wrap gap-2">
                {answer.followUps.map((f) => (
                  <Link
                    key={f.key}
                    href={`/app/ask?q=${f.key}`}
                    className="rounded-full bg-surface-tinted px-3 py-1.5 text-sm text-ink hover:bg-sage-50"
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
