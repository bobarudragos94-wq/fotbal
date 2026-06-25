import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Icon } from "@/components/icons";

export default async function Landing() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  const features = [
    { icon: Icon.Pin, title: "Multiple pitches", text: "Each location is its own world — players, rules, matches and history kept separate." },
    { icon: Icon.Users, title: "Balanced teams", text: "Smart, controlled randomization splits players into fair teams every time." },
    { icon: Icon.Calendar, title: "RSVP & waitlist", text: "Going, maybe or out. Full match? Players roll onto the waitlist automatically." },
    { icon: Icon.Chart, title: "Scores & stats", text: "Track games, standings, win rates and a full match history per location." },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-700 via-brand-800 to-slate-950 text-white">
      <div className="mx-auto flex max-w-app flex-col px-5 pb-16 pt-14">
        <div className="mb-10 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <Icon.Ball className="h-6 w-6" />
          </span>
          <span className="text-lg font-bold">Football Group Manager</span>
        </div>

        <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
          Organize your<br />football nights<br />
          <span className="text-accent-400">without the chaos.</span>
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-white/80">
          Set up your pitch, approve your mates, confirm who's in, and get fair, balanced
          teams in one tap. Built mobile-first for the group chat era.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/register" className="btn-accent w-full text-base">Create an account</Link>
          <Link href="/login" className="btn w-full border border-white/30 bg-white/10 text-white hover:bg-white/20">
            I already have an account
          </Link>
        </div>

        <div className="mt-12 grid gap-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/20 text-accent-400">
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="font-semibold">{f.title}</h3>
              </div>
              <p className="mt-2 text-sm text-white/70">{f.text}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-white/50">
          Install it as an app: open in your browser and tap “Add to Home Screen”.
        </p>
      </div>
    </main>
  );
}
