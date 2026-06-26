import { loadLocationContext } from "@/lib/locationContext";
import { BottomNav, type NavItem } from "@/components/BottomNav";

export default async function LocationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locationId: string };
}) {
  const ctx = await loadLocationContext(params.locationId);
  const base = `/loc/${params.locationId}`;

  const items: NavItem[] = [
    { href: base, label: "Meciuri", icon: "Ball", exact: true },
    { href: `${base}/rules`, label: "Reguli", icon: "Book" },
    { href: `${base}/stats`, label: "Statistici", icon: "Chart" },
  ];
  if (ctx.isAdmin) {
    items.push({ href: `${base}/admin`, label: "Admin", icon: "Shield" });
  } else {
    items.push({ href: `${base}/rate`, label: "Votează", icon: "Users" });
  }
  items.push({ href: "/app", label: "Acasă", icon: "Home", exact: true });

  return (
    <div className="mx-auto min-h-screen max-w-app pb-24">
      {children}
      <BottomNav items={items} />
    </div>
  );
}
