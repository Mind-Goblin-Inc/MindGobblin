const MATERIALS = ["Siltglass", "Bog Iron", "Moonbone", "Ashwood", "Cinder Brass", "Murksteel"];
const NOUNS = ["Shiv", "Lantern", "Hook", "Totem", "Idol", "Key", "Mask", "Horn"];
const EPITHETS = ["of the Hollow", "of Black Moss", "the Oath-Bitten", "the Cave-Woken", "of Dim Embers"];

function hashText(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildArtifactIdentity({ artifactId, runSeed, creationTick }) {
  const h = hashText(`${artifactId}|${runSeed}|${creationTick}`);
  const material = MATERIALS[h % MATERIALS.length];
  const noun = NOUNS[(h >>> 4) % NOUNS.length];
  const epithet = EPITHETS[(h >>> 8) % EPITHETS.length];

  return {
    displayName: `${noun} of ${material}`,
    epithet,
    seedSignature: `${h.toString(16)}`
  };
}

export function maybePromoteEpithet(artifact, tier) {
  if (tier >= 3 && !artifact.epithet) {
    artifact.epithet = "the Remembered";
  }
}
