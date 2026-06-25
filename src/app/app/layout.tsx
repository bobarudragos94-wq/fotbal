import { requirePageUser } from "@/lib/page";
import { BottomNav, type NavItem } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();

  const items: NavItem[] = [
    { href: "/app", label: "Locations", icon: "Home", exact: true },
    { href: "/app/join", label: "Join", icon: "Plus" },
    { href: "/app/profile", label: "Profile", icon: "User" },
  ];
  if (user.isSuperAdmin) {
    items.splice(2, 0, { href: "/super", label: "Admin", icon: "Shield" });
  }

  return (
    <div className="mx-auto min-h-screen max-w-app pb-24">
      {children}
      <BottomNav items={items} />
    </div>
  );
}
