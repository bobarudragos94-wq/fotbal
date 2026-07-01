import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

type BadgeTone = "brand" | "amber" | "slate" | "red" | "blue" | "green";
const toneMap: Record<BadgeTone, string> = {
  brand: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge ${toneMap[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeTone> = {
    draft: "slate",
    open: "green",
    locked: "amber",
    finished: "blue",
    going: "green",
    maybe: "amber",
    declined: "red",
    waitlist: "blue",
    pending: "amber",
    approved: "green",
    rejected: "red",
  };
  const ro: Record<string, string> = {
    draft: "ciornă",
    open: "deschis",
    locked: "blocat",
    finished: "încheiat",
    going: "vin",
    maybe: "poate",
    declined: "nu vin",
    waitlist: "rezervă",
    pending: "în așteptare",
    approved: "aprobat",
    rejected: "respins",
  };
  return <Badge tone={map[status] ?? "slate"}>{ro[status] ?? status}</Badge>;
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center py-10 text-center">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

export function LinkCard({ href, title, subtitle, right }: { href: string; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <Link href={href} className="card flex items-center justify-between gap-3 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700">
      <div className="min-w-0">
        <p className="truncate font-semibold">{title}</p>
        {subtitle && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{right}<Chevron /></div>
    </Link>
  );
}

export function Chevron() {
  return (
    <svg className="h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Rating badge. Final ratings are admin-only: pass `reveal={false}` for
 * player-facing views to hide the number. "Unrated" stays visible when
 * `showUnrated` is true (e.g. so players can see who still needs votes).
 */
export function RatingDot({
  rating,
  reveal = true,
  showUnrated = true,
}: {
  rating: number | null;
  reveal?: boolean;
  showUnrated?: boolean;
}) {
  if (rating == null) return showUnrated ? <Badge tone="amber">Fără rating</Badge> : null;
  if (!reveal) return null;
  // 1 = best … 6 = weakest
  const tone: BadgeTone =
    rating <= 2 ? "green" : rating === 3 ? "brand" : rating === 4 ? "slate" : rating === 5 ? "amber" : "red";
  return <Badge tone={tone}>★ {rating}</Badge>;
}
