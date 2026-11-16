#pragma once
#include <Arduino.h>
#include <math.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include "GameAPI.h"
#include "Hardware.h"
#include "MusicPlayer.h"
#include "MenuFooter.h"

namespace DeepHook {

// ============================================================
// Deep Hook — Jakeboy Arcade
// Fixed-step ocean fishing game for ESP32/ST7789.
// The launcher owns display, GPIO setup, SPI, menu, and universal exit.
// ============================================================

#define RGB565(r,g,b) ((uint16_t)((((uint16_t)(r) & 0xF8u) << 8) | (((uint16_t)(g) & 0xFCu) << 3) | ((uint16_t)(b) >> 3)))

constexpr int16_t SCREEN_W = 240;
constexpr int16_t SCREEN_H = 320;
constexpr int16_t HUD_TOP_H = 32;
constexpr int16_t WATER_TOP = 32;
constexpr int16_t WATER_BOTTOM = 288;
constexpr int16_t HUD_BOTTOM_H = 32;

constexpr int16_t TILE_W = 16;
constexpr int16_t TILE_H = 16;
constexpr int16_t TILE_COLS = 15;
constexpr int16_t TILE_ROWS = 20;
constexpr int16_t TILE_COUNT = TILE_COLS * TILE_ROWS;
constexpr int16_t COMPOSE_MAX_W = 240;
constexpr int16_t COMPOSE_MAX_H = 16;

constexpr uint8_t MAX_FISH = 30;
constexpr uint8_t MAX_GIANTS = 2;
constexpr uint8_t MAX_PARTICLES = 18;
constexpr uint8_t MAX_SCHOOL = 7;
constexpr uint8_t MAX_COLLISION_PARTS = 8;
constexpr uint8_t INVALID_SPECIES = 255;
constexpr uint16_t SPECIES_COUNT = 47;

// Three intentionally separate scales:
// - World motion keeps the original on-screen descent speed.
// - Biome depth advances 10x more slowly, stretching every existing region
//   to roughly ten times its former travel distance.
// - Player-facing feet advance 100x more slowly than the old HUD, so about
//   25 world pixels of descent is now 1 displayed foot instead of 100 feet.
constexpr float MOTION_FEET_PER_WORLD_PIXEL = 4.0f;
constexpr float BIOME_UNITS_PER_WORLD_PIXEL = 0.40f;
constexpr float DISPLAY_FEET_PER_WORLD_PIXEL = 0.04f;
constexpr float FINAL_REGION_BIOME_DEPTH = 5000.0f;
constexpr float FINAL_RARITY_RAMP_DEPTH = 4000.0f;
constexpr float HOOK_ANCHOR_Y = 134.4f;
constexpr float CAMERA_SURFACE_CLAMP = -72.0f;

// Keep a small pipeline of fish swimming well below the visible playfield.
// At maximum sustained descent (including frequent straight jigs), these lanes
// get roughly 5-7 seconds of simulation before the hook reaches them, giving
// even slow Drifters time to cross toward the middle instead of spawning too
// late at the side edges.
constexpr float FISH_PRELOAD_MIN_SCREEN_Y = WATER_BOTTOM + 280.0f;
constexpr float FISH_PRELOAD_MAX_SCREEN_Y = WATER_BOTTOM + 460.0f;
constexpr float FISH_PRELOAD_TRACK_SCREEN_Y = WATER_BOTTOM + 28.0f;
constexpr float FISH_PRELOAD_CULL_SCREEN_Y = FISH_PRELOAD_MAX_SCREEN_Y + 100.0f;
constexpr uint8_t FISH_PRELOAD_TARGET = 6;

constexpr uint32_t FIXED_US = 16667u;
constexpr float FIXED_DT = 1.0f / 60.0f;
constexpr uint8_t MAX_CATCHUP = 4;
constexpr uint32_t MAX_ELAPSED_US = 100000u;
constexpr uint32_t RENDER_50_US = 20000u;
constexpr uint32_t RENDER_40_US = 25000u;
constexpr uint32_t RENDER_30_US = 33333u;

constexpr float JIG_DURATION = 0.120f;
constexpr float JIG_COOLDOWN = 1.250f;
constexpr uint32_t JIG_CHORD_MS = 80u;
constexpr uint32_t BUTTON_DEBOUNCE_MS = 8u;
constexpr uint32_t SWITCH_DEBOUNCE_MS = 12u;

constexpr float LIGHT_STEER = 54.0f;
constexpr float HOOK_RADIUS = 2.0f;
constexpr float HOOK_MIN_X = 5.0f;
constexpr float HOOK_MAX_X = 234.0f;
constexpr float COLLISION_EPS = 0.0001f;
constexpr float DH_PI = 3.14159265358979323846f;

// Cast intro is one continuous scene. Fish are already present while the
// hook leaves the boat, crosses the surface, and descends into playable water.
constexpr float INTRO_TOTAL_SEC = 1.60f;
constexpr float INTRO_SURFACE_SEC = 0.35f;
constexpr float INTRO_END_WORLD_Y = 45.0f; // ~1.8 displayed ft; continues seamlessly from here.

// Current launcher exits after 700 ms of both buttons held.
// Stop only DeepHook-owned tones safely before that handoff.
constexpr uint32_t EXIT_AUDIO_GUARD_MS = 450u;

enum class Phase : uint8_t {
  Title,
  CastIntro,
  Descending,
  HookedFreeze,
  Reeling,
  CatchReveal,
  PlayerHandoff,
  FinalResults
};

enum class Tension : int8_t { Up = -1, Center = 0, Down = 1 };
enum class JigDirection : int8_t { Left = -1, Straight = 0, Right = 1 };
enum class SizeClass : uint8_t { Small, Average, GoodSize, Large, Trophy, Monster };
enum class Behavior : uint8_t { Drifter, Cruiser, Runner, Weaver, Burst, Curious };
enum class Shape : uint8_t {
  Bait, Perch, Oval, Mahi, Tuna, Billfish, Sailfish,
  Ribbon, Shark, Frilled, Squid, Angler, Ray,
  Hatchet, Barreleye, Coelacanth
};
enum SpeciesFlags : uint8_t { F_SCHOOL = 1, F_GIANT = 2, F_BIOLUME = 4 };
enum class JigRecognize : uint8_t { Idle, WaitingSecond, WaitRelease };
enum class SfxId : uint8_t { None, Splash, JigLeft, JigRight, JigStraight, Ready, Hook, ReelTick, Trophy, Monster, Empty };
enum class ParticleKind : uint8_t { Bubble, Trail, Impact, Spark };

struct Vec2 {
  float x, y;
  Vec2() : x(0), y(0) {}
  Vec2(float px, float py) : x(px), y(py) {}
};
static inline Vec2 operator+(const Vec2& a, const Vec2& b) { return Vec2(a.x+b.x, a.y+b.y); }
static inline Vec2 operator-(const Vec2& a, const Vec2& b) { return Vec2(a.x-b.x, a.y-b.y); }
static inline Vec2 operator*(const Vec2& a, float s) { return Vec2(a.x*s, a.y*s); }

struct RectF { float x0, y0, x1, y1; };
struct RectI {
  int16_t x0, y0, x1, y1;
  RectI() : x0(0), y0(0), x1(0), y1(0) {}
  RectI(int16_t a,int16_t b,int16_t c,int16_t d):x0(a),y0(b),x1(c),y1(d){}
};

struct SpeciesDef {
  const char* name;
  uint16_t minDepthFt, maxDepthFt;
  uint16_t minLengthTenths, typicalLengthTenths, maxLengthTenths;
  uint32_t baseValueDollars;
  uint8_t spawnWeight;
  Behavior behavior;
  uint8_t flags;
  Shape shape;
  uint8_t typicalDrawLengthPx;
  uint8_t typicalDrawHeightPx;
  uint16_t bodyColor, accentColor, glowColor;
};

struct SizeSample {
  uint16_t lengthTenths;
  float percentile;
  SizeClass sizeClass;
};

struct ValueInfo {
  uint32_t baseSizedValue;
  uint32_t finalValue;
};

struct Fish {
  bool active;
  uint8_t speciesId;
  uint16_t generation;
  uint16_t lengthTenths;
  float percentile;
  SizeClass sizeClass;
  uint32_t baseSizedValue;
  uint32_t finalValue;

  float x, worldY;
  float prevX, prevWorldY;
  float laneWorldY;
  float vx, vy;
  float baseSpeed;
  float behaviorPhase;
  float behaviorClock;
  float nextBurstAt;
  float burstRemaining;
  float burstTelegraph;
  int8_t direction;
  uint8_t schoolId;
  uint8_t drawLength, drawHeight;
  uint8_t animationFrame;
  float visibleSeconds;
};

struct CatchResult {
  bool completed;
  bool empty;
  uint8_t speciesId;
  uint16_t lengthTenths;
  SizeClass sizeClass;
  uint32_t baseSizedValue;
  uint32_t finalValue;
  uint16_t caughtDepthFt;
  uint8_t drawLength, drawHeight;
  uint32_t appearanceSeed;
};

struct Particle {
  bool active;
  ParticleKind kind;
  float x, worldY, vx, vy;
  float life, maxLife;
  uint16_t color;
};

struct DebouncedButton {
  bool initialized;
  bool rawCandidate;
  bool stable;
  bool pressed;
  bool released;
  uint32_t candidateSinceMs;
};

struct DebouncedSwitch {
  bool initialized;
  Tension candidate;
  Tension stable;
  Tension previousStable;
  uint32_t candidateSinceMs;
};

struct JigState {
  bool active;
  JigDirection direction;
  float elapsed;
  float cooldownRemaining;
  bool readyEvent;

  JigRecognize recognize;
  uint8_t firstButton; // 1 left, 2 right
  uint8_t seenMask;
  uint32_t firstPressMs;
  bool pending;
  JigDirection pendingDirection;
};

struct InputState {
  DebouncedButton left;
  DebouncedButton right;
  DebouncedSwitch leftSwitch;
  DebouncedSwitch rightSwitch;

  bool initialized;
  bool tapArmed;
  uint8_t tapCandidate;  // 1 left / 2 right
  uint8_t tapEvent;      // release-qualified
};

struct SpawnState {
  float secondsUntilAttempt;
  uint8_t nextSchoolId;
  uint8_t targetBandCounter;
};

struct ReelState {
  float startX;
  float startWorldY;
  float durationSec;
  bool landingStarted;
};

struct RevealState {
  uint32_t displayedValue;
  bool animationComplete;
};

struct ClockState {
  uint32_t lastUs;
  uint32_t lastPresentationUs;
  uint32_t accumulatorUs;
  uint32_t overloadCount;
  uint32_t renderIntervalUs;
  uint16_t slowFrames;
  uint16_t goodFrames;
};

struct SfxStep {
  uint16_t leftHz;
  uint16_t rightHz;
  uint16_t durationMs;
};

struct SfxState {
  const SfxStep* pattern;
  uint8_t count;
  uint8_t index;
  uint8_t priority;
  uint32_t stepStartedMs;
  bool active;
  bool ownsLeft;
  bool ownsRight;
  bool suppressedForExit;
  uint32_t bothHeldSinceMs;
};

struct GameState {
  Phase phase;
  float phaseElapsed;
  uint8_t selectedPlayers;
  uint8_t playerCount;
  uint8_t currentPlayer;
  CatchResult results[2];

  Fish fish[MAX_FISH];
  Particle particles[MAX_PARTICLES];
  Vec2 lure;
  Vec2 prevLure;
  float cameraTop;
  JigState jig;
  InputState input;
  SpawnState spawn;
  ReelState reel;
  RevealState reveal;
  ClockState clock;
  SfxState sfx;

  bool lineLimitActive;
  float lineLimitRemaining;
  uint16_t lineLimitShownSec;
  uint32_t rng;
  uint32_t cosmeticSeed;
  uint32_t sessionSeed;
  uint32_t castCounter;
  uint32_t matchCounter;
  uint8_t attachedFishSpecies;
  uint16_t attachedLengthTenths;
  uint8_t attachedDrawW, attachedDrawH;
  int8_t attachedDirection;
  uint16_t depthShown;
  uint8_t cooldownShownPx;
  bool forceFrame;
  bool seamlessIntroTransition;
  bool firstOuterUpdate;
};

struct Capsule {
  float ax, ay, bx, by;
  float radius;
};

struct CollisionShape {
  Capsule parts[MAX_COLLISION_PARTS];
  uint8_t count;
  RectF localBounds;
};

struct CandidateGroup {
  Fish members[MAX_SCHOOL];
  uint8_t count;
};

struct FishDrawItem {
  bool active;
  uint8_t speciesId;
  uint16_t generation;
  int16_t x, y;
  uint8_t w, h;
  int8_t direction;
  uint8_t animationFrame;
  uint16_t body, accent, glow;
  RectI bounds;
};

struct ParticleDrawItem {
  bool active;
  int16_t x, y;
  uint16_t color;
  ParticleKind kind;
  RectI bounds;
};

struct RenderSnapshot {
  Phase phase;
  float phaseElapsed;
  uint8_t selectedPlayers;
  uint8_t playerCount;
  uint8_t currentPlayer;
  CatchResult results[2];

  float cameraTop;
  int16_t lureX, lureY;
  bool jigActive;
  JigDirection jigDirection;
  float jigProgress;
  float jigCooldown;
  bool lineLimitActive;
  float lineLimitRemaining;
  uint16_t depthFt;
  uint32_t revealDisplayed;
  bool revealComplete;

  FishDrawItem fish[MAX_FISH];
  ParticleDrawItem particles[MAX_PARTICLES];
  uint16_t rowColor[SCREEN_H];
  bool boatVisible;
  int16_t boatY;
  RectI boatBounds;
  RectI lureBounds;
  RectI lineBounds;
};

struct PresentationHistory {
  bool valid;
  bool fishVisible[MAX_FISH];
  uint16_t fishGeneration[MAX_FISH];
  RectI fishBounds[MAX_FISH];

  bool particleVisible[MAX_PARTICLES];
  RectI particleBounds[MAX_PARTICLES];

  bool boatVisible;
  RectI boatBounds;
  RectI lureBounds;
  RectI lineBounds;

  uint16_t rowColor[SCREEN_H];
  Phase phase;
  uint16_t depthFt;
  uint8_t cooldownPx;
  bool lineLimitActive;
  uint16_t lineLimitSec;
  uint32_t revealDisplayed;
  bool revealComplete;
  uint8_t selectedPlayers;
};

static GameState g;
static RenderSnapshot snap;
static PresentationHistory history;

// ============================================================
// Species catalog — all 47 entries from the implementation plan.
// Lengths are tenths of an inch. baseValueDollars is the payout for a
// typical-size fish; size then scales that value. The ladder is intentionally
// tuned from $5 surface catches through five-figure abyssal jackpots.
// ============================================================

static const SpeciesDef SPECIES[SPECIES_COUNT] = {
  {"Anchovy", 0, 250, 30, 50, 80, 5u, 100, Behavior::Drifter, F_SCHOOL, Shape::Bait, 13, 6, RGB565(155,185,195), RGB565(40,80,100), RGB565(130,220,255)},
  {"Sardine", 0, 300, 50, 80, 120, 7u, 100, Behavior::Cruiser, F_SCHOOL, Shape::Bait, 16, 7, RGB565(175,200,205), RGB565(35,95,135), RGB565(120,220,255)},
  {"Herring", 0, 350, 70, 120, 170, 10u, 100, Behavior::Cruiser, F_SCHOOL, Shape::Bait, 19, 8, RGB565(185,205,210), RGB565(55,95,130), RGB565(140,225,255)},
  {"Atlantic Mackerel", 0, 450, 80, 140, 220, 18u, 100, Behavior::Cruiser, 0, Shape::Bait, 22, 9, RGB565(90,165,160), RGB565(25,70,90), RGB565(130,220,235)},
  {"Pompano", 0, 400, 80, 150, 240, 35u, 45, Behavior::Cruiser, 0, Shape::Oval, 22, 13, RGB565(190,185,130), RGB565(235,195,75), RGB565(200,230,240)},
  {"Triggerfish", 40, 450, 80, 150, 250, 40u, 45, Behavior::Weaver, 0, Shape::Perch, 23, 15, RGB565(95,150,150), RGB565(40,55,70), RGB565(170,220,230)},
  {"Sea Bass", 30, 500, 90, 180, 320, 55u, 100, Behavior::Cruiser, 0, Shape::Perch, 27, 13, RGB565(95,120,75), RGB565(150,165,125), RGB565(180,220,210)},
  {"Red Snapper", 50, 550, 100, 210, 380, 80u, 45, Behavior::Cruiser, 0, Shape::Perch, 29, 14, RGB565(205,70,65), RGB565(245,135,125), RGB565(255,190,180)},
  {"Bonito", 80, 600, 160, 270, 420, 120u, 45, Behavior::Runner, 0, Shape::Tuna, 31, 12, RGB565(80,125,170), RGB565(195,210,215), RGB565(150,220,255)},
  {"Mahi-Mahi", 150, 750, 180, 400, 720, 220u, 45, Behavior::Runner, 0, Shape::Mahi, 39, 18, RGB565(75,175,105), RGB565(225,190,65), RGB565(120,255,190)},
  {"Barracuda", 150, 800, 200, 410, 720, 250u, 45, Behavior::Burst, 0, Shape::Ribbon, 43, 10, RGB565(165,180,175), RGB565(55,70,75), RGB565(185,230,230)},
  {"Cobia", 200, 850, 240, 430, 740, 300u, 45, Behavior::Cruiser, 0, Shape::Ribbon, 39, 13, RGB565(105,95,90), RGB565(210,205,175), RGB565(190,220,220)},
  {"Amberjack", 200, 900, 220, 420, 760, 340u, 45, Behavior::Cruiser, 0, Shape::Tuna, 37, 17, RGB565(145,125,75), RGB565(225,175,65), RGB565(220,225,180)},
  {"Wahoo", 250, 900, 300, 540, 900, 450u, 45, Behavior::Runner, 0, Shape::Ribbon, 47, 12, RGB565(90,135,175), RGB565(30,50,70), RGB565(160,220,255)},
  {"Albacore Tuna", 250, 950, 240, 370, 580, 380u, 45, Behavior::Runner, 0, Shape::Tuna, 35, 17, RGB565(95,125,155), RGB565(205,215,220), RGB565(170,220,245)},
  {"Yellowfin Tuna", 250, 1100, 250, 480, 840, 650u, 45, Behavior::Runner, 0, Shape::Tuna, 43, 22, RGB565(70,105,145), RGB565(245,205,50), RGB565(160,220,255)},
  {"Bluefin Tuna", 300, 1200, 400, 780, 1250, 1500u, 15, Behavior::Runner, F_GIANT, Shape::Tuna, 58, 29, RGB565(45,80,120), RGB565(205,215,220), RGB565(140,205,255)},
  {"Sailfish", 300, 1100, 580, 910, 1250, 1200u, 15, Behavior::Runner, 0, Shape::Sailfish, 61, 29, RGB565(60,100,145), RGB565(90,155,210), RGB565(130,210,255)},
  {"Swordfish", 350, 1400, 480, 940, 1450, 1600u, 15, Behavior::Cruiser, 0, Shape::Billfish, 63, 20, RGB565(75,95,120), RGB565(175,190,200), RGB565(150,210,240)},
  {"Blue Marlin", 350, 1300, 700, 1220, 1850, 2400u, 15, Behavior::Runner, F_GIANT, Shape::Billfish, 73, 27, RGB565(50,90,150), RGB565(65,145,225), RGB565(120,210,255)},
  {"Opah", 600, 1500, 240, 430, 720, 700u, 45, Behavior::Cruiser, 0, Shape::Oval, 37, 30, RGB565(210,115,65), RGB565(230,185,165), RGB565(235,180,160)},
  {"Pomfret", 650, 1500, 120, 240, 400, 320u, 45, Behavior::Cruiser, F_SCHOOL, Shape::Oval, 28, 22, RGB565(95,110,120), RGB565(185,195,205), RGB565(165,210,230)},
  {"Escolar", 700, 1650, 280, 510, 860, 550u, 45, Behavior::Cruiser, 0, Shape::Tuna, 41, 17, RGB565(70,60,85), RGB565(150,140,155), RGB565(135,180,210)},
  {"Oilfish", 700, 1700, 300, 550, 920, 500u, 45, Behavior::Cruiser, 0, Shape::Ribbon, 46, 16, RGB565(105,80,70), RGB565(150,130,110), RGB565(150,185,200)},
  {"Black Scabbardfish", 750, 1800, 280, 500, 820, 650u, 45, Behavior::Weaver, 0, Shape::Ribbon, 51, 9, RGB565(45,50,65), RGB565(155,165,175), RGB565(130,180,210)},
  {"Sablefish", 750, 1800, 190, 330, 500, 800u, 45, Behavior::Cruiser, 0, Shape::Perch, 33, 14, RGB565(55,60,65), RGB565(145,155,165), RGB565(130,180,200)},
  {"Humboldt Squid", 700, 1900, 240, 500, 820, 950u, 45, Behavior::Burst, 0, Shape::Squid, 48, 22, RGB565(175,70,55), RGB565(220,115,95), RGB565(255,150,120)},
  {"Lanternfish", 800, 2100, 20, 50, 90, 75u, 100, Behavior::Drifter, F_SCHOOL|F_BIOLUME, Shape::Bait, 16, 8, RGB565(35,55,70), RGB565(80,110,135), RGB565(120,235,255)},
  {"Hatchetfish", 850, 2200, 10, 35, 70, 100u, 100, Behavior::Cruiser, F_SCHOOL|F_BIOLUME, Shape::Hatchet, 14, 13, RGB565(120,130,140), RGB565(190,205,215), RGB565(120,240,255)},
  {"Viperfish", 1200, 2800, 80, 150, 250, 350u, 45, Behavior::Curious, F_BIOLUME, Shape::Ribbon, 27, 11, RGB565(35,45,70), RGB565(150,160,175), RGB565(90,220,255)},
  {"Dragonfish", 1250, 2900, 60, 120, 210, 450u, 45, Behavior::Curious, F_BIOLUME, Shape::Ribbon, 26, 10, RGB565(45,30,45), RGB565(150,50,70), RGB565(80,180,255)},
  {"Fangtooth", 1300, 3000, 40, 70, 120, 550u, 45, Behavior::Burst, 0, Shape::Angler, 23, 17, RGB565(55,55,60), RGB565(180,175,155), RGB565(140,180,200)},
  {"Barreleye", 1400, 3100, 40, 70, 120, 900u, 45, Behavior::Drifter, F_BIOLUME, Shape::Barreleye, 23, 15, RGB565(45,55,65), RGB565(95,170,120), RGB565(125,255,200)},
  {"Deep Anglerfish", 1500, 3300, 80, 180, 380, 1100u, 45, Behavior::Curious, F_BIOLUME, Shape::Angler, 32, 25, RGB565(70,55,40), RGB565(150,120,80), RGB565(170,255,210)},
  {"Oarfish", 1200, 3200, 600, 1450, 3100, 3200u, 15, Behavior::Weaver, F_GIANT, Shape::Ribbon, 90, 15, RGB565(175,185,190), RGB565(190,50,45), RGB565(180,215,230)},
  {"Frilled Shark", 1500, 3500, 400, 630, 880, 1800u, 45, Behavior::Cruiser, 0, Shape::Frilled, 60, 20, RGB565(75,80,80), RGB565(135,105,90), RGB565(140,175,185)},
  {"Goblin Shark", 1600, 3700, 600, 940, 1450, 3000u, 15, Behavior::Burst, 0, Shape::Shark, 67, 26, RGB565(190,125,130), RGB565(230,175,175), RGB565(215,180,195)},
  {"Giant Squid", 1800, 4200, 800, 1650, 3000, 5000u, 15, Behavior::Curious, F_GIANT|F_BIOLUME, Shape::Squid, 94, 35, RGB565(160,80,105), RGB565(200,120,160), RGB565(125,230,255)},
  {"Sixgill Shark", 2200, 4500, 700, 1150, 1850, 4500u, 15, Behavior::Drifter, F_GIANT, Shape::Shark, 79, 30, RGB565(85,90,90), RGB565(135,145,150), RGB565(145,180,195)},
  {"Greenland Shark", 2400, 5000, 1000, 1650, 2550, 6500u, 5, Behavior::Drifter, F_GIANT, Shape::Shark, 88, 35, RGB565(70,85,75), RGB565(125,135,120), RGB565(130,170,165)},
  {"Coelacanth", 2700, 5000, 480, 660, 840, 8500u, 5, Behavior::Drifter, 0, Shape::Coelacanth, 57, 29, RGB565(50,75,110), RGB565(120,130,145), RGB565(100,170,220)},
  {"Abyssal Eel", 2500, 5000, 240, 560, 1100, 2200u, 45, Behavior::Weaver, F_BIOLUME, Shape::Ribbon, 59, 11, RGB565(30,75,120), RGB565(45,125,180), RGB565(80,220,255)},
  {"Phantom Ray", 2800, 5000, 300, 680, 1250, 5200u, 15, Behavior::Drifter, F_BIOLUME, Shape::Ray, 67, 45, RGB565(120,175,180), RGB565(175,220,220), RGB565(110,245,255)},
  {"Void Squid", 3100, 5000, 700, 1450, 2300, 9500u, 5, Behavior::Curious, F_GIANT|F_BIOLUME, Shape::Squid, 90, 35, RGB565(45,30,75), RGB565(80,65,125), RGB565(95,240,255)},
  {"Abyss Kingfish", 3200, 5000, 400, 780, 1300, 7500u, 15, Behavior::Runner, F_BIOLUME, Shape::Tuna, 58, 24, RGB565(95,85,45), RGB565(185,145,55), RGB565(125,235,255)},
  {"Crown Angler", 3500, 5000, 150, 320, 580, 12500u, 1, Behavior::Curious, F_BIOLUME, Shape::Angler, 44, 34, RGB565(70,35,95), RGB565(135,80,155), RGB565(100,255,235)},
  {"Leviathan Eel", 3800, 5000, 700, 1450, 2400, 15000u, 1, Behavior::Weaver, F_GIANT|F_BIOLUME, Shape::Ribbon, 104, 23, RGB565(45,45,110), RGB565(100,90,170), RGB565(80,235,255)},
};

#undef RGB565

// ============================================================
// Small math helpers
// ============================================================

static inline float clampF(float v, float lo, float hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}
static inline int16_t clampI16(int16_t v, int16_t lo, int16_t hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}
static inline float lerpF(float a, float b, float t) { return a + (b-a)*t; }
static inline float smoothstep01(float t) {
  t = clampF(t, 0.0f, 1.0f);
  return t*t*(3.0f - 2.0f*t);
}
static inline float lengthSq(float x, float y) { return x*x + y*y; }
static inline float moveToward(float cur, float target, float maxDelta) {
  if (cur < target) return (cur + maxDelta > target) ? target : cur + maxDelta;
  if (cur > target) return (cur - maxDelta < target) ? target : cur - maxDelta;
  return cur;
}
static inline bool rectEmpty(const RectI& r) { return r.x1 <= r.x0 || r.y1 <= r.y0; }

static RectI clipRect(RectI r) {
  if (r.x0 < 0) r.x0 = 0;
  if (r.y0 < 0) r.y0 = 0;
  if (r.x1 > SCREEN_W) r.x1 = SCREEN_W;
  if (r.y1 > SCREEN_H) r.y1 = SCREEN_H;
  if (r.x1 < r.x0) r.x1 = r.x0;
  if (r.y1 < r.y0) r.y1 = r.y0;
  return r;
}

static bool rectIntersects(const RectI& a, const RectI& b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

static RectI unionRect(const RectI& a, const RectI& b) {
  if (rectEmpty(a)) return b;
  if (rectEmpty(b)) return a;
  return RectI(a.x0 < b.x0 ? a.x0 : b.x0,
               a.y0 < b.y0 ? a.y0 : b.y0,
               a.x1 > b.x1 ? a.x1 : b.x1,
               a.y1 > b.y1 ? a.y1 : b.y1);
}

static uint16_t scaleColor(uint16_t c, float f) {
  f = clampF(f, 0.0f, 1.4f);
  uint8_t r = (uint8_t)(((c >> 11) & 31) * f);
  uint8_t gg = (uint8_t)(((c >> 5) & 63) * f);
  uint8_t b = (uint8_t)((c & 31) * f);
  if (r > 31) r = 31;
  if (gg > 63) gg = 63;
  if (b > 31) b = 31;
  return (uint16_t)((r << 11) | (gg << 5) | b);
}

static uint16_t mixColor(uint16_t a, uint16_t b, float t) {
  t = clampF(t, 0.0f, 1.0f);
  int ar=(a>>11)&31, ag=(a>>5)&63, ab=a&31;
  int br=(b>>11)&31, bg=(b>>5)&63, bb=b&31;
  int r=(int)roundf(ar + (br-ar)*t);
  int gg=(int)roundf(ag + (bg-ag)*t);
  int bl=(int)roundf(ab + (bb-ab)*t);
  return (uint16_t)((r<<11)|(gg<<5)|bl);
}

// ============================================================
// Randomness, size sampling, value calculation
// ============================================================

static uint32_t nextRandomU32() {
  uint32_t x = g.rng;
  if (x == 0) x = 0xA341316Cu;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  g.rng = x;
  return x;
}

static float uniform01() {
  uint32_t v = nextRandomU32() >> 8;
  float f = (v + 0.5f) * (1.0f / 16777216.0f);
  if (f <= 0.0f) f = 0.00000006f;
  if (f >= 1.0f) f = 0.99999994f;
  return f;
}

static float randomRange(float a, float b) { return a + (b-a)*uniform01(); }
static int randomInt(int lo, int hiInclusive) {
  if (hiInclusive <= lo) return lo;
  uint32_t span = (uint32_t)(hiInclusive - lo + 1);
  return lo + (int)(nextRandomU32() % span);
}

static float sampleNormal() {
  float u1 = uniform01();
  float u2 = uniform01();
  float mag = sqrtf(-2.0f * logf(u1));
  float ang = 2.0f * DH_PI * u2;
  return mag * cosf(ang);
}

static float normalCdf(float z) {
  float az = fabsf(z);
  float t = 1.0f / (1.0f + 0.2316419f * az);
  float density = 0.3989422804014327f * expf(-0.5f * az * az);
  float poly = t * (0.319381530f + t * (-0.356563782f +
               t * (1.781477937f + t * (-1.821255978f + t * 1.330274429f))));
  float positive = 1.0f - density * poly;
  float phi = z >= 0 ? positive : 1.0f - positive;
  return clampF(phi, 0.0f, 1.0f);
}

static SizeClass classifySize(float p) {
  if (p < 0.15f) return SizeClass::Small;
  if (p < 0.55f) return SizeClass::Average;
  if (p < 0.80f) return SizeClass::GoodSize;
  if (p < 0.95f) return SizeClass::Large;
  if (p < 0.99f) return SizeClass::Trophy;
  return SizeClass::Monster;
}

static SizeSample sampleSize(const SpeciesDef& s) {
  float minL = s.minLengthTenths / 10.0f;
  float mu = s.typicalLengthTenths / 10.0f;
  float maxL = s.maxLengthTenths / 10.0f;
  float sigma = (maxL - minL) / 6.0f;
  if (sigma < 0.05f) sigma = 0.05f;

  float accepted = mu;
  for (uint8_t i=0; i<16; ++i) {
    float candidate = mu + sigma * sampleNormal();
    if (candidate >= minL && candidate <= maxL) {
      accepted = candidate;
      break;
    }
  }

  uint16_t tenths = (uint16_t)roundf(accepted * 10.0f);
  if (tenths < s.minLengthTenths) tenths = s.minLengthTenths;
  if (tenths > s.maxLengthTenths) tenths = s.maxLengthTenths;

  float stored = tenths / 10.0f;
  float a = (minL - mu) / sigma;
  float b = (maxL - mu) / sigma;
  float z = (stored - mu) / sigma;
  float denom = normalCdf(b) - normalCdf(a);
  float p = denom > 0.00001f ? (normalCdf(z) - normalCdf(a)) / denom : 0.5f;
  p = clampF(p, 0.0f, 1.0f);

  SizeSample out;
  out.lengthTenths = tenths;
  out.percentile = p;
  out.sizeClass = classifySize(p);
  return out;
}

static uint8_t bonusPercent(SizeClass c) {
  if (c == SizeClass::Trophy) return 20;
  if (c == SizeClass::Monster) return 40;
  return 0;
}

static const char* sizeClassLabel(SizeClass c) {
  switch(c) {
    case SizeClass::Small: return "SMALL";
    case SizeClass::Average: return "AVERAGE";
    case SizeClass::GoodSize: return "GOOD SIZE";
    case SizeClass::Large: return "LARGE";
    case SizeClass::Trophy: return "TROPHY";
    default: return "MONSTER";
  }
}

static uint32_t roundPayout(float dollars) {
  return (uint32_t)roundf(dollars);
}

static ValueInfo calculateValue(const SpeciesDef& s, uint16_t lenTenths, SizeClass cls) {
  float ratio = lenTenths / (float)s.typicalLengthTenths;

  // A typical specimen pays exactly the species' authored base value. Size
  // matters strongly (area/mass-ish 2.2 exponent), while Trophy/Monster fish
  // retain their extra 20%/40% prestige bonus.
  float rawBase = s.baseValueDollars * powf(ratio, 2.2f);
  uint32_t base = roundPayout(rawBase);
  uint8_t bonus = bonusPercent(cls);
  uint32_t finalV = roundPayout(rawBase * ((100.0f + bonus) / 100.0f));
  ValueInfo v = {base, finalV};
  return v;
}

static void computeDrawSize(const SpeciesDef& s, uint16_t lenTenths, uint8_t& w, uint8_t& h) {
  float ratio = lenTenths / (float)s.typicalLengthTenths;
  float scale = clampF(powf(ratio, 0.45f), 0.70f, 1.35f);
  int wi = (int)roundf(s.typicalDrawLengthPx * scale);
  int hi = (int)roundf(s.typicalDrawHeightPx * scale);
  if (wi < 10) wi = 10;
  if (wi > 112) wi = 112;
  if (hi < 5) hi = 5;
  if (hi > 52) hi = 52;
  w = (uint8_t)wi;
  h = (uint8_t)hi;
}

// ============================================================
// Formatting
// ============================================================

static void formatMoneyNumber(uint32_t dollars, char* out, size_t cap) {
  char raw[16];
  snprintf(raw, sizeof(raw), "%lu", (unsigned long)dollars);
  size_t n = strlen(raw);
  char temp[24];
  size_t j = 0;
  for (size_t i=0; i<n && j+1<sizeof(temp); ++i) {
    if (i > 0 && ((n-i) % 3) == 0 && j+1<sizeof(temp)) temp[j++] = ',';
    temp[j++] = raw[i];
  }
  temp[j] = 0;
  if (cap) {
    strncpy(out, temp, cap-1);
    out[cap-1] = 0;
  }
}

static void formatMoney(uint32_t dollars, char* out, size_t cap) {
  char number[24];
  formatMoneyNumber(dollars, number, sizeof(number));
  if (cap) snprintf(out, cap, "$%s", number);
}

static void formatLength(uint16_t tenths, char* out, size_t cap) {
  snprintf(out, cap, "%u.%u IN", (unsigned)(tenths/10), (unsigned)(tenths%10));
}

static void formatDepth(uint16_t feet, char* out, size_t cap) {
  if (feet >= 1000)
    snprintf(out, cap, "%u,%03u FT", (unsigned)(feet/1000), (unsigned)(feet%1000));
  else
    snprintf(out, cap, "%u FT", (unsigned)feet);
}

// Gameplay HUD uses a fixed seven-character field and deliberately omits the
// comma. Keeping the entire changing number inside one 48 px compositor run
// prevents stale fragments such as an apparent 1,000 -> 17,000 jump.
static void formatHudDepth(uint16_t feet, char* out, size_t cap) {
  snprintf(out, cap, "%4u FT", (unsigned)feet);
}

// ============================================================
// Raw controls and debouncing
// ============================================================

static Tension readTensionContacts(int upPin, int downPin) {
  bool up = digitalRead(upPin) == LOW;
  bool down = digitalRead(downPin) == LOW;
  if (up && !down) return Tension::Up;
  if (!up && down) return Tension::Down;
  return Tension::Center; // center and invalid both-low are neutral
}

static void initButton(DebouncedButton& b, bool raw, uint32_t now) {
  b.initialized = true;
  b.rawCandidate = raw;
  b.stable = raw;
  b.pressed = false;
  b.released = false;
  b.candidateSinceMs = now;
}

static void debounceButton(DebouncedButton& b, bool raw, uint32_t now) {
  b.pressed = b.released = false;
  if (!b.initialized) {
    initButton(b, raw, now);
    return;
  }
  if (raw != b.rawCandidate) {
    b.rawCandidate = raw;
    b.candidateSinceMs = now;
  }
  if (b.stable != b.rawCandidate && (uint32_t)(now - b.candidateSinceMs) >= BUTTON_DEBOUNCE_MS) {
    bool old = b.stable;
    b.stable = b.rawCandidate;
    b.pressed = (!old && b.stable);
    b.released = (old && !b.stable);
  }
}

static void initSwitch(DebouncedSwitch& s, Tension raw, uint32_t now) {
  s.initialized = true;
  s.candidate = raw;
  s.stable = raw;
  s.previousStable = raw;
  s.candidateSinceMs = now;
}

static void debounceSwitch(DebouncedSwitch& s, Tension raw, uint32_t now) {
  s.previousStable = s.stable;
  if (!s.initialized) {
    initSwitch(s, raw, now);
    return;
  }
  if (raw != s.candidate) {
    s.candidate = raw;
    s.candidateSinceMs = now;
  }
  if (s.stable != s.candidate && (uint32_t)(now - s.candidateSinceMs) >= SWITCH_DEBOUNCE_MS) {
    s.stable = s.candidate;
  }
}

static void resetTapGate() {
  g.input.tapArmed = false;
  g.input.tapCandidate = 0;
  g.input.tapEvent = 0;
}

static void updateTapGate() {
  DebouncedButton& l = g.input.left;
  DebouncedButton& r = g.input.right;

  // A UI tap must survive outer-loop iterations until the next fixed
  // simulation step consumes it. Previously this was cleared every loop,
  // which made title/result controls depend on lucky timing.
  if (g.input.tapEvent != 0) return;

  if (!g.input.tapArmed) {
    if (!l.stable && !r.stable) g.input.tapArmed = true;
    return;
  }

  if (g.input.tapCandidate == 0) {
    if (l.pressed && !r.stable) g.input.tapCandidate = 1;
    else if (r.pressed && !l.stable) g.input.tapCandidate = 2;
    else if (l.stable && r.stable) {
      g.input.tapCandidate = 0;
      g.input.tapArmed = false;
    }
  } else {
    if (l.stable && r.stable) {
      g.input.tapCandidate = 0;
      g.input.tapArmed = false;
      return;
    }
    if (g.input.tapCandidate == 1 && l.released && !r.stable) {
      g.input.tapEvent = 1;
      g.input.tapCandidate = 0;
      g.input.tapArmed = false;
    } else if (g.input.tapCandidate == 2 && r.released && !l.stable) {
      g.input.tapEvent = 2;
      g.input.tapCandidate = 0;
      g.input.tapArmed = false;
    }
  }
}

static bool consumeTap(uint8_t allowedMask) {
  uint8_t e = g.input.tapEvent;
  if (!e) return false;
  g.input.tapEvent = 0;
  return (allowedMask & (1u << (e-1))) != 0;
}

static void clearJigRecognizerRequireRelease() {
  g.jig.pending = false;
  g.jig.recognize = JigRecognize::WaitRelease;
  g.jig.firstButton = 0;
  g.jig.seenMask = 0;
}

static void updateJigRecognizer(uint32_t nowMs) {
  bool lp = g.input.left.pressed;
  bool rp = g.input.right.pressed;
  bool lh = g.input.left.stable;
  bool rh = g.input.right.stable;

  if (g.phase != Phase::Descending) {
    g.jig.pending = false;
    if (!lh && !rh) g.jig.recognize = JigRecognize::Idle;
    else g.jig.recognize = JigRecognize::WaitRelease;
    return;
  }

  if (g.jig.recognize == JigRecognize::WaitRelease) {
    if (!lh && !rh) {
      g.jig.recognize = JigRecognize::Idle;
      g.jig.firstButton = 0;
      g.jig.seenMask = 0;
    }
    return;
  }

  if (g.jig.cooldownRemaining > 0.0001f) {
    if (lp || rp) clearJigRecognizerRequireRelease();
    return;
  }

  if (g.jig.recognize == JigRecognize::Idle) {
    if (lp && rp) {
      g.jig.pending = true;
      g.jig.pendingDirection = JigDirection::Straight;
      g.jig.recognize = JigRecognize::WaitRelease;
      return;
    }
    if (lp || rp) {
      g.jig.recognize = JigRecognize::WaitingSecond;
      g.jig.firstButton = lp ? 1 : 2;
      g.jig.seenMask = lp ? 1 : 2;
      g.jig.firstPressMs = nowMs;
    }
    return;
  }

  if (g.jig.recognize == JigRecognize::WaitingSecond) {
    bool otherEdge = (g.jig.firstButton == 1) ? rp : lp;
    if (otherEdge && (uint32_t)(nowMs - g.jig.firstPressMs) <= JIG_CHORD_MS) {
      g.jig.pending = true;
      g.jig.pendingDirection = JigDirection::Straight;
      g.jig.recognize = JigRecognize::WaitRelease;
      return;
    }
    if ((uint32_t)(nowMs - g.jig.firstPressMs) >= JIG_CHORD_MS) {
      g.jig.pending = true;
      g.jig.pendingDirection = (g.jig.firstButton == 1) ? JigDirection::Left : JigDirection::Right;
      g.jig.recognize = JigRecognize::WaitRelease;
    }
  }
}

static void sampleAndDebounceInput(const GameInput& input, uint32_t nowMs) {
  Tension rawL = readTensionContacts(LEFT_UP_PIN, LEFT_DOWN_PIN);
  Tension rawR = readTensionContacts(RIGHT_UP_PIN, RIGHT_DOWN_PIN);

  if (!g.input.initialized) {
    initButton(g.input.left, input.leftButton, nowMs);
    initButton(g.input.right, input.rightButton, nowMs);
    initSwitch(g.input.leftSwitch, rawL, nowMs);
    initSwitch(g.input.rightSwitch, rawR, nowMs);
    g.input.initialized = true;
    resetTapGate();
    return;
  }

  debounceButton(g.input.left, input.leftButton, nowMs);
  debounceButton(g.input.right, input.rightButton, nowMs);
  debounceSwitch(g.input.leftSwitch, rawL, nowMs);
  debounceSwitch(g.input.rightSwitch, rawR, nowMs);

  if (g.phase == Phase::Descending) updateJigRecognizer(nowMs);
  else updateTapGate();
}

struct ControlVelocity { float vx, vy; };

static ControlVelocity computeControl(Tension left, Tension right) {
  int lv = (int)left;
  int rv = (int)right;
  ControlVelocity c;

  // Horizontal steering is based only on which physical switch is moved.
  // Either UP or DOWN on the left switch steers left; either UP or DOWN on
  // the right switch steers right. If both switches are off-center at once,
  // their horizontal steering cancels. Their UP/DOWN positions still combine
  // below exactly as before to control descent speed.
  const bool leftActive = left != Tension::Center;
  const bool rightActive = right != Tension::Center;
  c.vx = LIGHT_STEER * ((rightActive ? 1.0f : 0.0f) -
                        (leftActive  ? 1.0f : 0.0f));

  int sum = lv + rv;
  float ft = 120.0f;
  if (sum <= -2) ft = 36.0f;
  else if (sum == -1) ft = 78.0f;
  else if (sum == 0) ft = 120.0f;
  else if (sum == 1) ft = 170.0f;
  else ft = 220.0f;
  c.vy = ft / MOTION_FEET_PER_WORLD_PIXEL;
  return c;
}

// ============================================================
// Audio — finite, nonblocking, and subordinate to background music.
// ============================================================

static const SfxStep SFX_SPLASH[] = {{900,900,35},{600,600,35},{300,300,35}};
static const SfxStep SFX_JIG_L[] = {{1500,0,25},{950,0,25}};
static const SfxStep SFX_JIG_R[] = {{0,1500,25},{0,950,25}};
static const SfxStep SFX_JIG_S[] = {{1300,1300,25},{800,800,25}};
static const SfxStep SFX_READY[] = {{1900,1900,15}};
static const SfxStep SFX_HOOK[] = {{350,700,60},{700,1050,60}};
static const SfxStep SFX_TROPHY[] = {{900,900,60},{1200,1200,60},{1550,1550,60}};
static const SfxStep SFX_MONSTER[] = {{800,1000,55},{1050,1250,55},{1300,1500,55},{1600,1900,80}};
static const SfxStep SFX_EMPTY[] = {{350,350,70},{220,220,70}};

static bool audioAllowed() {
  return Music::gameEffectsAllowed() && (int)Music::volume > 0 && !g.sfx.suppressedForExit;
}

static void writeBuzzerPin(uint8_t pin, uint16_t hz) {
  if (!hz) {
    ledcWriteTone(pin, 0);
    return;
  }
  ledcWriteTone(pin, hz);
  int volume = (int)Music::volume; if (volume < 0) volume = 0; if (volume > 100) volume = 100;
  uint32_t duty = Music::dutyForVolume((uint8_t)volume);
  if (duty > 0) ledcWrite(pin, duty);
}

static void stopOwnedSfx() {
  if (Music::gameEffectsAllowed()) {
    if (g.sfx.ownsLeft) ledcWriteTone(BUZZER_2_PIN, 0);
    if (g.sfx.ownsRight) ledcWriteTone(BUZZER_1_PIN, 0);
  }
  g.sfx.active = false;
  g.sfx.ownsLeft = g.sfx.ownsRight = false;
  g.sfx.pattern = nullptr;
  g.sfx.count = g.sfx.index = g.sfx.priority = 0;
}

static uint8_t sfxPriority(SfxId id) {
  if (id == SfxId::Hook) return 4;
  if (id == SfxId::Monster || id == SfxId::Trophy) return 3;
  if (id == SfxId::Splash || id == SfxId::JigLeft || id == SfxId::JigRight || id == SfxId::JigStraight || id == SfxId::Empty) return 2;
  return 1;
}

static void applySfxStep(uint32_t nowMs) {
  if (!g.sfx.active || !g.sfx.pattern || g.sfx.index >= g.sfx.count) {
    stopOwnedSfx();
    return;
  }
  const SfxStep& st = g.sfx.pattern[g.sfx.index];
  g.sfx.ownsLeft = st.leftHz != 0;
  g.sfx.ownsRight = st.rightHz != 0;
  if (g.sfx.ownsLeft) writeBuzzerPin(BUZZER_2_PIN, st.leftHz);
  else ledcWriteTone(BUZZER_2_PIN, 0);
  if (g.sfx.ownsRight) writeBuzzerPin(BUZZER_1_PIN, st.rightHz);
  else ledcWriteTone(BUZZER_1_PIN, 0);
  g.sfx.stepStartedMs = nowMs;
}

static void playPattern(const SfxStep* steps, uint8_t count, SfxId id, uint32_t nowMs) {
  if (!audioAllowed()) return;
  uint8_t pri = sfxPriority(id);
  if (g.sfx.active && pri < g.sfx.priority) return;
  stopOwnedSfx();
  g.sfx.pattern = steps;
  g.sfx.count = count;
  g.sfx.index = 0;
  g.sfx.priority = pri;
  g.sfx.active = true;
  applySfxStep(nowMs);
}

static void playSfx(SfxId id, uint32_t nowMs) {
  switch(id) {
    case SfxId::Splash: playPattern(SFX_SPLASH,3,id,nowMs); break;
    case SfxId::JigLeft: playPattern(SFX_JIG_L,2,id,nowMs); break;
    case SfxId::JigRight: playPattern(SFX_JIG_R,2,id,nowMs); break;
    case SfxId::JigStraight: playPattern(SFX_JIG_S,2,id,nowMs); break;
    case SfxId::Ready: playPattern(SFX_READY,1,id,nowMs); break;
    case SfxId::Hook: playPattern(SFX_HOOK,2,id,nowMs); break;
    case SfxId::Trophy: playPattern(SFX_TROPHY,3,id,nowMs); break;
    case SfxId::Monster: playPattern(SFX_MONSTER,4,id,nowMs); break;
    case SfxId::Empty: playPattern(SFX_EMPTY,2,id,nowMs); break;
    default: break;
  }
}

static void playReelTick(float t, uint32_t nowMs) {
  if (!audioAllowed()) return;
  static SfxStep one[1];
  uint16_t hz = (uint16_t)(1000 + 800 * clampF(t,0,1));
  one[0] = {hz, hz, 12};
  playPattern(one,1,SfxId::ReelTick,nowMs);
}

static void updateAudio(uint32_t nowMs) {
  if (!g.sfx.active || !g.sfx.pattern) return;
  if (!audioAllowed()) {
    stopOwnedSfx();
    return;
  }
  uint8_t guard = 0;
  while (g.sfx.active && guard++ < 8) {
    const SfxStep& st = g.sfx.pattern[g.sfx.index];
    if ((uint32_t)(nowMs - g.sfx.stepStartedMs) < st.durationMs) break;
    ++g.sfx.index;
    if (g.sfx.index >= g.sfx.count) {
      stopOwnedSfx();
      break;
    }
    applySfxStep(nowMs);
  }
}

static void updateExitAudioGuard(const GameInput& input, uint32_t nowMs) {
  if (input.leftButton && input.rightButton) {
    if (g.sfx.bothHeldSinceMs == 0) g.sfx.bothHeldSinceMs = nowMs ? nowMs : 1;
    if ((uint32_t)(nowMs - g.sfx.bothHeldSinceMs) >= EXIT_AUDIO_GUARD_MS) {
      g.sfx.suppressedForExit = true;
      stopOwnedSfx();
    }
  } else {
    g.sfx.bothHeldSinceMs = 0;
  }
}

// ============================================================
// Depth mapping
// ============================================================

static inline float biomeDepthForWorldY(float worldY) {
  return worldY * BIOME_UNITS_PER_WORLD_PIXEL;
}

static inline float displayedDepthForWorldY(float worldY) {
  return fmaxf(0.0f, worldY * DISPLAY_FEET_PER_WORLD_PIXEL);
}

// ============================================================
// Species selection and fish creation
// ============================================================

static bool eligibleAtDepth(const SpeciesDef& s, float biomeDepth) {
  if (biomeDepth <= FINAL_REGION_BIOME_DEPTH)
    return biomeDepth >= s.minDepthFt && biomeDepth <= s.maxDepthFt;

  // The last abyssal region never ends. Only species authored to reach the
  // old 5,000-depth boundary persist into it; their rarity then evolves with
  // continued descent instead of terminating at a bottom.
  return s.maxDepthFt >= (uint16_t)FINAL_REGION_BIOME_DEPTH;
}

static float finalRegionTargetWeight(uint8_t authoredWeight) {
  // At extreme depth, common final-zone fish become scarce while the rarest
  // species become increasingly plausible. This is deliberately not a flat
  // equalization: legendary 1-weight fish eventually become marquee targets.
  if (authoredWeight >= 45) return 4.0f;
  if (authoredWeight >= 15) return 8.0f;
  if (authoredWeight >= 5) return 14.0f;
  return 18.0f;
}

static float effectiveSpawnWeight(const SpeciesDef& s, float biomeDepth) {
  if (!eligibleAtDepth(s, biomeDepth)) return 0.0f;

  if (biomeDepth > FINAL_REGION_BIOME_DEPTH) {
    float extra = biomeDepth - FINAL_REGION_BIOME_DEPTH;
    float progress = 1.0f - expf(-extra / FINAL_RARITY_RAMP_DEPTH);
    float target = finalRegionTargetWeight(s.spawnWeight);
    return lerpF((float)s.spawnWeight, target, progress);
  }

  float range = (float)(s.maxDepthFt - s.minDepthFt);
  float edge = range * 0.20f;
  if (edge > 100.0f) edge = 100.0f;
  if (edge < 1.0f) edge = 1.0f;

  float in = (s.minDepthFt == 0) ? 1.0f : smoothstep01((biomeDepth - s.minDepthFt) / edge);
  float out = (s.maxDepthFt == (uint16_t)FINAL_REGION_BIOME_DEPTH) ? 1.0f : smoothstep01((s.maxDepthFt - biomeDepth) / edge);
  float edgeF = in < out ? in : out;
  return s.spawnWeight * (0.15f + 0.85f * edgeF);
}

static uint8_t countActiveFish() {
  uint8_t n=0;
  for (uint8_t i=0;i<MAX_FISH;i++) if (g.fish[i].active) ++n;
  return n;
}

static uint8_t countGiants() {
  uint8_t n=0;
  for (uint8_t i=0;i<MAX_FISH;i++) {
    if (g.fish[i].active && (SPECIES[g.fish[i].speciesId].flags & F_GIANT)) ++n;
  }
  return n;
}

static int8_t findFreeFishSlot() {
  for (uint8_t i=0;i<MAX_FISH;i++) if (!g.fish[i].active) return (int8_t)i;
  return -1;
}

static uint8_t selectSpecies(float depthFt, bool giantsAllowed) {
  float total = 0.0f;
  for (uint8_t i=0;i<SPECIES_COUNT;i++) {
    if (!giantsAllowed && (SPECIES[i].flags & F_GIANT)) continue;
    total += effectiveSpawnWeight(SPECIES[i], depthFt);
  }
  if (total <= 0.0f) return INVALID_SPECIES;
  float pick = uniform01() * total;
  float acc = 0.0f;
  for (uint8_t i=0;i<SPECIES_COUNT;i++) {
    if (!giantsAllowed && (SPECIES[i].flags & F_GIANT)) continue;
    acc += effectiveSpawnWeight(SPECIES[i], depthFt);
    if (pick <= acc) return i;
  }
  return INVALID_SPECIES;
}

static float behaviorBaseSpeed(Behavior b) {
  switch(b) {
    case Behavior::Drifter: return 20.0f;
    case Behavior::Cruiser: return 34.0f;
    case Behavior::Runner: return 54.0f;
    case Behavior::Weaver: return 31.0f;
    case Behavior::Burst: return 28.0f;
    default: return 29.0f;
  }
}

static Fish buildCandidateFish(uint8_t speciesId, float x, float worldY, int8_t direction, uint8_t schoolId) {
  Fish f = {};
  const SpeciesDef& s = SPECIES[speciesId];
  SizeSample sz = sampleSize(s);
  ValueInfo val = calculateValue(s, sz.lengthTenths, sz.sizeClass);
  uint8_t dw,dh;
  computeDrawSize(s, sz.lengthTenths, dw, dh);

  f.active = true;
  f.speciesId = speciesId;
  f.generation = 1;
  f.lengthTenths = sz.lengthTenths;
  f.percentile = sz.percentile;
  f.sizeClass = sz.sizeClass;
  f.baseSizedValue = val.baseSizedValue;
  f.finalValue = val.finalValue;
  f.x = f.prevX = x;
  f.worldY = f.prevWorldY = worldY;
  f.laneWorldY = worldY;
  f.direction = direction;
  float depthFactor = 1.0f + 0.20f * clampF(biomeDepthForWorldY(worldY) / FINAL_REGION_BIOME_DEPTH, 0, 1);
  float giantFactor = (s.flags & F_GIANT) ? 0.78f : 1.0f;
  f.baseSpeed = behaviorBaseSpeed(s.behavior) * randomRange(0.85f,1.15f) * depthFactor * giantFactor;
  f.vx = f.baseSpeed * direction;
  f.vy = 0;
  f.behaviorPhase = randomRange(0, 2*DH_PI);
  f.behaviorClock = 0;
  f.nextBurstAt = randomRange(1.2f,2.4f);
  f.burstRemaining = 0;
  f.burstTelegraph = 0;
  f.schoolId = schoolId;
  f.drawLength = dw;
  f.drawHeight = dh;
  f.animationFrame = 0;
  f.visibleSeconds = 0;
  return f;
}

static float fishHalfW(const Fish& f) { return f.drawLength * 0.5f; }
static float fishHalfH(const Fish& f) { return f.drawHeight * 0.5f; }

static bool candidateHasWarning(const Fish& f) {
  float dx = f.x - g.lure.x;
  float dy = f.worldY - g.lure.y;
  float dist = sqrtf(dx*dx + dy*dy) - sqrtf(fishHalfW(f)*fishHalfW(f)+fishHalfH(f)*fishHalfH(f));
  if (dist < 24.0f) return false;
  const SpeciesDef& s = SPECIES[f.speciesId];
  float speed = f.baseSpeed;
  if (s.behavior == Behavior::Burst) speed *= 2.0f;
  float rel = speed + 55.0f;
  float need = ((s.flags & F_GIANT) || s.behavior == Behavior::Burst) ? 0.90f : 0.65f;
  return dist / (rel > 1 ? rel : 1) >= need;
}

struct Interval { float a,b; };
static void sortIntervals(Interval* arr, uint8_t n) {
  for (uint8_t i=1;i<n;i++) {
    Interval key=arr[i];
    int j=i-1;
    while (j>=0 && arr[j].a > key.a) { arr[j+1]=arr[j]; --j; }
    arr[j+1]=key;
  }
}

static bool projectedGapOkay(const CandidateGroup& group) {
  const float samples[3] = {0.0f,0.35f,0.70f};
  ControlVelocity control = computeControl(g.input.leftSwitch.stable, g.input.rightSwitch.stable);

  for (uint8_t si=0;si<3;si++) {
    float t=samples[si];
    Interval ints[MAX_FISH+MAX_SCHOOL];
    uint8_t n=0;
    float likelyY = g.lure.y + control.vy * t;

    for (uint8_t i=0;i<MAX_FISH && n<MAX_FISH+MAX_SCHOOL;i++) {
      const Fish& f=g.fish[i];
      if (!f.active) continue;
      float fy=f.worldY;
      if (fabsf(fy-likelyY) > f.drawHeight*0.5f+18.0f) continue;
      float px=f.x + f.vx*t;
      float hw=f.drawLength*0.5f + HOOK_RADIUS + 3.0f;
      ints[n++]={px-hw,px+hw};
    }
    for (uint8_t i=0;i<group.count && n<MAX_FISH+MAX_SCHOOL;i++) {
      const Fish& f=group.members[i];
      float fy=f.worldY;
      if (fabsf(fy-likelyY) > f.drawHeight*0.5f+18.0f) continue;
      float px=f.x + f.vx*t;
      float hw=f.drawLength*0.5f + HOOK_RADIUS + 3.0f;
      ints[n++]={px-hw,px+hw};
    }
    sortIntervals(ints,n);

    float cursor=HOOK_MIN_X;
    bool found=false;
    float reach = LIGHT_STEER*t + 10.0f;
    for (uint8_t i=0;i<n;i++) {
      float a=ints[i].a; float b=ints[i].b;
      if (a > cursor) {
        float ga=cursor, gb=a;
        if (gb-ga >= 18.0f) {
          float nearest = clampF(g.lure.x,ga,gb);
          if (fabsf(nearest-g.lure.x) <= reach || (g.lure.x>=ga && g.lure.x<=gb)) { found=true; break; }
        }
      }
      if (b>cursor) cursor=b;
      if (cursor>HOOK_MAX_X) break;
    }
    if (!found && HOOK_MAX_X-cursor>=18.0f) {
      float nearest=clampF(g.lure.x,cursor,HOOK_MAX_X);
      if (fabsf(nearest-g.lure.x)<=reach || (g.lure.x>=cursor && g.lure.x<=HOOK_MAX_X)) found=true;
    }
    if (!found) return false;
  }
  return true;
}

static bool admitSpawn(const CandidateGroup& group) {
  uint8_t active=countActiveFish();
  if (active + group.count > MAX_FISH) return false;
  uint8_t giants=countGiants();
  for (uint8_t i=0;i<group.count;i++) {
    const Fish& f=group.members[i];
    const SpeciesDef& s=SPECIES[f.speciesId];
    if (!eligibleAtDepth(s, biomeDepthForWorldY(f.worldY))) return false;
    if ((s.flags&F_GIANT) && ++giants>MAX_GIANTS) return false;
    if (!candidateHasWarning(f)) return false;
  }
  // Preserve the stronger local-path screen while population is moderate.
  // At high density, retain warning-distance protection but allow the scene
  // to become genuinely crowded; otherwise the old path check capped the
  // practical population far below the requested density.
  if (active >= 12) return true;
  return projectedGapOkay(group);
}

static void commitCandidate(const CandidateGroup& group) {
  for (uint8_t i=0;i<group.count;i++) {
    int8_t slot=findFreeFishSlot();
    if (slot<0) return;
    uint16_t nextGen = g.fish[slot].generation + 1;
    g.fish[slot]=group.members[i];
    g.fish[slot].generation=nextGen ? nextGen : 1;
  }
  g.forceFrame=true;
}

static CandidateGroup buildSchool(uint8_t speciesId, float worldY, int8_t dir, bool seededInside) {
  CandidateGroup group = {};
  const SpeciesDef& s=SPECIES[speciesId];
  uint8_t freeSlots=MAX_FISH-countActiveFish();
  uint8_t desired=(uint8_t)randomInt(3,5);
  if (uniform01()<0.14f) desired=(uint8_t)randomInt(6,7);
  if (desired>freeSlots) desired=freeSlots;
  if (desired<1) return group;

  uint8_t schoolId=++g.spawn.nextSchoolId;
  if (!schoolId) schoolId=++g.spawn.nextSchoolId;
  float spacing=s.typicalDrawLengthPx*randomRange(0.7f,1.2f);
  float entryX = dir>0 ? -s.typicalDrawLengthPx*0.5f-4 : SCREEN_W+s.typicalDrawLengthPx*0.5f+4;
  if (seededInside) entryX = randomRange(18,222);

  for (uint8_t i=0;i<desired;i++) {
    float x=entryX - dir*(i*spacing);
    if (seededInside) x=clampF(entryX + dir*((int)i-(int)desired/2)*spacing, 12,228);
    float y=worldY + ((i%2)?1.0f:-1.0f)*((i+1)/2)*randomRange(4,8);
    Fish f=buildCandidateFish(speciesId,x,y,dir,schoolId);
    f.baseSpeed *= randomRange(0.96f,1.04f);
    f.vx=f.baseSpeed*dir;
    f.behaviorPhase += i*0.7f;
    group.members[group.count++]=f;
  }
  return group;
}

static CandidateGroup buildSolitary(uint8_t speciesId,float worldY,int8_t dir,bool seededInside) {
  CandidateGroup group={};
  const SpeciesDef& s=SPECIES[speciesId];
  float x=dir>0 ? -s.typicalDrawLengthPx*0.5f-4 : SCREEN_W+s.typicalDrawLengthPx*0.5f+4;
  if (seededInside) x=randomRange(18,222);
  group.members[0]=buildCandidateFish(speciesId,x,worldY,dir,0);
  group.count=1;
  return group;
}

static float spawnIntervalForDepth(float depthFt) {
  // Dense arcade tuning: roughly five times the encounter pressure of the
  // original implementation.
  if (g.lineLimitActive) return randomRange(0.10f,0.16f);
  if (depthFt<300) return randomRange(0.11f,0.17f);
  if (depthFt<800) return randomRange(0.14f,0.20f);
  if (depthFt<1600) return randomRange(0.17f,0.24f);
  if (depthFt<3000) return randomRange(0.20f,0.28f);
  return randomRange(0.17f,0.25f);
}

static uint8_t targetFishForDepth(float depthFt) {
  if (g.lineLimitActive) return 28;
  if (depthFt<300) return 28;
  if (depthFt<800) return 26;
  if (depthFt<1600) return 24;
  if (depthFt<3000) return 22;
  return 22;
}

static float schoolChance(float depthFt) {
  if (g.lineLimitActive) return 0.20f;
  if (depthFt<300) return 0.45f;
  if (depthFt<800) return 0.35f;
  if (depthFt<1600) return 0.40f;
  if (depthFt<3000) return 0.30f;
  return 0.25f;
}

static bool trySpawnGroup(bool seededInside, bool preloadDeep=false) {
  bool giantsAllowed=countGiants()<MAX_GIANTS;
  for (uint8_t attempt=0;attempt<6;attempt++) {
    float worldY;
    float sy;
    if (preloadDeep) {
      // Spawn far enough below the screen that fish are already swimming long
      // before the descending hook can reach their lane.
      sy=randomRange(FISH_PRELOAD_MIN_SCREEN_Y, FISH_PRELOAD_MAX_SCREEN_Y);
    } else if (uniform01()<0.70f) {
      sy=randomRange(g.lure.y-g.cameraTop+18.0f, 278.0f);
    } else {
      sy=randomRange(52.0f, g.lure.y-g.cameraTop+18.0f);
    }
    worldY=g.cameraTop+sy;
    if (worldY<0) worldY=0;
    float depth=biomeDepthForWorldY(worldY);
    uint8_t id=selectSpecies(depth,giantsAllowed);
    if (id==INVALID_SPECIES) continue;
    int8_t dir=(nextRandomU32()&1u)?1:-1;
    bool school=(SPECIES[id].flags&F_SCHOOL) && uniform01()<schoolChance(depth);
    CandidateGroup group=school?buildSchool(id,worldY,dir,seededInside):buildSolitary(id,worldY,dir,seededInside);
    if (!group.count) continue;
    if (admitSpawn(group)) {
      commitCandidate(group);
      return true;
    }
    if (group.count>3) {
      group.count=3;
      if (admitSpawn(group)) {
        commitCandidate(group);
        return true;
      }
    }
  }
  return false;
}

static void seedInitialFish() {
  uint8_t attempts=0;
  while (countActiveFish()<12 && attempts++<32) {
    if (!trySpawnGroup(true)) continue;
    // Ensure no initial body is too close to hook; remove offending members.
    for (uint8_t i=0;i<MAX_FISH;i++) {
      Fish& f=g.fish[i];
      if (!f.active) continue;
      float dx=f.x-g.lure.x, dy=f.worldY-g.lure.y;
      if (sqrtf(dx*dx+dy*dy)<44.0f || (fabsf(f.x-120.0f)<15.0f && f.worldY<g.lure.y+65.0f)) f.active=false;
    }
  }
}

static uint8_t countPreloadedFish() {
  uint8_t count=0;
  for (uint8_t i=0;i<MAX_FISH;i++) {
    const Fish& f=g.fish[i];
    if (!f.active) continue;
    if (f.worldY-g.cameraTop > FISH_PRELOAD_TRACK_SCREEN_Y) ++count;
  }
  return count;
}

static void updateSpawnScheduler(float dt) {
  g.spawn.secondsUntilAttempt -= dt;
  if (g.spawn.secondsUntilAttempt>0) return;

  float depth=biomeDepthForWorldY(g.lure.y);
  uint8_t active=countActiveFish();
  uint8_t desiredTotal=(uint8_t)(targetFishForDepth(depth) + FISH_PRELOAD_TARGET);
  if (desiredTotal>MAX_FISH) desiredTotal=MAX_FISH;

  // Refill the deep look-ahead band first. Once those fish rise toward the
  // visible playfield they stop counting as preloaded, so later free slots are
  // used to stage replacements farther down. This creates a continuous stream
  // of already-running fish instead of spawning each depth only as it appears.
  bool needPreload=countPreloadedFish()<FISH_PRELOAD_TARGET;

  // If the preload corridor is underfilled, use any genuinely free fish slot
  // to restore it even when the normal near-hook population is already healthy.
  // Otherwise the look-ahead reserve could disappear during a long dense run.
  if (active>=desiredTotal && !(needPreload && active<MAX_FISH)) {
    g.spawn.secondsUntilAttempt=spawnIntervalForDepth(depth);
    return;
  }

  bool ok=trySpawnGroup(false, needPreload);
  g.spawn.secondsUntilAttempt= ok ? spawnIntervalForDepth(depth) : randomRange(0.06f,0.10f);
}

static void cullFish() {
  for (uint8_t i=0;i<MAX_FISH;i++) {
    Fish& f=g.fish[i];
    if (!f.active) continue;

    float sy=f.worldY-g.cameraTop;
    float hw=fishHalfW(f);
    bool exited=(f.direction>0 && f.x-hw>SCREEN_W+16) || (f.direction<0 && f.x+hw<-16);

    // While a fish is still in the hidden preload corridor, keep it swimming
    // instead of destroying it when it crosses the far edge. Wrapping it back
    // to the opposite side lets slow species accumulate real travel time before
    // their lane scrolls into view. Once the lane approaches the playfield,
    // normal edge culling resumes.
    if (exited && sy>FISH_PRELOAD_TRACK_SCREEN_Y) {
      f.x = (f.direction>0) ? (-hw-6.0f) : (SCREEN_W+hw+6.0f);
      f.prevX=f.x;
      exited=false;
    }

    bool vertical=sy<-100 || sy>FISH_PRELOAD_CULL_SCREEN_Y;
    if (exited || vertical) f.active=false;
  }
}

// ============================================================
// Fish motion
// ============================================================

static void updateFishMotion(Fish& f, float dt) {
  const SpeciesDef& s=SPECIES[f.speciesId];
  f.prevX=f.x;
  f.prevWorldY=f.worldY;
  f.visibleSeconds += dt;
  f.behaviorClock += dt;

  float speedMul=1.0f;
  if (s.behavior==Behavior::Burst) {
    if (f.burstRemaining>0) {
      f.burstRemaining-=dt;
      if (f.burstRemaining<0) f.burstRemaining=0;
      speedMul=2.0f;
    } else if (f.burstTelegraph>0) {
      f.burstTelegraph-=dt;
      if (f.burstTelegraph<=0) {
        f.burstRemaining=0.30f;
        f.nextBurstAt=f.behaviorClock+randomRange(1.8f,3.0f);
      }
    } else if (f.behaviorClock>=f.nextBurstAt && f.visibleSeconds>0.65f) {
      f.burstTelegraph=0.18f;
    }
  }

  f.x += f.direction * f.baseSpeed * speedMul * dt;

  if (s.behavior==Behavior::Curious) {
    float dy=g.lure.y-f.worldY;
    float targetVy=0.0f;
    if (fabsf(f.x-g.lure.x)<95.0f && (f.direction>0 ? f.x<g.lure.x+20 : f.x>g.lure.x-20)) {
      float cap=(s.flags&F_GIANT)?6.0f:8.0f;
      targetVy=clampF(dy*0.35f,-cap,cap);
    } else {
      targetVy=clampF((f.laneWorldY-f.worldY)*0.25f,-5.0f,5.0f);
    }
    f.vy=moveToward(f.vy,targetVy,20.0f*dt);
    f.worldY+=f.vy*dt;
    float off=f.worldY-f.laneWorldY;
    if (off>22) f.worldY=f.laneWorldY+22;
    if (off<-22) f.worldY=f.laneWorldY-22;
  } else {
    float amp=0, period=3.0f;
    if (s.behavior==Behavior::Drifter) { amp=2; period=3.6f; }
    else if (s.behavior==Behavior::Cruiser) { amp=3; period=3.0f; }
    else if (s.behavior==Behavior::Runner) { amp=2; period=2.7f; }
    else if (s.behavior==Behavior::Weaver) { amp=7.5f; period=3.1f; }
    else if (s.behavior==Behavior::Burst) { amp=2; period=3.0f; }
    // Deterministic amplitude for Weaver derived from phase instead of per-frame RNG.
    if (s.behavior==Behavior::Weaver) amp=5.0f+5.0f*(0.5f+0.5f*sinf(f.behaviorPhase*1.73f));
    f.worldY=f.laneWorldY + amp*sinf(f.behaviorPhase + (2*DH_PI/period)*f.behaviorClock);
  }

  f.animationFrame=(uint8_t)((int)(f.behaviorClock*9.0f + f.behaviorPhase) & 3);
}

// ============================================================
// Lure, camera, particles
// ============================================================

static float worldToScreenY(float y) { return y-g.cameraTop; }

static void updateCamera() {
  float desired=g.lure.y-HOOK_ANCHOR_Y;
  if (desired<CAMERA_SURFACE_CLAMP) desired=CAMERA_SURFACE_CLAMP;
  g.cameraTop=desired;
}

static void spawnParticle(ParticleKind kind,float x,float y,float vx,float vy,float life,uint16_t color) {
  int slot=-1;
  for (uint8_t i=0;i<MAX_PARTICLES;i++) if (!g.particles[i].active) { slot=i; break; }
  if (slot<0) {
    float worst=999;
    for (uint8_t i=0;i<MAX_PARTICLES;i++) {
      if (g.particles[i].kind==ParticleKind::Bubble && g.particles[i].life<worst) { worst=g.particles[i].life; slot=i; }
    }
  }
  if (slot<0) return;
  Particle& p=g.particles[slot];
  p.active=true;p.kind=kind;p.x=x;p.worldY=y;p.vx=vx;p.vy=vy;p.life=life;p.maxLife=life;p.color=color;
}

static void updateParticles(float dt) {
  for (uint8_t i=0;i<MAX_PARTICLES;i++) {
    Particle& p=g.particles[i];
    if (!p.active) continue;
    p.life-=dt;
    if (p.life<=0) { p.active=false; continue; }
    p.x+=p.vx*dt;
    p.worldY+=p.vy*dt;
    if (p.x<-10 || p.x>250 || p.worldY-g.cameraTop<-20 || p.worldY-g.cameraTop>340) p.active=false;
  }
}

static void startJig(JigDirection dir, uint32_t nowMs) {
  if (g.jig.cooldownRemaining>0.0001f) return;
  g.jig.active=true;
  g.jig.direction=dir;
  g.jig.elapsed=0;
  g.jig.cooldownRemaining=JIG_COOLDOWN;
  g.jig.pending=false;

  if (dir==JigDirection::Left) playSfx(SfxId::JigLeft,nowMs);
  else if (dir==JigDirection::Right) playSfx(SfxId::JigRight,nowMs);
  else playSfx(SfxId::JigStraight,nowMs);
}

static void updateJigCooldown(float dt, uint32_t nowMs) {
  g.jig.readyEvent=false;
  if (g.jig.cooldownRemaining>0) {
    float old=g.jig.cooldownRemaining;
    g.jig.cooldownRemaining-=dt;
    if (g.jig.cooldownRemaining<=0) {
      g.jig.cooldownRemaining=0;
      g.jig.readyEvent=true;
      if (old>0) playSfx(SfxId::Ready,nowMs);
    }
  }
}

static Vec2 jigSliceDisplacement(float dt) {
  if (!g.jig.active) return Vec2(0,0);
  float oldT=clampF(g.jig.elapsed/JIG_DURATION,0,1);
  float newElapsed=g.jig.elapsed+dt;
  float newT=clampF(newElapsed/JIG_DURATION,0,1);
  float f0=1.0f-(1.0f-oldT)*(1.0f-oldT);
  float f1=1.0f-(1.0f-newT)*(1.0f-newT);
  float frac=f1-f0;
  float dx=0,dy=0;
  if (g.jig.direction==JigDirection::Straight) dy=36.0f*frac;
  else {
    dx=26.0f*frac*(int)g.jig.direction;
    dy=22.0f*frac;
  }
  g.jig.elapsed=newElapsed;
  if (g.jig.elapsed>=JIG_DURATION) g.jig.active=false;
  return Vec2(dx,dy);
}

// ============================================================
// Capsule collision
// ============================================================

static void addCapsule(CollisionShape& s,float ax,float ay,float bx,float by,float r) {
  if (s.count>=MAX_COLLISION_PARTS) return;
  s.parts[s.count++]={ax,ay,bx,by,r};
}

static void buildFishGeometry(const Fish& f, CollisionShape& out) {
  out.count=0;
  float w=f.drawLength, h=f.drawHeight;
  float sx=f.direction>=0?1.0f:-1.0f;
  Shape sh=SPECIES[f.speciesId].shape;

  switch(sh) {
    case Shape::Bait:
      addCapsule(out,-0.30f*w*sx,0,0.30f*w*sx,0,h*0.26f);
      addCapsule(out,0.24f*w*sx,0,0.43f*w*sx,0,h*0.14f);
      break;
    case Shape::Perch:
    case Shape::Mahi:
    case Shape::Tuna:
      addCapsule(out,-0.28f*w*sx,0,0.28f*w*sx,0,h*0.31f);
      addCapsule(out,-0.05f*w*sx,-0.12f*h,0.25f*w*sx,-0.08f*h,h*0.16f);
      break;
    case Shape::Oval:
    case Shape::Hatchet:
    case Shape::Barreleye:
      addCapsule(out,-0.18f*w*sx,-0.12f*h,0.18f*w*sx,-0.12f*h,h*0.30f);
      addCapsule(out,-0.15f*w*sx,0.14f*h,0.15f*w*sx,0.14f*h,h*0.25f);
      break;
    case Shape::Billfish:
    case Shape::Sailfish:
      addCapsule(out,-0.25f*w*sx,0,0.23f*w*sx,0,h*0.27f);
      addCapsule(out,0.22f*w*sx,-0.02f*h,0.48f*w*sx,-0.02f*h,h*0.06f);
      break;
    case Shape::Ribbon:
    case Shape::Frilled:
      addCapsule(out,-0.42f*w*sx,0,-0.15f*w*sx,-0.08f*h,h*0.22f);
      addCapsule(out,-0.15f*w*sx,-0.08f*h,0.12f*w*sx,0.08f*h,h*0.22f);
      addCapsule(out,0.12f*w*sx,0.08f*h,0.40f*w*sx,0,h*0.18f);
      break;
    case Shape::Shark:
      addCapsule(out,-0.30f*w*sx,0,0.25f*w*sx,0,h*0.28f);
      addCapsule(out,0.23f*w*sx,0,0.43f*w*sx,0,h*0.16f);
      break;
    case Shape::Squid:
      addCapsule(out,-0.10f*w*sx,-0.18f*h,0.10f*w*sx,-0.18f*h,h*0.28f);
      addCapsule(out,0,0.02f*h,0,0.22f*h,h*0.22f);
      addCapsule(out,-0.08f*w,0.12f*h,-0.24f*w,0.46f*h,h*0.055f);
      addCapsule(out,0.08f*w,0.12f*h,0.24f*w,0.46f*h,h*0.055f);
      addCapsule(out,-0.02f*w,0.14f*h,-0.08f*w,0.48f*h,h*0.05f);
      addCapsule(out,0.02f*w,0.14f*h,0.08f*w,0.48f*h,h*0.05f);
      break;
    case Shape::Angler:
      addCapsule(out,-0.23f*w*sx,0,0.22f*w*sx,0,h*0.34f);
      addCapsule(out,0.12f*w*sx,0.08f*h,0.36f*w*sx,0.08f*h,h*0.14f);
      break;
    case Shape::Ray:
      addCapsule(out,-0.34f*w,0,0.34f*w,0,h*0.16f);
      addCapsule(out,-0.24f*w,-0.13f*h,0.24f*w,-0.13f*h,h*0.12f);
      addCapsule(out,-0.24f*w,0.13f*h,0.24f*w,0.13f*h,h*0.12f);
      addCapsule(out,0.25f*w*sx,0,0.48f*w*sx,0,h*0.05f);
      break;
    case Shape::Coelacanth:
      addCapsule(out,-0.28f*w*sx,0,0.23f*w*sx,0,h*0.30f);
      addCapsule(out,0.20f*w*sx,0,0.42f*w*sx,0,h*0.18f);
      break;
  }
  out.localBounds={-w*0.5f,-h*0.5f,w*0.5f,h*0.5f};
}

static float pointSegmentDistSq(Vec2 p, Vec2 a, Vec2 b) {
  float vx=b.x-a.x, vy=b.y-a.y;
  float wx=p.x-a.x, wy=p.y-a.y;
  float vv=vx*vx+vy*vy;
  float t=vv>0.000001f ? (wx*vx+wy*vy)/vv : 0;
  t=clampF(t,0,1);
  float dx=p.x-(a.x+t*vx),dy=p.y-(a.y+t*vy);
  return dx*dx+dy*dy;
}

static bool segmentVsCircle(Vec2 p0,Vec2 p1,Vec2 c,float r,float& tHit) {
  Vec2 d=p1-p0;
  Vec2 m=p0-c;
  float rr=r*r;
  if (m.x*m.x+m.y*m.y<=rr) { tHit=0; return true; }
  float a=d.x*d.x+d.y*d.y;
  if (a<1e-8f) return false;
  float b=2.0f*(m.x*d.x+m.y*d.y);
  float cc=m.x*m.x+m.y*m.y-rr;
  float disc=b*b-4*a*cc;
  if (disc<-1e-6f) return false;
  if (disc<0) disc=0;
  float root=sqrtf(disc);
  float t=(-b-root)/(2*a);
  if (t>=-COLLISION_EPS && t<=1.0f+COLLISION_EPS) {
    tHit=clampF(t,0,1); return true;
  }
  t=(-b+root)/(2*a);
  if (t>=-COLLISION_EPS && t<=1.0f+COLLISION_EPS) {
    tHit=clampF(t,0,1); return true;
  }
  return false;
}

static bool segmentVsAabb(Vec2 p0,Vec2 p1,float xmin,float ymin,float xmax,float ymax,float& tHit) {
  Vec2 d=p1-p0;
  float tmin=0,tmax=1;
  if (fabsf(d.x)<1e-8f) {
    if (p0.x<xmin || p0.x>xmax) return false;
  } else {
    float ood=1.0f/d.x;
    float t1=(xmin-p0.x)*ood,t2=(xmax-p0.x)*ood;
    if (t1>t2) { float q=t1;t1=t2;t2=q; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return false;
  }
  if (fabsf(d.y)<1e-8f) {
    if (p0.y<ymin || p0.y>ymax) return false;
  } else {
    float ood=1.0f/d.y;
    float t1=(ymin-p0.y)*ood,t2=(ymax-p0.y)*ood;
    if(t1>t2){float q=t1;t1=t2;t2=q;}
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return false;
  }
  tHit=clampF(tmin,0,1);return true;
}

static bool sweepPointAgainstCapsule(Vec2 p0,Vec2 p1,const Capsule& c,float expandedR,float& tHit) {
  Vec2 A(c.ax,c.ay), B(c.bx,c.by);
  float r=c.radius+expandedR;
  if (pointSegmentDistSq(p0,A,B)<=r*r) { tHit=0; return true; }

  Vec2 axis=B-A;
  float len=sqrtf(axis.x*axis.x+axis.y*axis.y);
  float best=2.0f, t;
  if (len<1e-6f) {
    if(segmentVsCircle(p0,p1,A,r,t)){tHit=t;return true;}
    return false;
  }

  Vec2 u(axis.x/len,axis.y/len);
  Vec2 v(-u.y,u.x);
  auto transform = [&](Vec2 p)->Vec2 {
    Vec2 q=p-A;
    return Vec2(q.x*u.x+q.y*u.y, q.x*v.x+q.y*v.y);
  };
  Vec2 q0=transform(p0),q1=transform(p1);
  if(segmentVsAabb(q0,q1,0,-r,len,r,t) && t<best)best=t;
  if(segmentVsCircle(p0,p1,A,r,t)&&t<best)best=t;
  if(segmentVsCircle(p0,p1,B,r,t)&&t<best)best=t;
  if(best<=1.0f){tHit=best;return true;}
  return false;
}

static bool findEarliestCatch(float& bestT,uint8_t& bestIndex) {
  bestT=2.0f;bestIndex=255;
  for(uint8_t i=0;i<MAX_FISH;i++){
    Fish& f=g.fish[i];
    if(!f.active)continue;

    float minHookX=fminf(g.prevLure.x,g.lure.x)-HOOK_RADIUS;
    float maxHookX=fmaxf(g.prevLure.x,g.lure.x)+HOOK_RADIUS;
    float minHookY=fminf(g.prevLure.y,g.lure.y)-HOOK_RADIUS;
    float maxHookY=fmaxf(g.prevLure.y,g.lure.y)+HOOK_RADIUS;
    float hw=fishHalfW(f),hh=fishHalfH(f);
    float minFishX=fminf(f.prevX,f.x)-hw,maxFishX=fmaxf(f.prevX,f.x)+hw;
    float minFishY=fminf(f.prevWorldY,f.worldY)-hh,maxFishY=fmaxf(f.prevWorldY,f.worldY)+hh;
    if(maxHookX<minFishX||minHookX>maxFishX||maxHookY<minFishY||minHookY>maxFishY)continue;

    CollisionShape sh; buildFishGeometry(f,sh);
    Vec2 p0(g.prevLure.x-f.prevX,g.prevLure.y-f.prevWorldY);
    Vec2 p1(g.lure.x-f.x,g.lure.y-f.worldY);
    for(uint8_t k=0;k<sh.count;k++){
      float t;
      if(sweepPointAgainstCapsule(p0,p1,sh.parts[k],HOOK_RADIUS,t)){
        if(t<bestT-COLLISION_EPS || (fabsf(t-bestT)<=COLLISION_EPS && i<bestIndex)){
          bestT=t;bestIndex=i;
        }
      }
    }
  }
  return bestIndex!=255;
}

// ============================================================
// State transitions
// ============================================================

static void markAllDirty();
static void buildRenderSnapshot();
static void renderFrame();

static void clearFishAndParticles() {
  for(uint8_t i=0;i<MAX_FISH;i++) g.fish[i].active=false;
  for(uint8_t i=0;i<MAX_PARTICLES;i++) g.particles[i].active=false;
}

static void changePhase(Phase next) {
  const bool seamlessIntroToPlay=(g.phase==Phase::CastIntro && next==Phase::Descending);
  g.phase=next;
  g.phaseElapsed=0;
  g.jig.pending=false;
  g.input.tapEvent=0;
  if(next!=Phase::Descending) {
    g.jig.recognize=(g.input.left.stable||g.input.right.stable)?JigRecognize::WaitRelease:JigRecognize::Idle;
  }
  if(next==Phase::Title || next==Phase::CatchReveal || next==Phase::PlayerHandoff || next==Phase::FinalResults) resetTapGate();

  // CastIntro -> Descending is intentionally a continuous camera scene.
  // Do not trigger a full-screen tile sweep at that boundary; only the boat,
  // old/new line, lure, fish, and changed background rows need recomposition.
  g.seamlessIntroTransition=seamlessIntroToPlay;
  g.forceFrame=true;
  if(!seamlessIntroToPlay) markAllDirty();
}

static void beginCast(uint8_t playerIndex) {
  g.currentPlayer=playerIndex;
  clearFishAndParticles();
  g.lure=Vec2(120.0f,0.0f);
  g.prevLure=g.lure;
  g.cameraTop=CAMERA_SURFACE_CLAMP;
  g.jig.active=false;
  g.jig.elapsed=0;
  g.jig.cooldownRemaining=0;
  g.jig.readyEvent=false;
  g.jig.pending=false;
  g.jig.recognize=(g.input.left.stable||g.input.right.stable)?JigRecognize::WaitRelease:JigRecognize::Idle;
  // Retained fields for render/state compatibility; normal gameplay no longer
  // enters a line limit because the final abyssal region is endless.
  g.lineLimitActive=false;
  g.lineLimitRemaining=0.0f;
  g.lineLimitShownSec=0;
  g.spawn.secondsUntilAttempt=0.3f;
  g.spawn.nextSchoolId=0;
  g.spawn.targetBandCounter=0;
  g.attachedFishSpecies=INVALID_SPECIES;
  g.attachedLengthTenths=0;
  g.attachedDrawW=g.attachedDrawH=0;
  ++g.castCounter;
  g.rng = g.sessionSeed ^ (0x9E3779B9u * (g.castCounter+1)) ^ (0x85EBCA6Bu * (playerIndex+1)) ^ (g.matchCounter*0xC2B2AE35u);
  if(!g.rng)g.rng=0x1234567u;

  // Populate the ocean before the intro starts. The boat drop and the first
  // gameplay frame therefore share the same fish scene instead of swapping
  // from an empty intro to a suddenly populated playfield.
  seedInitialFish();
  changePhase(Phase::CastIntro);
}

static void beginMatch(uint8_t count) {
  g.playerCount=count;
  g.selectedPlayers=count;
  g.currentPlayer=0;
  g.results[0]={};g.results[1]={};
  g.results[0].speciesId=g.results[1].speciesId=INVALID_SPECIES;
  ++g.matchCounter;
  beginCast(0);
}

static void enterLineLimit() {
  if(g.lineLimitActive)return;
  g.lineLimitActive=true;
  g.lineLimitRemaining=12.0f;
  g.lineLimitShownSec=12;
  g.forceFrame=true;
}

static void hookFish(uint8_t idx,uint32_t nowMs) {
  if(idx>=MAX_FISH||!g.fish[idx].active||g.phase!=Phase::Descending)return;
  Fish& f=g.fish[idx];
  CatchResult& r=g.results[g.currentPlayer];
  r.completed=true;r.empty=false;r.speciesId=f.speciesId;r.lengthTenths=f.lengthTenths;
  r.sizeClass=f.sizeClass;r.baseSizedValue=f.baseSizedValue;r.finalValue=f.finalValue;
  float depth=displayedDepthForWorldY(g.lure.y);
  r.caughtDepthFt=(uint16_t)clampF(roundf(depth),0,65535);
  r.drawLength=f.drawLength;r.drawHeight=f.drawHeight;r.appearanceSeed=(g.cosmeticSeed^f.generation^(f.speciesId*2654435761u));
  g.attachedFishSpecies=f.speciesId;
  g.attachedLengthTenths=f.lengthTenths;
  g.attachedDrawW=f.drawLength;g.attachedDrawH=f.drawHeight;g.attachedDirection=f.direction;
  g.jig.active=false;g.jig.pending=false;g.lineLimitActive=false;
  playSfx(SfxId::Hook,nowMs);
  for(uint8_t p=0;p<5;p++)spawnParticle(ParticleKind::Impact,g.lure.x,g.lure.y,randomRange(-18,18),randomRange(-18,8),0.35f,ST77XX_WHITE);
  changePhase(Phase::HookedFreeze);
}

static void beginEmptyReel(uint32_t nowMs) {
  CatchResult& r=g.results[g.currentPlayer];
  r.completed=true;r.empty=true;r.speciesId=INVALID_SPECIES;r.lengthTenths=0;
  r.sizeClass=SizeClass::Average;r.baseSizedValue=0;r.finalValue=0;
  r.caughtDepthFt=(uint16_t)clampF(roundf(displayedDepthForWorldY(g.lure.y)),0,65535);
  r.drawLength=r.drawHeight=0;r.appearanceSeed=0;
  g.attachedFishSpecies=INVALID_SPECIES;
  g.jig.active=false;g.jig.pending=false;g.lineLimitActive=false;
  playSfx(SfxId::Empty,nowMs);
  g.reel.startX=g.lure.x;g.reel.startWorldY=g.lure.y;
  g.reel.durationSec=clampF(1.8f+2.7f*clampF(biomeDepthForWorldY(g.lure.y)/FINAL_REGION_BIOME_DEPTH,0,1),1.8f,4.5f);
  g.reel.landingStarted=false;
  clearFishAndParticles();
  changePhase(Phase::Reeling);
}

static void enterReeling() {
  g.reel.startX=g.lure.x;
  g.reel.startWorldY=g.lure.y;
  float depth=biomeDepthForWorldY(g.reel.startWorldY);
  g.reel.durationSec=clampF(1.8f+2.7f*clampF(depth/FINAL_REGION_BIOME_DEPTH,0,1),1.8f,4.5f);
  g.reel.landingStarted=false;
  for(uint8_t i=0;i<MAX_FISH;i++)g.fish[i].active=false;
  changePhase(Phase::Reeling);
}

static void enterCatchReveal(uint32_t nowMs) {
  g.reveal.displayedValue=0;
  g.reveal.animationComplete=false;
  CatchResult& r=g.results[g.currentPlayer];
  if(r.empty) {
    g.reveal.displayedValue=0;
  } else if(r.sizeClass==SizeClass::Monster) playSfx(SfxId::Monster,nowMs);
  else if(r.sizeClass==SizeClass::Trophy) playSfx(SfxId::Trophy,nowMs);
  changePhase(Phase::CatchReveal);
}

// ============================================================
// Phase simulation
// ============================================================

static void updateTitle(float dt) {
  g.phaseElapsed+=dt;

  // Either three-position switch may select the player count.
  // UP selects 1P, DOWN selects 2P. If the two switches are deliberately
  // held in conflicting directions, retain the existing selection.
  const Tension ls = g.input.leftSwitch.stable;
  const Tension rs = g.input.rightSwitch.stable;
  const bool anyUp = (ls==Tension::Up) || (rs==Tension::Up);
  const bool anyDown = (ls==Tension::Down) || (rs==Tension::Down);
  uint8_t wanted = g.selectedPlayers;
  if(anyUp && !anyDown) wanted=1;
  else if(anyDown && !anyUp) wanted=2;

  if(wanted!=g.selectedPlayers) {
    g.selectedPlayers=wanted;
    g.forceFrame=true;
  }

  // Either physical action button starts the selected mode.
  if(consumeTap(3)) beginMatch(g.selectedPlayers);
}

static void updateCastIntro(float dt,uint32_t nowMs) {
  const float before=g.phaseElapsed;
  g.phaseElapsed+=dt;
  if(g.phaseElapsed>INTRO_TOTAL_SEC) g.phaseElapsed=INTRO_TOTAL_SEC;

  g.prevLure=g.lure;

  // For the first short beat the presentation hook travels from the boat to
  // the surface while simulation depth remains zero. After water entry the
  // actual lure descends smoothly to about 1.8 displayed ft, so the first gameplay frame
  // continues from the exact same hook position with no teleport.
  if(g.phaseElapsed<=INTRO_SURFACE_SEC) {
    g.lure.x=120.0f;
    g.lure.y=0.0f;
  } else {
    const float t=clampF((g.phaseElapsed-INTRO_SURFACE_SEC) /
                         (INTRO_TOTAL_SEC-INTRO_SURFACE_SEC),0.0f,1.0f);
    g.lure.x=120.0f;
    g.lure.y=INTRO_END_WORLD_Y*smoothstep01(t);
  }
  updateCamera();

  if(before<INTRO_SURFACE_SEC && g.phaseElapsed>=INTRO_SURFACE_SEC) {
    playSfx(SfxId::Splash,nowMs);
    for(uint8_t i=0;i<6;i++)
      spawnParticle(ParticleKind::Bubble,120,0,randomRange(-16,16),
                    randomRange(-25,-10),0.6f,ST77XX_CYAN);
  }

  // Keep the already-visible ocean alive during the intro. Collision and
  // spawning remain disabled until Descending, but fish and bubbles move.
  for(uint8_t i=0;i<MAX_FISH;i++)
    if(g.fish[i].active) updateFishMotion(g.fish[i],dt);
  updateParticles(dt);

  if(g.phaseElapsed>=INTRO_TOTAL_SEC) {
    changePhase(Phase::Descending);
  }
}

static void updateLineLimit(float dt,uint32_t nowMs) {
  if(!g.lineLimitActive)return;
  g.lineLimitRemaining-=dt;
  if(g.lineLimitRemaining<0)g.lineLimitRemaining=0;
  uint16_t sec=(uint16_t)ceilf(g.lineLimitRemaining);
  if(sec!=g.lineLimitShownSec){g.lineLimitShownSec=sec;g.forceFrame=true;}
  if(g.lineLimitRemaining<=0) beginEmptyReel(nowMs);
}

static void updateDescending(float dt,uint32_t nowMs) {
  g.phaseElapsed+=dt;

  updateJigCooldown(dt,nowMs);
  if(g.jig.pending && g.jig.cooldownRemaining<=0.0001f) startJig(g.jig.pendingDirection,nowMs);

  ControlVelocity control=computeControl(g.input.leftSwitch.stable,g.input.rightSwitch.stable);

  float maxRelative=fabsf(control.vx)+control.vy+120.0f;
  if(g.jig.active)maxRelative+=350.0f;
  int sub=(int)ceilf((maxRelative*dt)/2.0f);
  if (sub < 1) sub = 1;
  if (sub > 8) sub = 8;
  float sdt=dt/sub;

  for(int step=0;step<sub;step++){
    g.prevLure=g.lure;
    for(uint8_t i=0;i<MAX_FISH;i++)if(g.fish[i].active)updateFishMotion(g.fish[i],sdt);

    Vec2 extra=jigSliceDisplacement(sdt);
    g.lure.x += control.vx*sdt + extra.x;
    g.lure.y += control.vy*sdt + extra.y;
    g.lure.x=clampF(g.lure.x,HOOK_MIN_X,HOOK_MAX_X);
    // No hard bottom: once the final abyssal region is reached, descent can
    // continue indefinitely and the final-region rarity curve keeps evolving.

    float t;uint8_t idx;
    if(findEarliestCatch(t,idx)){
      g.lure.x=lerpF(g.prevLure.x,g.lure.x,t);
      g.lure.y=lerpF(g.prevLure.y,g.lure.y,t);
      Fish& f=g.fish[idx];
      f.x=lerpF(f.prevX,f.x,t);f.worldY=lerpF(f.prevWorldY,f.worldY,t);
      hookFish(idx,nowMs);
      return;
    }
    if(g.phase!=Phase::Descending)return;
  }

  updateCamera();
  updateParticles(dt);
  cullFish();
  updateSpawnScheduler(dt);
  // Endless abyss: no line-limit countdown or forced empty reel.
}

static void updateHookedFreeze(float dt) {
  g.phaseElapsed+=dt;
  updateParticles(dt);
  if(g.phaseElapsed>=0.36f) enterReeling();
}

static void updateReeling(float dt,uint32_t nowMs) {
  float before=g.phaseElapsed;
  g.phaseElapsed+=dt;

  float t=clampF(g.phaseElapsed/g.reel.durationSec,0,1);
  float s=t*t*(3-2*t);
  g.prevLure=g.lure;
  g.lure.y=g.reel.startWorldY*(1-s);
  g.lure.x=lerpF(g.reel.startX,120.0f,s);
  updateCamera();

  // finite reel ticks roughly every 120 ms
  int oldTick=(int)(before/0.12f), newTick=(int)(g.phaseElapsed/0.12f);
  if(newTick>oldTick && t<1.0f)playReelTick(t,nowMs);

  if(t<1.0f) {
    if((nextRandomU32()&15u)==0)spawnParticle(ParticleKind::Trail,g.lure.x+randomRange(-2,2),g.lure.y+6,randomRange(-5,5),randomRange(12,28),0.25f,ST77XX_CYAN);
    updateParticles(dt);
  }

  if(g.phaseElapsed>=g.reel.durationSec+0.25f) enterCatchReveal(nowMs);
}

static void updateCatchReveal(float dt) {
  g.phaseElapsed+=dt;
  CatchResult& r=g.results[g.currentPlayer];
  bool oldComplete=g.reveal.animationComplete;
  uint32_t oldValue=g.reveal.displayedValue;

  if(r.empty){
    g.reveal.displayedValue=0;
    if(g.phaseElapsed>=0.40f)g.reveal.animationComplete=true;
  }else{
    float t=clampF(g.phaseElapsed/0.90f,0,1);
    float ease=1.0f-powf(1.0f-t,3.0f);
    if(t<1.0f) g.reveal.displayedValue=(uint32_t)roundf(r.baseSizedValue*ease);
    else{
      uint8_t bonus=bonusPercent(r.sizeClass);
      if(!bonus){g.reveal.displayedValue=r.finalValue;g.reveal.animationComplete=true;}
      else{
        float bt=clampF((g.phaseElapsed-0.90f)/0.35f,0,1);
        g.reveal.displayedValue=(uint32_t)roundf(lerpF((float)r.baseSizedValue,(float)r.finalValue,bt));
        if(bt>=1.0f)g.reveal.animationComplete=true;
      }
    }
  }
  if(oldValue!=g.reveal.displayedValue||oldComplete!=g.reveal.animationComplete)g.forceFrame=true;

  if(g.reveal.animationComplete && consumeTap(3)){
    if(g.playerCount==1) beginMatch(1);
    else if(g.currentPlayer==0) changePhase(Phase::PlayerHandoff);
    else changePhase(Phase::FinalResults);
  }
}

static void updateHandoff(float dt) {
  g.phaseElapsed+=dt;
  if(consumeTap(3))beginCast(1);
}

static void updateFinal(float dt) {
  g.phaseElapsed+=dt;
  if(consumeTap(3))beginMatch(2);
}

static void simulateStep(float dt,uint32_t nowMs) {
  switch(g.phase){
    case Phase::Title:updateTitle(dt);break;
    case Phase::CastIntro:updateCastIntro(dt,nowMs);break;
    case Phase::Descending:updateDescending(dt,nowMs);break;
    case Phase::HookedFreeze:updateHookedFreeze(dt);break;
    case Phase::Reeling:updateReeling(dt,nowMs);break;
    case Phase::CatchReveal:updateCatchReveal(dt);break;
    case Phase::PlayerHandoff:updateHandoff(dt);break;
    case Phase::FinalResults:updateFinal(dt);break;
  }
}

// ============================================================
// Tile compositor
// ============================================================

class TileCanvas : public Adafruit_GFX {
public:
  TileCanvas():Adafruit_GFX(COMPOSE_MAX_W,COMPOSE_MAX_H),activeW(0),activeH(0){}
  void beginRegion(int16_t w,int16_t h){
    activeW=w;activeH=h;
    memset(pixels,0,sizeof(pixels));
    setTextWrap(false);
  }
  void drawPixel(int16_t x,int16_t y,uint16_t color) override {
    if(x<0||y<0||x>=activeW||y>=activeH)return;
    pixels[y*activeW+x]=color;
  }
  void drawFastHLine(int16_t x,int16_t y,int16_t w,uint16_t color){
    if(y<0||y>=activeH||w<=0)return;
    if(x<0){w+=x;x=0;} if(x+w>activeW)w=activeW-x;if(w<=0)return;
    uint16_t* p=pixels+y*activeW+x;for(int16_t i=0;i<w;i++)p[i]=color;
  }
  void drawFastVLine(int16_t x,int16_t y,int16_t h,uint16_t color){
    if(x<0||x>=activeW||h<=0)return;
    if(y<0){h+=y;y=0;}if(y+h>activeH)h=activeH-y;if(h<=0)return;
    for(int16_t i=0;i<h;i++)pixels[(y+i)*activeW+x]=color;
  }
  void fillRect(int16_t x,int16_t y,int16_t w,int16_t h,uint16_t color){
    if(w<=0||h<=0)return;
    int16_t x0=x<0?0:x,y0=y<0?0:y,x1=x+w,y1=y+h;
    if (x1 > activeW) x1 = activeW;
    if (y1 > activeH) y1 = activeH;
    if(x1<=x0||y1<=y0)return;
    for(int16_t yy=y0;yy<y1;yy++){
      uint16_t* p=pixels+yy*activeW+x0;
      for(int16_t xx=x0;xx<x1;xx++)*p++=color;
    }
  }
  uint16_t* data(){return pixels;}
  int16_t widthActive()const{return activeW;}
  int16_t heightActive()const{return activeH;}
private:
  uint16_t pixels[COMPOSE_MAX_W*COMPOSE_MAX_H];
  int16_t activeW,activeH;
};

static TileCanvas tile;
static uint8_t dirtyBits[(TILE_COUNT+7)/8];

static bool dirtyGet(int idx){return (dirtyBits[idx>>3]&(1u<<(idx&7)))!=0;}
static void dirtySet(int idx){dirtyBits[idx>>3]|=(uint8_t)(1u<<(idx&7));}
static void dirtyClear(int idx){dirtyBits[idx>>3]&=(uint8_t)~(1u<<(idx&7));}

static void markAllDirty(){
  memset(dirtyBits,0xFF,sizeof(dirtyBits));
  // clear excess high bits is unnecessary; loops never access them.
}

static void markDirtyRect(RectI rr){
  RectI r=clipRect(rr);
  if(rectEmpty(r))return;
  int c0=r.x0/TILE_W,c1=(r.x1-1)/TILE_W;
  int row0=r.y0/TILE_H,row1=(r.y1-1)/TILE_H;
  for(int y=row0;y<=row1;y++)for(int x=c0;x<=c1;x++)dirtySet(y*TILE_COLS+x);
}

struct Painter {
  Adafruit_GFX& c; int16_t ox,oy;
  Painter(Adafruit_GFX& cc,int16_t x,int16_t y):c(cc),ox(x),oy(y){}
  int16_t X(int16_t x)const{return x-ox;} int16_t Y(int16_t y)const{return y-oy;}
  void pixel(int16_t x,int16_t y,uint16_t col){c.drawPixel(X(x),Y(y),col);}
  void line(int16_t x0,int16_t y0,int16_t x1,int16_t y1,uint16_t col){c.drawLine(X(x0),Y(y0),X(x1),Y(y1),col);}
  void rect(int16_t x,int16_t y,int16_t w,int16_t h,uint16_t col){c.drawRect(X(x),Y(y),w,h,col);}
  void fill(int16_t x,int16_t y,int16_t w,int16_t h,uint16_t col){c.fillRect(X(x),Y(y),w,h,col);}
  void circle(int16_t x,int16_t y,int16_t r,uint16_t col){c.drawCircle(X(x),Y(y),r,col);}
  void fillCircle(int16_t x,int16_t y,int16_t r,uint16_t col){c.fillCircle(X(x),Y(y),r,col);}
  void tri(int16_t x0,int16_t y0,int16_t x1,int16_t y1,int16_t x2,int16_t y2,uint16_t col){c.fillTriangle(X(x0),Y(y0),X(x1),Y(y1),X(x2),Y(y2),col);}
  void text(int16_t x,int16_t y,const char* s,uint8_t size,uint16_t col){
    c.setTextWrap(false);c.setTextSize(size);c.setTextColor(col);c.setCursor(X(x),Y(y));c.print(s);
  }
};

static int16_t textWidth(const char* s,uint8_t size){return (int16_t)strlen(s)*6*size;}
static void centered(Painter& p,int16_t cx,int16_t y,const char* s,uint8_t size,uint16_t col){
  p.text(cx-textWidth(s,size)/2,y,s,size,col);
}

// Draw the currency symbol with primitives instead of relying on the host
// simulator/font implementation. This guarantees a visible dollar unit on
// both the simulator and the physical Adafruit GFX display.
static void drawDollarGlyph(Painter& p,int16_t x,int16_t y,uint8_t size,uint16_t col){
  const int16_t s=size;
  const int16_t left=x+s;
  const int16_t right=x+4*s;
  const int16_t mid=x+2*s;
  p.line(mid,y,mid,y+7*s-1,col);
  p.line(left,y+s,right,y+s,col);
  p.line(left,y+s,left,y+3*s,col);
  p.line(left,y+3*s,right,y+3*s,col);
  p.line(right,y+3*s,right,y+5*s,col);
  p.line(left,y+5*s,right,y+5*s,col);
}

static void moneyCentered(Painter& p,int16_t cx,int16_t y,uint32_t dollars,uint8_t size,uint16_t col){
  char number[24];
  formatMoneyNumber(dollars,number,sizeof(number));
  const int16_t dollarW=6*size;
  const int16_t numberW=textWidth(number,size);
  const int16_t x=(int16_t)(cx-(dollarW+numberW)/2);
  drawDollarGlyph(p,x,y,size,col);
  p.text((int16_t)(x+dollarW),y,number,size,col);
}

static void fillOval(Painter& p,int16_t cx,int16_t cy,int16_t w,int16_t h,uint16_t col){
  // Filled 12-gon approximation, cheap and tile-clipped.
  const int N=12;
  int16_t px[N],py[N];
  for(int i=0;i<N;i++){
    float a=2*DH_PI*i/N;
    px[i]=cx+(int16_t)roundf(cosf(a)*w*0.5f);
    py[i]=cy+(int16_t)roundf(sinf(a)*h*0.5f);
  }
  for(int i=0;i<N;i++)p.tri(cx,cy,px[i],py[i],px[(i+1)%N],py[(i+1)%N],col);
}

static void drawFish(Painter& p,uint8_t id,int16_t cx,int16_t cy,int16_t w,int16_t h,int8_t dir,uint16_t body,uint16_t accent,uint16_t glow,uint8_t frame){
  if(id>=SPECIES_COUNT)return;
  Shape sh=SPECIES[id].shape;
  int s=dir>=0?1:-1;
  int nose=cx+s*w/2,tail=cx-s*w/2;
  int eyeX=cx+s*w/4;
  int wag=(frame&1)?1:-1;

  switch(sh){
    case Shape::Bait:
      fillOval(p,cx,cy,w*3/4,h,body);
      p.tri(tail+s*(w*3/8),cy,tail,cy-h/2+wag,tail,cy+h/2+wag,accent);
      break;
    case Shape::Perch:
      fillOval(p,cx,cy,w*3/4,h,body);
      p.tri(tail+s*(w*3/8),cy,tail,cy-h/3,tail,cy+h/3,accent);
      p.tri(cx-w/8,cy-h/3,cx+w/8,cy-h/2,cx+w/4,cy-h/3,accent);
      break;
    case Shape::Oval:
      fillOval(p,cx,cy,w*2/3,h,body);
      p.tri(tail+s*(w/3),cy,tail,cy-h/4,tail,cy+h/4,accent);
      break;
    case Shape::Mahi:
      fillOval(p,cx,cy,w*3/4,h*3/4,body);
      p.fill(cx-w/4,cy-h/2,w/2,2,accent);
      p.tri(tail+s*(w*3/8),cy,tail,cy-h/3,tail,cy+h/3,accent);
      break;
    case Shape::Tuna:
      fillOval(p,cx,cy,w*3/4,h*3/4,body);
      p.tri(tail+s*(w*3/8),cy,tail,cy-h/2,tail,cy+h/2,accent);
      p.tri(cx,cy-h/3,cx-s*w/8,cy-h/2,cx+s*w/8,cy-h/3,accent);
      break;
    case Shape::Billfish:
    case Shape::Sailfish:
      fillOval(p,cx-s*w/10,cy,w*2/3,h*2/3,body);
      p.line(nose-s*w/6,cy,nose,cy,accent);
      p.line(nose-s*w/6,cy+1,nose,cy+1,accent);
      p.tri(tail+s*w/3,cy,tail,cy-h/3,tail,cy+h/3,accent);
      if(sh==Shape::Sailfish)p.tri(cx-w/5,cy-h/4,cx+w/7,cy-h/2,cx+w/4,cy-h/4,accent);
      break;
    case Shape::Ribbon:
    case Shape::Frilled:{
      int x0=tail+s*2,x1=cx-s*w/5,x2=cx+s*w/5,x3=nose-s*2;
      p.line(x0,cy+wag,x1,cy-2-wag,body);p.line(x0,cy+wag+1,x1,cy-1-wag,body);
      p.line(x1,cy-2-wag,x2,cy+2+wag,body);p.line(x1,cy-1-wag,x2,cy+3+wag,body);
      p.line(x2,cy+2+wag,x3,cy,body);p.line(x2,cy+3+wag,x3,cy+1,body);
      if(h>10){p.line(x0,cy-1+wag,x1,cy-4-wag,body);p.line(x1,cy-4-wag,x2,cy+4+wag,body);}
      if(sh==Shape::Frilled)for(int k=0;k<3;k++)p.line(nose-s*(w/5+k*3),cy-h/4,nose-s*(w/5+k*3),cy+h/4,accent);
      break;}
    case Shape::Shark:
      fillOval(p,cx-s*w/12,cy,w*2/3,h*2/3,body);
      p.tri(cx-s*w/8,cy-h/3,cx+s*w/10,cy-h/2,cx+s*w/5,cy-h/3,accent);
      p.tri(tail+s*w/3,cy,tail,cy-h/2,tail,cy+h/2,accent);
      break;
    case Shape::Squid:{
      fillOval(p,cx,cy-h/6,w/2,h/2,body);
      p.tri(cx-w/4,cy-h/4,cx+w/4,cy-h/4,cx,cy-h/2,accent);
      int baseY=cy+h/8;
      for(int k=-2;k<=2;k++){
        int ex=cx+k*w/12 + ((frame&1)?k:0);
        p.line(cx+k*w/18,baseY,ex,cy+h/2, k==0?accent:body);
        p.line(cx+k*w/18+1,baseY,ex+1,cy+h/2, k==0?accent:body);
      }
      break;}
    case Shape::Angler:
      fillOval(p,cx,cy,w*3/4,h*3/4,body);
      p.tri(nose-s*w/4,cy,nose,cy-h/6,nose,cy+h/6,accent);
      p.line(cx+s*w/8,cy-h/3,cx+s*w/4,cy-h/2,glow);
      p.fillCircle(cx+s*w/4,cy-h/2,1,glow);
      break;
    case Shape::Ray:
      p.tri(cx-w/2,cy,cx,cy-h/2,cx+w/2,cy,body);
      p.tri(cx-w/2,cy,cx,cy+h/2,cx+w/2,cy,body);
      p.line(cx+s*w/3,cy,nose,cy,accent);
      break;
    case Shape::Hatchet:
      p.tri(cx-w/3,cy-h/3,cx+w/3,cy-h/3,cx,cy+h/2,body);
      p.tri(tail+s*w/3,cy-h/4,tail,cy-h/2,tail,cy,accent);
      break;
    case Shape::Barreleye:
      fillOval(p,cx,cy,w*3/4,h*3/4,body);
      p.fill(cx+s*w/12,cy-h/3,w/4,h/3,accent);
      break;
    case Shape::Coelacanth:
      fillOval(p,cx,cy,w*3/4,h*3/4,body);
      p.tri(tail+s*w/3,cy,tail,cy-h/3,tail-s*3,cy,accent);
      p.tri(tail+s*w/3,cy,tail,cy+h/3,tail-s*3,cy,accent);
      p.tri(cx-s*w/8,cy+h/4,cx-s*w/4,cy+h/2,cx,cy+h/4,accent);
      break;
  }

  // Eye and species-specific identity marks.
  p.fillCircle(eyeX,cy-h/8,1,ST77XX_WHITE);
  p.pixel(eyeX+s,cy-h/8,ST77XX_BLACK);

  switch(id){
    case 1: for(int k=-1;k<=1;k++)p.pixel(cx+k*4,cy,accent);break;
    case 3: for(int k=-2;k<=2;k++)p.line(cx+k*3,cy-h/3,cx+k*3+s*2,cy,accent);break;
    case 7: p.line(cx-w/4,cy+h/5,cx+w/4,cy+h/5,accent);break;
    case 9: p.line(cx-w/4,cy-h/3,cx+w/4,cy-h/3,accent);break;
    case 10: for(int k=0;k<3;k++)p.pixel(nose-s*(2+k*2),cy+2,ST77XX_WHITE);break;
    case 13: for(int k=-2;k<=2;k++)p.line(cx+k*4,cy-h/4,cx+k*4+s*2,cy+h/4,accent);break;
    case 14: p.line(cx,cy,cx-s*w/3,cy+h/2,accent);break;
    case 15: for(int k=0;k<4;k++)p.pixel(tail+s*(w/4+k*3),cy-h/3,accent);break;
    case 17: p.line(nose-s*w/6,cy,nose+s*2,cy,ST77XX_WHITE);break;
    case 24: p.pixel(eyeX,cy-h/8,ST77XX_YELLOW);break;
    case 27: for(int k=-2;k<=2;k++)p.fillCircle(cx+k*3,cy+h/4,1,glow);break;
    case 28: p.line(cx-w/4,cy+h/3,cx+w/4,cy+h/3,glow);break;
    case 29: p.fillCircle(nose-s*w/5,cy+h/4,1,glow);break;
    case 30: for(int k=-2;k<=2;k++)p.pixel(cx+k*4,cy+h/4,glow);break;
    case 32: p.fill(cx-s*1,cy-h/3,3,3,glow);break;
    case 34: p.line(tail+s*w/3,cy-h/3,nose-s*w/4,cy-h/3,accent);break;
    case 36: p.line(nose-s*w/4,cy,nose+s*w/8,cy,accent);break;
    case 38: for(int k=0;k<6;k++)p.line(nose-s*(w/4+k*2),cy-h/6,nose-s*(w/4+k*2),cy+h/6,accent);break;
    case 40: p.fillCircle(cx-s*w/6,cy+h/4,2,accent);break;
    case 41: p.line(tail+s*3,cy-h/4,nose-s*3,cy-h/4,glow);break;
    case 42: p.fillCircle(cx-w/2,cy,1,glow);p.fillCircle(cx+w/2,cy,1,glow);break;
    case 43: for(int k=-2;k<=2;k++)p.pixel(cx+k*3,cy+h/3,glow);break;
    case 44: for(int k=-2;k<=2;k++)p.pixel(cx+k*4,cy-h/3,glow);break;
    case 45: for(int k=-1;k<=1;k++)p.fillCircle(cx+k*4,cy-h/2,1,glow);break;
    case 46: for(int k=-4;k<=4;k+=2)p.fillCircle(cx+k*5,cy-h/4,1,glow);break;
    default:break;
  }

  if(SPECIES[id].flags&F_BIOLUME){
    p.fillCircle(eyeX,cy-h/8,1,glow);
  }
}

static uint16_t pack565(uint8_t r,uint8_t gg,uint8_t b){return (uint16_t)(((r&0xF8)<<8)|((gg&0xFC)<<3)|(b>>3));}

static uint16_t waterColorAtDepth(float depthFt){
  struct Knot{float d;uint8_t r,g,b;};
  static const Knot k[]={
    {0,4,119,157},{300,4,75,137},{800,3,37,88},
    {1600,2,13,38},{3000,1,5,15},{5000,0,1,5}
  };
  if(depthFt<=0)return pack565(k[0].r,k[0].g,k[0].b);
  for(uint8_t i=0;i<5;i++){
    if(depthFt<=k[i+1].d){
      float t=smoothstep01((depthFt-k[i].d)/(k[i+1].d-k[i].d));
      uint8_t r=(uint8_t)roundf(lerpF(k[i].r,k[i+1].r,t));
      uint8_t gg=(uint8_t)roundf(lerpF(k[i].g,k[i+1].g,t));
      uint8_t b=(uint8_t)roundf(lerpF(k[i].b,k[i+1].b,t));
      return pack565(r,gg,b);
    }
  }
  return pack565(0,1,5);
}

static void computeFishLighting(const Fish& f,uint16_t& body,uint16_t& accent,uint16_t& glow){
  const SpeciesDef& s=SPECIES[f.speciesId];
  float depth=biomeDepthForWorldY(f.worldY);
  float ambient=1.0f;
  float detail=240, cue=300;
  if(depth<800){float t=depth/800;ambient=lerpF(1,0.62f,t);detail=lerpF(240,115,t);cue=lerpF(300,170,t);}
  else if(depth<1600){float t=(depth-800)/800;ambient=lerpF(.62f,.30f,t);detail=lerpF(115,88,t);cue=lerpF(170,145,t);}
  else if(depth<3000){float t=(depth-1600)/1400;ambient=lerpF(.30f,.16f,t);detail=lerpF(88,72,t);cue=lerpF(145,130,t);}
  else {float t=clampF((depth-3000)/2000,0,1);ambient=lerpF(.16f,.10f,t);detail=lerpF(72,65,t);cue=lerpF(130,120,t);}
  float dx=f.x-g.lure.x,dy=f.worldY-g.lure.y;
  float d=sqrtf(dx*dx+dy*dy)-sqrtf(fishHalfW(f)*fishHalfW(f)+fishHalfH(f)*fishHalfH(f));
  if(d<0)d=0;
  float light=ambient;
  if(d<detail)light=fmaxf(light,1.0f-(d/detail)*0.28f);
  else if(d<cue)light=fmaxf(light,0.24f*(1.0f-(d-detail)/(cue-detail))+0.12f);
  body=scaleColor(s.bodyColor,light);
  accent=scaleColor(s.accentColor,fminf(1.0f,light+0.10f));
  glow=(s.flags&F_BIOLUME)?s.glowColor:scaleColor(s.glowColor,light);
}

static RectI fishVisualBounds(int16_t x,int16_t y,uint8_t w,uint8_t h,uint8_t id){
  // Species art includes fins, bills, tentacle tips, glow points, and tail
  // animation that can extend beyond the nominal body footprint. A generous
  // dirty pad prevents stale pixels when fish move off the top/edges.
  int pad=(SPECIES[id].flags&F_BIOLUME)?10:8;
  return RectI(x-w/2-pad,y-h/2-pad,x+(w+1)/2+pad+1,y+(h+1)/2+pad+1);
}

static RectI particleBounds(int16_t x,int16_t y,ParticleKind k){
  int r=(k==ParticleKind::Impact||k==ParticleKind::Spark)?2:1;
  return RectI(x-r,y-r,x+r+1,y+r+1);
}

static void buildRenderSnapshot(){
  snap.phase=g.phase;snap.phaseElapsed=g.phaseElapsed;
  snap.selectedPlayers=g.selectedPlayers;snap.playerCount=g.playerCount;snap.currentPlayer=g.currentPlayer;
  snap.results[0]=g.results[0];snap.results[1]=g.results[1];
  snap.cameraTop=g.cameraTop;
  snap.lureX=(int16_t)roundf(g.lure.x);
  snap.lureY=(int16_t)roundf(worldToScreenY(g.lure.y));

  // Presentation-only first leg: visibly leave the boat and enter the water.
  // At INTRO_SURFACE_SEC this exactly meets world depth 0 (screen y=72), then
  // the actual lure position continues downward without a discontinuity.
  if(g.phase==Phase::CastIntro && g.phaseElapsed<INTRO_SURFACE_SEC) {
    const float t=smoothstep01(clampF(g.phaseElapsed/INTRO_SURFACE_SEC,0.0f,1.0f));
    snap.lureX=120;
    snap.lureY=(int16_t)roundf(50.0f + (72.0f-50.0f)*t);
  }

  snap.jigActive=g.jig.active;snap.jigDirection=g.jig.direction;
  snap.jigProgress=g.jig.active?clampF(g.jig.elapsed/JIG_DURATION,0,1):0;
  snap.jigCooldown=g.jig.cooldownRemaining;
  snap.lineLimitActive=g.lineLimitActive;snap.lineLimitRemaining=g.lineLimitRemaining;
  snap.depthFt=(uint16_t)clampF(floorf(displayedDepthForWorldY(g.lure.y) + 0.0001f),0,65535);
  snap.revealDisplayed=g.reveal.displayedValue;snap.revealComplete=g.reveal.animationComplete;

  // Keep the boat physically attached to the sea surface instead of to the
  // intro phase. At the initial surface clamp, worldY 0 is screen y=72 and
  // the boat top is y=55. As the camera descends, the boat scrolls upward
  // naturally and remains present until its complete silhouette leaves the
  // panel. Reeling uses the same relationship in reverse.
  {
    const int16_t surfaceY=(int16_t)roundf(-g.cameraTop);
    snap.boatY=(int16_t)(surfaceY-17);
    snap.boatBounds=RectI(76,snap.boatY-16,165,snap.boatY+19);
    snap.boatVisible=(snap.boatBounds.y1>0 && snap.boatBounds.y0<SCREEN_H);
  }

  for(int y=0;y<SCREEN_H;y++){
    if(g.phase==Phase::Title || g.phase==Phase::CatchReveal || g.phase==Phase::PlayerHandoff || g.phase==Phase::FinalResults){
      float d=clampF((y-40)*18.0f,0,5000);
      snap.rowColor[y]=waterColorAtDepth(d);
    }else if(y<HUD_TOP_H||y>=WATER_BOTTOM)snap.rowColor[y]=pack565(0,6,12);
    else{
      float depth=biomeDepthForWorldY(g.cameraTop+y);
      if(depth<0) snap.rowColor[y]=pack565(35,120,155);
      else snap.rowColor[y]=waterColorAtDepth(depth);
    }
  }

  for(uint8_t i=0;i<MAX_FISH;i++){
    FishDrawItem& d=snap.fish[i];d.active=false;
    const Fish& f=g.fish[i];
    if(!f.active)continue;
    int16_t sy=(int16_t)roundf(f.worldY-g.cameraTop);
    int16_t sx=(int16_t)roundf(f.x);
    uint16_t body,accent,glow;computeFishLighting(f,body,accent,glow);
    d.active=true;d.speciesId=f.speciesId;d.generation=f.generation;d.x=sx;d.y=sy;
    d.w=f.drawLength;d.h=f.drawHeight;d.direction=f.direction;d.animationFrame=f.animationFrame;
    d.body=body;d.accent=accent;d.glow=glow;d.bounds=fishVisualBounds(sx,sy,d.w,d.h,d.speciesId);
  }

  for(uint8_t i=0;i<MAX_PARTICLES;i++){
    ParticleDrawItem& d=snap.particles[i];d.active=false;
    const Particle& pp=g.particles[i];if(!pp.active)continue;
    int16_t x=(int16_t)roundf(pp.x),y=(int16_t)roundf(pp.worldY-g.cameraTop);
    d.active=true;d.x=x;d.y=y;d.color=pp.color;d.kind=pp.kind;d.bounds=particleBounds(x,y,pp.kind);
  }

  snap.lureBounds=RectI(snap.lureX-9,snap.lureY-11,snap.lureX+10,snap.lureY+13);

  // Track the complete line, not just a narrow box around the lure. The line
  // pivots from x=120, so old diagonal pixels can be far from the current
  // lure x and must be dirtied when steering sideways.
  int16_t endX=snap.lureX;
  int16_t endY=snap.lureY-4;
  int16_t bendX=endX, bendY=endY;
  if(g.jig.active && g.jig.direction!=JigDirection::Straight){
    bendX=endX-(int16_t)g.jig.direction*8;
    bendY=endY-18;
  }
  const int16_t lineStartX=120;
  const int16_t lineStartY=snap.boatVisible ? (int16_t)(snap.boatY-5) : WATER_TOP;
  int16_t lx0=(int16_t)fminf((float)lineStartX,fminf((float)endX,(float)bendX))-4;
  int16_t lx1=(int16_t)fmaxf((float)lineStartX,fmaxf((float)endX,(float)bendX))+5;
  int16_t ly0=(int16_t)fminf((float)lineStartY,fminf((float)endY,(float)bendY))-3;
  int16_t ly1=(int16_t)fmaxf((float)lineStartY,fmaxf((float)endY,(float)bendY))+4;
  snap.lineBounds=RectI(lx0,ly0,lx1,ly1);
}

static void collectDirtyTiles(){
  const bool seamlessIntroToPlay =
      g.seamlessIntroTransition && history.valid &&
      history.phase==Phase::CastIntro && snap.phase==Phase::Descending;

  if(!history.valid ||
     (g.forceFrame && !seamlessIntroToPlay) ||
     (history.phase!=snap.phase && !seamlessIntroToPlay)) {
    markAllDirty();
    return;
  }

  if(seamlessIntroToPlay) {
    // Remove only the surface boat/rod area. Generic old/new lure, line, fish,
    // particle and row-color invalidation below handles the rest.
    markDirtyRect(RectI(70,34,174,78));
  }

  // Intro presentation includes the boat-to-surface segment plus real
  // underwater descent. Refresh the whole narrow hook/line corridor.
  if(snap.phase==Phase::CastIntro)
    markDirtyRect(RectI(102,36,139,132));

  // During reeling the attached catch swings relative to the lure and is not
  // part of the live fish pool. Recompose the water region so the cinematic
  // cannot leave fish/line fragments behind.
  if(snap.phase==Phase::Reeling)
    markDirtyRect(RectI(0,WATER_TOP,SCREEN_W,WATER_BOTTOM));

  // Depth changes continuously during gameplay. Recompose the whole top HUD
  // band each presentation so stale digits can never visually concatenate
  // into apparent jumps such as 1,000 -> 17,000.
  if(snap.phase==Phase::Descending || snap.phase==Phase::Reeling || snap.phase==Phase::HookedFreeze)
    markDirtyRect(RectI(0,0,SCREEN_W,HUD_TOP_H));

  for(int y=0;y<SCREEN_H;y++){
    if(history.rowColor[y]!=snap.rowColor[y])markDirtyRect(RectI(0,y,SCREEN_W,y+1));
  }

  for(uint8_t i=0;i<MAX_FISH;i++){
    if(history.fishVisible[i])markDirtyRect(history.fishBounds[i]);
    if(snap.fish[i].active)markDirtyRect(snap.fish[i].bounds);
  }
  for(uint8_t i=0;i<MAX_PARTICLES;i++){
    if(history.particleVisible[i])markDirtyRect(history.particleBounds[i]);
    if(snap.particles[i].active)markDirtyRect(snap.particles[i].bounds);
  }
  if(history.boatVisible)markDirtyRect(history.boatBounds);
  if(snap.boatVisible)markDirtyRect(snap.boatBounds);
  markDirtyRect(history.lureBounds);markDirtyRect(snap.lureBounds);
  markDirtyRect(history.lineBounds);markDirtyRect(snap.lineBounds);

  if(history.depthFt!=snap.depthFt||history.lineLimitActive!=snap.lineLimitActive||
     history.lineLimitSec!=(uint16_t)ceilf(snap.lineLimitRemaining))
    markDirtyRect(RectI(0,0,SCREEN_W,HUD_TOP_H));

  uint8_t cdpx=(uint8_t)roundf((1.0f-clampF(snap.jigCooldown/JIG_COOLDOWN,0,1))*187.0f);
  if(history.cooldownPx!=cdpx)markDirtyRect(RectI(38,292,234,314));

  if(history.revealDisplayed!=snap.revealDisplayed||history.revealComplete!=snap.revealComplete)
    markDirtyRect(RectI(0,190,SCREEN_W,318));

  if(history.selectedPlayers!=snap.selectedPlayers)
    markDirtyRect(RectI(10,208,230,284));
}

static void drawBackground(Painter& p,const RectI& region){
  for(int y=region.y0;y<region.y1;y++)p.fill(region.x0,y,region.x1-region.x0,1,snap.rowColor[y]);
}

static void drawBoat(Painter& p,int16_t y){
  p.fill(78,y,84,8,pack565(55,45,35));
  p.tri(78,y+8,162,y+8,150,y+17,pack565(35,30,28));
  p.line(120,y,120,y-14,ST77XX_WHITE);
  p.tri(121,y-14,121,y-2,143,y-2,pack565(210,215,200));
}

static void drawLure(Painter& p){
  int x=snap.lureX,y=snap.lureY;
  p.circle(x,y,7,scaleColor(ST77XX_CYAN,0.25f));
  p.circle(x,y,4,scaleColor(ST77XX_CYAN,0.45f));
  p.fill(x-2,y-4,4,7,ST77XX_WHITE);
  p.fill(x-1,y-3,2,4,ST77XX_CYAN);
  p.line(x,y+2,x,y+7,ST77XX_WHITE);
  p.line(x,y+7,x+4,y+7,ST77XX_WHITE);
  p.line(x+4,y+7,x+5,y+4,ST77XX_WHITE);
}

static void drawLine(Painter& p){
  int x=snap.lureX,y=snap.lureY-4;
  uint16_t c=pack565(90,130,145);
  const int startY=snap.boatVisible ? (snap.boatY-5) : WATER_TOP;
  if(snap.jigActive && snap.jigDirection!=JigDirection::Straight){
    int bendX=x-(int)snap.jigDirection*8;
    int bendY=y-18;
    p.line(120,startY,bendX,bendY,c);p.line(bendX,bendY,x,y,c);
  }else p.line(120,startY,x,y,c);
}

static void drawHud(Painter& p){
  p.fill(0,0,SCREEN_W,HUD_TOP_H,pack565(0,6,12));
  p.fill(0,WATER_BOTTOM,SCREEN_W,HUD_BOTTOM_H,pack565(0,6,12));
  p.line(0,31,239,31,pack565(40,100,115));
  p.line(0,288,239,288,pack565(40,100,115));

  char buf[24];
  snprintf(buf,sizeof(buf),"P%u",(unsigned)(snap.currentPlayer+1));
  p.text(8,10,buf,2,ST77XX_WHITE);

  // Fixed 48 px depth cell, entirely within the x=192..239 compositor run.
  // Always repaint the complete cell before text so old digits cannot survive.
  p.fill(192,1,48,29,pack565(0,6,12));
  formatHudDepth(snap.depthFt,buf,sizeof(buf));
  p.text(196,12,buf,1,ST77XX_WHITE);

  if(snap.lineLimitActive){
    char lim[18];snprintf(lim,sizeof(lim),"LIMIT %us",(unsigned)ceilf(snap.lineLimitRemaining));
    p.text(130,21,lim,1,ST77XX_YELLOW);
  }

  p.text(8,299,"JIG",1,ST77XX_WHITE);
  p.rect(42,297,190,13,pack565(80,130,140));
  int fill=(int)roundf((1.0f-clampF(snap.jigCooldown/JIG_COOLDOWN,0,1))*187.0f);
  uint16_t c=snap.jigCooldown<=0.001f?ST77XX_CYAN:pack565(45,105,110);
  if(fill>0)p.fill(44,299,fill,9,c);
}

static void drawGameplayScene(Painter& p,const RectI& region){
  drawBackground(p,region);

  // The boat belongs to world depth 0, not to a particular phase. It remains
  // visible through the intro and early descent, then scrolls naturally off
  // the top as the camera follows the hook. It re-enters naturally on reel-up.
  if(snap.boatVisible) drawBoat(p,snap.boatY);

  for(uint8_t i=0;i<MAX_PARTICLES;i++){
    const ParticleDrawItem& d=snap.particles[i];
    if(!d.active||!rectIntersects(region,d.bounds))continue;
    if(d.kind==ParticleKind::Bubble)p.circle(d.x,d.y,1,d.color);
    else p.fillCircle(d.x,d.y,d.kind==ParticleKind::Impact?2:1,d.color);
  }

  drawLine(p);

  for(uint8_t i=0;i<MAX_FISH;i++){
    const FishDrawItem& d=snap.fish[i];
    if(!d.active||!rectIntersects(region,d.bounds))continue;
    drawFish(p,d.speciesId,d.x,d.y,d.w,d.h,d.direction,d.body,d.accent,d.glow,d.animationFrame);
  }

  if(snap.phase==Phase::Reeling && snap.results[snap.currentPlayer].completed && !snap.results[snap.currentPlayer].empty){
    const CatchResult& r=snap.results[snap.currentPlayer];
    int swing=(int)roundf(6*sinf(snap.phaseElapsed*6.0f));
    int fy=snap.lureY+16+(int)roundf(2*sinf(snap.phaseElapsed*9.0f));
    uint8_t w=r.drawLength,h=r.drawHeight;
    drawFish(p,r.speciesId,snap.lureX+swing,fy,w,h,g.attachedDirection,
             SPECIES[r.speciesId].bodyColor,SPECIES[r.speciesId].accentColor,SPECIES[r.speciesId].glowColor,0);
  }

  drawLure(p);
  drawHud(p);

  if(snap.phase==Phase::HookedFreeze){
    p.fill(55,52,130,24,pack565(0,20,30));
    centered(p,120,57,"HOOKED!",2,ST77XX_YELLOW);
  }
  if(snap.lineLimitActive && snap.lineLimitRemaining>11.4f){
    p.fill(58,52,124,20,pack565(0,20,30));
    centered(p,120,56,"LINE LIMIT",1,ST77XX_YELLOW);
  }
}

static void drawTitleScene(Painter& p,const RectI& region){
  drawBackground(p,region);
  p.line(0,64,239,64,pack565(160,220,230));
  drawBoat(p,48);
  centered(p,120,20,"DEEP HOOK",3,ST77XX_WHITE);
  centered(p,120,48,"GO DEEP. PICK YOUR CATCH.",1,ST77XX_CYAN);
  p.line(120,65,120,158,pack565(90,130,145));
  p.fill(118,154,4,8,ST77XX_WHITE);

  drawFish(p,17,45,110,44,20,1,scaleColor(SPECIES[17].bodyColor,.65f),scaleColor(SPECIES[17].accentColor,.65f),SPECIES[17].glowColor,0);
  drawFish(p,37,184,153,54,22,-1,scaleColor(SPECIES[37].bodyColor,.58f),scaleColor(SPECIES[37].accentColor,.58f),SPECIES[37].glowColor,1);
  drawFish(p,46,120,195,90,20,1,scaleColor(SPECIES[46].bodyColor,.35f),scaleColor(SPECIES[46].accentColor,.35f),SPECIES[46].glowColor,2);

  uint16_t sel=ST77XX_CYAN,dim=pack565(45,90,100);
  p.rect(22,214,196,30,snap.selectedPlayers==1?sel:dim);
  p.rect(22,252,196,30,snap.selectedPlayers==2?sel:dim);
  centered(p,120,222,"1 PLAYER",2,snap.selectedPlayers==1?ST77XX_WHITE:pack565(150,170,175));
  centered(p,120,260,"2 PLAYERS",2,snap.selectedPlayers==2?ST77XX_WHITE:pack565(150,170,175));
  p.fill(0,MenuFooter::Y,MenuFooter::WIDTH,MenuFooter::HEIGHT,MenuFooter::BACKGROUND);
  centered(p,120,MenuFooter::Y+4,MenuFooter::TEXT,1,MenuFooter::FOREGROUND);
}

static void previewFish(Painter& p,const CatchResult& r,int yCenter){
  if(r.empty||r.speciesId>=SPECIES_COUNT)return;
  const SpeciesDef& s=SPECIES[r.speciesId];
  float scale=fminf(150.0f/r.drawLength,68.0f/r.drawHeight);
  if(scale>2.4f)scale=2.4f;
  int w=(int)(r.drawLength*scale),h=(int)(r.drawHeight*scale);
  drawFish(p,r.speciesId,120,yCenter,w,h,1,s.bodyColor,s.accentColor,s.glowColor,1);
}

static void drawRevealScene(Painter& p,const RectI& region){
  drawBackground(p,region);
  const CatchResult& r=snap.results[snap.currentPlayer];
  char buf[40];
  snprintf(buf,sizeof(buf),"PLAYER %u CATCH",(unsigned)(snap.currentPlayer+1));
  centered(p,120,12,buf,1,ST77XX_CYAN);
  if(r.empty){
    centered(p,120,43,"EMPTY LINE",3,ST77XX_WHITE);
    p.line(120,85,120,145,ST77XX_WHITE);
    p.line(120,145,130,145,ST77XX_WHITE);p.line(130,145,133,138,ST77XX_WHITE);
    moneyCentered(p,120,218,0,3,ST77XX_YELLOW);
    centered(p,120,260,"NO CATCH",1,ST77XX_CYAN);
  }else{
    uint8_t titleSize=strlen(SPECIES[r.speciesId].name)>18?1:2;
    centered(p,120,titleSize==2?42:50,SPECIES[r.speciesId].name,titleSize,ST77XX_WHITE);
    previewFish(p,r,121);
    formatLength(r.lengthTenths,buf,sizeof(buf));centered(p,120,169,buf,1,ST77XX_WHITE);
    uint16_t classColor=(r.sizeClass==SizeClass::Trophy)?ST77XX_YELLOW:(r.sizeClass==SizeClass::Monster?ST77XX_CYAN:ST77XX_WHITE);
    centered(p,120,194,sizeClassLabel(r.sizeClass),1,classColor);
    moneyCentered(p,120,220,snap.revealDisplayed,3,ST77XX_YELLOW);
    char depthBuf[28]; snprintf(depthBuf,sizeof(depthBuf),"CAUGHT %u FT",(unsigned)r.caughtDepthFt); centered(p,120,258,depthBuf,1,ST77XX_CYAN);
    uint8_t bonus=bonusPercent(r.sizeClass);
    if(bonus){snprintf(buf,sizeof(buf),"+%u%% SIZE BONUS",(unsigned)bonus);centered(p,120,280,buf,1,classColor);}
  }
  if(snap.revealComplete){
    const char* prompt=(snap.playerCount==1)?"BUTTON: CAST AGAIN":(snap.currentPlayer==0?"BUTTON: PASS TO PLAYER 2":"BUTTON: FINAL RESULTS");
    centered(p,120,305,prompt,1,ST77XX_WHITE);
  }
}

static void drawResultSummary(Painter& p,const CatchResult& r,int y,bool highlight,uint8_t player){
  uint16_t border=highlight?ST77XX_YELLOW:pack565(50,100,115);
  p.rect(10,y,220,90,border);
  char b[40];snprintf(b,sizeof(b),"PLAYER %u",(unsigned)player);p.text(18,y+8,b,1,ST77XX_CYAN);
  if(r.empty){
    p.text(18,y+27,"EMPTY LINE",2,ST77XX_WHITE);
    moneyCentered(p,120,y+55,0,2,ST77XX_YELLOW);
  }else{
    p.text(18,y+27,SPECIES[r.speciesId].name,1,ST77XX_WHITE);
    formatLength(r.lengthTenths,b,sizeof(b));p.text(18,y+44,b,1,ST77XX_WHITE);
    moneyCentered(p,120,y+61,r.finalValue,2,ST77XX_YELLOW);
  }
}

static void drawHandoffScene(Painter& p,const RectI& region){
  drawBackground(p,region);
  centered(p,120,22,"PASS TO PLAYER 2",2,ST77XX_WHITE);
  centered(p,120,48,"PLAYER 1 RESULT",1,ST77XX_CYAN);
  drawResultSummary(p,snap.results[0],78,false,1);
  centered(p,120,286,"BUTTON WHEN READY",1,ST77XX_WHITE);
}

static void drawFinalScene(Painter& p,const RectI& region){
  drawBackground(p,region);
  centered(p,120,12,"FINAL CATCHES",2,ST77XX_WHITE);
  uint32_t a=snap.results[0].finalValue,b=snap.results[1].finalValue;
  bool p1=a>b,p2=b>a;
  drawResultSummary(p,snap.results[0],43,p1,1);
  drawResultSummary(p,snap.results[1],143,p2,2);
  if(a==b){
    centered(p,120,255,"DRAW",1,ST77XX_CYAN);
  }else if(p1){
    centered(p,120,255,"PLAYER 1 WINS",1,ST77XX_YELLOW);
  }else{
    centered(p,120,255,"PLAYER 2 WINS",1,ST77XX_YELLOW);
  }
  centered(p,120,284,"BUTTON: REMATCH",1,ST77XX_WHITE);
  p.fill(0,MenuFooter::Y,MenuFooter::WIDTH,MenuFooter::HEIGHT,MenuFooter::BACKGROUND);
  centered(p,120,MenuFooter::Y+4,MenuFooter::TEXT,1,MenuFooter::FOREGROUND);
}

static void composeRegion(const RectI& region){
  tile.beginRegion(region.x1-region.x0,region.y1-region.y0);
  Painter p(tile,region.x0,region.y0);
  if(snap.phase==Phase::Title)drawTitleScene(p,region);
  else if(snap.phase==Phase::CatchReveal)drawRevealScene(p,region);
  else if(snap.phase==Phase::PlayerHandoff)drawHandoffScene(p,region);
  else if(snap.phase==Phase::FinalResults)drawFinalScene(p,region);
  else drawGameplayScene(p,region);
}

static void blitRegion(const RectI& r){
  int w=r.x1-r.x0,h=r.y1-r.y0;
  display.drawRGBBitmap(r.x0,r.y0,tile.data(),w,h);
}

static void commitPresentation(){
  history.valid=true;history.phase=snap.phase;
  for(uint8_t i=0;i<MAX_FISH;i++){
    history.fishVisible[i]=snap.fish[i].active;
    history.fishGeneration[i]=snap.fish[i].generation;
    history.fishBounds[i]=snap.fish[i].bounds;
  }
  for(uint8_t i=0;i<MAX_PARTICLES;i++){
    history.particleVisible[i]=snap.particles[i].active;
    history.particleBounds[i]=snap.particles[i].bounds;
  }
  history.boatVisible=snap.boatVisible;history.boatBounds=snap.boatBounds;
  history.lureBounds=snap.lureBounds;history.lineBounds=snap.lineBounds;
  memcpy(history.rowColor,snap.rowColor,sizeof(history.rowColor));
  history.depthFt=snap.depthFt;
  history.cooldownPx=(uint8_t)roundf((1.0f-clampF(snap.jigCooldown/JIG_COOLDOWN,0,1))*187.0f);
  history.lineLimitActive=snap.lineLimitActive;
  history.lineLimitSec=(uint16_t)ceilf(snap.lineLimitRemaining);
  history.revealDisplayed=snap.revealDisplayed;
  history.revealComplete=snap.revealComplete;
  history.selectedPlayers=snap.selectedPlayers;
  g.forceFrame=false;
  g.seamlessIntroTransition=false;
}

static void renderDirtyTiles(){
  uint32_t started=micros();
  for(int row=0;row<TILE_ROWS;row++){
    int col=0;
    while(col<TILE_COLS){
      int idx=row*TILE_COLS+col;
      if(!dirtyGet(idx)){++col;continue;}
      int start=col,count=0;
      const bool wideUi = (snap.phase==Phase::Title || snap.phase==Phase::CatchReveal ||
                           snap.phase==Phase::PlayerHandoff || snap.phase==Phase::FinalResults);
      const int maxRun = wideUi ? TILE_COLS : 4;
      while(col<TILE_COLS&&count<maxRun&&dirtyGet(row*TILE_COLS+col)){++col;++count;}
      RectI r(start*TILE_W,row*TILE_H,(start+count)*TILE_W,(row+1)*TILE_H);
      r=clipRect(r);
      composeRegion(r);
      blitRegion(r);
      for(int c=start;c<start+count;c++)dirtyClear(row*TILE_COLS+c);
    }
  }
  uint32_t elapsed=micros()-started;
  if(elapsed>18000u){
    if(g.clock.slowFrames<60000)++g.clock.slowFrames;
    g.clock.goodFrames=0;
  }else if(elapsed<14500u){
    if(g.clock.goodFrames<60000)++g.clock.goodFrames;
    if(g.clock.slowFrames) --g.clock.slowFrames;
  }
  if(g.clock.slowFrames>30 && g.clock.renderIntervalUs<RENDER_40_US)g.clock.renderIntervalUs=RENDER_40_US;
  if(g.clock.slowFrames>60)g.clock.renderIntervalUs=RENDER_30_US;
  if(g.clock.goodFrames>250 && g.clock.renderIntervalUs>RENDER_50_US){
    g.clock.renderIntervalUs=(g.clock.renderIntervalUs==RENDER_30_US)?RENDER_40_US:RENDER_50_US;
    g.clock.goodFrames=0;g.clock.slowFrames=0;
  }
}

static void renderFrame(){
  buildRenderSnapshot();
  collectDirtyTiles();
  renderDirtyTiles();
  commitPresentation();
}

// ============================================================
// Public entry points
// ============================================================

static bool validateSpeciesTable(){
  if(SPECIES_COUNT!=47)return false;
  for(uint8_t i=0;i<SPECIES_COUNT;i++){
    const SpeciesDef& s=SPECIES[i];
    if(!s.name||!s.name[0]||s.minDepthFt>s.maxDepthFt||s.minLengthTenths>s.typicalLengthTenths||
       s.typicalLengthTenths>s.maxLengthTenths||s.spawnWeight==0)return false;
  }
  return true;
}

void enter(){
  stopOwnedSfx();
  g = GameState();
  history = PresentationHistory();
  memset(dirtyBits,0,sizeof(dirtyBits));

  display.setRotation(0);
  display.setTextWrap(false);

  g.phase=Phase::Title;
  g.selectedPlayers=1;
  g.playerCount=1;
  g.results[0].speciesId=g.results[1].speciesId=INVALID_SPECIES;
  g.cameraTop=CAMERA_SURFACE_CLAMP;
  g.lure=Vec2(120,0);g.prevLure=g.lure;
  g.clock.lastUs=micros();
  g.clock.lastPresentationUs=g.clock.lastUs;
  g.clock.accumulatorUs=0;
  g.clock.renderIntervalUs=RENDER_50_US;
  g.sessionSeed=(uint32_t)micros() ^ ((uint32_t)millis()<<16) ^ 0xD33F00D1u;
  if(!g.sessionSeed)g.sessionSeed=0xD33F00D1u;
  g.rng=g.sessionSeed;
  g.cosmeticSeed=g.sessionSeed^0xB5297A4Du;
  g.forceFrame=true;
  g.firstOuterUpdate=true;
  g.input.initialized=false;
  g.sfx.suppressedForExit=false;
  g.sfx.bothHeldSinceMs=0;
  validateSpeciesTable();

  markAllDirty();
  buildRenderSnapshot();
  renderDirtyTiles();
  commitPresentation();
}

void update(const GameInput& launcherInput){
  uint32_t nowMs=millis();
  uint32_t nowUs=micros();

  sampleAndDebounceInput(launcherInput,nowMs);
  updateExitAudioGuard(launcherInput,nowMs);
  updateAudio(nowMs);

  uint32_t elapsed=nowUs-g.clock.lastUs;
  g.clock.lastUs=nowUs;
  if(elapsed>MAX_ELAPSED_US)elapsed=MAX_ELAPSED_US;
  g.clock.accumulatorUs+=elapsed;

  uint8_t steps=0;
  while(g.clock.accumulatorUs>=FIXED_US&&steps<MAX_CATCHUP){
    simulateStep(FIXED_DT,nowMs);
    g.clock.accumulatorUs-=FIXED_US;
    ++steps;
  }
  if(g.clock.accumulatorUs>=FIXED_US){
    ++g.clock.overloadCount;
    g.clock.accumulatorUs%=FIXED_US;
  }

  bool due=(uint32_t)(nowUs-g.clock.lastPresentationUs)>=g.clock.renderIntervalUs;
  if(due||g.forceFrame){
    g.clock.lastPresentationUs=nowUs;
    renderFrame();
  }
}

} // namespace DeepHook
