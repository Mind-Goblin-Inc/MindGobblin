function parseHexColor(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (clean.length === 8) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      parseInt(clean.slice(6, 8), 16)
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      255
    ];
  }
  return [0, 0, 0, 0];
}

function rgb565ToRgba(px16) {
  const r5 = (px16 >> 11) & 0x1f;
  const g6 = (px16 >> 5) & 0x3f;
  const b5 = px16 & 0x1f;
  return [
    Math.round((r5 / 31) * 255),
    Math.round((g6 / 63) * 255),
    Math.round((b5 / 31) * 255),
    255
  ];
}

function spriteToCanvas(sprite, paletteRgba) {
  const c = document.createElement("canvas");
  c.width = sprite.width;
  c.height = sprite.height;
  const ctx = c.getContext("2d");
  const image = ctx.createImageData(sprite.width, sprite.height);

  for (let i = 0; i < sprite.pixels.length; i += 1) {
    const color = paletteRgba[sprite.pixels[i]] || [0, 0, 0, 0];
    const o = i * 4;
    image.data[o] = color[0];
    image.data[o + 1] = color[1];
    image.data[o + 2] = color[2];
    image.data[o + 3] = color[3];
  }
  ctx.putImageData(image, 0, 0);
  return c;
}

function makeGeneratedSprite(id, rows, on = "x") {
  const height = rows.length;
  const width = rows[0]?.length || 0;
  const pixels = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const ch = rows[y][x];
      if (ch === ".") pixels.push(0);
      else if (ch === "r") pixels.push(8);
      else if (ch === "g") pixels.push(11);
      else if (ch === "b") pixels.push(12);
      else if (ch === "w") pixels.push(7);
      else if (ch === "s") pixels.push(5);
      else if (ch === "d") pixels.push(4);
      else if (ch === on) pixels.push(10);
      else pixels.push(0);
    }
  }
  return { id, width, height, pixels };
}

function bitmap565ToCanvas(bmp) {
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d");
  const image = ctx.createImageData(bmp.width, bmp.height);

  for (let i = 0; i < bmp.pixels.length; i += 1) {
    const [r, g, b, a] = rgb565ToRgba(bmp.pixels[i]);
    const o = i * 4;
    image.data[o] = r;
    image.data[o + 1] = g;
    image.data[o + 2] = b;
    image.data[o + 3] = a;
  }
  ctx.putImageData(image, 0, 0);
  return c;
}

export async function loadGraphicsAssets() {
  const [sprRes, envRes] = await Promise.all([
    fetch("goblin-sim/graphics/assets/sprites-8bit.json"),
    fetch("goblin-sim/graphics/assets/environment-16bit.json")
  ]);

  const [sprData, envData] = await Promise.all([sprRes.json(), envRes.json()]);
  const palette = (sprData.palette || []).map(parseHexColor);

  const spritesById = {};
  for (const sprite of sprData.sprites || []) {
    spritesById[sprite.id] = {
      ...sprite,
      _canvas: spriteToCanvas(sprite, palette)
    };
  }

  if (!spritesById.home) {
    const sprite = makeGeneratedSprite("home", [
      "................",
      "................",
      "......rrrr......",
      ".....rrrrrr.....",
      "....rrrrrrrr....",
      "...rrrrrrrrrr...",
      "...rrddddddrr...",
      "...rddddddddr...",
      "...rddwddwddr...",
      "...rddddddddr...",
      "...rddddddddr...",
      "...rdddssdddr...",
      "...rddddddddr...",
      "...rrrrrrrrrr...",
      "................",
      "................"
    ]);
    spritesById.home = { ...sprite, _canvas: spriteToCanvas(sprite, palette) };
  }

  if (!spritesById.wall) {
    const sprite = makeGeneratedSprite("wall", [
      "................",
      "................",
      "................",
      "...ssssssssss...",
      "...swwwwwwwws...",
      "...swwsswwwws...",
      "...swwwwwwwws...",
      "...swwsswwwws...",
      "...swwwwwwwws...",
      "...swwsswwwws...",
      "...swwwwwwwws...",
      "...ssssssssss...",
      "................",
      "................",
      "................",
      "................"
    ]);
    spritesById.wall = { ...sprite, _canvas: spriteToCanvas(sprite, palette) };
  }

  if (!spritesById.outpost) {
    const sprite = makeGeneratedSprite("outpost", [
      "................",
      ".......s........",
      ".......s........",
      "......sss.......",
      "......srs.......",
      ".....ssrss......",
      "...ssssrsssss...",
      "...sdddddddds...",
      "...sddwddwdds...",
      "...sdddddddds...",
      "...sdddddddds...",
      "...sdddssddds...",
      "...sdddddddds...",
      "...ssssssssss...",
      "................",
      "................"
    ]);
    spritesById.outpost = { ...sprite, _canvas: spriteToCanvas(sprite, palette) };
  }

  const envCanvas = bitmap565ToCanvas(envData);

  return {
    version: 1,
    indexed8: {
      palette,
      spritesById
    },
    rgb565: {
      bitmap: envData,
      canvas: envCanvas
    }
  };
}

export function drawIndexedSprite(ctx, assets, id, dx, dy, dw, dh) {
  const sprite = assets?.indexed8?.spritesById?.[id];
  if (!sprite) return false;
  const w = dw ?? sprite.width;
  const h = dh ?? sprite.height;
  ctx.drawImage(sprite._canvas, dx, dy, w, h);
  return true;
}

export function drawRgb565Bitmap(ctx, assets, dx, dy, dw, dh) {
  const src = assets?.rgb565?.canvas;
  if (!src) return false;
  const w = dw ?? src.width;
  const h = dh ?? src.height;
  ctx.drawImage(src, dx, dy, w, h);
  return true;
}
