# Migração pontual: Competições/Jogos/Operacional/FAF Lab/Backgrounds/Documentos → Supabase

Continuação de `migrate-registry.md` (que já migrou Clubes/Estádios/Cidades). Rode isto **uma vez**, na mesma aba onde o app tem os dados reais — precisa estar **logado no app nessa aba** antes de rodar (o script reaproveita a sessão já ativa). Rode **depois** de já ter aplicado o `supabase/schema.sql` atualizado no SQL Editor.

Este script lê as **duas** IndexedDBs do navegador (`faf-mkt-ops`, a principal, e `urano-faf-documents`, onde ficam IMTs e Tabela Detalhada) e faz upsert em Supabase respeitando a ordem de FK:

`competitions` → `matches` → `operational_staff` → `match_faftv`/`match_operacao`/`match_operations_history` → `player_competition_stats`/`lab_notes` → `backgrounds` → `imts`/`detailed_tables`.

Não repete a migração de clubes/estádios/cidades — se ainda não rodou `migrate-registry.md`, rode-o primeiro.

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

  function openIdb(name, version) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function getAll(db, store) {
    return new Promise((res, rej) => {
      const tx = db.transaction(store, "readonly");
      const r = tx.objectStore(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
  const isoFromDate = (d) => (d instanceof Date ? d.toISOString() : d ? new Date(d).toISOString() : null);

  const mainDb = await openIdb("faf-mkt-ops", 5);
  const docsDb = await openIdb("urano-faf-documents", 2);

  const results = {};
  async function upsert(table, rows) {
    if (rows.length === 0) {
      results[table] = { count: 0, error: null };
      return;
    }
    const { error } = await supabase.from(table).upsert(rows);
    results[table] = { count: rows.length, error };
    if (error) console.error(`Erro em ${table}:`, error);
  }

  // 1. Competitions
  const competitions = await getAll(mainDb, "competitions");
  await upsert(
    "competitions",
    competitions.map((c) => ({
      id: c.id,
      series_id: c.seriesId ?? null,
      name: c.name,
      season: c.season,
      category: c.category || null,
      gender: c.gender || null,
      age_group: c.ageGroup || null,
      logo: c.logo || null,
      background: c.background,
      templates: c.templates ?? [],
      active: c.active,
      status: c.status ?? null,
      deleted_at: iso(c.deletedAt),
    })),
  );

  // 2. Matches (id = gameRef, already the keyPath in this store)
  const matches = await getAll(mainDb, "matches");
  await upsert(
    "matches",
    matches.map((m) => ({
      id: m.id,
      competition_id: m.competitionId,
      round: m.round || null,
      date: m.date || null,
      time: m.time || null,
      home_club_id: m.homeClubId,
      away_club_id: m.awayClubId,
      stadium_id: m.stadiumId || null,
      city_id: m.cityId || null,
      home_goals: m.homeGoals,
      away_goals: m.awayGoals,
      tv: m.tv,
      phase: m.phase ?? null,
      ref: m.ref ?? null,
    })),
  );

  // 3. Operational staff
  const staff = await getAll(mainDb, "operationalStaff");
  await upsert(
    "operational_staff",
    staff.map((s) => ({
      id: s.id,
      name: s.name,
      photo: s.photo ?? null,
      cpf: s.cpf ?? null,
      phone: s.phone ?? null,
      address: s.address ?? null,
      role: s.role,
      area: s.area,
      deleted_at: iso(s.deletedAt),
    })),
  );

  // 4. Match FAFTV / Operação / Histórico
  const faftv = await getAll(mainDb, "matchFaftv");
  await upsert(
    "match_faftv",
    faftv.map((f) => ({
      id: f.id,
      game_ref: f.gameRef,
      coordinator_staff_id: f.coordinatorStaffId ?? null,
      commentator_staff_id: f.commentatorStaffId ?? null,
      broadcast_link: f.broadcastLink ?? null,
      checklist: f.checklist ?? {},
      status: f.status,
      updated_at: iso(f.updatedAt) ?? new Date().toISOString(),
    })),
  );

  const operacao = await getAll(mainDb, "matchOperacao");
  await upsert(
    "match_operacao",
    operacao.map((o) => ({
      id: o.id,
      game_ref: o.gameRef,
      delegado_staff_id: o.delegadoStaffId ?? null,
      supervisor_staff_id: o.supervisorStaffId ?? null,
      fiscal_staff_id: o.fiscalStaffId ?? null,
      controle_acesso_staff_id: o.controleAcessoStaffId ?? null,
      checklist: o.checklist ?? {},
      status: o.status,
      updated_at: iso(o.updatedAt) ?? new Date().toISOString(),
    })),
  );

  const history = await getAll(mainDb, "matchOperationsHistory");
  await upsert(
    "match_operations_history",
    history.map((h) => ({
      id: h.id,
      game_ref: h.gameRef,
      module: h.module,
      operator: h.operator,
      description: h.description,
      timestamp: iso(h.timestamp) ?? new Date().toISOString(),
    })),
  );

  // 5. FAF Lab: player stats + lab notes
  const playerStats = await getAll(mainDb, "playerStats");
  await upsert(
    "player_competition_stats",
    playerStats.map((p) => ({
      id: p.id,
      competition_id: p.competitionId,
      cbf: p.cbf ?? null,
      club_id: p.clubId,
      apelido: p.apelido || null,
      nome: p.nome || null,
      idade: p.idade ?? null,
      vinculo: p.vinculo || null,
      jogos: p.jogos,
      titular: p.titular,
      minutos: p.minutos,
      gols: p.gols,
      cartoes_amarelos: p.cartoesAmarelos,
      cartoes_vermelhos: p.cartoesVermelhos,
      entrou: p.entrou,
      saiu: p.saiu,
      sub: p.sub ?? null,
      estrangeiro: p.estrangeiro ?? null,
    })),
  );

  const labNotes = await getAll(mainDb, "labNotes");
  await upsert(
    "lab_notes",
    labNotes.map((n) => ({
      id: n.id,
      notes: n.notes,
      updated_at: iso(n.updatedAt) ?? new Date().toISOString(),
    })),
  );

  // 6. Backgrounds
  const backgrounds = await getAll(mainDb, "backgrounds");
  await upsert(
    "backgrounds",
    backgrounds.map((b) => ({ id: b.id, name: b.name, data_uri: b.dataUri })),
  );

  // 7. Documentos: IMTs + Tabela Detalhada (segunda IndexedDB)
  const imts = await getAll(docsDb, "imts");
  await upsert(
    "imts",
    imts.map((i) => ({
      id: i.id,
      competition_id: i.competitionId,
      competition_name: i.competitionName,
      game_ref: i.gameRef,
      home_club_name: i.homeClubName,
      away_club_name: i.awayClubName,
      round: i.round,
      number: i.number,
      season: i.season,
      old_game: i.oldGame,
      new_game: i.newGame,
      reason: i.reason,
      requester: i.requester,
      responsible: i.responsible,
      created_at: isoFromDate(i.createdAt),
      status: i.status,
      html: i.html,
    })),
  );

  const detailedTables = await getAll(docsDb, "detailedTables");
  await upsert(
    "detailed_tables",
    detailedTables.map((t) => ({
      id: t.id,
      competition_id: t.competitionId,
      competition_name: t.competitionName,
      season: t.season,
      version: t.version,
      status: t.status,
      created_at: isoFromDate(t.createdAt),
      standings: t.standings,
      rounds: t.rounds,
      html: t.html,
    })),
  );

  console.table(
    Object.entries(results).map(([table, r]) => ({ table, count: r.count, error: r.error?.message ?? null })),
  );
})();
```

Confira a tabela impressa no console: todo `error` deve vir `null`. Um erro geralmente aponta pra RLS/GRANT ausente (rode `schema.sql` de novo) ou uma FK quebrada (ex.: um `competition_id`/`club_id` referenciado que ainda não existe na tabela referenciada — rode este script de novo depois de garantir que a etapa anterior da cadeia terminou sem erro).
