import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/Form";
import { OAuthButtons, OAuthError } from "@/components/OAuthButtons";
import { Icon } from "@/components/icons";

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  if (await getCurrentUser()) redirect("/app");
  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Icon.Ball className="h-6 w-6" />
        </span>
        <span className="text-lg font-bold">Football Group Manager</span>
      </div>
      <h1 className="text-2xl font-bold">Bine ai revenit</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">Conectează-te ca să-ți vezi meciurile.</p>

      <OAuthError error={searchParams.error} />
      <OAuthButtons />

      <ActionForm action={loginAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Parolă</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input" placeholder="••••••••" />
        </div>
        <SubmitButton pendingText="Se conectează…">Conectare</SubmitButton>
      </ActionForm>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Nu ai cont?{" "}
        <Link href="/register" className="font-semibold text-brand-600 dark:text-brand-400">Creează unul</Link>
      </p>
    </main>
  );
}
