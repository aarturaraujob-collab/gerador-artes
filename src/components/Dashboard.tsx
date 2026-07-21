import type { DataStore } from "@/modules/dataStore";

interface Props {
  dataStore: DataStore;
}

export function Dashboard({ dataStore }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Competições<strong className="mt-1 block text-2xl text-slate-900">{dataStore.competitions.length}</strong></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Jogos<strong className="mt-1 block text-2xl text-slate-900">{dataStore.matches.length}</strong></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Clubes<strong className="mt-1 block text-2xl text-slate-900">{dataStore.clubs.length}</strong></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Estádios<strong className="mt-1 block text-2xl text-slate-900">{dataStore.stadiums.length}</strong></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Última atualização<strong className="mt-1 block text-base text-slate-900">{dataStore.lastUpdated}</strong></div>
    </div>
  );
}
