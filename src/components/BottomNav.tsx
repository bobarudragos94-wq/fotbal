"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

export type IconName = keyof typeof Icon;
export type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-app items-stretch justify-around">
        {items.map((it) => {
          const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
          const Ico = Icon[it.icon];
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                active ? "text-brand-600 dark:text-brand-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Ico className="h-6 w-6" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
