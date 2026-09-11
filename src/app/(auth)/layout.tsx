import { AppBrand } from "@/components/brand/AppBrand";
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
          <div className="mb-8 flex justify-center">
            <AppBrand href="/login" size={32} />
          </div>
          {children}
        </div>
      </div>
      <footer className="pb-8 text-center text-caption uppercase tracking-[0.2em] text-ink-faint">
        {config.brand.tagline}
      </footer>
    </div>
  );
}
