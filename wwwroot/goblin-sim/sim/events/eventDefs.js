export const EVENT_DEFS = [
  {
    key: "faction_pressure_notice",
    category: "diplomacy",
    cooldownTicks: 48,
    activeDurationTicks: 20,
    timeoutBehavior: "expire"
  },
  {
    key: "faction_trade_probe",
    category: "trade",
    cooldownTicks: 60,
    activeDurationTicks: 24,
    timeoutBehavior: "expire"
  }
];

export function eventDefByKey(key) {
  return EVENT_DEFS.find((d) => d.key === key) || null;
}
