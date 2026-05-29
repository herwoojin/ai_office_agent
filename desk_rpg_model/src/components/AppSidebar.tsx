"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Users,
  Building2,
  Cpu,
  KeyRound,
  Palette,
  ShieldCheck,
  Sparkles,
  Home,
  FileText,
} from "lucide-react";
import { useT } from "@/lib/i18n";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type NavSection = {
  titleKey: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    titleKey: "sidebar.section.start",
    items: [
      { href: "/onboarding", labelKey: "sidebar.item.onboarding", icon: Sparkles },
      { href: "/characters", labelKey: "sidebar.item.home", icon: Home },
    ],
  },
  {
    titleKey: "sidebar.section.play",
    items: [
      { href: "/characters", labelKey: "sidebar.item.characters", icon: Users },
      { href: "/channels", labelKey: "sidebar.item.channels", icon: Building2 },
    ],
  },
  {
    titleKey: "sidebar.section.ai",
    items: [
      { href: "/gateways", labelKey: "sidebar.item.gateways", icon: Cpu },
      { href: "/settings/llm", labelKey: "sidebar.item.llm", icon: KeyRound },
    ],
  },
  {
    titleKey: "sidebar.section.tools",
    items: [
      { href: "/reports", labelKey: "sidebar.item.reports", icon: FileText },
      { href: "/map-editor", labelKey: "sidebar.item.mapEditor", icon: Palette },
    ],
  },
  {
    titleKey: "sidebar.section.admin",
    items: [
      { href: "/admin/groups", labelKey: "sidebar.item.adminGroups", icon: ShieldCheck },
    ],
  },
];

const STORAGE_KEY = "appSidebar.collapsed";

export default function AppSidebar() {
  const pathname = usePathname();
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {}
    setHydrated(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {}
  }

  // Pre-hydration: render collapsed-width placeholder to avoid layout shift
  if (!hydrated) {
    return <aside className="w-16 shrink-0 border-r border-[var(--border-subtle,#2a2a35)] bg-[var(--surface,#181820)]" />;
  }

  const widthClass = collapsed ? "w-16" : "w-60";

  return (
    <aside
      className={`${widthClass} shrink-0 border-r border-[var(--border-subtle,#2a2a35)] bg-[var(--surface,#181820)] text-[var(--text,#e5e5ee)] flex flex-col transition-[width] duration-200 sticky top-0 h-screen`}
      aria-label="Primary navigation"
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border-subtle,#2a2a35)]">
        {!collapsed && (
          <Link href="/characters" className="flex items-center gap-2 font-semibold text-sm text-[var(--text,#e5e5ee)] hover:opacity-80">
            <Compass size={18} className="text-[var(--color-primary,#7c8cff)]" />
            <span>DeskRPG</span>
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          className="ml-auto rounded-md p-1.5 hover:bg-[var(--surface-raised,#22222e)] text-[var(--text-muted,#9090a0)] hover:text-[var(--text,#e5e5ee)]"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.titleKey}>
            {!collapsed && (
              <div className="px-2 mb-1 text-[10px] uppercase tracking-wider text-[var(--text-muted,#9090a0)]">
                {t(section.titleKey)}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href + "/"));
                return (
                  <li key={item.href + item.labelKey}>
                    <Link
                      href={item.href}
                      title={collapsed ? t(item.labelKey) : undefined}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        isActive
                          ? "bg-[var(--color-primary-muted,rgba(124,140,255,0.18))] text-[var(--color-primary,#7c8cff)]"
                          : "text-[var(--text,#e5e5ee)] hover:bg-[var(--surface-raised,#22222e)]"
                      }`}
                    >
                      <Icon size={16} className="shrink-0" />
                      {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-3 py-3 border-t border-[var(--border-subtle,#2a2a35)] text-[11px] text-[var(--text-muted,#9090a0)]">
          <Link href="/onboarding" className="hover:text-[var(--color-primary,#7c8cff)]">
            {t("sidebar.helpHint")}
          </Link>
        </div>
      )}
    </aside>
  );
}
