export function renderArtifactInspector(state, mount) {
  const id = state.debug.selectedArtifactId;
  const artifact = id ? state.lore.artifacts.byId[id] : null;

  if (!artifact) {
    mount.textContent = "No artifact selected.";
    return;
  }

  const owner = artifact.provenance[artifact.provenance.length - 1]?.to;
  const preview = {
    id: artifact.id,
    displayName: artifact.displayName,
    epithet: artifact.epithet,
    rarityTier: artifact.rarityTier,
    legendScore: Math.round(artifact.legendScore * 10) / 10,
    currentOwner: owner,
    provenance: artifact.provenance.slice(-8)
  };

  mount.textContent = JSON.stringify(preview, null, 2);
}

export function renderArtifactList(state, mount) {
  mount.innerHTML = "";
  for (const id of state.lore.artifacts.allIds) {
    const artifact = state.lore.artifacts.byId[id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gob-row";
    if (state.debug.selectedArtifactId === id) btn.classList.add("active");
    btn.dataset.artifactId = id;
    btn.innerHTML = `
      <span class="name">${artifact.displayName}</span>
      <span class="tag">L:${Math.round(artifact.legendScore)}</span>
      <span class="tag">R:${artifact.rarityTier}</span>
      <span class="tag">${artifact.epithet || ""}</span>
    `;
    mount.appendChild(btn);
  }
}
