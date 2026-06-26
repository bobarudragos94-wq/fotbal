import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/page";
import { BottomNav, type NavItem } from "@/components/BottomNav";

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  if (!user.isSuperAdmin) redirect("/app");

  const items: NavItem[] = [
    { href: "/super", label: "Sumar", icon: "Home", exact: true },
    { href: "/super/locations", label: "Locații", icon: "Pin" },
    { href: "/super/users", label: "Utilizatori", icon: "Users" },
    { href: "/super/pending", label: "Cereri", icon: "Clock" },
    { href: "/app", label: "Ieșire", icon: "Logout", exact: true },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-app pb-24">
      {children}
      <BottomNav items={items} />
    </div>
  );
}
