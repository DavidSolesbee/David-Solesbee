import { exitViewAsAction } from "@/app/app/actions";
import { Button } from "@/components/ui/Button";

/** Persistent reminder that a platform admin is inspecting another tenant. */
export function ViewAsBanner({ organizationName }: { organizationName: string }) {
  return (
    <div className="border-b border-amber-300 bg-amber-50">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-6 py-2">
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Viewing as {organizationName}</span>
          <span className="text-amber-700">
            {" "}
            — you are still yourself. This is not impersonation.
          </span>
        </p>
        <form action={exitViewAsAction}>
          <Button type="submit" size="sm" variant="secondary">
            Exit View-As
          </Button>
        </form>
      </div>
    </div>
  );
}
