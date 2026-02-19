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


def fish_sprite():
    s = make_sprite()
    rect(s, 4, 7, 7, 3, 12)
    put(s, 3, 8, 12)
    put(s, 11, 7, 12)
    put(s, 11, 9, 12)
    put(s, 12, 8, 7)
    put(s, 6, 8, 1)
    return s


def deer_sprite():
    s = make_sprite()
    rect(s, 5, 8, 6, 4, 4)
    rect(s, 10, 7, 3, 3, 4)
    rect(s, 6, 12, 1, 3, 4)
    rect(s, 9, 12, 1, 3, 4)
    put(s, 12, 8, 7)
    put(s, 13, 7, 10)
    put(s, 13, 6, 10)
    return s


def wolf_sprite():
    s = make_sprite()
    rect(s, 4, 8, 8, 3, 5)
    rect(s, 10, 7, 3, 2, 5)
    rect(s, 5, 11, 1, 3, 5)
    rect(s, 9, 11, 1, 3, 5)
    put(s, 3, 9, 5)
    put(s, 12, 7, 7)
    put(s, 13, 7, 8)
    return s


def barbarian_sprite():
    s = make_sprite()
    circle(s, 8, 5, 3, 7)
    rect(s, 5, 8, 6, 6, 4)
    rect(s, 11, 9, 2, 1, 6)
    put(s, 13, 9, 8)
    put(s, 7, 5, 1)
    put(s, 9, 5, 1)
    return s


def pine_tree_sprite():
    s = make_sprite()
    rect(s, 7, 12, 2, 3, 4)
    for y in range(3, 13):
        span = 1 + (y - 3) // 2
        for x in range(8 - span, 9 + span):
            put(s, x, y, 3 if (x + y) % 3 else 11)
    put(s, 8, 2, 11)
    return s


def dead_tree_sprite():
    s = make_sprite()
    rect(s, 7, 6, 2, 9, 4)
    rect(s, 5, 7, 2, 1, 5)
    rect(s, 9, 8, 2, 1, 5)
    rect(s, 4, 9, 2, 1, 5)
    rect(s, 10, 10, 2, 1, 5)
    put(s, 8, 5, 6)
    return s


def berry_bush_sprite():
    s = make_sprite()
    circle(s, 8, 9, 5, 3)
    put(s, 6, 8, 8)
    put(s, 9, 7, 8)
    put(s, 10, 10, 8)
    put(s, 7, 11, 8)
    put(s, 8, 6, 11)
    return s


def fern_sprite():
    s = make_sprite()
    for y in range(7, 14):
        put(s, 8, y, 11)
    for i in range(5):
        put(s, 8 - i, 10 - i, 3)
        put(s, 8 + i, 10 - i, 3)
        put(s, 8 - i, 11 + i, 3)
        put(s, 8 + i, 11 + i, 3)
    return s


def reed_sprite():
    s = make_sprite()
    for x in (6, 8, 10):
        for y in range(5, 15):
            put(s, x, y, 11 if (x + y) % 4 else 3)
    for x in (5, 7, 9, 11):
        put(s, x, 5, 10)
        put(s, x, 6, 10)
    return s


def flower_red_sprite():
    s = make_sprite()
    rect(s, 7, 9, 2, 6, 11)
    put(s, 8, 8, 10)
    for dx, dy in [(-1, -1), (0, -2), (1, -1), (-1, 0), (1, 0)]:
        put(s, 8 + dx, 8 + dy, 8)
    return s


def flower_blue_sprite():
    s = make_sprite()
    rect(s, 7, 9, 2, 6, 11)
    put(s, 8, 8, 10)
    for dx, dy in [(-1, -1), (0, -2), (1, -1), (-1, 0), (1, 0)]:
        put(s, 8 + dx, 8 + dy, 12)
    return s


def sapling_sprite():
    s = make_sprite()
    rect(s, 7, 10, 2, 5, 4)
    circle(s, 8, 8, 3, 11)
    put(s, 6, 9, 3)
    put(s, 10, 9, 3)
    return s


def rabbit_sprite():
    s = make_sprite()
    rect(s, 6, 9, 5, 3, 6)
    rect(s, 10, 8, 2, 2, 6)
    rect(s, 10, 5, 1, 3, 6)
    rect(s, 11, 5, 1, 3, 6)
    put(s, 11, 8, 1)
    put(s, 5, 10, 6)
    return s


def boar_sprite():
    s = make_sprite()
    rect(s, 4, 8, 8, 4, 4)
    rect(s, 11, 9, 2, 2, 4)
    rect(s, 5, 12, 1, 3, 4)
    rect(s, 9, 12, 1, 3, 4)
    put(s, 12, 10, 7)
    put(s, 13, 10, 7)
    return s


def crow_sprite():
    s = make_sprite()
    rect(s, 5, 8, 6, 3, 1)
    put(s, 10, 8, 6)
    put(s, 11, 9, 9)
    put(s, 4, 9, 1)
    put(s, 6, 11, 5)
    put(s, 8, 11, 5)
    return s


def snake_sprite():
    s = make_sprite()
    for i in range(10):
        x = 3 + i
        y = 9 + ((i % 3) - 1)
        put(s, x, y, 11)
    put(s, 12, 8, 7)
    put(s, 13, 8, 8)
    return s


def bear_sprite():
    s = make_sprite()
    circle(s, 8, 9, 5, 5)
    circle(s, 6, 6, 2, 5)
    circle(s, 10, 6, 2, 5)
    put(s, 7, 8, 1)
    put(s, 9, 8, 1)
    put(s, 8, 10, 7)
    return s


def goblin_child_sprite():
    s = make_sprite()
    circle(s, 8, 6, 2, 11)
    rect(s, 6, 8, 4, 4, 3)
    put(s, 7, 6, 8)
    put(s, 9, 6, 8)
    put(s, 6, 12, 4)
    put(s, 9, 12, 4)
    return s


def shaman_sprite():
    s = make_sprite()
    circle(s, 8, 5, 3, 11)
    rect(s, 5, 8, 6, 6, 13)
    rect(s, 3, 7, 2, 1, 10)
    rect(s, 4, 8, 1, 5, 10)
    put(s, 7, 5, 7)
    put(s, 9, 5, 7)
    put(s, 8, 3, 10)
    return s


def human_raider_sprite():
    s = make_sprite()
    circle(s, 8, 5, 3, 7)
    rect(s, 5, 8, 6, 6, 2)
    rect(s, 11, 9, 2, 1, 6)
    put(s, 13, 9, 8)
    put(s, 7, 5, 1)
    put(s, 9, 5, 1)
    return s


def elf_ranger_sprite():
    s = make_sprite()
    circle(s, 8, 5, 3, 7)
    put(s, 4, 5, 11)
    put(s, 12, 5, 11)
    rect(s, 5, 8, 6, 6, 3)
    rect(s, 11, 9, 2, 1, 6)
    put(s, 13, 9, 10)
    return s


def ogre_sprite():
    s = make_sprite()
    circle(s, 8, 5, 4, 4)
    rect(s, 4, 8, 8, 7, 5)
    rect(s, 12, 10, 2, 2, 6)
    put(s, 7, 5, 1)
    put(s, 10, 5, 1)
    put(s, 8, 7, 7)
    return s


def spring_turret_sprite():
    s = make_sprite()
    rect(s, 4, 10, 8, 3, 5)
    rect(s, 7, 7, 2, 4, 6)
    rect(s, 8, 5, 5, 2, 6)
    put(s, 13, 5, 9)
    put(s, 6, 11, 10)
    put(s, 9, 11, 10)
    # spring coil accent
    for x in range(5, 11):
        put(s, x, 9 + (x % 2), 13)
    return s


def spike_trap_sprite():
    s = make_sprite()
    rect(s, 3, 11, 10, 2, 4)
    for i in range(5):
        put(s, 4 + i * 2, 10, 6)
        put(s, 4 + i * 2, 9, 7)
    put(s, 3, 12, 5)
    put(s, 12, 12, 5)
    return s


def snare_line_sprite():
    s = make_sprite()
    rect(s, 4, 11, 8, 1, 4)
    for x in range(4, 12):
        if x % 2 == 0:
            put(s, x, 10, 6)
    circle(s, 10, 8, 2, 6)
    put(s, 10, 8, 0)
    put(s, 5, 8, 11)
    put(s, 5, 9, 11)
    put(s, 5, 10, 11)
    return s


def watchtower_sprite():
    s = make_sprite()
    rect(s, 6, 4, 4, 2, 6)
    rect(s, 5, 6, 6, 2, 5)
    rect(s, 6, 8, 1, 6, 4)
    rect(s, 9, 8, 1, 6, 4)
    rect(s, 7, 9, 2, 1, 5)
    put(s, 7, 5, 8)
    put(s, 8, 5, 8)
    put(s, 5, 8, 6)
    put(s, 10, 8, 6)
    return s


def alarm_gong_sprite():
    s = make_sprite()
    rect(s, 4, 4, 8, 1, 6)
    rect(s, 5, 5, 1, 8, 4)
    rect(s, 10, 5, 1, 8, 4)
    circle(s, 8, 8, 3, 9)
    put(s, 8, 8, 10)
    rect(s, 2, 9, 2, 1, 6)
    put(s, 3, 8, 5)
    return s


def workshop_bench_sprite():
    s = make_sprite()
    rect(s, 4, 8, 8, 2, 4)
    rect(s, 5, 10, 1, 4, 5)
    rect(s, 10, 10, 1, 4, 5)
    # anvil/tool silhouette
    rect(s, 6, 6, 4, 1, 6)
    rect(s, 7, 5, 2, 1, 6)
    put(s, 9, 6, 10)
    put(s, 10, 5, 10)
    return s


def cistern_pump_sprite():
    s = make_sprite()
    circle(s, 8, 9, 4, 12)
    circle(s, 8, 9, 3, 1)
    rect(s, 7, 4, 2, 3, 6)
    rect(s, 9, 4, 3, 1, 6)
    put(s, 12, 4, 7)
    put(s, 8, 9, 7)
    return s


def smokehouse_sprite():
    s = make_sprite()
    rect(s, 4, 7, 8, 6, 4)
    rect(s, 6, 5, 4, 2, 5)
    rect(s, 7, 9, 2, 4, 1)
    put(s, 8, 4, 6)
    put(s, 9, 3, 13)
    put(s, 10, 2, 13)
    return s


def medic_hut_sprite():
    s = make_sprite()
    rect(s, 4, 7, 8, 6, 3)
    rect(s, 6, 5, 4, 2, 5)
    rect(s, 7, 9, 2, 4, 1)
    rect(s, 7, 7, 2, 4, 7)
    rect(s, 6, 8, 4, 2, 7)
    return s


def signal_beacon_sprite():
    s = make_sprite()
    rect(s, 7, 7, 2, 7, 4)
    put(s, 8, 6, 6)
    put(s, 8, 5, 9)
    put(s, 7, 4, 10)
    put(s, 9, 4, 10)
    # signal rays
    put(s, 6, 3, 7)
    put(s, 10, 3, 7)
    put(s, 5, 2, 6)
    put(s, 11, 2, 6)
    return s


def gatehouse_mechanism_sprite():
    s = make_sprite()
    rect(s, 3, 9, 10, 4, 5)
    rect(s, 5, 7, 6, 2, 6)
    rect(s, 7, 10, 2, 3, 1)
    circle(s, 5, 11, 2, 6)
    circle(s, 11, 11, 2, 6)
    put(s, 5, 11, 1)
    put(s, 11, 11, 1)
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


def grass_tile_variant(seed):
    s = make_sprite(fill=3)
    for y in range(H):
        for x in range(W):
            n = (x * (11 + seed) + y * (7 + seed * 2) + seed * 13) % 37
            if n < 4:
                put(s, x, y, 11)
            elif n in (9, 10):
                put(s, x, y, 10)
            elif (x + y + seed) % 11 == 0:
                put(s, x, y, 6)
    return s


def swamp_tile_variant(seed):
    s = make_sprite(fill=1)
    for y in range(H):
        for x in range(W):
            n = (x * (9 + seed) + y * (5 + seed) + seed * 17) % 41
            if n < 8:
                put(s, x, y, 3)
            elif n in (11, 12, 13):
                put(s, x, y, 12)
            elif (x + y + seed) % 9 == 0:
                put(s, x, y, 5)
    return s


def hills_tile_variant(seed):
    s = make_sprite(fill=4)
    for y in range(H):
        for x in range(W):
            n = (x * (7 + seed) + y * (13 + seed) + seed * 19) % 47
            if n < 10:
                put(s, x, y, 5)
            elif n in (20, 21, 22):
                put(s, x, y, 6)
            elif (x * 3 + y + seed) % 12 == 0:
                put(s, x, y, 10)
    return s


def caves_tile_variant(seed):
    s = make_sprite(fill=5)
    for y in range(H):
        for x in range(W):
            n = (x * (5 + seed) + y * (11 + seed * 2) + seed * 23) % 43
            if n < 11:
                put(s, x, y, 1)
            elif n in (16, 17):
                put(s, x, y, 6)
            elif (x + y * 2 + seed) % 13 == 0:
                put(s, x, y, 13)
    return s


def ruins_tile_variant(seed):
    s = make_sprite(fill=5)
    for y in range(H):
        for x in range(W):
            n = (x * (13 + seed) + y * (9 + seed) + seed * 7) % 53
            if n < 9:
                put(s, x, y, 4)
            elif n in (15, 16, 17):
                put(s, x, y, 6)
            elif (x * 2 + y + seed) % 10 == 0:
                put(s, x, y, 7)
    return s


def badlands_tile_variant(seed):
    s = make_sprite(fill=4)
    for y in range(H):
        for x in range(W):
            n = (x * (15 + seed) + y * (3 + seed) + seed * 29) % 59
            if n < 12:
                put(s, x, y, 9)
            elif n in (21, 22, 23):
                put(s, x, y, 10)
            elif (x + y + seed) % 8 == 0:
                put(s, x, y, 5)
    return s


def make_sprites_pack():
    sprites = {
        "goblin": goblin_sprite(),
        "tree": tree_sprite(),
        "rock": rock_sprite(),
        "mushroom": mushroom_sprite(),
        "fish": fish_sprite(),
        "deer": deer_sprite(),
        "wolf": wolf_sprite(),
        "barbarian": barbarian_sprite(),
        "pine_tree": pine_tree_sprite(),
        "dead_tree": dead_tree_sprite(),
        "berry_bush": berry_bush_sprite(),
        "fern": fern_sprite(),
        "reed": reed_sprite(),
        "flower_red": flower_red_sprite(),
        "flower_blue": flower_blue_sprite(),
        "sapling": sapling_sprite(),
        "rabbit": rabbit_sprite(),
        "boar": boar_sprite(),
        "crow": crow_sprite(),
        "snake": snake_sprite(),
        "bear": bear_sprite(),
        "goblin_child": goblin_child_sprite(),
        "shaman": shaman_sprite(),
        "human_raider": human_raider_sprite(),
        "elf_ranger": elf_ranger_sprite(),
        "ogre": ogre_sprite(),
        "spring_turret": spring_turret_sprite(),
        "spike_trap": spike_trap_sprite(),
        "snare_line": snare_line_sprite(),
        "watchtower": watchtower_sprite(),
        "alarm_gong": alarm_gong_sprite(),
        "workshop_bench": workshop_bench_sprite(),
        "cistern_pump": cistern_pump_sprite(),
        "smokehouse": smokehouse_sprite(),
        "medic_hut": medic_hut_sprite(),
        "signal_beacon": signal_beacon_sprite(),
        "gatehouse_mechanism": gatehouse_mechanism_sprite(),
        "water_tile": water_tile(),
        "grass_tile": grass_tile(),
        "grass_tile_2": grass_tile_variant(2),
        "grass_tile_3": grass_tile_variant(3),
        "grass_tile_4": grass_tile_variant(4),
        "grass_tile_5": grass_tile_variant(5),
        "grass_tile_6": grass_tile_variant(6),
        "grass_tile_7": grass_tile_variant(7),
        "grass_tile_8": grass_tile_variant(8),
        "swamp_tile_1": swamp_tile_variant(1),
        "swamp_tile_2": swamp_tile_variant(2),
        "swamp_tile_3": swamp_tile_variant(3),
        "swamp_tile_4": swamp_tile_variant(4),
        "swamp_tile_5": swamp_tile_variant(5),
        "swamp_tile_6": swamp_tile_variant(6),
        "swamp_tile_7": swamp_tile_variant(7),
        "swamp_tile_8": swamp_tile_variant(8),
        "hills_tile_1": hills_tile_variant(1),
        "hills_tile_2": hills_tile_variant(2),
        "hills_tile_3": hills_tile_variant(3),
        "hills_tile_4": hills_tile_variant(4),
        "hills_tile_5": hills_tile_variant(5),
        "hills_tile_6": hills_tile_variant(6),
        "hills_tile_7": hills_tile_variant(7),
        "hills_tile_8": hills_tile_variant(8),
        "caves_tile_1": caves_tile_variant(1),
        "caves_tile_2": caves_tile_variant(2),
        "caves_tile_3": caves_tile_variant(3),
        "caves_tile_4": caves_tile_variant(4),
        "caves_tile_5": caves_tile_variant(5),
        "caves_tile_6": caves_tile_variant(6),
        "caves_tile_7": caves_tile_variant(7),
        "caves_tile_8": caves_tile_variant(8),
        "ruins_tile_1": ruins_tile_variant(1),
        "ruins_tile_2": ruins_tile_variant(2),
        "ruins_tile_3": ruins_tile_variant(3),
        "ruins_tile_4": ruins_tile_variant(4),
        "ruins_tile_5": ruins_tile_variant(5),
        "ruins_tile_6": ruins_tile_variant(6),
        "ruins_tile_7": ruins_tile_variant(7),
        "ruins_tile_8": ruins_tile_variant(8),
        "badlands_tile_1": badlands_tile_variant(1),
        "badlands_tile_2": badlands_tile_variant(2),
        "badlands_tile_3": badlands_tile_variant(3),
        "badlands_tile_4": badlands_tile_variant(4),
        "badlands_tile_5": badlands_tile_variant(5),
        "badlands_tile_6": badlands_tile_variant(6),
        "badlands_tile_7": badlands_tile_variant(7),
        "badlands_tile_8": badlands_tile_variant(8),
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
