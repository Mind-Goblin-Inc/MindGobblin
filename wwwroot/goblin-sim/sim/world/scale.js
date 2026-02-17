// Terminology:
// - Chunk: large world-generation cell (formerly "region tile")
// - Tile: smallest simulation grid cell used by agents/structures (formerly "micro tile")
// - Cell: render-space/world-space floating coordinate
export const TILES_PER_CHUNK = 4;

export function tileKey(x, y) {
  return `${x},${y}`;
}

export function chunkToTileCenter(chunkCoord) {
  return chunkCoord * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2);
}

export function tileToChunkCoord(tileCoord) {
  return Math.floor(tileCoord / TILES_PER_CHUNK);
}

export function tileToWorldCell(tileCoord) {
  return tileCoord / TILES_PER_CHUNK;
}

// Backward-compatible aliases.
export const MICRO_PER_REGION = TILES_PER_CHUNK;
export const microKey = tileKey;
export const regionToMicroCenter = chunkToTileCenter;
export const microToRegionCoord = tileToChunkCoord;
export const microToWorldTile = tileToWorldCell;
