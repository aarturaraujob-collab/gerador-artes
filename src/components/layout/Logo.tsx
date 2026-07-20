interface LogoProps {
  collapsed: boolean;
}

export function Logo({ collapsed }: LogoProps) {
  if (collapsed) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-lg font-black text-white">
        F
      </div>
    );
  }

  return (
    <div className="flex flex-col leading-none">
      <span className="text-2xl font-black tracking-tight text-slate-900">
        FAF
      </span>

      <span className="-mt-1 text-sm font-semibold tracking-wide text-violet-600">
        MKT OPS
      </span>
    </div>
  );
}