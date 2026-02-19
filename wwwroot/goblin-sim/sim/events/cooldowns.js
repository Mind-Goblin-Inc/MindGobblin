export function ensureEventCooldownState(state) {
  state.events = state.events || {};
  state.events.cooldownsByKey = state.events.cooldownsByKey || {};
  return state.events.cooldownsByKey;
}

export function canTriggerEvent(state, eventKey, tick, cooldownTicks) {
  const map = ensureEventCooldownState(state);
  const last = Number(map[eventKey] || -100000);
  return tick - last >= cooldownTicks;
}

export function markEventTriggered(state, eventKey, tick) {
  const map = ensureEventCooldownState(state);
  map[eventKey] = tick;
}
