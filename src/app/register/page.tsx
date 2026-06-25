import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { registerAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/Form";
import { Icon } from "@/components/icons";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/app");
  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Icon.Ball className="h-6 w-6" />
        </span>
        <span className="text-lg font-bold">Football Group Manager</span>
      </div>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        After signing up, join a location with an invite code.
      </p>

      <ActionForm action={registerAction} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" name="name" required className="input" placeholder="Andrei Popescu" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone <span className="text-slate-400">(optional)</span></label>
          <input id="phone" name="phone" className="input" placeholder="07xx xxx xxx" autoComplete="tel" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={6} className="input" placeholder="At least 6 characters" autoComplete="new-password" />
        </div>
        <SubmitButton pendingText="Creating…">Create account</SubmitButton>
      </ActionForm>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 dark:text-brand-400">Log in</Link>
      </p>
    </main>
  );
}
