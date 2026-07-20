import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";

interface NavigationItemProps {
  label: string;
  href: string;
  icon: LucideIcon;
  collapsed: boolean;
}

export function NavigationItem({
  label,
  href,
  icon: Icon,
  collapsed,
}: NavigationItemProps) {
  return (
    <Link href={href}>
      <button
        className="
          flex
          w-full
          items-center
          rounded-xl
          px-4
          py-3
          text-slate-600
          transition-all
          duration-200
          hover:bg-violet-50
          hover:text-violet-600
        "
      >
        <Icon
          size={20}
          className="shrink-0"
        />

        {!collapsed && (
          <span className="ml-3 text-sm font-medium">
            {label}
          </span>
        )}
      </button>
    </Link>
  );
}