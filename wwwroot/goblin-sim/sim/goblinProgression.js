export function grantXp(goblin, amount) {
  goblin.progression.xp += amount;
  const threshold = goblin.progression.level * 100;
  if (goblin.progression.xp >= threshold) {
    goblin.progression.xp -= threshold;
    goblin.progression.level += 1;
    goblin.progression.milestones.push(`Reached level ${goblin.progression.level}`);
    return {
      type: "GOBLIN_LEVEL_UP",
      goblinId: goblin.id,
      newLevel: goblin.progression.level
    };
  }
  return null;
}
