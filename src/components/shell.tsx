"use client";
/** App chrome: sidebar on desktop, top bar + bottom tab bar on phones. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  IconBell,
  IconBuilding,
  IconCalendar,
  IconFile,
  IconFlame,
  IconHome,
  IconLogout,
  IconSettings,
  IconUsers,
} from "./icons";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; mobile?: boolean };

const ICONS = {
  home: IconHome,
  calendar: IconCalendar,
  file: IconFile,
  building: IconBuilding,
  users: IconUsers,
  settings: IconSettings,
  bell: IconBell,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({
  nav,
  user,
  logout,
  children,
  areaLabel,
}: {
  nav: NavItem[];
  user: { name: string; role: string };
  logout: () => Promise<void>;
  children: ReactNode;
  areaLabel: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileNav = nav.filter((n) => n.mobile);
  const overflow = nav.filter((n) => !n.mobile);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <IconFlame />
          </span>
          <div>
            <div className="font-bold leading-tight">FireCert</div>
            <div className="text-xs text-ink-500">{areaLabel}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((n) => {
            const Icon = ICONS[n.icon];
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                )}
              >
                <Icon />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-ink-100 p-3">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="text-xs capitalize text-ink-500">{user.role.toLowerCase()}</div>
          </div>
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50">
              <IconLogout /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="safe-top sticky top-0 z-30 flex items-center justify-between border-b border-ink-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <IconFlame width={18} height={18} />
            </span>
            <span className="font-bold">FireCert</span>
          </div>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-100"
            aria-expanded={menuOpen}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </header>
        {menuOpen && (
          <div className="fixed inset-x-0 top-[57px] z-30 border-b border-ink-200 bg-white p-3 shadow-lg lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="px-3 pb-2 text-sm">
              <div className="font-semibold">{user.name}</div>
              <div className="text-xs capitalize text-ink-500">{user.role.toLowerCase()}</div>
            </div>
            {overflow.map((n) => {
              const Icon = ICONS[n.icon];
              return (
                <Link key={n.href} href={n.href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium text-ink-700 hover:bg-ink-50">
                  <Icon /> {n.label}
                </Link>
              );
            })}
            <form action={logout}>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium text-ink-700 hover:bg-ink-50">
                <IconLogout /> Sign out
              </button>
            </form>
          </div>
        )}

        <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>

        {/* Mobile bottom tabs */}
        {mobileNav.length > 0 && (
          <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white lg:hidden">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }}>
              {mobileNav.map((n) => {
                const Icon = ICONS[n.icon];
                const active = isActive(pathname, n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", active ? "text-brand-700" : "text-ink-500")}
                  >
                    <Icon width={22} height={22} />
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
