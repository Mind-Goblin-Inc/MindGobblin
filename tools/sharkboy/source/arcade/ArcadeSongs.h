#pragma once

namespace Music {

struct SongDef {
  const char *title;
  const char *style;
  const char *abc;
};

enum SongIndex : uint8_t {
  SONG_NOCTURNE,
  SONG_NEON_SPRINT,
  SONG_HARBOR_WALTZ,
  SONG_DUST_ROAD,
  SONG_MIDNIGHT_TRAIN,
  SONG_CLOUDSTEP,
  SONG_CAVE_ECHO,
  SONG_PIXEL_PARADE,
  SONG_SUNSET_BOSSA,
  SONG_IRON_MARCH
};

// Two voices keep every arrangement playable on the arcade's two buzzers.
const SongDef SONGS[] = {
  {"D MINOR NOCTURNE", "CLASSICAL / 76 BPM", R"ABC(
X:1
T:Nocturne in D Minor
C:Original
M:3/4
L:1/8
Q:1/4=76
K:Dm
[V:RH]
A2 d2 f2 | e2 d2 c2 | A2 ^c2 e2 | d4 A2 |
f2 a2 g2 | f2 e2 d2 | c2 e2 g2 | f4 e2 |
d2 f2 a2 | c'2 a2 f2 | e2 g2 b2 | a4 g2 |
f2 e2 d2 | ^c2 e2 A2 | d2 f2 e2 | d6 |
A2 d2 f2 | a2 g2 f2 | e2 c2 A2 | G4 A2 |
B2 d2 g2 | f2 e2 d2 | ^c2 A2 e2 | d4 A2 |
d2 e2 f2 | g2 a2 b2 | a2 f2 d2 | c'4 a2 |
g2 e2 c2 | A2 ^c2 e2 | f2 e2 ^c2 | d6 |]
[V:LH]
D,2 A,2 D2 | C,2 G,2 C2 | A,,2 E,2 A,2 | D,2 A,2 D2 |
D,2 A,2 D2 | B,,2 F,2 B,2 | C,2 G,2 C2 | F,2 C2 A2 |
D,2 A,2 D2 | F,2 C2 F2 | E,2 B,2 E2 | A,,2 E,2 A,2 |
D,2 A,2 D2 | A,,2 E,2 A,2 | D,2 A,2 A2 | D,6 |
D,2 A,2 D2 | F,2 C2 F2 | C,2 G,2 C2 | G,,2 D,2 G,2 |
G,2 D2 G2 | B,,2 F,2 B,2 | A,,2 E,2 A,2 | D,2 A,2 D2 |
D,2 A,2 D2 | G,2 D2 G2 | F,2 C2 F2 | F,2 C2 F2 |
C,2 G,2 C2 | A,,2 E,2 A,2 | A,,2 E,2 A,2 | D,6 |]
)ABC"},
  {"NEON SPRINT", "SYNTHWAVE / 148 BPM", R"ABC(
X:2
T:Neon Sprint
M:4/4
L:1/8
Q:1/4=148
K:Em
[V:RH]
E2 G2 B2 e2 | d2 B2 G2 E2 | G B e B G B e B | a2 g2 e2 d2 |
E2 G2 B2 e2 | d2 B2 A2 G2 | F2 A2 d2 c2 | B4 z2 B2 |
e2 e2 d2 B2 | G2 B2 e2 g2 | f2 d2 B2 A2 | G4 z2 E2 |
G B e g f d B A | G2 E2 F2 G2 | A2 B2 d2 f2 | e8 |]
[V:LH]
E,2 z2 B,2 z2 | E,2 z2 B,2 z2 | C,2 z2 G,2 z2 | D,2 z2 A,2 z2 |
E,2 z2 B,2 z2 | E,2 z2 B,2 z2 | D,2 z2 A,2 z2 | B,,2 z2 F,2 z2 |
C,2 z2 G,2 z2 | C,2 z2 G,2 z2 | D,2 z2 A,2 z2 | E,2 z2 B,2 z2 |
C,2 z2 G,2 z2 | E,2 z2 B,2 z2 | B,,2 z2 F,2 z2 | E,8 |]
)ABC"},
  {"HARBOR WALTZ", "WALTZ / 96 BPM", R"ABC(
X:3
T:Harbor Waltz
M:3/4
L:1/8
Q:1/4=96
K:G
[V:RH]
B2 d2 g2 | f2 e2 d2 | c2 e2 a2 | g4 d2 |
B2 d2 g2 | a2 g2 f2 | e2 d2 c2 | B6 |
d2 g2 b2 | a2 g2 f2 | e2 a2 c'2 | b4 g2 |
f2 e2 d2 | c2 B2 A2 | G2 B2 d2 | g6 |]
[V:LH]
G,2 D2 B2 | D,2 A,2 F2 | C,2 G,2 E2 | G,2 D2 B2 |
G,2 D2 B2 | D,2 A,2 F2 | C,2 G,2 E2 | G,6 |
G,2 D2 B2 | D,2 A,2 F2 | C,2 G,2 E2 | G,2 D2 B2 |
D,2 A,2 F2 | C,2 G,2 E2 | G,2 D2 B2 | G,6 |]
)ABC"},
  {"DUST ROAD", "COUNTRY / 112 BPM", R"ABC(
X:4
T:Dust Road
M:4/4
L:1/8
Q:1/4=112
K:C
[V:RH]
E2 G2 A2 G2 | E2 D2 C4 | E G A c B A G E | D2 G2 G4 |
E2 G2 A2 c2 | d2 c2 A2 G2 | E G E D C2 D2 | C8 |
G2 G2 E2 C2 | A2 A2 G4 | c2 d2 e2 d2 | c2 A2 G4 |
E G A c B A G E | D2 G2 B2 d2 | c2 A2 G2 E2 | C8 |]
[V:LH]
C,2 G,2 C2 G,2 | F,2 C2 F2 C2 | A,2 E2 A2 E2 | G,2 D2 G2 D2 |
C,2 G,2 C2 G,2 | F,2 C2 F2 C2 | G,2 D2 G2 D2 | C,8 |
C,2 G,2 C2 G,2 | F,2 C2 F2 C2 | A,2 E2 A2 E2 | G,2 D2 G2 D2 |
C,2 G,2 C2 G,2 | G,2 D2 G2 D2 | F,2 C2 G,2 D2 | C,8 |]
)ABC"},
  {"MIDNIGHT TRAIN", "BLUES / 132 BPM", R"ABC(
X:5
T:Midnight Train
M:4/4
L:1/8
Q:1/4=132
K:Am
[V:RH]
A2 C2 D2 ^D2 | E2 G2 E2 D2 | C2 A2 C2 D2 | E4 z2 E2 |
A2 C2 D2 ^D2 | E2 G2 A2 G2 | E2 D2 C2 A2 | G4 z2 E2 |
A C D ^D E G E D | C2 A2 C2 E2 | G2 A2 c2 A2 | G4 E2 D2 |
C2 D2 E2 G2 | A2 G2 E2 D2 | C2 A2 G2 E2 | A8 |]
[V:LH]
A,,2 E,2 G,2 E,2 | A,,2 E,2 G,2 E,2 | D,2 A,2 C2 A,2 | A,,2 E,2 G,2 E,2 |
A,,2 E,2 G,2 E,2 | D,2 A,2 C2 A,2 | E,2 B,2 D2 B,2 | A,,2 E,2 G,2 E,2 |
A,,2 E,2 G,2 E,2 | A,,2 E,2 G,2 E,2 | D,2 A,2 C2 A,2 | E,2 B,2 D2 B,2 |
A,,2 E,2 G,2 E,2 | D,2 A,2 C2 A,2 | E,2 B,2 D2 B,2 | A,,8 |]
)ABC"},
  {"CLOUDSTEP", "DANCE / 124 BPM", R"ABC(
X:6
T:Cloudstep
M:4/4
L:1/8
Q:1/4=124
K:D
[V:RH]
z2 A2 d2 f2 | e2 d2 A2 z2 | z2 A2 d2 e2 | f4 e2 d2 |
z2 A2 d2 f2 | a2 f2 e2 d2 | B2 d2 e2 f2 | d6 z2 |
f2 f2 e2 d2 | A2 d2 f2 a2 | g2 f2 e2 d2 | B4 z2 A2 |
d2 f2 a2 f2 | e2 d2 A2 B2 | d2 e2 f2 e2 | d8 |]
[V:LH]
D,2 z2 A,2 z2 | D,2 z2 A,2 z2 | G,2 z2 D2 z2 | A,,2 z2 E,2 z2 |
D,2 z2 A,2 z2 | D,2 z2 A,2 z2 | G,2 z2 D2 z2 | D,2 z2 A,2 z2 |
B,,2 z2 F,2 z2 | B,,2 z2 F,2 z2 | G,2 z2 D2 z2 | A,,2 z2 E,2 z2 |
D,2 z2 A,2 z2 | G,2 z2 D2 z2 | A,,2 z2 E,2 z2 | D,8 |]
)ABC"},
  {"CAVE ECHO", "AMBIENT / 58 BPM", R"ABC(
X:7
T:Cave Echo
M:4/4
L:1/8
Q:1/4=58
K:Em
[V:RH]
E4 z2 G2 | B6 z2 | a4 g2 e2 | d8 |
E4 z2 B2 | g6 z2 | f4 e2 d2 | B8 |
G4 z2 A2 | B6 z2 | e4 d2 B2 | G8 |
A4 z2 G2 | F4 E2 D2 | E4 B4 | e8 |]
[V:LH]
E,8 | B,,8 | C,8 | G,,8 |
E,8 | C,8 | D,8 | B,,8 |
C,8 | G,,8 | E,8 | B,,8 |
C,8 | D,8 | B,,8 | E,8 |]
)ABC"},
  {"PIXEL PARADE", "CHIPTUNE / 160 BPM", R"ABC(
X:8
T:Pixel Parade
M:4/4
L:1/8
Q:1/4=160
K:C
[V:RH]
C E G c G E C E | D F A d A F D F | E G c e c G E G | G B d g d B G B |
c2 c2 e2 g2 | a2 g2 e2 c2 | d e f d B G D B, | C4 z2 G2 |
C E G c G E C E | D F A d A F D F | E G c e c G E G | G B d g d B G B |
c2 e2 g2 e2 | d2 f2 a2 f2 | e d c B A G F D | C8 |]
[V:LH]
C,2 G,2 C2 G,2 | D,2 A,2 D2 A,2 | E,2 B,2 E2 B,2 | G,2 D2 G2 D2 |
F,2 C2 F2 C2 | F,2 C2 F2 C2 | G,2 D2 G2 D2 | C,4 z2 G,2 |
C,2 G,2 C2 G,2 | D,2 A,2 D2 A,2 | E,2 B,2 E2 B,2 | G,2 D2 G2 D2 |
F,2 C2 F2 C2 | G,2 D2 G2 D2 | G,2 D2 G2 D2 | C,8 |]
)ABC"},
  {"SUNSET BOSSA", "BOSSA / 104 BPM", R"ABC(
X:9
T:Sunset Bossa
M:4/4
L:1/8
Q:1/4=104
K:F
[V:RH]
A2 c2 z2 a2 | g2 f2 e2 c2 | A2 c2 f2 e2 | d4 z2 c2 |
A2 c2 z2 a2 | g2 f2 e2 d2 | c2 A2 G2 F2 | F6 z2 |
c2 e2 g2 e2 | f2 d2 c2 A2 | B2 d2 f2 d2 | c4 z2 A2 |
G2 A2 c2 e2 | f2 e2 d2 c2 | A2 G2 F2 E2 | F8 |]
[V:LH]
F,2 z2 C2 z2 | C,2 z2 G,2 z2 | F,2 z2 C2 z2 | B,,2 z2 F,2 z2 |
F,2 z2 C2 z2 | C,2 z2 G,2 z2 | B,,2 z2 F,2 z2 | F,8 |
C,2 z2 G,2 z2 | D,2 z2 A,2 z2 | B,,2 z2 F,2 z2 | C,2 z2 G,2 z2 |
B,,2 z2 F,2 z2 | C,2 z2 G,2 z2 | F,2 z2 C2 z2 | F,8 |]
)ABC"},
  {"IRON MARCH", "CINEMATIC / 138 BPM", R"ABC(
X:10
T:Iron March
M:4/4
L:1/8
Q:1/4=138
K:Gm
[V:RH]
G2 G2 d2 B2 | A2 G2 F4 | G2 B2 d2 g2 | f4 d4 |
G2 G2 d2 B2 | c2 B2 A2 G2 | F2 A2 c2 d2 | G8 |
d2 d2 g2 f2 | e2 d2 c4 | B2 d2 g2 a2 | g4 d4 |
G2 B2 d2 f2 | g2 f2 d2 B2 | A2 F2 G2 A2 | G8 |]
[V:LH]
G,2 D2 G,2 D2 | F,2 C2 F,2 C2 | E,2 B,2 E,2 B,2 | D,2 A,2 D2 A,2 |
G,2 D2 G,2 D2 | E,2 B,2 E,2 B,2 | F,2 C2 D,2 A,2 | G,8 |
G,2 D2 G,2 D2 | C,2 G,2 C2 G,2 | E,2 B,2 E,2 B,2 | D,2 A,2 D2 A,2 |
G,2 D2 G,2 D2 | E,2 B,2 E,2 B,2 | F,2 C2 D,2 A,2 | G,8 |]
)ABC"}
};

constexpr uint8_t SONG_COUNT = sizeof(SONGS) / sizeof(SONGS[0]);

}  // namespace Music
