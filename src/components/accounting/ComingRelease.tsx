import Link from "next/link";
import { ModuleHeader } from "@/components/analytics/Primitives";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";

export function ComingRelease({
  title,
  planned,
  blockedBy,
  relatedHref,
  relatedLabel,
}: {
  title: string;
  planned: string[];
  blockedBy: string;
  relatedHref?: string;
  relatedLabel?: string;
}) {
  return (
    <div className="space-y-8">
      <ModuleHeader
        title={title}
        subtitle="Reserved in this release so the module structure is complete. Analytics will land when the source can support them."
        scopeLabel="Coming in a newer release"
        crossDept
      />

      <EmptyState
        title="Not in this release"
        description={blockedBy}
        action={
          relatedHref && relatedLabel ? (
            <Link
              href={relatedHref}
              className="text-sm font-medium text-forest-600 hover:text-forest-700"
            >
              {relatedLabel} →
            </Link>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-ink">Planned for a later release</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {planned.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-caption text-ink-faint">
            No sample or placeholder amounts are shown. A later release will compute
            these only from connected accounting data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
