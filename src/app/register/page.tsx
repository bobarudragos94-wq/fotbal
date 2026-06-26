import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { registerAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/Form";
import { OAuthButtons, OAuthError } from "@/components/OAuthButtons";
import { Icon } from "@/components/icons";

export default async function RegisterPage({ searchParams }: { searchParams: { error?: string; oauth?: string } }) {
  if (await getCurrentUser()) redirect("/app");
  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Icon.Ball className="h-6 w-6" />
        </span>
        <span className="text-lg font-bold">Football Group Manager</span>
      </div>
      <h1 className="text-2xl font-bold">Creează-ți contul</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">
        După înregistrare, intri într-o locație cu un cod de invitație.
      </p>

      <OAuthError error={searchParams.error} />
      <OAuthButtons force={searchParams.oauth === "1"} />

      <ActionForm action={registerAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Nume complet <span className="text-slate-400">(privat)</span></label>
          <input id="name" name="name" required className="input" placeholder="Andrei Popescu" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="nickname">Nickname <span className="text-slate-400">(vizibil pentru toți)</span></label>
          <input id="nickname" name="nickname" required minLength={2} maxLength={24} className="input" placeholder="ex. Fulger" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Telefon <span className="text-slate-400">(opțional)</span></label>
          <input id="phone" name="phone" className="input" placeholder="07xx xxx xxx" autoComplete="tel" />
        </div>
        <div>
          <label className="label" htmlFor="password">Parolă</label>
          <input id="password" name="password" type="password" required minLength={6} className="input" placeholder="Minim 6 caractere" autoComplete="new-password" />
        </div>
        <SubmitButton pendingText="Se creează…">Creează cont</SubmitButton>
      </ActionForm>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Ai deja cont?{" "}
        <Link href="/login" className="font-semibold text-brand-600 dark:text-brand-400">Conectează-te</Link>
      </p>
    </main>
  );
}
