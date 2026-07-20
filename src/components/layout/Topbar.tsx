import { Bell, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Topbar() {
  return (
    <header
      className="
        h-20
        bg-white
        border-b
        border-slate-200
        px-8
        flex
        items-center
        justify-between
      "
    >
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Dashboard
        </h1>

        <p className="text-sm text-slate-500">
          Bem-vindo ao FAF MKT OPS
        </p>
      </div>

      <div className="flex items-center gap-5">
        <Search className="w-5 h-5 text-slate-500" />

        <Bell className="w-5 h-5 text-slate-500" />

        <Avatar>
          <AvatarFallback>AA</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}