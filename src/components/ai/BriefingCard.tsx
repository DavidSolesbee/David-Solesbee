import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";

export function BriefingCard({
  narrative,
  askHref = "/app/ask",
}: {
  narrative: string;
  askHref?: string;
}) {
  return (
    <Card className="border-sage-300/70 bg-sage-50/40">
      <CardContent className="space-y-3">
        <div className="text-caption font-semibold uppercase tracking-[0.18em] text-forest-600">
          Perseus Briefing
        </div>
        <p className="text-[17px] leading-relaxed text-ink">{narrative}</p>
        <p className="text-caption text-ink-faint">
          Every statement is backed by a deterministic finding in your authorized scope. Perseus
          does not invent figures.
        </p>
        <Link href={askHref} className="text-sm font-medium text-forest-600 hover:text-forest-700">
          Ask AI →
        </Link>
      </CardContent>
    </Card>
  );
}
