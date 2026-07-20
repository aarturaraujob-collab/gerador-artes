import type { ReactNode } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useSidebar } from "@/hooks/useSidebar";

interface Props {
  children: ReactNode;
}

export function MainLayout({ children }: Props) {
  const sidebar = useSidebar();

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar
        collapsed={sidebar.collapsed}
        onToggle={sidebar.toggle}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}