import json
from math import sqrt

OUT_SPRITES = "wwwroot/goblin-sim/graphics/assets/sprites-8bit.json"
OUT_ENV = "wwwroot/goblin-sim/graphics/assets/environment-16bit.json"

# 8-bit indexed palette (index 0 is transparent)
PALETTE = [
    "#00000000",
    "#1d2b53ff",
    "#7e2553ff",
    "#008751ff",
    "#ab5236ff",
    "#5f574fff",
    "#c2c3c7ff",
    "#fff1e8ff",
    "#ff004dff",
    "#ffa300ff",
    "#ffec27ff",
    "#00e436ff",
    "#29adffff",
    "#83769cff",
    "#ff77a8ff",
    "#ffccaa00"
]

W = H = 16


def make_sprite(fill=0):
    return [[fill for _ in range(W)] for _ in range(H)]


def put(px, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        px[y][x] = c


def rect(px, x, y, w, h, c):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            put(px, xx, yy, c)


def circle(px, cx, cy, r, c):
    for y in range(H):
        for x in range(W):
            if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r:
                put(px, x, y, c)


def flatten(px):
    out = []
    for row in px:
        out.extend(row)
    return out


def goblin_sprite():
    s = make_sprite()
    # body
    rect(s, 5, 7, 6, 6, 11)
    # darker body shading
    rect(s, 8, 8, 2, 5, 3)
    # head
    circle(s, 8, 5, 3, 11)
    # ears
    put(s, 4, 5, 11)
    put(s, 12, 5, 11)
    # eyes
    put(s, 7, 5, 8)
    put(s, 9, 5, 8)
    # dagger
    rect(s, 11, 9, 2, 1, 6)
    put(s, 13, 9, 9)
    # feet
    put(s, 6, 13, 4)
    put(s, 9, 13, 4)
    return s


def tree_sprite():
    s = make_sprite()
    # canopy
    circle(s, 8, 6, 5, 11)
    circle(s, 6, 7, 4, 3)
    circle(s, 10, 7, 4, 3)
    # trunk
    rect(s, 7, 9, 2, 6, 4)
    # highlights
    put(s, 8, 3, 10)
    put(s, 10, 5, 10)
    put(s, 5, 6, 10)
    return s


def rock_sprite():
    s = make_sprite()
    circle(s, 7, 10, 4, 5)
    circle(s, 10, 9, 3, 6)
    put(s, 9, 8, 7)
    put(s, 7, 9, 7)
    return s


def mushroom_sprite():
    s = make_sprite()
    # cap
    rect(s, 4, 6, 8, 3, 8)
    rect(s, 5, 5, 6, 1, 8)
    # spots
    put(s, 6, 7, 7)
    put(s, 9, 7, 7)
    # stem
    rect(s, 7, 9, 2, 4, 7)
    return s


def water_tile():
    s = make_sprite(fill=12)
    # wave bands
    for y in [3, 7, 11, 14]:
        for x in range(W):
            if (x + y) % 3 != 0:
                put(s, x, y, 1)
    for y in [1, 5, 9, 13]:
        for x in range(W):
            if (x + y) % 4 == 0:
                put(s, x, y, 7)
    return s


def grass_tile():
    s = make_sprite(fill=3)
    for y in range(H):
        for x in range(W):
            if (x * 13 + y * 7) % 19 < 3:
                put(s, x, y, 11)
            elif (x * 9 + y * 11) % 29 == 0:
                put(s, x, y, 10)
    return s


def make_sprites_pack():
    sprites = {
        "goblin": goblin_sprite(),
        "tree": tree_sprite(),
        "rock": rock_sprite(),
        "mushroom": mushroom_sprite(),
        "water_tile": water_tile(),
        "grass_tile": grass_tile(),
    }
    data = {
        "version": 1,
        "format": "indexed8",
        "palette": PALETTE,
        "sprites": [
            {
                "id": sid,
                "width": W,
                "height": H,
                "pixels": flatten(px),
            }
            for sid, px in sprites.items()
        ],
    }
    with open(OUT_SPRITES, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))


def rgb565(r, g, b):
    r5 = (r * 31) // 255
    g6 = (g * 63) // 255
    b5 = (b * 31) // 255
    return (r5 << 11) | (g6 << 5) | b5


def build_env_bitmap(w=128, h=96):
    px = [[rgb565(28, 70, 44) for _ in range(w)] for _ in range(h)]

    # Subtle grass noise
    for y in range(h):
        for x in range(w):
            if (x * 17 + y * 19) % 23 == 0:
                px[y][x] = rgb565(34, 82, 48)
            elif (x * 11 + y * 13) % 37 == 0:
                px[y][x] = rgb565(24, 58, 38)

    # River
    for y in range(h):
        river_x = int(w * 0.2 + (y * 0.35) + ((y * y) % 11) - 5)
        for x in range(max(0, river_x - 6), min(w, river_x + 8)):
            px[y][x] = rgb565(28, 95, 125)
            if (x + y) % 4 == 0:
                px[y][x] = rgb565(40, 120, 155)

    # Trees (simple circles)
    tree_spots = [(84, 20), (92, 28), (75, 45), (110, 52), (88, 70), (68, 73)]
    for cx, cy in tree_spots:
        for y in range(max(0, cy - 5), min(h, cy + 6)):
            for x in range(max(0, cx - 5), min(w, cx + 6)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= 25:
                    px[y][x] = rgb565(20, 98, 38)
                elif (x - cx) ** 2 + (y - cy) ** 2 <= 36:
                    px[y][x] = rgb565(42, 80, 38)

    # Goblin dots
    goblins = [(56, 30), (60, 31), (62, 35), (58, 38), (52, 34)]
    for gx, gy in goblins:
        for y in range(max(0, gy - 1), min(h, gy + 2)):
            for x in range(max(0, gx - 1), min(w, gx + 2)):
                px[y][x] = rgb565(45, 220, 80)

    flat = []
    for row in px:
        flat.extend(row)

    data = {
        "version": 1,
        "format": "rgb565",
        "width": w,
        "height": h,
        "pixels": flat,
    }
    with open(OUT_ENV, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))


def main():
    make_sprites_pack()
    build_env_bitmap()
    print("wrote", OUT_SPRITES)
    print("wrote", OUT_ENV)


if __name__ == "__main__":
    main()
