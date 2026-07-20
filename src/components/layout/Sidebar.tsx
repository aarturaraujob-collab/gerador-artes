import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { navigation } from "@/constants/navigation";

import { Logo } from "./Logo";
import { NavigationItem } from "./NavigationItem";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({
  collapsed,
  onToggle,
}: SidebarProps) {
  return (
    <aside
      className={`
        relative
        flex
        flex-col
        justify-between
        border-r
        border-slate-200
        bg-white
        transition-all
        duration-300
        ${collapsed ? "w-20" : "w-72"}
      `}
    >
      <div>
        <div className="flex items-center justify-between px-6 py-6">
          <Logo collapsed={collapsed} />

          <button
            onClick={onToggle}
            className="
              rounded-lg
              p-2
              text-slate-500
              transition-colors
              hover:bg-slate-100
              hover:text-slate-900
            "
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>

        <nav className="space-y-1 px-3">
          {navigation.map((item) => (
            <NavigationItem
              key={item.label}
              {...item}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </div>

      <div
        className={`
          border-t
          border-slate-200
          px-6
          py-5
          transition-all
          duration-300
          ${collapsed ? "text-center" : ""}
        `}
      >
        {collapsed ? (
          <p className="text-xs font-semibold text-slate-500">v0.1</p>
        ) : (
          <>
            <p className="text-xs font-semibold text-slate-600">
              FAF MKT OPS
            </p>

            <p className="text-xs text-slate-400">
              Versão 0.1
            </p>
          </>
        )}
      </div>
    </aside>
  );
}