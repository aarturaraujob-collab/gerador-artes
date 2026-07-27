# Migração pontual: Clubes/Estádios/Cidades do IndexedDB → Supabase

Rode isto **uma vez**, no navegador onde o app já tem os dados reais (Clubes/Estádios/Cidades) cadastrados — precisa estar **logado no app nessa mesma aba** antes de rodar (o script reaproveita a sessão já ativa).

Abra o DevTools (F12) → Console, cole o script abaixo e dê Enter:

```js
(async () => {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(
    "https://velguljjckaolxquzidr.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlbGd1bGpqY2thb2x4cXV6aWRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNzc0NTksImV4cCI6MjEwMDc1MzQ1OX0.mJ8ULNieYDoYEmcPzWUN1l1CfmeA5vGe4rtG60QAvrE",
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    console.error("Faça login no app nesta aba antes de rodar isso.");
    return;
  }

  const req = indexedDB.open("faf-mkt-ops");
  const db = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  async function getAll(store) {
    const tx = db.transaction(store, "readonly");
    return new Promise((res, rej) => {
      const r = tx.objectStore(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  const cities = await getAll("cities");
  const stadiums = await getAll("stadiums");
  const clubs = await getAll("clubs");

  const cityRows = cities.map((c) => ({
    id: c.id,
    name: c.name,
    state: c.state ?? null,
    deleted_at: c.deletedAt ? new Date(c.deletedAt).toISOString() : null,
  }));
  const stadiumRows = stadiums.map((s) => ({
    id: s.id,
    name: s.name,
    // Empty string (a few legacy rows have no city) isn't a valid foreign key.
    city_id: s.cityId || null,
    capacity: s.capacity ?? null,
    turf_type: s.turfType ?? null,
    image: s.image ?? null,
    deleted_at: s.deletedAt ? new Date(s.deletedAt).toISOString() : null,
  }));
  const clubRows = clubs.map((c) => ({
    id: c.id,
    short_name: c.shortName,
    full_name: c.fullName,
    shield: c.shield || null,
    city_id: c.cityId ?? null,
    state: c.state ?? null,
    primary_color: c.primaryColor ?? null,
    secondary_color: c.secondaryColor ?? null,
    founded_year: c.foundedYear ?? null,
    deleted_at: c.deletedAt ? new Date(c.deletedAt).toISOString() : null,
  }));

  // Ordem importa: cidades primeiro (estádios/clubes referenciam city_id).
  const r1 = await supabase.from("cities").upsert(cityRows);
  const r2 = await supabase.from("stadiums").upsert(stadiumRows);
  const r3 = await supabase.from("clubs").upsert(clubRows);

  console.log({
    cities: cityRows.length,
    citiesError: r1.error,
    stadiums: stadiumRows.length,
    stadiumsError: r2.error,
    clubs: clubRows.length,
    clubsError: r3.error,
  });
})();
```

Confira no final se `citiesError`/`stadiumsError`/`clubsError` vieram `null` — se algum vier preenchido, o erro geralmente aponta pra RLS (não logado) ou schema ainda não criado.
