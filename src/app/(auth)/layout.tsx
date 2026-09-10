import Link from "next/link";
import { PerseusMark } from "@/components/brand/PerseusLogo";
import { config } from "@/lib/config";

/** Calm, centered layout for all unauthenticated (auth) screens. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex flex-col items-center gap-3">
            <PerseusMark size={48} />
            <span className="text-center">
              <span className="block text-lg font-semibold uppercase tracking-[0.22em] text-forest-600">
                Perseus
              </span>
              <span className="block text-caption uppercase tracking-[0.28em] text-ink-faint">
                Equipment Intelligence
              </span>
            </span>
          </Link>
          {children}
        </div>
      </div>
      <footer className="pb-8 text-center text-caption uppercase tracking-[0.2em] text-ink-faint">
        {config.brand.tagline}
      </footer>
    </div>
  );
}
