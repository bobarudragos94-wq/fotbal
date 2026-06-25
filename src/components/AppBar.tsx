import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function AppBar({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-app items-center gap-2 px-4 py-3">
        {back && (
          <Link href={back} className="btn-ghost h-9 w-9 min-h-0 rounded-full p-0" aria-label="Back">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
        )}
        <h1 className="flex-1 truncate text-lg font-bold tracking-tight">{title}</h1>
        <div className="flex items-center gap-1">
          {right}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
