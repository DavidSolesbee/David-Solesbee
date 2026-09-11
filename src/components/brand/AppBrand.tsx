import Link from "next/link";
import Image from "next/image";
import { PerseusMark } from "@/components/brand/PerseusLogo";
import { clsx } from "clsx";

/**
 * Platform lockup: Solesbee Analytics (left) | Perseus Equipment (right).
 */
export function AppBrand({
  href = "/app",
  size = 28,
  className,
}: {
  href?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx("inline-flex items-center gap-3", className)}
      aria-label="Solesbee Analytics — Perseus Equipment"
    >
      <Image
        src="/brand/solesbee-analytics.png"
        alt="Solesbee Analytics"
        width={960}
        height={340}
        className="h-11 w-auto object-contain object-left"
        priority
        unoptimized
      />
      <span className="h-8 w-px shrink-0 bg-line-strong" aria-hidden />
      <span className="inline-flex items-center gap-2">
        <PerseusMark size={size} title="Perseus Equipment" />
        <span className="flex flex-col leading-none">
          <span
            className="font-semibold uppercase tracking-[0.18em] text-forest-600"
            style={{ fontSize: size * 0.42 }}
          >
            Perseus
          </span>
          <span
            className="mt-0.5 uppercase tracking-[0.22em] text-ink-soft"
            style={{ fontSize: size * 0.22 }}
          >
            Equipment
          </span>
        </span>
      </span>
    </Link>
  );
}
