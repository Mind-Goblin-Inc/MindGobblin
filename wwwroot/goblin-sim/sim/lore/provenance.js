export function appendProvenance(artifact, transfer) {
  const prev = artifact.provenance[artifact.provenance.length - 1];
  if (prev && transfer.tick < prev.tick) {
    transfer.tick = prev.tick;
  }
  artifact.provenance.push(transfer);
}

export function currentOwner(artifact) {
  const last = artifact.provenance[artifact.provenance.length - 1];
  return last ? last.to : null;
}
