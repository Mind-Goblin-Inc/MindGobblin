export function nextId(state, prefix) {
  const value = state.meta.nextId;
  state.meta.nextId += 1;
  return `${prefix}-${value.toString(36)}`;
}

export function canonicalEdgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
