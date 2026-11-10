import { Shell, type NavItem } from "@/components/shell";
import { logoutAction } from "@/app/actions/auth";
import { requireUser, STAFF } from "@/server/auth";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(STAFF);
  const nav: NavItem[] = [
    { href: "/dashboard", label: "Home", icon: "home", mobile: true },
    { href: "/schedule", label: "Schedule", icon: "calendar", mobile: true },
    { href: "/certificates", label: "Certificates", icon: "file", mobile: true },
    { href: "/customers", label: "Customers", icon: "building", mobile: true },
  ];
  if (user.role === "ADMIN") {
    nav.push(
      { href: "/users", label: "Staff", icon: "users" },
      { href: "/notifications", label: "Notifications", icon: "bell" },
      { href: "/settings", label: "Settings", icon: "settings" },
    );
  }
  return (
    <Shell nav={nav} user={{ name: user.name, role: user.role }} logout={logoutAction} areaLabel="Staff">
      {children}
    </Shell>
  );
}
