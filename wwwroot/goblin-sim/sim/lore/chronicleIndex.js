function pushIndex(map, key, value) {
  if (!key) return;
  if (!map[key]) map[key] = [];
  map[key].push(value);
}

export function indexChronicleFromCursor(state) {
  const lore = state.lore;
  const start = lore.chronicleIndex.cursor;
  for (let i = start; i < state.chronicle.length; i += 1) {
    const entry = state.chronicle[i];
    const id = entry.id;
    pushIndex(lore.chronicleIndex.byType, entry.type, id);
    pushIndex(lore.chronicleIndex.byGoblinId, entry.goblinId, id);
    pushIndex(lore.chronicleIndex.byFactionId, entry.factionId, id);
    pushIndex(lore.chronicleIndex.byArtifactId, entry.artifactId, id);
    pushIndex(lore.chronicleIndex.byTickBucket, String(Math.floor(entry.tick / 10)), id);
  }
  lore.chronicleIndex.cursor = state.chronicle.length;
}

export function queryChronicle(state, filters) {
  const search = (filters.search || "").trim().toLowerCase();
  const type = filters.type || "all";
  const goblinId = filters.goblinId || null;
  let list = state.chronicle;

  if (goblinId) list = list.filter((c) => c.goblinId === goblinId);
  if (type !== "all") list = list.filter((c) => c.type === type);
  if (search) {
    list = list.filter((c) => {
      const text = `${c.text} ${c.type}`.toLowerCase();
      return text.includes(search);
    });
  }

  return list.slice(-80);
}
