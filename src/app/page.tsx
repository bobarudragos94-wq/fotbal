import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Icon } from "@/components/icons";

export default async function Landing() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  const features = [
    { icon: Icon.Pin, title: "Mai multe terenuri", text: "Fiecare locație e separată — jucători, reguli, meciuri și istoric, toate independente." },
    { icon: Icon.Users, title: "Echipe echilibrate", text: "Randomizare controlată care împarte jucătorii în echipe corecte de fiecare dată." },
    { icon: Icon.Calendar, title: "Înscrieri & rezerve", text: "Vin, poate sau nu. Meci plin? Jucătorii intră automat pe lista de rezerve." },
    { icon: Icon.Chart, title: "Scoruri & statistici", text: "Urmărește meciuri, clasamente, procent de victorii și tot istoricul per locație." },
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
          Organizează-ți<br />serile de fotbal<br />
          <span className="text-accent-400">fără haos.</span>
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-white/80">
          Îți faci terenul, îți accepți gașca, vezi cine vine și primești echipe corecte
          și echilibrate dintr-un tap. Gândit mobile-first pentru era grupului de WhatsApp.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/register" className="btn-accent w-full text-base">Creează cont</Link>
          <Link href="/login" className="btn w-full border border-white/30 bg-white/10 text-white hover:bg-white/20">
            Am deja cont
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
          Instaleaz-o ca aplicație: deschide în browser și apasă „Adaugă la ecranul principal".
        </p>
      </div>
    </main>
  );
}
