# Goblin Graphics Pipeline (8-bit / 16-bit)

## What We Implemented
- `8-bit indexed bitmap` sprite pack:
  - File: `wwwroot/goblin-sim/graphics/assets/sprites-8bit.json`
  - Contains palette + indexed pixel data for:
    - `goblin`, `tree`, `rock`, `mushroom`, `grass_tile`, `water_tile`
- `16-bit RGB565 bitmap` environment sample:
  - File: `wwwroot/goblin-sim/graphics/assets/environment-16bit.json`
- Decoder + renderer:
  - File: `wwwroot/goblin-sim/graphics/indexedBitmap.js`
- Generator script:
  - File: `tools/generate_indexed_bitmaps.py`
- Visual lab page:
  - File: `wwwroot/goblin-graphics-lab.html`

## Why This Format Works
- 8-bit indexed is great for stylized sprites:
  - tiny storage
  - palette swaps possible
  - easy modding by editing indices
- 16-bit RGB565 is great for larger backgrounds/terrain:
  - compact compared to RGBA
  - no palette management required

## Runtime Decode Flow
1. Fetch JSON bitmaps.
2. For indexed sprites:
  - parse palette
  - map each pixel index -> RGBA
  - build cached canvas per sprite
3. For RGB565 bitmap:
  - unpack `R5 G6 B5` -> 8-bit RGBA
  - build cached canvas
4. Draw onto main canvas at target scale.

## Integration in Simulation
- `wwwroot/goblin-sim/index.js` now loads graphics assets on boot.
- `wwwroot/goblin-sim/ui/world/mapRenderer.js` now uses bitmap sprites for:
  - goblin units
  - site markers
  - deterministic environmental props per region
- Fallback rendering remains if assets fail to load.

## Extending This
- Add animation:
  - define frame lists per sprite id in JSON (`frames`, `fps`)
- Add palette swaps:
  - keep same pixel indices, swap palette at runtime
- Add LOD:
  - small map zoom uses simple glyphs
  - close zoom uses full sprite bitmaps
- Add atlas packing:
  - combine sprite canvases into one atlas for fewer draw calls

## Regenerating Samples
Run:

```bash
python3 tools/generate_indexed_bitmaps.py
```

This rewrites:
- `wwwroot/goblin-sim/graphics/assets/sprites-8bit.json`
- `wwwroot/goblin-sim/graphics/assets/environment-16bit.json`

