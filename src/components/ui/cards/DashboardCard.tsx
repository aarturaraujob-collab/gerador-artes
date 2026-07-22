import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
};

export function DashboardCard({
  title,
  description,
  icon,
  href,
}: Props) {
  return (
    <Link
      href={href}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <motion.div
        className="group cursor-pointer rounded-2xl border border-card-border bg-card p-6 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-brand/30 hover:shadow-md"
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >

        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-brand/10 text-brand">
          {icon}
        </div>

        <h3 className="text-lg font-semibold text-foreground">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
          {description}
        </p>

        <div className="mt-6 flex items-center text-sm font-medium text-brand-solid">
          Abrir
          <ChevronRight
            size={16}
            className="ml-1 transition-transform duration-200 group-hover:translate-x-1"
          />
        </div>

      </motion.div>
    </Link>
  );
}
