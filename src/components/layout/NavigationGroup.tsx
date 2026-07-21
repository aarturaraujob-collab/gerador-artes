import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";

import type { NavigationChild } from "@/constants/navigation";

interface NavigationGroupProps {
  label: string;
  icon: LucideIcon;
  children: NavigationChild[];
  collapsed: boolean;
}

export function NavigationGroup({ label, icon: Icon, children, collapsed }: NavigationGroupProps) {
  const [location] = useLocation();

  if (collapsed) {
    return (
      <Link href={children[0]?.href ?? "#"}>
        <button
          title={label}
          className="flex w-full items-center justify-center rounded-xl px-4 py-3 text-slate-600 transition-all duration-200 hover:bg-violet-50 hover:text-violet-600"
        >
          <Icon size={20} className="shrink-0" />
        </button>
      </Link>
    );
  }

  return (
    <div>
      <div className="flex items-center px-4 py-2 text-slate-500">
        <Icon size={18} className="shrink-0" />
        <span className="ml-3 text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>

      <div className="ml-4 space-y-1 border-l border-slate-200 pl-3">
        {children.map((child) => {
          const isActive = location === child.href;
          return (
            <Link key={child.href} href={child.href}>
              <button
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200 ${
                  isActive ? "bg-violet-50 text-violet-600" : "text-slate-600 hover:bg-violet-50 hover:text-violet-600"
                }`}
              >
                {child.label}
              </button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
