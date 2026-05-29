"use client";

import { usePathname } from "next/navigation";
import AppSidebar from "./AppSidebar";

// Pages that should render full-bleed without the sidebar chrome
const HIDDEN_EXACT = new Set<string>(["/", "/auth"]);
const HIDDEN_PREFIXES = ["/auth/", "/game", "/demo"];

function shouldHide(pathname: string): boolean {
  if (HIDDEN_EXACT.has(pathname)) return true;
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";

  if (shouldHide(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
