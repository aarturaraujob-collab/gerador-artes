import { ReactNode, useState } from "react";

import { Sidebar } from "@/components/ui/navigation/Sidebar";
import { Topbar } from "@/components/ui/Topbar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type Props = {
  children: ReactNode;
};

export function AppShell({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">

      <div className="hidden md:flex">
        <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((value) => !value)} />
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">

        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

      </div>

    </div>
  );
}
