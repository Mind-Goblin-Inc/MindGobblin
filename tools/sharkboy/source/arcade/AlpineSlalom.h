#pragma once

#include "GameAPI.h"
#include "Hardware.h"
#include <Arduino.h>
#include <Adafruit_ST7789.h>
#include <stdint.h>
#include <stddef.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

// Optional launcher hook. On the real Jakeboy sketch this resolves to the
// launcher's global enterMenu(); simulator/standalone builds can leave it absent.
#if defined(__GNUC__)
extern void enterMenu() __attribute__((weak));
#define ALPINE_HAS_WEAK_MENU_HOOK 1
#else
#define ALPINE_HAS_WEAK_MENU_HOOK 0
#endif

#if defined(ARDUINO_ARCH_ESP32) && defined(__has_include)
  #if __has_include("GameRenderMemory.h")
    #include "GameRenderMemory.h"
    #define ALPINE_HAS_SHARED_RENDER_MEMORY 1
  #endif
#endif

#if defined(GAME_API_LIFECYCLE_VERSION) && GAME_API_LIFECYCLE_VERSION >= 1
  #define ALPINE_EXTENDED_API 1
#else
  #define ALPINE_EXTENDED_API 0
#endif

namespace AlpineSlalom {

// ============================================================
// Structural constants
// ============================================================

static constexpr int16_t SCREEN_W = 240;
static constexpr int16_t SCREEN_H = 320;
static constexpr int16_t HUD_H = 32;
static constexpr int16_t WORLD_TOP = 32;
static constexpr int16_t WORLD_BOTTOM = SCREEN_H;
static constexpr int16_t FOOTER_Y = 304;
static constexpr int16_t FOOTER_H = 16;
static constexpr int16_t STRIP_H = 16;

static constexpr uint32_t STEP_US = 10000;
static constexpr float STEP_DT = 0.01f;
static constexpr uint8_t MAX_STEPS_PER_UPDATE = 8;
static constexpr uint32_t FRAME_INTERVAL_US = 33333;
static constexpr uint32_t HUD_INTERVAL_MS = 100;

static constexpr uint8_t GATE_COUNT = 30;
static constexpr uint8_t TREE_COUNT = 96;
static constexpr uint8_t CENTER_NODE_COUNT = 25;
static constexpr uint8_t TRACK_CAPACITY = 64;
static constexpr uint8_t PARTICLE_CAPACITY = 32;

static constexpr float COURSE_LENGTH = 1195.0f;
static constexpr uint32_t COUNTDOWN_MS = 1500;
static constexpr uint32_t COAST_MS = 900;

// ============================================================
// Physics and rules
// ============================================================

static constexpr float START_SPEED = 6.0f;
static constexpr float MIN_SPEED = 2.5f;
static constexpr float MAX_SPEED = 22.0f;
static constexpr float MAX_LATERAL_SPEED = 12.0f;

static constexpr float CARVE_BUILD_RATE = 2.0f;
static constexpr float CARVE_REVERSE_RATE = 2.6f;
static constexpr float CARVE_RETURN_RATE = 1.6f;
static constexpr float MAX_HEADING = 0.66f;

static constexpr float NEUTRAL_GRIP = 0.30f;
static constexpr float EDGE_GRIP_GAIN = 1.60f;
static constexpr float GRIP_ACCEL_LIMIT = 11.0f;
static constexpr float SKID_DEMAND_RANGE = 14.0f;
static constexpr float SKID_GRIP_LOSS = 0.30f;
static constexpr float SKID_RISE_TAU = 0.10f;
static constexpr float SKID_FALL_TAU = 0.30f;

static constexpr float DOWNHILL_ACCEL = 5.2f;
static constexpr float AIR_DRAG = 0.01075f;
static constexpr float TURN_DRAG_2 = 0.04f;
static constexpr float TURN_DRAG_4 = 0.30f;
static constexpr float SKID_DRAG = 0.35f;
static constexpr float TRANSITION_DRAG = 0.06f;
static constexpr float ROUGH_FORWARD_DRAG = 1.0f;
static constexpr float ROUGH_LATERAL_DRAG = 1.2f;

static constexpr float PISTE_HALF = 13.0f;
static constexpr float OFFPISTE_RAMP = 8.0f;
static constexpr float PLAYER_RADIUS = 0.32f;
static constexpr float POLE_RADIUS = 0.12f;
static constexpr float GATE_CLEARANCE = 0.65f;

static constexpr uint32_t MISS_PENALTY_MS = 3000;
static constexpr uint32_t HIT_PENALTY_MS = 3000;
static constexpr uint32_t CRASH_PENALTY_MS = 2000;

static constexpr float POLE_SPEED_MULT = 0.62f;
static constexpr float POLE_LATERAL_MULT = 0.60f;
static constexpr float SEVERE_POLE_SPEED = 18.5f;
static constexpr float SEVERE_POLE_DISTANCE = 0.22f;

static constexpr float CRASH_DURATION = 1.20f;
static constexpr float RECOVERY_SLIDE_START = 0.80f;
static constexpr float RECOVERY_SPEED = 4.5f;
static constexpr float RECOVERY_SAFE_HALF = 9.5f;
static constexpr float RECOVERY_GRACE = 1.00f;

static constexpr int16_t PLAYER_ANCHOR_Y = 246;
static constexpr float PROJ_D = 45.0f;
static constexpr float PROJ_F = 360.0f;
static constexpr float PROJ_S0 = 7.5f;

// ============================================================
// Palette
// ============================================================

static constexpr uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) {
  return (uint16_t)(((uint16_t)(r & 0xF8) << 8) |
                    ((uint16_t)(g & 0xFC) << 3) |
                    ((uint16_t)b >> 3));
}
static constexpr uint16_t C_SNOW = rgb565(0xF2,0xF7,0xF7);
static constexpr uint16_t C_WHITE = rgb565(0xFF,0xFF,0xFF);
static constexpr uint16_t C_PALE = rgb565(0xDF,0xED,0xF2);
static constexpr uint16_t C_SHADOW = rgb565(0xB8,0xD4,0xE2);
static constexpr uint16_t C_ROUGH = rgb565(0xCB,0xDE,0xE5);
static constexpr uint16_t C_NAVY = rgb565(0x17,0x35,0x4A);
static constexpr uint16_t C_PINE_DARK = rgb565(0x16,0x4A,0x45);
static constexpr uint16_t C_PINE_LIGHT = rgb565(0x2C,0x6C,0x62);
static constexpr uint16_t C_RED = rgb565(0xE7,0x48,0x4D);
static constexpr uint16_t C_BLUE = rgb565(0x24,0x6D,0xCE);
static constexpr uint16_t C_ORANGE = rgb565(0xF5,0x9E,0x42);
static constexpr uint16_t C_GOLD = rgb565(0xFF,0xD2,0x76);
static constexpr uint16_t C_ROCK = rgb565(0x74,0x8A,0x96);
static constexpr uint16_t C_SKIER_LIME = rgb565(0xCD,0xEB,0x19);
static constexpr uint16_t C_SKIER_TAN = rgb565(0xB8,0x8E,0x6F);
static constexpr uint16_t C_SUIT_LIGHT = rgb565(0xB0,0xC5,0xD8);
static constexpr uint16_t C_SUIT_MID = rgb565(0x8C,0xA7,0xBC);
static constexpr uint16_t C_SPRAY_CYAN = rgb565(0x53,0xD6,0xF2);

// ============================================================
// Data model
// ============================================================

enum class Phase : uint8_t { Title, Countdown, Racing, FinishCoast, Results, Wipeout };
enum class MoveMode : uint8_t { Skiing, Crashed };
enum class PassSide : int8_t { Left = -1, Right = 1 };
enum class GateOutcome : uint8_t { Pending, Clean, Hit, Miss };
enum class ObstacleKind : uint8_t { Pine, Rock };
enum class NoticeKind : uint8_t { None, Clean, Miss, Hit, Crash, Go, Finish };
enum class EventKind : uint8_t { None, Pole, Obstacle, OuterEdge, GatePlane, Finish };

struct Vec2 { float x, z; };

struct Controls {
  bool leftHeld;
  bool rightHeld;
  int8_t steer;
  bool uiTap;
};

struct TapLatch {
  bool armed;
  bool cancelled;
  uint8_t candidate;
  uint32_t neutralSinceMs;
  uint32_t pressedAtMs;
  bool neutralTracking;
  bool prevLeft;
  bool prevRight;
};

struct PlayerState {
  float x, z, vx, v, carve, heading, carveRate, skid;
  MoveMode mode;
  float crashAge, graceRemaining, crashStartX, recoverTargetX;
  int8_t crashSpinSign;
};

struct GateDef {
  float z, x;
  PassSide passSide;
  uint8_t ordinal;
};

struct CourseNode {
  float z, x;
};

struct GateRuntime {
  GateOutcome outcome;
  float hitAge;
  float cleanHighlightRemaining;
  int8_t bendSign;
};

struct ObstacleDef {
  float x, z, radius;
  ObstacleKind kind;
};

struct RunStats {
  uint32_t penaltyMs;
  uint8_t cleared, hits, misses, crashes, streak, bestStreak;
  float topSpeed;
  bool recordEligible;
};

struct FrozenResult {
  uint64_t rawUs;
  uint32_t rawMs, penaltyMs, finalMs;
  uint8_t cleared, hits, misses, crashes, bestStreak;
  bool valid, recordEligible, newBest;
};

struct SessionRecords {
  bool hasBest;
  uint32_t bestFinalMs;
};

struct CameraState { float x; };

struct TrackNode {
  float x, z, heading;
  uint8_t shade;
  bool breakBefore;
};

struct TrackState {
  TrackNode nodes[TRACK_CAPACITY];
  uint8_t head, count;
  float distanceResidual;
  bool breakNext;
};

struct SnowParticle {
  float x,z,height,vx,vz,vh,age,life;
  uint8_t size,shade;
  bool active;
};

struct EffectState {
  SnowParticle snow[PARTICLE_CAPACITY];
  float sprayCredit;
  uint32_t rng;
  uint8_t replaceCursor;
  NoticeKind notice;
  float noticeAge;
  float noticeLife;
  uint8_t noticeStreak;
};

struct RaceClock {
  uint32_t lastUpdateUs;
  uint32_t accumulatorUs;
  uint32_t lastRenderUs;
  uint64_t processedRaceUs;
  uint32_t phaseStartedMs;
  uint32_t lastHudMs;
  bool initialized;
};

struct MotionEvent {
  EventKind kind;
  float fraction;
  uint8_t index;
  int8_t side;
  float closestDistance;
};

struct Projected {
  float x,y,scale;
  bool visible;
};

struct GameState {
  Phase phase;
  Controls controls;
  TapLatch tap;
  PlayerState player;
  GateRuntime gates[GATE_COUNT];
  RunStats stats;
  FrozenResult result;
  CameraState camera;
  TrackState tracks;
  EffectState effects;
  RaceClock clock;
  uint8_t nextGate;
  uint8_t countdownStage;
  float coastZ;
  float coastSpeed;
  uint32_t coastStartedMs;
  uint32_t wipeoutStartedMs;
  bool forceFrame;
  bool hudDirty;
};

static GameState g;
static SessionRecords records = {false, 0};

// ============================================================
// Procedural course / open mountain
// ============================================================

static GateDef runCourse[GATE_COUNT];
static ObstacleDef runTrees[TREE_COUNT];
static CourseNode centerNodes[CENTER_NODE_COUNT];
static uint32_t layoutRng = 0x41C64E6Du;
static uint32_t runCounter = 0;

static inline uint32_t nextLayoutRandom() {
  uint32_t x=layoutRng;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  if (!x) x=0x41C64E6Du;
  layoutRng=x;
  return x;
}

static inline float layout01() {
  return (nextLayoutRandom() & 0x00FFFFFFu) / 16777216.0f;
}

static inline float layoutRange(float lo,float hi) {
  return lo + (hi-lo)*layout01();
}

static inline float layoutClamp(float v,float lo,float hi) {
  return v<lo?lo:(v>hi?hi:v);
}

static inline float layoutSmooth(float t) {
  t=layoutClamp(t,0.0f,1.0f);
  return t*t*(3.0f-2.0f*t);
}

static inline float courseSecant(uint8_t a,uint8_t b) {
  float dz=centerNodes[b].z-centerNodes[a].z;
  if (fabsf(dz)<1e-6f) return 0.0f;
  return (centerNodes[b].x-centerNodes[a].x)/dz;
}

// Monotone-ish Hermite tangent. Extrema get a zero tangent, while sustained
// bends carry slope through intermediate nodes instead of flattening at every
// control point as the old per-segment smoothstep curve did.
static float courseNodeTangent(uint8_t i) {
  static constexpr float MAX_CENTER_SLOPE=0.30f;
  if (i==0) return layoutClamp(courseSecant(0,1),-MAX_CENTER_SLOPE,MAX_CENTER_SLOPE);
  if (i>=CENTER_NODE_COUNT-1)
    return layoutClamp(courseSecant(CENTER_NODE_COUNT-2,CENTER_NODE_COUNT-1),-MAX_CENTER_SLOPE,MAX_CENTER_SLOPE);

  float d0=courseSecant(i-1,i);
  float d1=courseSecant(i,i+1);
  if (d0*d1<=0.0f) return 0.0f;

  float m=0.5f*(d0+d1);
  float limit=3.0f*fminf(fabsf(d0),fabsf(d1));
  if (fabsf(m)>limit) m=copysignf(limit,m);
  return layoutClamp(m,-MAX_CENTER_SLOPE,MAX_CENTER_SLOPE);
}

static float courseCenterX(float z) {
  if (z<=centerNodes[0].z) return centerNodes[0].x;
  if (z>=centerNodes[CENTER_NODE_COUNT-1].z) return centerNodes[CENTER_NODE_COUNT-1].x;

  for (uint8_t i=0;i<CENTER_NODE_COUNT-1;i++) {
    const CourseNode& a=centerNodes[i];
    const CourseNode& b=centerNodes[i+1];
    if (z<=b.z) {
      float span=b.z-a.z;
      float t=layoutClamp((z-a.z)/span,0.0f,1.0f);
      float t2=t*t, t3=t2*t;
      float h00= 2.0f*t3-3.0f*t2+1.0f;
      float h10=       t3-2.0f*t2+t;
      float h01=-2.0f*t3+3.0f*t2;
      float h11=       t3-      t2;
      float m0=courseNodeTangent(i);
      float m1=courseNodeTangent(i+1);
      float x=h00*a.x + h10*span*m0 + h01*b.x + h11*span*m1;

      // Defensive overshoot guard. The authored node sequence is monotonic
      // between local extrema; no interpolation should leave that local band.
      float lo=fminf(a.x,b.x)-0.75f;
      float hi=fmaxf(a.x,b.x)+0.75f;
      return layoutClamp(x,lo,hi);
    }
  }
  return centerNodes[CENTER_NODE_COUNT-1].x;
}

static inline float edgeNoiseSample(int32_t cell,uint32_t salt) {
  uint32_t x=(uint32_t)cell*0x9E3779B9u ^ salt;
  x ^= x>>16; x *= 0x7FEB352Du;
  x ^= x>>15; x *= 0x846CA68Bu;
  x ^= x>>16;
  return ((x&0xFFFFu)/65535.0f)*2.0f-1.0f;
}

static float pisteEdgeWobble(float z,uint32_t salt) {
  const float CELL=8.0f;
  int32_t c=(int32_t)floorf(z/CELL);
  float t=(z-c*CELL)/CELL;
  t=layoutSmooth(t);
  float a=edgeNoiseSample(c,salt);
  float b=edgeNoiseSample(c+1,salt);
  return (a+(b-a)*t)*0.38f; // meters; subtle, deterministic edge irregularity
}

static void generateCourseLayout() {
  // Fresh seed every run, including very fast restarts in the simulator.
  runCounter++;
  layoutRng = micros() ^ (0x9E3779B9u * runCounter) ^ 0xA17E5A10u;
  if (!layoutRng) layoutRng=0xA17E5A10u;

  // Build five large mountain sweeps. Macro anchors alternate across the fall
  // line, while the 25 sampled nodes preserve a smooth, continuous curve.
  // This guarantees a genuinely winding course instead of a nearly straight
  // line receiving small independent random nudges.
  static constexpr uint8_t MACRO_COUNT=6;
  static const uint8_t macroIndex[MACRO_COUNT]={0,5,10,15,20,24};
  float macroX[MACRO_COUNT];
  macroX[0]=0.0f;
  int8_t bendSide=(nextLayoutRandom()&1u)?1:-1;
  for (uint8_t m=1;m<MACRO_COUNT;m++) {
    float magnitude=(m==MACRO_COUNT-1)?layoutRange(16.0f,25.0f):layoutRange(18.0f,27.0f);
    // Slight asymmetry makes two generated runs with the same broad rhythm
    // look less mechanically mirrored.
    float bias=layoutRange(-2.5f,2.5f);
    macroX[m]=(float)bendSide*magnitude+bias;
    macroX[m]=layoutClamp(macroX[m],-32.0f,32.0f);
    bendSide=-bendSide;
  }

  float nodeDz=COURSE_LENGTH/(CENTER_NODE_COUNT-1);
  centerNodes[0]={0.0f,0.0f};
  for (uint8_t m=0;m<MACRO_COUNT-1;m++) {
    uint8_t ia=macroIndex[m], ib=macroIndex[m+1];
    float bow=layoutRange(-2.0f,2.0f);
    for (uint8_t i=ia;i<=ib;i++) {
      float t=(ib==ia)?0.0f:(float)(i-ia)/(float)(ib-ia);
      float s=layoutSmooth(t);
      float x=macroX[m]+(macroX[m+1]-macroX[m])*s;
      // Bow is zero at anchors and strongest in the middle, preserving the
      // macro extrema while varying the shape of each sweep.
      x += sinf(t*3.14159265f)*bow;
      centerNodes[i]={nodeDz*i,layoutClamp(x,-34.0f,34.0f)};
    }
  }
  centerNodes[CENTER_NODE_COUNT-1].z=COURSE_LENGTH;

  // Thirty gates. The first required side is random, then every subsequent
  // gate strictly alternates. There is no same-side exception anymore.
  float z=40.0f;
  int8_t side=(nextLayoutRandom()&1u)?1:-1;
  for (uint8_t i=0;i<GATE_COUNT;i++) {
    if (i>0) {
      float remain=COURSE_LENGTH-43.0f-z;
      uint8_t left=(uint8_t)(GATE_COUNT-i);
      float nominal=remain/left;
      float spacing=layoutClamp(nominal+layoutRange(-4.0f,4.0f),31.0f,46.0f);
      z+=spacing;
      side=-side;
    }
    float center=courseCenterX(z);
    float offset=layoutRange(3.0f,6.0f)*(float)side;
    runCourse[i]={z,center+offset,side<0?PassSide::Left:PassSide::Right,(uint8_t)(i+1)};
  }

  // Physical trees follow the winding trail but live beyond the groomed
  // corridor. A minority sit near the rough-snow transition to make large
  // off-piste excursions risky without forming a wall.
  for (uint8_t i=0;i<TREE_COUNT;i++) {
    float tz=layoutRange(24.0f,COURSE_LENGTH-18.0f);
    float center=courseCenterX(tz);
    int8_t treeSide=(nextLayoutRandom()&1u)?1:-1;
    float lateral=(PISTE_HALF+layoutRange(5.0f,30.0f))*(float)treeSide;
    if ((nextLayoutRandom()%6u)==0u)
      lateral=(PISTE_HALF+layoutRange(2.5f,8.0f))*(float)treeSide;
    runTrees[i]={center+lateral,tz,layoutRange(0.52f,0.82f),ObstacleKind::Pine};
  }
}

// ============================================================
// Strip buffer
// ============================================================

#if defined(ALPINE_HAS_SHARED_RENDER_MEMORY)
static_assert(GameRenderMemory::CAPACITY >= SCREEN_W * STRIP_H * 2,
              "GameRenderMemory is too small for Alpine Slalom strip buffer");
static uint16_t* stripPixels = nullptr;
#else
alignas(4) static uint16_t privateStrip[SCREEN_W * STRIP_H];
static uint16_t* stripPixels = privateStrip;
#endif

static inline uint16_t* acquireStripBuffer() {
#if defined(ALPINE_HAS_SHARED_RENDER_MEMORY)
  stripPixels = reinterpret_cast<uint16_t*>(GameRenderMemory::bytes);
#endif
  return stripPixels;
}

// ============================================================
// Small helpers
// ============================================================

static inline float clampF(float v, float lo, float hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}
static inline float moveToward(float value, float target, float maxDelta) {
  if (value < target) return fminf(value + maxDelta, target);
  if (value > target) return fmaxf(value - maxDelta, target);
  return target;
}
static inline float approach(float value, float target, float tau, float dt) {
  return value + (target - value) * (dt / (tau + dt));
}
static inline float smoothstep01(float x) {
  x = clampF(x, 0.0f, 1.0f);
  return x*x*(3.0f - 2.0f*x);
}
static inline uint32_t elapsedMs(uint32_t now, uint32_t then) { return now - then; }
static inline uint32_t elapsedUs(uint32_t now, uint32_t then) { return now - then; }

static inline uint32_t nextEffectRandom() {
  uint32_t x = g.effects.rng;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  if (!x) x = 0xA17E5A10u;
  g.effects.rng = x;
  return x;
}
static inline float random01() {
  return (nextEffectRandom() & 0x00FFFFFFu) / 16777216.0f;
}

// ============================================================
// 5x7 raster text
// ============================================================

static const uint8_t FONT5X7[37][5] = {
  {0x7E,0x11,0x11,0x11,0x7E}, // A
  {0x7F,0x49,0x49,0x49,0x36}, // B
  {0x3E,0x41,0x41,0x41,0x22}, // C
  {0x7F,0x41,0x41,0x22,0x1C}, // D
  {0x7F,0x49,0x49,0x49,0x41}, // E
  {0x7F,0x09,0x09,0x09,0x01}, // F
  {0x3E,0x41,0x49,0x49,0x7A}, // G
  {0x7F,0x08,0x08,0x08,0x7F}, // H
  {0x00,0x41,0x7F,0x41,0x00}, // I
  {0x20,0x40,0x41,0x3F,0x01}, // J
  {0x7F,0x08,0x14,0x22,0x41}, // K
  {0x7F,0x40,0x40,0x40,0x40}, // L
  {0x7F,0x02,0x0C,0x02,0x7F}, // M
  {0x7F,0x04,0x08,0x10,0x7F}, // N
  {0x3E,0x41,0x41,0x41,0x3E}, // O
  {0x7F,0x09,0x09,0x09,0x06}, // P
  {0x3E,0x41,0x51,0x21,0x5E}, // Q
  {0x7F,0x09,0x19,0x29,0x46}, // R
  {0x46,0x49,0x49,0x49,0x31}, // S
  {0x01,0x01,0x7F,0x01,0x01}, // T
  {0x3F,0x40,0x40,0x40,0x3F}, // U
  {0x1F,0x20,0x40,0x20,0x1F}, // V
  {0x3F,0x40,0x38,0x40,0x3F}, // W
  {0x63,0x14,0x08,0x14,0x63}, // X
  {0x07,0x08,0x70,0x08,0x07}, // Y
  {0x61,0x51,0x49,0x45,0x43}, // Z
  {0x3E,0x51,0x49,0x45,0x3E}, // 0
  {0x00,0x42,0x7F,0x40,0x00}, // 1
  {0x42,0x61,0x51,0x49,0x46}, // 2
  {0x21,0x41,0x45,0x4B,0x31}, // 3
  {0x18,0x14,0x12,0x7F,0x10}, // 4
  {0x27,0x45,0x45,0x45,0x39}, // 5
  {0x3C,0x4A,0x49,0x49,0x30}, // 6
  {0x01,0x71,0x09,0x05,0x03}, // 7
  {0x36,0x49,0x49,0x49,0x36}, // 8
  {0x06,0x49,0x49,0x29,0x1E}, // 9
  {0,0,0,0,0}                 // space
};

static inline const uint8_t* glyph(char c) {
  if (c >= 'A' && c <= 'Z') return FONT5X7[c-'A'];
  if (c >= '0' && c <= '9') return FONT5X7[26 + (c-'0')];
  return FONT5X7[36];
}

struct Raster {
  uint16_t* p;
  int16_t y0;
  int16_t h;

  inline void pixel(int16_t x, int16_t y, uint16_t c) {
    if (x < 0 || x >= SCREEN_W || y < y0 || y >= y0+h) return;
    p[(y-y0)*SCREEN_W + x] = c;
  }

  void hline(int16_t x, int16_t y, int16_t w, uint16_t c) {
    if (w <= 0 || y < y0 || y >= y0+h) return;
    int16_t a = x < 0 ? 0 : x;
    int16_t b = x + w;
    if (b > SCREEN_W) b = SCREEN_W;
    if (a >= b) return;
    uint16_t* row = p + (y-y0)*SCREEN_W + a;
    for (int16_t i=a;i<b;i++) *row++ = c;
  }

  void rect(int16_t x, int16_t y, int16_t w, int16_t hh, uint16_t c) {
    if (w <= 0 || hh <= 0) return;
    int16_t ya = y < y0 ? y0 : y;
    int16_t yb = y + hh;
    if (yb > y0+h) yb = y0+h;
    if (ya >= yb) return;
    for (int16_t yy=ya; yy<yb; ++yy) hline(x,yy,w,c);
  }

  void line(int16_t x0,int16_t y0_,int16_t x1,int16_t y1,uint16_t c) {
    int16_t minx = x0 < x1 ? x0 : x1, maxx = x0 > x1 ? x0 : x1;
    int16_t miny = y0_ < y1 ? y0_ : y1, maxy = y0_ > y1 ? y0_ : y1;
    if (maxx < 0 || minx >= SCREEN_W || maxy < y0 || miny >= y0+h) return;
    int dx = abs(x1-x0), sx = x0<x1 ? 1 : -1;
    int dy = -abs(y1-y0_), sy = y0_<y1 ? 1 : -1;
    int err = dx + dy;
    for (;;) {
      pixel(x0,y0_,c);
      if (x0==x1 && y0_==y1) break;
      int e2 = 2*err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0_ += sy; }
    }
  }

  void circle(int16_t cx,int16_t cy,int16_t r,uint16_t c) {
    if (r <= 0) { pixel(cx,cy,c); return; }
    for (int16_t yy=-r; yy<=r; ++yy) {
      int16_t xx = (int16_t)sqrtf((float)(r*r - yy*yy));
      hline(cx-xx, cy+yy, 2*xx+1, c);
    }
  }

  void triangle(int16_t x0,int16_t y0_,int16_t x1,int16_t y1,int16_t x2,int16_t y2,uint16_t c) {
    if (y0_ > y1) { int16_t tx=x0; x0=x1; x1=tx; int16_t ty=y0_; y0_=y1; y1=ty; }
    if (y1 > y2) { int16_t tx=x1; x1=x2; x2=tx; int16_t ty=y1; y1=y2; y2=ty; }
    if (y0_ > y1) { int16_t tx=x0; x0=x1; x1=tx; int16_t ty=y0_; y0_=y1; y1=ty; }
    if (y0_ == y2) {
      int16_t mn=x0, mx=x0;
      if (x1<mn) mn=x1;
      if (x2<mn) mn=x2;
      if (x1>mx) mx=x1;
      if (x2>mx) mx=x2;
      hline(mn,y0_,mx-mn+1,c); return;
    }
    for (int16_t y=y0_; y<=y2; ++y) {
      if (y < this->y0 || y >= this->y0+h) continue;
      float a = (y2==y0_) ? 0 : (float)(y-y0_)/(float)(y2-y0_);
      int16_t xa = (int16_t)lroundf(x0 + (x2-x0)*a);
      int16_t xb;
      if (y < y1 && y1 != y0_) {
        float b=(float)(y-y0_)/(float)(y1-y0_);
        xb=(int16_t)lroundf(x0+(x1-x0)*b);
      } else if (y2 != y1) {
        float b=(float)(y-y1)/(float)(y2-y1);
        xb=(int16_t)lroundf(x1+(x2-x1)*b);
      } else xb=x1;
      if (xa>xb) { int16_t t=xa; xa=xb; xb=t; }
      hline(xa,y,xb-xa+1,c);
    }
  }

  void text(int16_t x,int16_t y,uint8_t scale,uint16_t c,const char* s) {
    if (!s || scale==0) return;
    int16_t cx=x;
    for (;*s;++s) {
      char ch=*s;
      if (ch==' ') { cx += 6*scale; continue; }
      if (ch==':' || ch=='.' || ch=='+' || ch=='/' || ch=='-') {
        if (ch==':') { rect(cx+2*scale,y+2*scale,scale,scale,c); rect(cx+2*scale,y+5*scale,scale,scale,c); }
        else if (ch=='.') rect(cx+2*scale,y+6*scale,scale,scale,c);
        else if (ch=='+') { rect(cx+2*scale,y+1*scale,scale,5*scale,c); rect(cx,y+3*scale,5*scale,scale,c); }
        else if (ch=='-') rect(cx,y+3*scale,5*scale,scale,c);
        else { line(cx+4*scale,y,cx,y+7*scale,c); }
        cx += 6*scale; continue;
      }
      const uint8_t* gr=glyph(ch);
      for (uint8_t col=0; col<5; ++col) {
        uint8_t bits=gr[col];
        for (uint8_t row=0; row<7; ++row) if (bits & (1u<<row))
          rect(cx+col*scale,y+row*scale,scale,scale,c);
      }
      cx += 6*scale;
    }
  }
};

static inline int16_t textWidth(const char* s,uint8_t scale) {
  if (!s || !*s) return 0;
  return (int16_t)(strlen(s)*6*scale - scale);
}

static inline void fillStrip(uint16_t c,int16_t h=STRIP_H) {
  for (int i=0;i<SCREEN_W*h;++i) stripPixels[i]=c;
}

static inline void blitStrip(int16_t y,int16_t h) {
  display.drawRGBBitmap(0,y,stripPixels,SCREEN_W,h);
}

// ============================================================
// Formatting
// ============================================================

static inline void formatTime(uint32_t ms,char* out,size_t n) {
  uint32_t cs = ms / 10;
  uint32_t minutes = cs / 6000;
  uint32_t seconds = (cs / 100) % 60;
  uint32_t hundredths = cs % 100;
  snprintf(out,n,"%lu:%02lu.%02lu",
           (unsigned long)minutes,
           (unsigned long)seconds,
           (unsigned long)hundredths);
}
static inline void formatPenalty(uint32_t ms,char* out,size_t n) {
  snprintf(out,n,"+%lu.%02lu",
           (unsigned long)(ms/1000),
           (unsigned long)((ms/10)%100));
}

// ============================================================
// Input / state
// ============================================================

static inline Controls sampleControls(const GameInput& input) {
  Controls c;
  c.leftHeld=input.leftButton;
  c.rightHeld=input.rightButton;
  c.steer=(int8_t)((input.rightButton?1:0)-(input.leftButton?1:0));
  c.uiTap=false;
  return c;
}

static inline void resetTapLatch(uint32_t nowMs) {
  g.tap = {};
  g.tap.neutralSinceMs=nowMs;
  g.tap.neutralTracking=true;
}

static inline bool updateTapLatch(const GameInput& input,uint32_t nowMs) {
  bool L=input.leftButton, R=input.rightButton;
  bool accepted=false;

  if (!L && !R) {
    if (!g.tap.neutralTracking) {
      g.tap.neutralTracking=true;
      g.tap.neutralSinceMs=nowMs;
    }
    if (!g.tap.armed && !g.tap.candidate &&
        elapsedMs(nowMs,g.tap.neutralSinceMs)>=100) {
      g.tap.armed=true;
      g.tap.cancelled=false;
    }
  } else {
    g.tap.neutralTracking=false;
  }

  bool leftDown=L && !g.tap.prevLeft;
  bool rightDown=R && !g.tap.prevRight;
  bool leftUp=!L && g.tap.prevLeft;
  bool rightUp=!R && g.tap.prevRight;

  if (g.tap.armed && g.tap.candidate==0) {
    if (leftDown && !R) { g.tap.candidate=1; g.tap.pressedAtMs=nowMs; }
    else if (rightDown && !L) { g.tap.candidate=2; g.tap.pressedAtMs=nowMs; }
  }

  if (g.tap.candidate && L && R) g.tap.cancelled=true;

  if (g.tap.candidate==1 && leftUp) {
    uint32_t d=elapsedMs(nowMs,g.tap.pressedAtMs);
    accepted=!g.tap.cancelled && !R && d>=20 && d<=600;
    g.tap.candidate=0; g.tap.armed=false; g.tap.neutralTracking=true; g.tap.neutralSinceMs=nowMs;
  } else if (g.tap.candidate==2 && rightUp) {
    uint32_t d=elapsedMs(nowMs,g.tap.pressedAtMs);
    accepted=!g.tap.cancelled && !L && d>=20 && d<=600;
    g.tap.candidate=0; g.tap.armed=false; g.tap.neutralTracking=true; g.tap.neutralSinceMs=nowMs;
  }

  if (g.tap.candidate && elapsedMs(nowMs,g.tap.pressedAtMs)>600) g.tap.cancelled=true;
  if (g.tap.cancelled && !L && !R && g.tap.candidate==0) {
    g.tap.armed=false;
    g.tap.neutralTracking=true;
    g.tap.neutralSinceMs=nowMs;
    g.tap.cancelled=false;
  }

  g.tap.prevLeft=L;
  g.tap.prevRight=R;
  return accepted;
}

// ============================================================
// Effects / tracks
// ============================================================

static inline void setNotice(NoticeKind kind,float life,uint8_t streak=0) {
  auto priority=[](NoticeKind k)->uint8_t {
    switch(k) {
      case NoticeKind::Finish:return 6;
      case NoticeKind::Crash:return 5;
      case NoticeKind::Hit:return 4;
      case NoticeKind::Miss:return 3;
      case NoticeKind::Go:return 2;
      case NoticeKind::Clean:return 1;
      default:return 0;
    }
  };
  if (g.effects.noticeLife-g.effects.noticeAge>0 &&
      priority(kind)<priority(g.effects.notice)) return;
  g.effects.notice=kind;
  g.effects.noticeAge=0;
  g.effects.noticeLife=life;
  g.effects.noticeStreak=streak;
}

static inline void breakTracks() { g.tracks.breakNext=true; }

static void appendTrackPoint(float x,float z,float heading,uint8_t shade) {
  uint8_t idx;
  if (g.tracks.count < TRACK_CAPACITY) {
    idx=(uint8_t)((g.tracks.head+g.tracks.count)%TRACK_CAPACITY);
    g.tracks.count++;
  } else {
    idx=g.tracks.head;
    g.tracks.head=(uint8_t)((g.tracks.head+1)%TRACK_CAPACITY);
  }
  g.tracks.nodes[idx]={x,z,heading,shade,g.tracks.breakNext};
  g.tracks.breakNext=false;
}

static void appendTracks(Vec2 a,Vec2 b) {
  float dx=b.x-a.x,dz=b.z-a.z;
  float len=sqrtf(dx*dx+dz*dz);
  if (len<1e-5f) return;
  float residual=g.tracks.distanceResidual;
  float needed=0.75f-residual;
  float traversed=0;
  while (needed <= len-traversed+1e-6f) {
    traversed += needed;
    float t=traversed/len;
    appendTrackPoint(a.x+dx*t,a.z+dz*t,g.player.heading,g.player.skid>0.55f?1:0);
    residual=0;
    needed=0.75f;
  }
  residual += len-traversed;
  if (residual>=0.75f) residual=fmodf(residual,0.75f);
  g.tracks.distanceResidual=residual;
}

static void spawnParticle(float x,float z,float strength) {
  int slot=-1;
  for (uint8_t i=0;i<PARTICLE_CAPACITY;i++) if (!g.effects.snow[i].active) { slot=i; break; }
  if (slot<0) { slot=g.effects.replaceCursor++ % PARTICLE_CAPACITY; }
  SnowParticle& p=g.effects.snow[slot];
  float s=(random01()*2.0f-1.0f);
  p.active=true;
  p.x=x; p.z=z; p.height=0.05f;
  p.vx=s*(0.5f+1.5f*random01())*strength;
  p.vz=-(1.0f+2.0f*random01())*strength;
  p.vh=0.5f+0.7f*random01();
  p.age=0;
  p.life=0.18f+0.27f*random01();
  p.size=(uint8_t)(1+(nextEffectRandom()%3));
  p.shade=(uint8_t)(nextEffectRandom()&1);
}

static void spawnBurst(uint8_t count,float strength) {
  if (count>16) count=16;
  for (uint8_t i=0;i<count;i++) spawnParticle(g.player.x,g.player.z,strength);
}

static void emitSpray(float dt) {
  if (g.player.mode!=MoveMode::Skiing) return;
  float speedScale=clampF(g.player.v/MAX_SPEED,0,1);
  float rate=speedScale*(4.0f*fabsf(g.player.carve)+24.0f*g.player.skid);
  g.effects.sprayCredit += rate*dt;
  uint8_t emitted=0;
  while (g.effects.sprayCredit>=1.0f && emitted<3) {
    g.effects.sprayCredit-=1.0f;
    float sign=(fabsf(g.player.carve)>0.03f) ? -copysignf(1.0f,g.player.carve)
      : (fabsf(g.player.vx)>0.1f ? -copysignf(1.0f,g.player.vx) : 0);
    if (sign!=0) {
      float sx=g.player.x+sign*0.36f;
      spawnParticle(sx,g.player.z,0.8f);
    }
    emitted++;
  }
}

static void updateEffects(float dt) {
  if (g.effects.noticeLife>0) {
    g.effects.noticeAge+=dt;
    if (g.effects.noticeAge>=g.effects.noticeLife) {
      g.effects.notice=NoticeKind::None;
      g.effects.noticeLife=0;
    }
  }
  for (uint8_t i=0;i<GATE_COUNT;i++) {
    if (g.gates[i].hitAge>=0) g.gates[i].hitAge+=dt;
    if (g.gates[i].cleanHighlightRemaining>0)
      g.gates[i].cleanHighlightRemaining=fmaxf(0,g.gates[i].cleanHighlightRemaining-dt);
  }
  for (uint8_t i=0;i<PARTICLE_CAPACITY;i++) {
    SnowParticle& p=g.effects.snow[i];
    if (!p.active) continue;
    p.age+=dt;
    p.x+=p.vx*dt; p.z+=p.vz*dt;
    p.vh-=3.0f*dt; p.height+=p.vh*dt;
    if (p.age>=p.life || p.height<0) p.active=false;
  }
}

// ============================================================
// Audio (silent on legacy API / simulator)
// ============================================================

static inline uint8_t audioVolume() {
#if ALPINE_EXTENDED_API
  int v=gameAudioVolume();
  if (v<0) v=0;
  if (v>100) v=100;
  return (uint8_t)v;
#else
  return 0;
#endif
}

static void tonePin(int pin,uint16_t hz,uint8_t volume) {
#if ALPINE_EXTENDED_API && defined(ARDUINO_ARCH_ESP32)
  if (!hz || !volume) { ledcWriteTone(pin,0); return; }
  ledcWriteTone(pin,hz);
  uint32_t duty=ledcRead(pin);
  ledcWrite(pin,(uint32_t)((uint64_t)duty*volume/100u));
#else
  (void)pin; (void)hz; (void)volume;
#endif
}

static uint32_t cueUntilMs=0;
static uint16_t cueHz=0;
static bool cueBoth=false;

static void requestTone(uint16_t hz,uint16_t durationMs,bool both=false) {
  uint8_t vol=audioVolume();
  if (!vol) return;
  // A new cue owns the current short SFX slot; silence any prior second voice
  // first so a previous two-buzzer cue cannot leak underneath a one-buzzer cue.
  tonePin(BUZZER_1_PIN,0,0);
  tonePin(BUZZER_2_PIN,0,0);
  cueHz=hz; cueUntilMs=millis()+durationMs; cueBoth=both;
  tonePin(BUZZER_1_PIN,hz,vol);
  if (both) tonePin(BUZZER_2_PIN,hz,vol);
}

static void serviceAudio(uint32_t nowMs) {
  if (cueHz && (int32_t)(nowMs-cueUntilMs)>=0) {
    tonePin(BUZZER_1_PIN,0,0);
    tonePin(BUZZER_2_PIN,0,0);
    cueHz=0; cueBoth=false;
  }
}
static void stopAudio() {
  tonePin(BUZZER_1_PIN,0,0);
  tonePin(BUZZER_2_PIN,0,0);
  cueHz=0; cueBoth=false; cueUntilMs=0;
}

// ============================================================
// Core physics
// ============================================================

static inline float roughnessAt(float x,float z) {
  float local=fabsf(x-courseCenterX(z));
  float r=clampF((local-PISTE_HALF)/OFFPISTE_RAMP,0,1);
  return smoothstep01(r);
}

static void updateSteering(int8_t command,float dt) {
  if (g.player.mode==MoveMode::Crashed) return;
  float old=g.player.carve;
  float rate;
  if (command==0) rate=CARVE_RETURN_RATE;
  else if ((float)command*g.player.carve<0) rate=CARVE_REVERSE_RATE;
  else rate=CARVE_BUILD_RATE;
  g.player.carve=moveToward(g.player.carve,(float)command,rate*dt);
  g.player.carve=clampF(g.player.carve,-1,1);
  g.player.carveRate=(g.player.carve-old)/dt;
  g.player.heading=MAX_HEADING*g.player.carve;
}

static void computeForces(float dt,float& ax,float& av) {
  float targetVx=g.player.v*tanf(g.player.heading);
  float gripRate=NEUTRAL_GRIP+EDGE_GRIP_GAIN*fabsf(g.player.carve);
  float requestedAx=gripRate*(targetVx-g.player.vx);
  float speedFactor=clampF((g.player.v-10.0f)/10.0f,0,1);
  float skidTarget=clampF((fabsf(requestedAx)-GRIP_ACCEL_LIMIT)/SKID_DEMAND_RANGE,0,1)*speedFactor;
  g.player.skid=approach(g.player.skid,skidTarget,
                         skidTarget>g.player.skid?SKID_RISE_TAU:SKID_FALL_TAU,dt);
  g.player.skid=clampF(g.player.skid,0,1);

  float rough=roughnessAt(g.player.x,g.player.z);
  ax=clampF(requestedAx,-GRIP_ACCEL_LIMIT,GRIP_ACCEL_LIMIT)*(1.0f-SKID_GRIP_LOSS*g.player.skid);
  ax-=ROUGH_LATERAL_DRAG*rough*g.player.vx;

  float c2=g.player.carve*g.player.carve;
  float c4=c2*c2;
  float transitionLoad=fminf(fabsf(g.player.carveRate)/CARVE_REVERSE_RATE,1.0f)*fabsf(g.player.carve);

  av=DOWNHILL_ACCEL-AIR_DRAG*g.player.v*g.player.v;
  av-=g.player.v*(TURN_DRAG_2*c2+TURN_DRAG_4*c4);
  av-=SKID_DRAG*g.player.skid*g.player.v;
  av-=TRANSITION_DRAG*transitionLoad*g.player.v;
  av-=ROUGH_FORWARD_DRAG*rough*g.player.v;
}

static bool sweptCircle(Vec2 a,Vec2 b,Vec2 c,float radius,float& t,float& closest) {
  float dx=b.x-a.x,dz=b.z-a.z;
  float mx=a.x-c.x,mz=a.z-c.z;
  float A=dx*dx+dz*dz;
  float C=mx*mx+mz*mz-radius*radius;
  if (A<1e-10f) {
    if (C<=0) { t=0; closest=sqrtf(fmaxf(0,mx*mx+mz*mz)); return true; }
    return false;
  }
  float tc=clampF(-(mx*dx+mz*dz)/A,0,1);
  float qx=mx+dx*tc,qz=mz+dz*tc;
  closest=sqrtf(qx*qx+qz*qz);
  if (C<=0) { t=0; return true; }
  float B=2.0f*(mx*dx+mz*dz);
  float disc=B*B-4.0f*A*C;
  if (disc<0) return false;
  if (disc<1e-7f) disc=0;
  float root=(-B-sqrtf(disc))/(2.0f*A);
  if (root<0 || root>1) return false;
  t=root; return true;
}

static inline int eventPriority(EventKind k) {
  switch(k) {
    case EventKind::Pole:
    case EventKind::Obstacle:
    case EventKind::OuterEdge:return 0;
    case EventKind::GatePlane:return 1;
    case EventKind::Finish:return 2;
    default:return 9;
  }
}

static bool chooseEvent(MotionEvent& best,const MotionEvent& c) {
  if (c.kind==EventKind::None) return false;
  if (best.kind==EventKind::None ||
      c.fraction < best.fraction-1e-5f ||
      (fabsf(c.fraction-best.fraction)<=1e-5f && eventPriority(c.kind)<eventPriority(best.kind))) {
    best=c; return true;
  }
  return false;
}

static bool earliestEvent(Vec2 a,Vec2 b,MotionEvent& out,bool allowSolid=true) {
  out={EventKind::None,2.0f,0,0,0};

  // Pending poles.
  for (uint8_t i=0;i<GATE_COUNT;i++) {
    if (g.gates[i].outcome!=GateOutcome::Pending) continue;
    const GateDef& gd=runCourse[i];
    if (gd.z < fminf(a.z,b.z)-1 || gd.z > fmaxf(a.z,b.z)+1) continue;
    float t,closest;
    if (sweptCircle(a,b,{gd.x,gd.z},PLAYER_RADIUS+POLE_RADIUS,t,closest)) {
      MotionEvent e{EventKind::Pole,t,i,0,closest}; chooseEvent(out,e);
    }
  }

  if (allowSolid) {
    for (uint8_t i=0;i<TREE_COUNT;i++) {
      const ObstacleDef& tree=runTrees[i];
      if (tree.z < fminf(a.z,b.z)-2 || tree.z > fmaxf(a.z,b.z)+2) continue;
      float t,closest;
      if (sweptCircle(a,b,{tree.x,tree.z},PLAYER_RADIUS+tree.radius,t,closest)) {
        int8_t side=(a.x>=tree.x)?1:-1;
        MotionEvent e{EventKind::Obstacle,t,i,side,closest}; chooseEvent(out,e);
      }
    }
  }

  if (g.nextGate<GATE_COUNT) {
    float gz=runCourse[g.nextGate].z;
    if (a.z<=gz && b.z>=gz && b.z>a.z) {
      float t=(gz-a.z)/(b.z-a.z);
      MotionEvent e{EventKind::GatePlane,t,g.nextGate,0,0}; chooseEvent(out,e);
    }
  }

  if (a.z<=COURSE_LENGTH && b.z>=COURSE_LENGTH && b.z>a.z) {
    float t=(COURSE_LENGTH-a.z)/(b.z-a.z);
    MotionEvent e{EventKind::Finish,t,0,0,0}; chooseEvent(out,e);
  }

  return out.kind!=EventKind::None;
}

static void resolveGatePlane(uint8_t index,float crossingX) {
  if (index>=GATE_COUNT) return;
  GateRuntime& gr=g.gates[index];
  if (gr.outcome==GateOutcome::Pending) {
    const GateDef& gd=runCourse[index];
    float side=(float)(int8_t)gd.passSide;
    float q=side*(crossingX-gd.x);
    // A slalom gate is a one-sided checkpoint, not a narrow passage window.
    // Once the skier is at least the required clearance beyond the pole on the
    // indicated side, the gate is clean regardless of how far out they are or
    // whether they have left the groomed piste.
    bool legal=q>=GATE_CLEARANCE-0.0001f &&
      g.player.mode==MoveMode::Skiing;
    if (legal) {
      gr.outcome=GateOutcome::Clean;
      gr.cleanHighlightRemaining=0.18f;
      g.stats.cleared++;
      g.stats.streak++;
      if (g.stats.streak>g.stats.bestStreak) g.stats.bestStreak=g.stats.streak;
      if (g.stats.streak>=2) setNotice(NoticeKind::Clean,0.35f,g.stats.streak);
      requestTone(1046,35,false);
    } else {
      gr.outcome=GateOutcome::Miss;
      g.stats.misses++;
      g.stats.streak=0;
      g.stats.penaltyMs+=MISS_PENALTY_MS;
      setNotice(NoticeKind::Miss,0.80f);
      requestTone(220,80,false);
    }
  }
  if (g.nextGate==index) g.nextGate++;
  g.hudDirty=true;
}

static void beginCrash(int8_t side) {
  if (g.player.mode==MoveMode::Crashed) return;
  g.player.mode=MoveMode::Crashed;
  g.player.crashAge=0;
  g.player.crashStartX=g.player.x;
  g.player.recoverTargetX=courseCenterX(g.player.z)+clampF(g.player.x-courseCenterX(g.player.z),-RECOVERY_SAFE_HALF,RECOVERY_SAFE_HALF);
  g.player.crashSpinSign=side?side:(g.player.vx>=0?1:-1);
  g.player.carve=0; g.player.heading=0; g.player.skid=1;
  if (g.player.v>5.0f) g.player.v=5.0f;
  g.stats.crashes++;
  g.stats.streak=0;
  g.stats.penaltyMs+=CRASH_PENALTY_MS;
  setNotice(NoticeKind::Crash,1.0f);
  spawnBurst(16,1.4f);
  breakTracks();
  g.hudDirty=true;
  requestTone(110,100,true);
}

static void beginTreeWipeout(int8_t side) {
  if (g.phase!=Phase::Racing) return;
  g.player.mode=MoveMode::Crashed;
  g.player.crashAge=0;
  g.player.crashSpinSign=side?side:(g.player.vx>=0?1:-1);
  g.player.carve=0;
  g.player.heading=0;
  g.player.skid=1;
  g.player.v=fminf(g.player.v,8.0f);
  g.wipeoutStartedMs=millis();
  g.phase=Phase::Wipeout;
  g.clock.phaseStartedMs=g.wipeoutStartedMs;
  g.forceFrame=true;
  resetTapLatch(g.wipeoutStartedMs);
  spawnBurst(16,1.8f);
  breakTracks();
  requestTone(110,120,true);
}

static void applyPoleHit(uint8_t index,float incomingV,float closestDistance) {
  if (index>=GATE_COUNT) return;
  GateRuntime& gr=g.gates[index];
  if (gr.outcome!=GateOutcome::Pending) return;
  const GateDef& gd=runCourse[index];

  gr.outcome=GateOutcome::Hit;
  gr.hitAge=0;
  int8_t sign=(g.player.x>=gd.x)?1:-1;
  if (fabsf(g.player.x-gd.x)<0.001f) {
    sign=(fabsf(g.player.vx)>0.05f)?(g.player.vx>0?1:-1):-(int8_t)gd.passSide;
  }
  gr.bendSign=sign;
  g.stats.hits++;
  g.stats.streak=0;
  g.stats.penaltyMs+=HIT_PENALTY_MS;

  g.player.v*=POLE_SPEED_MULT;
  g.player.vx*=POLE_LATERAL_MULT;
  g.player.vx += 0.8f*sign;
  g.player.v=clampF(g.player.v,MIN_SPEED,MAX_SPEED);
  g.player.vx=clampF(g.player.vx,-MAX_LATERAL_SPEED,MAX_LATERAL_SPEED);
  spawnBurst(10,1.0f);
  setNotice(NoticeKind::Hit,0.80f);
  g.hudDirty=true;
  requestTone(160,90,false);

  if (incomingV>=SEVERE_POLE_SPEED && closestDistance<=SEVERE_POLE_DISTANCE)
    beginCrash(sign);
}

static void updateSessionRecord() {
  g.result.newBest=false;
  if (!g.result.valid || !g.result.recordEligible) return;
  if (!records.hasBest || g.result.finalMs < records.bestFinalMs) {
    records.hasBest=true;
    records.bestFinalMs=g.result.finalMs;
    g.result.newBest=true;
  }
}

static void finishRun(uint64_t crossingUs) {
  if (g.result.valid) return;
  g.result.valid=true;
  g.result.rawUs=crossingUs;
  g.result.rawMs=(uint32_t)((crossingUs+500)/1000);
  g.result.penaltyMs=g.stats.penaltyMs;
  uint64_t sum=(uint64_t)g.result.rawMs+g.result.penaltyMs;
  if (sum>0xFFFFFFFFu) sum=0xFFFFFFFFu;
  g.result.finalMs=(uint32_t)sum;
  g.result.cleared=g.stats.cleared;
  g.result.hits=g.stats.hits;
  g.result.misses=g.stats.misses;
  g.result.crashes=g.stats.crashes;
  g.result.bestStreak=g.stats.bestStreak;
  g.result.recordEligible=g.stats.recordEligible;
  updateSessionRecord();

  g.coastZ=g.player.z;
  g.coastSpeed=g.player.v;
  g.coastStartedMs=millis();
  g.phase=Phase::FinishCoast;
  g.clock.phaseStartedMs=g.coastStartedMs;
  g.forceFrame=true;
  g.hudDirty=true;
  setNotice(NoticeKind::Finish,0.9f);
  requestTone(784,120,true);
}

static void processPlaneCrossings(Vec2 a,Vec2 b,uint64_t segmentStartUs,uint32_t segmentUs) {
  // Used by crash motion. Forward z remains monotonic.
  while (g.nextGate<GATE_COUNT) {
    float gz=runCourse[g.nextGate].z;
    if (!(a.z<=gz && b.z>=gz) || b.z<=a.z) break;
    float t=(gz-a.z)/(b.z-a.z);
    float x=a.x+(b.x-a.x)*t;
    resolveGatePlane(g.nextGate,x);
  }
  if (!g.result.valid && a.z<=COURSE_LENGTH && b.z>=COURSE_LENGTH && b.z>a.z) {
    float t=(COURSE_LENGTH-a.z)/(b.z-a.z);
    uint64_t us=segmentStartUs+(uint64_t)llroundf(t*segmentUs);
    g.player.x=a.x+(b.x-a.x)*t;
    g.player.z=COURSE_LENGTH;
    finishRun(us);
  }
}

static void updateCrashMotion(float dt,uint64_t segmentStartUs) {
  if (g.player.mode!=MoveMode::Crashed || g.phase!=Phase::Racing) return;
  float remaining=dt;
  uint64_t elapsedSegmentUs=0;

  while (remaining>1e-6f && g.player.mode==MoveMode::Crashed && g.phase==Phase::Racing) {
    float boundary = g.player.crashAge < RECOVERY_SLIDE_START ? RECOVERY_SLIDE_START : CRASH_DURATION;
    float slice=fminf(remaining,boundary-g.player.crashAge);
    if (slice<=1e-6f) {
      if (g.player.crashAge>=CRASH_DURATION-1e-6f) {
        g.player.mode=MoveMode::Skiing;
        g.player.vx=0; g.player.v=RECOVERY_SPEED;
        g.player.carve=g.player.heading=g.player.skid=0;
        g.player.graceRemaining=RECOVERY_GRACE;
        breakTracks();
        break;
      }
      if (g.player.crashAge>=RECOVERY_SLIDE_START-1e-6f) {
        g.player.crashStartX=g.player.x;
        g.player.recoverTargetX=courseCenterX(g.player.z)+clampF(g.player.x-courseCenterX(g.player.z),-RECOVERY_SAFE_HALF,RECOVERY_SAFE_HALF);
        g.player.crashAge=RECOVERY_SLIDE_START;
      }
      continue;
    }

    Vec2 a{g.player.x,g.player.z};
    if (g.player.crashAge < RECOVERY_SLIDE_START) {
      g.player.vx *= 1.0f/(1.0f+2.5f*slice);
      g.player.v=approach(g.player.v,MIN_SPEED,0.20f,slice);
      g.player.x+=g.player.vx*slice;
      g.player.z+=g.player.v*slice;
    } else {
      float t0=(g.player.crashAge-RECOVERY_SLIDE_START)/(CRASH_DURATION-RECOVERY_SLIDE_START);
      float t1=(g.player.crashAge+slice-RECOVERY_SLIDE_START)/(CRASH_DURATION-RECOVERY_SLIDE_START);
      float s1=smoothstep01(t1);
      (void)t0;
      g.player.x=g.player.crashStartX+(g.player.recoverTargetX-g.player.crashStartX)*s1;
      g.player.v=approach(g.player.v,RECOVERY_SPEED,0.20f,slice);
      g.player.z+=g.player.v*slice;
    }
    Vec2 b{g.player.x,g.player.z};
    uint32_t sliceUs=(uint32_t)lroundf(slice*1000000.0f);
    processPlaneCrossings(a,b,segmentStartUs+elapsedSegmentUs,sliceUs);
    if (g.phase!=Phase::Racing) return;
    g.player.crashAge+=slice;
    remaining-=slice;
    elapsedSegmentUs+=sliceUs;

    if (g.player.crashAge>=RECOVERY_SLIDE_START-1e-6f &&
        g.player.crashAge-slice<RECOVERY_SLIDE_START-1e-6f) {
      g.player.crashStartX=g.player.x;
      g.player.recoverTargetX=courseCenterX(g.player.z)+clampF(g.player.x-courseCenterX(g.player.z),-RECOVERY_SAFE_HALF,RECOVERY_SAFE_HALF);
      breakTracks();
    }
  }
}

static void resolveMovement(float dt,uint64_t stepStartUs) {
  float remaining=dt;
  float consumed=0;
  uint8_t contacts=0;

  while (remaining>1e-6f && g.phase==Phase::Racing && g.player.mode==MoveMode::Skiing) {
    Vec2 a{g.player.x,g.player.z};
    Vec2 b{a.x+g.player.vx*remaining, a.z+g.player.v*remaining};
    MotionEvent e;
    if (!earliestEvent(a,b,e,true)) {
      g.player.x=b.x; g.player.z=b.z;
      appendTracks(a,b);
      consumed+=remaining;
      remaining=0;
      break;
    }

    float segT=remaining*clampF(e.fraction,0,1);
    Vec2 hit{a.x+(b.x-a.x)*e.fraction,a.z+(b.z-a.z)*e.fraction};
    g.player.x=hit.x; g.player.z=hit.z;
    if (segT>1e-7f) appendTracks(a,hit);
    consumed+=segT;
    remaining-=segT;

    if (e.kind==EventKind::Pole) {
      float incomingV=g.player.v;
      applyPoleHit(e.index,incomingV,e.closestDistance);
      contacts++;
      if (g.player.mode==MoveMode::Crashed) {
        uint64_t crashStart=stepStartUs+(uint64_t)llroundf(consumed*1000000.0f);
        updateCrashMotion(remaining,crashStart);
        return;
      }
    } else if (e.kind==EventKind::Obstacle) {
      beginTreeWipeout(e.side);
      return;
    } else if (e.kind==EventKind::GatePlane) {
      resolveGatePlane(e.index,g.player.x);
    } else if (e.kind==EventKind::Finish) {
      uint64_t crossing=stepStartUs+(uint64_t)llroundf(consumed*1000000.0f);
      finishRun(crossing);
      return;
    }

    // Nudge time after zero-fraction non-plane contacts so an overlap cannot spin forever.
    if (e.fraction<=1e-6f && remaining>1e-6f) {
      float tiny=fminf(remaining,0.00005f);
      g.player.x+=g.player.vx*tiny;
      g.player.z+=g.player.v*tiny;
      consumed+=tiny; remaining-=tiny;
    }
    if (contacts>=4) {
      g.stats.recordEligible=false;
      remaining=0;
      break;
    }
  }

}

static void updateCamera(float dt) {
  float center=courseCenterX(g.player.z);
  float local=g.player.x-center;
  // Follow most of a deep off-piste excursion so the skier stays visible,
  // while still keeping enough of the winding course in frame to navigate back.
  float target=center+local*0.72f;
  g.camera.x=approach(g.camera.x,target,0.50f,dt);
}

static void stepRace(float dt) {
  uint64_t stepStartUs=g.clock.processedRaceUs;
  bool graceWasActive=g.player.graceRemaining>0;

  if (g.player.mode==MoveMode::Skiing) {
    updateSteering(g.controls.steer,dt);
    float ax,av;
    computeForces(dt,ax,av);
    g.player.vx=clampF(g.player.vx+ax*dt,-MAX_LATERAL_SPEED,MAX_LATERAL_SPEED);
    g.player.v=clampF(g.player.v+av*dt,MIN_SPEED,MAX_SPEED);
    resolveMovement(dt,stepStartUs);
  } else {
    updateCrashMotion(dt,stepStartUs);
  }

  if (g.phase!=Phase::Racing) return;

  g.clock.processedRaceUs += STEP_US;
  if (graceWasActive)
    g.player.graceRemaining=fmaxf(0,g.player.graceRemaining-dt);

  if (g.player.v>g.stats.topSpeed) g.stats.topSpeed=g.player.v;
  emitSpray(dt);
  updateEffects(dt);
  updateCamera(dt);
}

static void advanceRaceClock(uint32_t deltaUs) {
  uint64_t total=(uint64_t)g.clock.accumulatorUs+deltaUs;
  uint64_t steps=total/STEP_US;
  uint32_t remainder=(uint32_t)(total%STEP_US);
  if (steps>MAX_STEPS_PER_UPDATE) {
    uint64_t dropped=steps-MAX_STEPS_PER_UPDATE;
    g.clock.processedRaceUs += dropped*STEP_US;
    steps=MAX_STEPS_PER_UPDATE;
    g.stats.recordEligible=false;
  }
  g.clock.accumulatorUs=(uint32_t)(steps*STEP_US)+remainder;
  while (g.clock.accumulatorUs>=STEP_US && g.phase==Phase::Racing) {
    g.clock.accumulatorUs-=STEP_US;
    stepRace(STEP_DT);
  }
  if (g.phase!=Phase::Racing) g.clock.accumulatorUs=0;
}

// ============================================================
// Projection / drawing
// ============================================================

static Projected project(float x,float z,float viewZ,float nearDepth=-9.0f) {
  float d=z-viewZ;
  if (d<nearDepth || d>110.0f) return {0,0,0,false};
  float denom=PROJ_D+d;
  if (denom<40.0f) return {0,0,0,false};
  float scale=PROJ_S0*PROJ_D/denom;
  float sx=120.0f+(x-g.camera.x)*scale;
  float sy=PLAYER_ANCHOR_Y-PROJ_F*d/denom;
  return {sx,sy,scale,true};
}

static void drawSnowSurface(Raster& r,float viewZ) {
  r.rect(0,r.y0,SCREEN_W,r.h,C_ROUGH);
  for (int16_t y=r.y0; y<r.y0+r.h; ++y) {
    if (y<WORLD_TOP || y>=WORLD_BOTTOM) continue;
    float q=PLAYER_ANCHOR_Y-y;
    float denom=PROJ_F-q;
    if (fabsf(denom)<1e-3f) continue;
    float d=PROJ_D*q/denom;
    float worldZ=viewZ+d;
    float scale=PROJ_S0*(1.0f-q/PROJ_F);
    float center=courseCenterX(worldZ);
    float leftEdge=center-PISTE_HALF+pisteEdgeWobble(worldZ,0x13579BDFu);
    float rightEdge=center+PISTE_HALF+pisteEdgeWobble(worldZ,0x2468ACE0u);
    float left=120.0f+(leftEdge-g.camera.x)*scale;
    float right=120.0f+(rightEdge-g.camera.x)*scale;
    int16_t li=(int16_t)floorf(left), ri=(int16_t)ceilf(right);
    r.hline(li,y,ri-li+1,C_SNOW);
    // Broken, wind-softened piste edge instead of a continuous corridor line.
    int32_t edgeCell=(int32_t)floorf(worldZ*0.45f);
    if ((edgeCell&3)!=1) r.pixel(li,y,C_SHADOW);
    if ((edgeCell&3)!=2) r.pixel(ri,y,C_SHADOW);
  }

  int cell0=(int)floorf((viewZ-12.0f)/10.0f);
  for (int c=cell0;c<cell0+14;c++) {
    uint32_t h=(uint32_t)c*2654435761u;
    for (int m=0;m<3;m++) {
      uint32_t v=h ^ (0x9E3779B9u*(uint32_t)(m+1));
      float z=c*10.0f+((v>>16)&0xFFu)*(10.0f/255.0f);
      float center=courseCenterX(z);
      float textureHalf=PISTE_HALF-1.5f;
      float x=center-textureHalf+(v&0xFFFFu)*(2.0f*textureHalf/65535.0f);
      float len=1.0f+0.6f*((v>>24)&0x03u);
      Projected a=project(x,z,viewZ), b=project(x,z+len,viewZ);
      if (a.visible&&b.visible) r.line((int)a.x,(int)a.y,(int)b.x,(int)b.y,C_PALE);
    }
  }

  if ((g.phase==Phase::Racing || g.phase==Phase::FinishCoast || g.phase==Phase::Wipeout) && g.player.v > 9.0f) {
    float intensity=clampF((g.player.v-9.0f)/11.0f,0.0f,1.0f);
    int streaks=4+(int)(8.0f*intensity);
    uint32_t base=(uint32_t)(viewZ*10.0f);
    for (int i=0;i<streaks;i++) {
      uint32_t h=base ^ (0xA341316Cu * (uint32_t)(i+1));
      int y=WORLD_TOP + (int)((h>>8) % (WORLD_BOTTOM-WORLD_TOP-8));
      int len=6 + (int)((h>>16)&0x07u);
      int inset=4 + (int)((h>>24)&0x07u);
      r.line(inset,y,inset+len,y+2,C_WHITE);
      r.line(SCREEN_W-inset-len,y+2,SCREEN_W-inset,y,C_WHITE);
    }
  }
}

static void drawTracks(Raster& r,float viewZ) {
  if (g.tracks.count<2) return;
  for (uint8_t n=1;n<g.tracks.count;n++) {
    uint8_t ia=(uint8_t)((g.tracks.head+n-1)%TRACK_CAPACITY);
    uint8_t ib=(uint8_t)((g.tracks.head+n)%TRACK_CAPACITY);
    const TrackNode& a=g.tracks.nodes[ia];
    const TrackNode& b=g.tracks.nodes[ib];
    if (b.breakBefore || b.z<viewZ-12) continue;
    float ca=cosf(a.heading), sa=sinf(a.heading);
    float cb=cosf(b.heading), sb=sinf(b.heading);
    for (int side=-1;side<=1;side+=2) {
      float ax=a.x+side*0.18f*ca;
      float az=a.z-side*0.18f*sa;
      float bx=b.x+side*0.18f*cb;
      float bz=b.z-side*0.18f*sb;
      Projected p0=project(ax,az,viewZ),p1=project(bx,bz,viewZ);
      if (p0.visible&&p1.visible) {
        uint16_t c=b.shade?C_SHADOW:C_PALE;
        r.line((int)p0.x,(int)p0.y,(int)p1.x,(int)p1.y,c);
        if (b.shade) r.line((int)p0.x+1,(int)p0.y,(int)p1.x+1,(int)p1.y,c);
      }
    }
  }
}

static void drawPine(Raster& r,const Projected& p) {
  int x=(int)lroundf(p.x), y=(int)lroundf(p.y);
  int h=(int)clampF(34.0f*p.scale/7.5f,10,52);
  int w=h/2;
  r.rect(x-1,y-h/6,3,h/6,C_ROCK);
  r.triangle(x,y-h,x-w/2,y-h/2,x+w/2,y-h/2,C_PINE_LIGHT);
  r.triangle(x,y-h*4/5,x-w*2/3,y-h/3,x+w*2/3,y-h/3,C_PINE_DARK);
  r.triangle(x,y-h*3/5,x-w,y,x+w,y,C_PINE_DARK);
}

[[maybe_unused]] static void drawRock(Raster& r,const Projected& p) {
  int x=(int)lroundf(p.x),y=(int)lroundf(p.y);
  int s=(int)clampF(8.0f*p.scale/7.5f,3,13);
  r.triangle(x-s,y,x,y-s,x+s,y,C_ROCK);
  r.triangle(x-s,y,x+s,y,x+s/2,y+s/3,C_SHADOW);
}

static void drawGate(Raster& r,uint8_t i,float viewZ) {
  const GateDef& gd=runCourse[i];
  Projected p=project(gd.x,gd.z,viewZ,-12);
  if (!p.visible) return;
  int x=(int)lroundf(p.x), base=(int)lroundf(p.y);
  float norm=p.scale/7.5f;
  int poleH=(int)clampF(25*norm,7,42);
  int poleW=(int)clampF(2.5f*norm,1,4);
  uint16_t c=(gd.ordinal&1)?C_RED:C_BLUE;
  if (g.gates[i].cleanHighlightRemaining>0) c=C_GOLD;

  float bend=0;
  if (g.gates[i].outcome==GateOutcome::Hit) {
    float t=clampF(g.gates[i].hitAge/0.10f,0,1);
    bend=(65.0f-(15.0f*t))*((float)g.gates[i].bendSign);
  }
  int topX=x+(int)lroundf(sinf(bend*3.1415926f/180.0f)*poleH);
  int topY=base-(int)lroundf(cosf(bend*3.1415926f/180.0f)*poleH);
  for (int k=0;k<poleW;k++) r.line(x+k,base,topX+k,topY,c);
  r.circle(x,base,1,C_NAVY);

  // Flag and required-side arrow.
  int fw=(int)clampF(8*norm,6,14), fh=(int)clampF(6*norm,4,10);
  int fx=topX + ((int8_t)gd.passSide<0 ? -fw : 0);
  int fy=topY;
  r.rect(fx,fy,fw,fh,c);
  int midY=fy+fh/2;
  if ((int8_t)gd.passSide<0) {
    r.line(fx+1,midY,fx+fw-2,midY,C_WHITE);
    r.line(fx+1,midY,fx+3,midY-2,C_WHITE);
    r.line(fx+1,midY,fx+3,midY+2,C_WHITE);
  } else {
    r.line(fx+1,midY,fx+fw-2,midY,C_WHITE);
    r.line(fx+fw-2,midY,fx+fw-4,midY-2,C_WHITE);
    r.line(fx+fw-2,midY,fx+fw-4,midY+2,C_WHITE);
  }

  // Passage chevrons on legal side.
  for (int n=0;n<2;n++) {
    float q=n?2.7f:1.5f;
    float wx=gd.x+(float)(int8_t)gd.passSide*q;
    Projected cp=project(wx,gd.z,viewZ);
    if (cp.visible) {
      int cx=(int)cp.x, cy=(int)cp.y;
      int dir=(int8_t)gd.passSide;
      r.line(cx-dir*3,cy-2,cx,cy,C_SHADOW);
      r.line(cx,cy,cx-dir*3,cy+2,C_SHADOW);
    }
  }

  if (g.gates[i].outcome==GateOutcome::Miss) {
    r.line(x-3,base-5,x+3,base+1,C_NAVY);
    r.line(x+3,base-5,x-3,base+1,C_NAVY);
  }
}

static void drawParticles(Raster& r,float viewZ) {
  for (uint8_t i=0;i<PARTICLE_CAPACITY;i++) {
    const SnowParticle& s=g.effects.snow[i];
    if (!s.active) continue;
    Projected p=project(s.x,s.z,viewZ,-10);
    if (!p.visible) continue;
    int x=(int)p.x;
    int y=(int)lroundf(p.y-s.height*p.scale);
    int sz=s.size;
    if (s.age>s.life*0.7f && sz>1) sz--;
    r.rect(x,y,sz,sz,s.shade?C_SHADOW:C_WHITE);
  }
}

// ============================================================
// Authored pixel skier
//
// The skier is intentionally an authored palette-indexed sprite family rather
// than a body assembled from runtime rectangles/lines.  The source style is
// the low, forward racing tuck from the supplied reference image.
// Two pixels are packed per byte (high nibble first) to keep flash use small.
// ============================================================

static constexpr uint8_t TITLE_SKIER_W = 56;
static constexpr uint8_t TITLE_SKIER_H = 48;
static constexpr int8_t TITLE_SKIER_BOOT_X = 24;
static constexpr int8_t TITLE_SKIER_BOOT_Y = 24;


static const uint8_t TITLE_SKIER[1344] = {
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x04,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x10,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x03,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x30,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x33,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x33,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x08,0x88,0x00,0x00,0x80,0x55,0x80,0x00,0x00,0x00,0x05,0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x80,
  0x00,0x00,0x06,0x00,0x00,0x81,0x11,0x60,0x66,0x55,0x55,0x50,0x00,0x00,0x08,0x55,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x07,0x11,0x11,0x75,0x57,0x66,0x66,0x76,0x66,0x68,0x26,0x80,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x07,0x11,0x17,0x21,0x76,0x66,0x66,0x33,0x66,0x62,0x76,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x71,0x11,0x76,0x11,0x66,0x66,0x63,0x54,
  0x26,0x27,0x66,0x66,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x60,0x00,0x60,0x00,0x11,0x13,0x36,0x11,
  0x66,0x66,0x34,0x11,0x67,0x66,0x66,0x66,0x70,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x01,0x33,0x36,0x11,0x67,0x77,0x34,0x16,0x67,0x76,0x66,0x66,0x67,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x33,0x55,0x51,0x71,0x16,0x71,0x66,0x66,0x77,0x66,0x76,0x66,0x70,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x06,0x00,0x09,0x00,0x00,0x55,0x51,0x71,0x56,0x61,0x76,0x66,0x77,0x67,0x66,0x66,0x70,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x06,0x00,0x00,0x00,0x90,0x00,0x00,0x06,0x16,0x11,0x67,0x17,0x77,0x66,0x67,0x77,0x66,
  0x66,0x67,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x06,0x00,0x00,0x09,0x99,0x00,0x00,0x00,0x03,0x41,0x15,0x71,0x77,0x76,
  0x66,0x67,0x77,0x66,0x66,0x67,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x86,0x00,0x90,0x00,0x00,0x00,0x00,0x00,0x16,
  0x65,0x11,0x46,0x66,0x66,0x77,0x76,0x66,0x66,0x66,0x70,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x09,0x00,0x00,0x00,
  0x00,0x00,0x00,0x06,0x71,0x11,0x46,0x66,0x67,0x77,0x76,0x66,0x66,0x66,0x70,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x06,0x09,
  0x90,0x00,0x00,0x11,0x00,0x00,0x00,0x06,0x11,0x11,0x46,0x66,0x77,0x77,0x76,0x66,0x66,0x66,0x70,0x00,0x00,0x00,0x00,0x06,
  0x00,0x60,0x00,0x66,0x00,0x60,0x01,0x19,0x00,0x00,0x04,0x11,0x56,0x77,0x00,0x07,0x77,0x77,0x66,0x86,0x66,0x66,0x70,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x68,0x60,0x00,0x66,0x12,0x00,0x00,0x00,0x01,0x11,0x14,0x76,0x00,0x67,0x77,0x76,0x68,0x00,
  0x66,0x66,0x67,0x77,0x76,0x00,0x00,0x00,0x00,0x66,0x16,0x00,0x06,0x11,0x10,0x00,0x00,0x00,0x02,0x11,0x55,0x70,0x00,0x66,
  0x77,0x66,0x60,0x00,0x06,0x66,0x66,0x66,0x66,0x77,0x70,0x00,0x06,0x11,0x60,0x00,0x61,0x19,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x06,0x66,0x66,0x67,0x00,0x00,0x00,0x66,0x66,0x66,0x66,0x66,0x67,0x67,0x71,0x22,0x12,0x16,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x66,0x66,0x66,0x66,0x00,0x00,0x00,0x00,0x86,0x66,0x66,0x11,0x77,0x77,0x71,0x12,
  0x60,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x66,0x66,0x66,0x70,0x00,0x00,0x00,0x00,0x06,0x61,0x44,
  0x67,0x77,0x11,0x70,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x66,0x66,0x67,0x70,0x00,0x00,
  0x00,0x01,0x14,0x41,0x17,0x71,0x11,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x06,0x66,
  0x66,0x67,0x00,0x00,0x00,0x61,0x96,0x14,0x47,0x11,0x90,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x66,0x66,0x77,0x71,0x11,0x19,0x80,0x46,0x11,0x10,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x61,0x16,0x77,0x77,0x11,0x90,0x01,0x61,0x11,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x14,0x44,0x67,0x71,0x20,0x08,0x01,0x11,0x90,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x04,0x11,0x67,0x11,0x00,0x00,0x01,0x10,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x44,0x71,0x10,
  0x00,0x60,0x21,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x14,0x61,0x11,0x00,0x00,0x61,0x10,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x11,0x11,0x90,0x00,0x06,0x17,0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x08,0x11,0x20,0x00,0x06,0x11,0x70,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x67,0x12,0x00,0x06,0x61,0x26,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x07,0x17,0x80,0x00,0x11,0x96,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x08,0x11,0x70,0x00,0x11,0x16,0x80,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x02,0x16,0x80,
  0x01,0x19,0x60,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x01,0x11,0x00,0x07,0x11,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x11,0x90,0x81,0x11,0x10,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x11,0x10,0x00,0x02,0x17,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x11,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x11,0x90,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x06,0x11,0x10,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x11,0x11,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x71,0x60,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
};






static inline uint8_t titleSpriteIndex(const uint8_t* sprite,uint16_t pixelIndex) {
  uint8_t packed=sprite[pixelIndex>>1];
  return (pixelIndex&1) ? (packed&0x0F) : (packed>>4);
}

static inline uint16_t titlePaletteColor(uint8_t index) {
  switch(index) {
    case 1: return C_NAVY;
    case 2: return C_BLUE;
    case 3: return C_RED;
    case 4: return C_SKIER_LIME;
    case 5: return C_SKIER_TAN;
    case 6: return C_SUIT_LIGHT;
    case 7: return C_SUIT_MID;
    case 8: return C_WHITE;
    case 9: return C_SPRAY_CYAN;
    default:return 0;
  }
}

static void drawIndexedTitleSkier(Raster& r,
                              int16_t anchorX,
                              int16_t anchorY,
                              const uint8_t* sprite,
                              bool mirror,
                              float scale,
                              float sprayAmount) {
  if (!sprite || scale<=0.0f) return;

  int16_t sourceAnchorX=mirror ? (TITLE_SKIER_W-1-TITLE_SKIER_BOOT_X) : TITLE_SKIER_BOOT_X;
  int16_t originX=anchorX-(int16_t)lroundf(sourceAnchorX*scale);
  int16_t originY=anchorY-(int16_t)lroundf(TITLE_SKIER_BOOT_Y*scale);
  int16_t block=(int16_t)ceilf(scale);
  if (block<1) block=1;

  for (uint8_t sy=0;sy<TITLE_SKIER_H;sy++) {
    int16_t dy=originY+(int16_t)lroundf(sy*scale);
    int16_t dy2=originY+(int16_t)lroundf((sy+1)*scale);
    int16_t ph=dy2-dy;
    if (ph<1) ph=block;
    if (dy>=r.y0+r.h || dy+ph<=r.y0) continue;

    for (uint8_t sx=0;sx<TITLE_SKIER_W;sx++) {
      uint8_t readX=mirror ? (uint8_t)(TITLE_SKIER_W-1-sx) : sx;
      uint16_t pi=(uint16_t)sy*TITLE_SKIER_W+readX;
      uint8_t colorIndex=titleSpriteIndex(sprite,pi);
      if (!colorIndex) continue;

      // Cyan pixels are the compact snow plume from the authored sprite.
      // At low speed render only some of it; at high speed the full plume appears.
      if (colorIndex==9 && sprayAmount<0.99f) {
        uint8_t mask=(uint8_t)((sx*13u+sy*7u)&0xFFu);
        if (mask>(uint8_t)(sprayAmount*255.0f)) continue;
      }

      int16_t dx=originX+(int16_t)lroundf(sx*scale);
      int16_t dx2=originX+(int16_t)lroundf((sx+1)*scale);
      int16_t pw=dx2-dx;
      if (pw<1) pw=block;
      r.rect(dx,dy,pw,ph,titlePaletteColor(colorIndex));
    }
  }
}

static void drawTitleSkier(Raster& r,int16_t anchorX,int16_t anchorY,float scale) {
  // Title art is intentionally isolated from gameplay.  This is the only place
  // the poster bitmap is used.
  drawIndexedTitleSkier(r,anchorX,anchorY,TITLE_SKIER,false,scale,0.90f);
}

// ============================================================
// Articulated gameplay skier
//
// This is a new rear/three-quarter character designed specifically for the
// race view.  It shares costume colors with the title racer, but no title
// pixels, silhouette, or pose data.  The body is constructed from filled
// pixel-art masses driven continuously by the live physics state.
// ============================================================

struct CharPoint {
  float x;
  float y;
};

struct GameplayPose {
  CharPoint leftBoot, rightBoot;
  CharPoint leftKnee, rightKnee;
  CharPoint hip;
  CharPoint leftShoulder, rightShoulder;
  CharPoint leftHand, rightHand;
  CharPoint head;
  CharPoint leftSki, rightSki;
  CharPoint leftPoleTip, rightPoleTip;
  float leftSkiAngle;
  float rightSkiAngle;
  bool leftSkiDetached;
  bool rightSkiDetached;
};

static inline CharPoint cp(float x,float y) { return {x,y}; }
static inline CharPoint cpAdd(CharPoint a,CharPoint b) { return {a.x+b.x,a.y+b.y}; }
static inline CharPoint cpScale(CharPoint a,float s) { return {a.x*s,a.y*s}; }
static inline CharPoint cpLerp(CharPoint a,CharPoint b,float t) {
  return {a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t};
}
static inline float ease01(float t) { return smoothstep01(clampF(t,0.0f,1.0f)); }

static inline CharPoint rotatePoint(CharPoint p,CharPoint pivot,float angle) {
  float s=sinf(angle), c=cosf(angle);
  float x=p.x-pivot.x, y=p.y-pivot.y;
  return {pivot.x+x*c-y*s,pivot.y+x*s+y*c};
}

static void fillQuad(Raster& r,CharPoint a,CharPoint b,CharPoint c,CharPoint d,uint16_t color) {
  r.triangle((int16_t)lroundf(a.x),(int16_t)lroundf(a.y),
             (int16_t)lroundf(b.x),(int16_t)lroundf(b.y),
             (int16_t)lroundf(c.x),(int16_t)lroundf(c.y),color);
  r.triangle((int16_t)lroundf(a.x),(int16_t)lroundf(a.y),
             (int16_t)lroundf(c.x),(int16_t)lroundf(c.y),
             (int16_t)lroundf(d.x),(int16_t)lroundf(d.y),color);
}

static void drawThickSegment(Raster& r,CharPoint a,CharPoint b,float width,uint16_t color) {
  float dx=b.x-a.x, dy=b.y-a.y;
  float len=sqrtf(dx*dx+dy*dy);
  if (len<0.001f) {
    int s=(int)fmaxf(1.0f,width);
    r.rect((int)a.x-s/2,(int)a.y-s/2,s,s,color);
    return;
  }
  float nx=-dy/len*(width*0.5f);
  float ny= dx/len*(width*0.5f);
  fillQuad(r,{a.x+nx,a.y+ny},{b.x+nx,b.y+ny},
             {b.x-nx,b.y-ny},{a.x-nx,a.y-ny},color);
}

static GameplayPose buildGameplayPose() {
  GameplayPose p{};
  float c=clampF(g.player.carve,-1.0f,1.0f);
  float a=fabsf(c);
  float skid=clampF(g.player.skid,0.0f,1.0f);
  float speedN=clampF((g.player.v-6.0f)/16.0f,0.0f,1.0f);
  float drift=clampF(g.player.vx/MAX_LATERAL_SPEED,-1.0f,1.0f);

  // Distance-driven chatter: motion stops when the skier stops and naturally
  // accelerates with downhill speed.
  float phase=fmodf(g.player.z*0.72f,1.0f);
  if (phase<0) phase+=1.0f;
  float tri=1.0f-fabsf(phase*2.0f-1.0f); // 0..1..0
  float bob=(tri-0.5f)*1.2f;

  float skiSep=4.1f+1.8f*skid+0.5f*a;
  p.leftBoot =cp(-skiSep,0.0f);
  p.rightBoot=cp( skiSep,0.0f);

  // Inside leg compresses, outside leg extends.  The hips/shoulders move more
  // than the boots so the character loads an edge instead of rotating rigidly.
  float leftInside = c<0 ? a : 0.0f;
  float rightInside= c>0 ? a : 0.0f;
  p.leftKnee =cp(-4.4f+2.2f*c,-5.5f+1.4f*leftInside-0.8f*rightInside+bob);
  p.rightKnee=cp( 4.4f+2.2f*c,-5.5f+1.4f*rightInside-0.8f*leftInside+bob);

  float tuck=2.1f*speedN;
  p.hip=cp(3.7f*c+1.0f*drift,-10.2f+tuck+bob);
  CharPoint shoulderCenter=cp(6.0f*c+1.3f*drift,-19.0f+3.0f*speedN+bob);
  float shoulderHalf=5.1f-0.7f*speedN;
  p.leftShoulder =cp(shoulderCenter.x-shoulderHalf,shoulderCenter.y+0.6f*c);
  p.rightShoulder=cp(shoulderCenter.x+shoulderHalf,shoulderCenter.y-0.6f*c);

  p.head=cp(shoulderCenter.x+0.9f*c,
            shoulderCenter.y-6.0f+1.8f*speedN);

  // Arms tuck inward with speed.  Inside hand drops during a loaded carve.
  float handSpread=8.5f-2.8f*speedN;
  float handDrop=3.4f+2.2f*speedN;
  p.leftHand =cp(shoulderCenter.x-handSpread,
                 shoulderCenter.y+handDrop+2.0f*leftInside);
  p.rightHand=cp(shoulderCenter.x+handSpread,
                 shoulderCenter.y+handDrop+2.0f*rightInside);

  p.leftPoleTip =cp(p.leftHand.x-4.5f-1.5f*speedN,p.leftHand.y+11.0f);
  p.rightPoleTip=cp(p.rightHand.x+4.5f+1.5f*speedN,p.rightHand.y+11.0f);

  // Skis show more heading than the torso.  Skid opens the tails slightly so
  // the visual direction can disagree with the actual lateral drift.
  float visualHeading=clampF(g.player.heading*0.78f,-0.52f,0.52f);
  p.leftSki =cp(p.leftBoot.x,p.leftBoot.y+1.5f);
  p.rightSki=cp(p.rightBoot.x,p.rightBoot.y+1.5f);
  p.leftSkiAngle =visualHeading-0.09f*skid;
  p.rightSkiAngle=visualHeading+0.09f*skid;
  p.leftSkiDetached=false;
  p.rightSkiDetached=false;
  return p;
}

static void rotateBody(GameplayPose& p,float angle,CharPoint pivot,float xShift,float yShift) {
  CharPoint* pts[]={&p.leftBoot,&p.rightBoot,&p.leftKnee,&p.rightKnee,&p.hip,
                    &p.leftShoulder,&p.rightShoulder,&p.leftHand,&p.rightHand,&p.head};
  for (CharPoint* q:pts) {
    *q=rotatePoint(*q,pivot,angle);
    q->x+=xShift; q->y+=yShift;
  }
}

static GameplayPose buildRecoverableFallPose() {
  GameplayPose p=buildGameplayPose();
  float age=clampF(g.player.crashAge,0.0f,CRASH_DURATION);
  float sign=(float)(g.player.crashSpinSign==0?1:g.player.crashSpinSign);

  // A recoverable gate crash falls onto a hip, slides, then visibly gathers the
  // skis back underneath the racer before control returns.
  float fallAmount;
  if (age<0.80f) fallAmount=ease01(age/0.80f);
  else fallAmount=ease01(1.0f-(age-0.80f)/0.40f);

  float impact=ease01(age/0.12f)*(1.0f-ease01((age-0.12f)/0.18f));
  float angle=sign*(1.18f*fallAmount);
  float drop=6.5f*fallAmount+2.0f*impact;
  rotateBody(p,angle,{0.0f,0.0f},sign*2.0f*fallAmount,drop);

  p.leftSkiAngle += -0.34f*fallAmount;
  p.rightSkiAngle+=  0.34f*fallAmount;
  p.leftSki.x -= 2.5f*fallAmount;
  p.rightSki.x+= 2.5f*fallAmount;
  p.leftPoleTip.x -= 4.0f*fallAmount;
  p.rightPoleTip.x+= 4.0f*fallAmount;
  return p;
}

static GameplayPose buildTreeWipeoutPose() {
  GameplayPose p=buildGameplayPose();
  float age=clampF(g.player.crashAge,0.0f,1.2f);
  float sign=(float)(g.player.crashSpinSign==0?1:g.player.crashSpinSign);

  // Tree impacts are terminal and therefore get a different, much more violent
  // animation: compress, launch/twist, tumble, then settle on the snow.
  float impact=ease01(age/0.10f);
  float launch=ease01((age-0.08f)/0.34f);
  float settle=ease01((age-0.55f)/0.35f);
  float angle=sign*(2.55f*launch + (1.48f-2.55f)*settle);
  float xShift=sign*(2.0f*impact+7.0f*launch-2.0f*settle);
  float yShift=2.0f*impact+7.0f*launch;
  rotateBody(p,angle,{0.0f,-2.0f},xShift,yShift);

  // Skis separate from the feet after impact.  They remain visible as scattered
  // equipment while the body settles instead of snapping back to a race pose.
  float detach=ease01((age-0.10f)/0.28f);
  p.leftSkiDetached=detach>0.05f;
  p.rightSkiDetached=detach>0.05f;
  if (p.leftSkiDetached) {
    p.leftSki=cp(-11.0f-6.0f*detach,5.0f+4.0f*detach);
    p.leftSkiAngle=-0.72f*sign-0.35f*detach;
  }
  if (p.rightSkiDetached) {
    p.rightSki=cp(12.0f+7.0f*detach,7.0f+2.0f*detach);
    p.rightSkiAngle=0.62f*sign+0.42f*detach;
  }
  p.leftPoleTip =cp(-15.0f-5.0f*detach,2.0f+8.0f*detach);
  p.rightPoleTip=cp(15.0f+6.0f*detach,5.0f+6.0f*detach);
  return p;
}

static void drawGameplaySki(Raster& r,CharPoint center,float angle,bool bright) {
  float sx=sinf(angle), sy=-cosf(angle);
  CharPoint front=cp(center.x+sx*16.0f,center.y+sy*16.0f);
  CharPoint tail =cp(center.x-sx*9.0f, center.y-sy*9.0f);
  drawThickSegment(r,tail,front,2.4f,C_NAVY);
  if (bright) {
    CharPoint n=cp(cosf(angle),sinf(angle));
    drawThickSegment(r,cpAdd(tail,cpScale(n,0.9f)),cpAdd(front,cpScale(n,0.9f)),0.8f,C_BLUE);
  }
}

static void drawGameplayLeg(Raster& r,CharPoint hipJoint,CharPoint knee,CharPoint boot,bool nearLeg) {
  drawThickSegment(r,hipJoint,knee,nearLeg?4.2f:3.8f,C_SUIT_LIGHT);
  drawThickSegment(r,knee,boot,nearLeg?3.7f:3.3f,C_SUIT_MID);
  int bx=(int)lroundf(boot.x), by=(int)lroundf(boot.y);
  r.rect(bx-2,by-2,4,4,C_SKIER_LIME);
  r.rect(bx-1,by-2,3,2,C_NAVY);
}

static void drawGameplayArm(Raster& r,CharPoint shoulder,CharPoint hand,bool nearArm,float outward) {
  CharPoint elbow=cpLerp(shoulder,hand,0.56f);
  elbow.x+=outward*1.8f;
  elbow.y+=1.0f;
  drawThickSegment(r,shoulder,elbow,nearArm?3.4f:3.0f,C_BLUE);
  drawThickSegment(r,elbow,hand,nearArm?3.0f:2.6f,C_BLUE);
  int hx=(int)lroundf(hand.x),hy=(int)lroundf(hand.y);
  r.rect(hx-1,hy-1,3,3,C_NAVY);
}

static void drawGameplayTorso(Raster& r,const GameplayPose& p) {
  float dx=p.rightShoulder.x-p.leftShoulder.x;
  float dy=p.rightShoulder.y-p.leftShoulder.y;
  float len=sqrtf(dx*dx+dy*dy);
  float nx=(len>0.01f)?(-dy/len):0.0f;
  float ny=(len>0.01f)?( dx/len):1.0f;
  CharPoint hipL=cp(p.hip.x-dx*0.30f+nx*0.5f,p.hip.y-dy*0.30f+ny*0.5f);
  CharPoint hipR=cp(p.hip.x+dx*0.30f-nx*0.5f,p.hip.y+dy*0.30f-ny*0.5f);
  fillQuad(r,p.leftShoulder,p.rightShoulder,hipR,hipL,C_BLUE);

  // Light center-back panel and red shoulder stripe identify this as the same
  // racer as the title character without copying the title sprite.
  CharPoint topMid=cpLerp(p.leftShoulder,p.rightShoulder,0.5f);
  CharPoint panelTopL=cpLerp(p.leftShoulder,topMid,0.60f);
  CharPoint panelTopR=cpLerp(p.rightShoulder,topMid,0.60f);
  CharPoint panelBotL=cpLerp(hipL,p.hip,0.55f);
  CharPoint panelBotR=cpLerp(hipR,p.hip,0.55f);
  fillQuad(r,panelTopL,panelTopR,panelBotR,panelBotL,C_SUIT_LIGHT);
  drawThickSegment(r,cpLerp(p.leftShoulder,p.hip,0.12f),
                     cpLerp(p.rightShoulder,p.hip,0.12f),1.8f,C_RED);
}

static void drawGameplayHelmet(Raster& r,CharPoint head,float leanSign) {
  int x=(int)lroundf(head.x),y=(int)lroundf(head.y);
  r.rect(x-3,y-3,7,6,C_NAVY);
  r.rect(x-2,y-4,5,2,C_NAVY);
  r.rect(x+(leanSign>=0?0:-2),y-2,3,3,C_BLUE);
  r.rect(x-2,y+1,5,1,C_RED);
  r.rect(x+(leanSign>=0?2:-2),y-1,2,1,C_WHITE);
}

static void drawGameplayCharacter(Raster& r,const GameplayPose& local,bool wipeout) {
  // Convert local character coordinates into the fixed race anchor.  Using one
  // translation here keeps every joint coherent across strip boundaries.
  GameplayPose p=local;
  auto toScreen=[](CharPoint q)->CharPoint { return {120.0f+q.x,(float)PLAYER_ANCHOR_Y+q.y}; };
  p.leftBoot=toScreen(p.leftBoot); p.rightBoot=toScreen(p.rightBoot);
  p.leftKnee=toScreen(p.leftKnee); p.rightKnee=toScreen(p.rightKnee);
  p.hip=toScreen(p.hip); p.leftShoulder=toScreen(p.leftShoulder); p.rightShoulder=toScreen(p.rightShoulder);
  p.leftHand=toScreen(p.leftHand); p.rightHand=toScreen(p.rightHand); p.head=toScreen(p.head);
  p.leftSki=toScreen(p.leftSki); p.rightSki=toScreen(p.rightSki);
  p.leftPoleTip=toScreen(p.leftPoleTip); p.rightPoleTip=toScreen(p.rightPoleTip);

  // The world projection already positions the player laterally.  Add that
  // projected displacement after the local rig is built.
  Projected projected=project(g.player.x,g.player.z,g.player.z,-2);
  float offsetX=projected.x-120.0f;
  CharPoint* pts[]={&p.leftBoot,&p.rightBoot,&p.leftKnee,&p.rightKnee,&p.hip,
                    &p.leftShoulder,&p.rightShoulder,&p.leftHand,&p.rightHand,&p.head,
                    &p.leftSki,&p.rightSki,&p.leftPoleTip,&p.rightPoleTip};
  for (CharPoint* q:pts) q->x+=offsetX;

  float lean=g.player.carve;
  bool rightNear=lean>=0.0f;

  // Shadow fragments under the skier; wipeout shadow widens as the body settles.
  int shadowW=wipeout?30:18+(int)(6.0f*clampF(g.player.skid,0,1));
  int sx=(int)lroundf((p.leftBoot.x+p.rightBoot.x)*0.5f);
  int sy=(int)lroundf(fmaxf(p.leftBoot.y,p.rightBoot.y)+3.0f);
  r.rect(sx-shadowW/2,sy,shadowW,2,C_SHADOW);

  // Far equipment / limbs first for a rear three-quarter read.
  if (rightNear) {
    drawGameplaySki(r,p.leftSki,p.leftSkiAngle,false);
    drawGameplayLeg(r,cp(p.hip.x-2.4f,p.hip.y),p.leftKnee,p.leftBoot,false);
    drawThickSegment(r,p.leftHand,p.leftPoleTip,1.0f,C_RED);
    drawGameplayArm(r,p.leftShoulder,p.leftHand,false,-1.0f);
  } else {
    drawGameplaySki(r,p.rightSki,p.rightSkiAngle,false);
    drawGameplayLeg(r,cp(p.hip.x+2.4f,p.hip.y),p.rightKnee,p.rightBoot,false);
    drawThickSegment(r,p.rightHand,p.rightPoleTip,1.0f,C_RED);
    drawGameplayArm(r,p.rightShoulder,p.rightHand,false,1.0f);
  }

  drawGameplayTorso(r,p);

  if (rightNear) {
    drawGameplaySki(r,p.rightSki,p.rightSkiAngle,true);
    drawGameplayLeg(r,cp(p.hip.x+2.4f,p.hip.y),p.rightKnee,p.rightBoot,true);
    drawGameplayArm(r,p.rightShoulder,p.rightHand,true,1.0f);
    drawThickSegment(r,p.rightHand,p.rightPoleTip,1.0f,C_RED);
  } else {
    drawGameplaySki(r,p.leftSki,p.leftSkiAngle,true);
    drawGameplayLeg(r,cp(p.hip.x-2.4f,p.hip.y),p.leftKnee,p.leftBoot,true);
    drawGameplayArm(r,p.leftShoulder,p.leftHand,true,-1.0f);
    drawThickSegment(r,p.leftHand,p.leftPoleTip,1.0f,C_RED);
  }

  drawGameplayHelmet(r,p.head,lean);
}

static void drawGameplaySkier(Raster& r,float viewZ) {
  (void)viewZ;
  if (g.phase==Phase::Wipeout) {
    drawGameplayCharacter(r,buildTreeWipeoutPose(),true);
  } else if (g.player.mode==MoveMode::Crashed) {
    drawGameplayCharacter(r,buildRecoverableFallPose(),false);
  } else {
    drawGameplayCharacter(r,buildGameplayPose(),false);
  }
}


static void drawFinish(Raster& r,float viewZ) {
  float center=courseCenterX(COURSE_LENGTH);
  Projected l=project(center-PISTE_HALF,COURSE_LENGTH,viewZ,-12);
  Projected rr=project(center+PISTE_HALF,COURSE_LENGTH,viewZ,-12);
  if (!l.visible || !rr.visible) return;
  int y=(int)lroundf((l.y+rr.y)*0.5f);
  r.line((int)l.x,y,(int)rr.x,y,C_NAVY);
  int h=(int)clampF(26*l.scale/7.5f,8,38);
  r.line((int)l.x,y,(int)l.x,y-h,C_RED);
  r.line((int)rr.x,y,(int)rr.x,y-h,C_BLUE);
  int x0=(int)l.x, x1=(int)rr.x;
  int bw=x1-x0;
  if (bw>10) {
    r.rect(x0,y-h,bw,5,C_NAVY);
    int tx=x0+(bw-textWidth("FINISH",1))/2;
    r.text(tx,y-h-1,1,C_WHITE,"FINISH");
  }
}

static void drawNotice(Raster& r) {
  if (g.effects.notice==NoticeKind::None) return;
  char buf[32];
  uint16_t accent=C_NAVY;
  switch(g.effects.notice) {
    case NoticeKind::Clean: snprintf(buf,sizeof(buf),"CLEAN %u",g.effects.noticeStreak); accent=C_GOLD; break;
    case NoticeKind::Miss: snprintf(buf,sizeof(buf),"MISS +3.00"); accent=C_RED; break;
    case NoticeKind::Hit: snprintf(buf,sizeof(buf),"HIT +3.00"); accent=C_RED; break;
    case NoticeKind::Crash: snprintf(buf,sizeof(buf),"CRASH +2.00"); accent=C_ORANGE; break;
    case NoticeKind::Go: snprintf(buf,sizeof(buf),"GO"); accent=C_ORANGE; break;
    case NoticeKind::Finish: snprintf(buf,sizeof(buf),"FINISH"); accent=C_ORANGE; break;
    default:return;
  }
  int w=textWidth(buf,1)+10;
  int x=(SCREEN_W-w)/2, y=52;
  r.rect(x,y,w,12,C_PALE);
  r.rect(x,y,3,12,accent);
  r.text(x+6,y+2,1,C_NAVY,buf);
}

static void renderWorld() {
  float viewZ=(g.phase==Phase::FinishCoast)?g.coastZ:g.player.z;

  for (int16_t sy=WORLD_TOP;sy<WORLD_BOTTOM;sy+=STRIP_H) {
    int16_t hh=(sy+STRIP_H>WORLD_BOTTOM)?WORLD_BOTTOM-sy:STRIP_H;
    fillStrip(C_SNOW,hh);
    Raster r{stripPixels,sy,hh};
    drawSnowSurface(r,viewZ);
    drawTracks(r,viewZ);

    // Every visible tree is part of the generated physical forest.
    for (uint8_t i=0;i<TREE_COUNT;i++) {
      Projected p=project(runTrees[i].x,runTrees[i].z,viewZ,-12);
      if (p.visible) drawPine(r,p);
    }

    // Gates far-to-near.
    for (int i=GATE_COUNT-1;i>=0;i--) drawGate(r,(uint8_t)i,viewZ);
    drawFinish(r,viewZ);
    drawParticles(r,viewZ);
    drawGameplaySkier(r,viewZ);
    drawNotice(r);

    blitStrip(sy,hh);
    serviceAudio(millis());
  }
}

static void drawActionButton(int16_t x,int16_t y,int16_t w,int16_t h,const char* label) {
  display.fillRect(x,y,w,h,C_NAVY);
  display.fillRect(x+1,y+1,w-2,h-2,C_PALE);
  display.setTextSize(1);
  display.setTextColor(C_ORANGE,C_PALE);
  int16_t tx=x+(w-textWidth(label,1))/2;
  int16_t ty=y+(h-7)/2;
  display.setCursor(tx,ty);
  display.print(label);
}

static void drawResultsActionButtons() {
  // Keep these above the standard 304-319 menu footer.
  static constexpr int16_t Y=284;
  static constexpr int16_t H=19;
  drawActionButton(7,Y,80,H,"< MENU");
  drawActionButton(146,Y,87,H,"RETRY >");
}

static void drawStandardFooter() {
  display.fillRect(0,FOOTER_Y,SCREEN_W,FOOTER_H,C_NAVY);
  display.setTextSize(1);
  display.setTextColor(C_WHITE,C_NAVY);
  const char* footerText="HOLD BOTH: MENU";
  display.setCursor((SCREEN_W-textWidth(footerText,1))/2,FOOTER_Y+4);
  display.print(footerText);
}

static void drawWipeoutOverlay(uint32_t nowMs) {
  // Wipeout owns a centered splash panel. It intentionally has no bottom
  // menu footer: the Menu/Retry choices live inside this panel instead.
  static constexpr int16_t PANEL_X=22;
  static constexpr int16_t PANEL_Y=104;
  static constexpr int16_t PANEL_W=196;
  static constexpr int16_t PANEL_H=92;

  display.fillRect(PANEL_X,PANEL_Y,PANEL_W,PANEL_H,C_NAVY);
  display.fillRect(PANEL_X+2,PANEL_Y+2,PANEL_W-4,PANEL_H-4,C_PALE);
  display.setTextColor(C_NAVY,C_PALE);
  display.setTextSize(2);
  display.setCursor(73,PANEL_Y+14);
  display.print("WIPEOUT");
  display.setTextSize(1);

  if (elapsedMs(nowMs,g.wipeoutStartedMs)>=900) {
    static constexpr int16_t BUTTON_Y=PANEL_Y+55;
    static constexpr int16_t BUTTON_H=23;
    drawActionButton(PANEL_X+10,BUTTON_Y,78,BUTTON_H,"< MENU");
    drawActionButton(PANEL_X+108,BUTTON_Y,78,BUTTON_H,"RETRY >");
  }
}

static void drawHud(uint32_t nowMs) {
  uint64_t elapsed=g.result.valid?g.result.rawUs:(g.clock.processedRaceUs+g.clock.accumulatorUs);
  uint32_t ms=(uint32_t)((elapsed+500)/1000);
  char t[20],p[16],small[24];
  formatTime(ms,t,sizeof(t));
  formatPenalty(g.stats.penaltyMs,p,sizeof(p));

  for (int16_t sy=0;sy<HUD_H;sy+=16) {
    fillStrip(C_NAVY,16);
    Raster r{stripPixels,sy,16};
    if (sy==0) {
      r.text(8,6,1,C_PALE,"T");
      r.text(24,3,2,C_WHITE,t);
      snprintf(small,sizeof(small),"P %s",p);
      r.text(148,6,1,C_PALE,small);
    } else {
      uint8_t resolved=g.nextGate;
      snprintf(small,sizeof(small),"G %02u/30",resolved);
      r.text(8,22,1,C_WHITE,small);
      if (g.stats.streak>=2) {
        snprintf(small,sizeof(small),"CLEAN %02u",g.stats.streak);
        r.text(88,22,1,C_GOLD,small);
      }
      snprintf(small,sizeof(small),"%d KMH",(int)lroundf(g.player.v*3.6f));
      int x=232-textWidth(small,1);
      r.text(x,22,1,C_WHITE,small);
    }
    blitStrip(sy,16);
  }
  g.clock.lastHudMs=nowMs;
  g.hudDirty=false;
}

static void renderTitleStrip(int16_t sy,int16_t hh) {
  fillStrip(C_PALE,hh);
  Raster r{stripPixels,sy,hh};
  r.rect(0,sy,SCREEN_W,hh,C_PALE);

  // Mountains.
  r.triangle(0,125,70,45,125,125,C_SHADOW);
  r.triangle(70,125,145,30,215,125,C_WHITE);
  r.triangle(130,125,205,60,240,125,C_SHADOW);
  r.triangle(0,115,125,95,240,140,C_SNOW);

  r.text(30,26,4,C_NAVY,"ALPINE");
  r.text(30,62,4,C_NAVY,"SLALOM");

  if (records.hasBest) {
    char b[32],tt[20];
    formatTime(records.bestFinalMs,tt,sizeof(tt));
    snprintf(b,sizeof(b),"BEST %s",tt);
    r.text((SCREEN_W-textWidth(b,1))/2,112,1,C_NAVY,b);
  }

  // Poster gates.
  r.line(48,218,48,160,C_RED); r.rect(48,160,24,12,C_RED);
  r.line(190,202,190,166,C_BLUE); r.rect(170,166,20,10,C_BLUE);
  drawTitleSkier(r,125,220,1.7f);

  const char* startText="PRESS TO START";
  r.text((SCREEN_W-textWidth(startText,1))/2,292,1,C_ORANGE,startText);

  // Standard launcher exit hint belongs to the title/menu only.
  r.rect(0,FOOTER_Y,SCREEN_W,FOOTER_H,C_NAVY);
  const char* footerText="HOLD BOTH: MENU";
  r.text((SCREEN_W-textWidth(footerText,1))/2,FOOTER_Y+4,1,C_WHITE,footerText);
}

static void drawTitle() {
  for (int16_t sy=0;sy<SCREEN_H;sy+=STRIP_H) {
    int16_t hh=(sy+STRIP_H>SCREEN_H)?SCREEN_H-sy:STRIP_H;
    renderTitleStrip(sy,hh);
    blitStrip(sy,hh);
  }
}

static void drawCountdown() {
  renderWorld();
  drawHud(millis());
  // Center count on a small snow patch.
  int num=3-(int)g.countdownStage;
  char s[8]; snprintf(s,sizeof(s),"%d",num);
  display.fillRect(95,120,50,68,C_PALE);
  display.setTextColor(C_NAVY,C_PALE);
  display.setTextSize(7);
  display.setCursor(104,128);
  display.print(s);
  display.setTextSize(1);
}

static void drawResults() {
  for (int16_t sy=0;sy<SCREEN_H;sy+=STRIP_H) {
    int16_t hh=(sy+STRIP_H>SCREEN_H)?SCREEN_H-sy:STRIP_H;
    fillStrip(C_PALE,hh);
    Raster r{stripPixels,sy,hh};

    r.triangle(0,120,70,35,120,120,C_SHADOW);
    r.triangle(80,120,155,28,235,120,C_WHITE);
    r.text(24,24,2,C_NAVY,"ALPINE RUN");
    r.text(24,60,1,C_NAVY,"FINAL TIME");

    char finalT[20], rawT[20], pen[16], line[40];
    formatTime(g.result.finalMs,finalT,sizeof(finalT));
    formatTime(g.result.rawMs,rawT,sizeof(rawT));
    formatPenalty(g.result.penaltyMs,pen,sizeof(pen));
    r.text(24,80,3,C_ORANGE,finalT);
    if (g.result.newBest) r.text(24,110,1,C_ORANGE,"NEW BEST");

    snprintf(line,sizeof(line),"RAW %s",rawT); r.text(24,134,1,C_NAVY,line);
    snprintf(line,sizeof(line),"PENALTIES %s",pen); r.text(24,156,1,C_NAVY,line);
    snprintf(line,sizeof(line),"CLEAN %u / 30",g.result.cleared); r.text(24,180,1,C_NAVY,line);
    snprintf(line,sizeof(line),"MISSED %u",g.result.misses); r.text(24,199,1,C_NAVY,line);
    snprintf(line,sizeof(line),"POLE HITS %u",g.result.hits); r.text(24,218,1,C_NAVY,line);
    snprintf(line,sizeof(line),"CRASHES %u",g.result.crashes); r.text(24,237,1,C_NAVY,line);

    if (records.hasBest) {
      char bestT[20]; formatTime(records.bestFinalMs,bestT,sizeof(bestT));
      snprintf(line,sizeof(line),"BEST %s",bestT);
    } else snprintf(line,sizeof(line),"BEST --");
    r.text(24,258,1,C_NAVY,line);

    if (!g.result.recordEligible)
      r.text(24,275,1,C_RED,"TIMING STALL - NO RECORD");

    blitStrip(sy,hh);
  }
  drawResultsActionButtons();
  drawStandardFooter();
}

static void renderFrame() {
  switch(g.phase) {
    case Phase::Title: drawTitle(); break;
    case Phase::Countdown: drawCountdown(); break;
    case Phase::Racing:
    case Phase::FinishCoast:
      renderWorld();
      drawHud(millis());
      break;
    case Phase::Wipeout:
      renderWorld();
      drawHud(millis());
      drawWipeoutOverlay(millis());
      break;
    case Phase::Results: drawResults(); break;
  }
  g.forceFrame=false;
}

// ============================================================
// Phase management
// ============================================================

static void resetRun() {
  generateCourseLayout();

  PlayerState p{};
  p.x=courseCenterX(0.0f);
  p.v=START_SPEED;
  p.mode=MoveMode::Skiing;
  g.player=p;

  memset(g.gates,0,sizeof(g.gates));
  for (uint8_t i=0;i<GATE_COUNT;i++) g.gates[i].hitAge=-1.0f;
  g.stats={};
  g.stats.recordEligible=true;
  g.result={};
  g.camera={};
  g.camera.x=courseCenterX(0.0f);
  g.tracks={};
  g.tracks.breakNext=true;
  g.effects={};
  g.effects.rng=layoutRng ^ 0xA17E5A10u;
  g.nextGate=0;
  g.countdownStage=0;
  g.clock.accumulatorUs=0;
  g.clock.processedRaceUs=0;
  g.clock.lastHudMs=0;
  g.hudDirty=true;
}

static void setPhase(Phase next,uint32_t nowMs,uint32_t nowUs) {
  g.phase=next;
  g.clock.phaseStartedMs=nowMs;
  g.forceFrame=true;
  resetTapLatch(nowMs);

  if (next==Phase::Countdown) {
    resetRun();
    g.phase=Phase::Countdown;
    g.clock.phaseStartedMs=nowMs;
    g.countdownStage=0;
    requestTone(660,45,false);
  } else if (next==Phase::Racing) {
    g.clock.processedRaceUs=0;
    g.clock.accumulatorUs=0;
    g.clock.lastUpdateUs=nowUs;
    g.clock.initialized=true;
    setNotice(NoticeKind::Go,0.35f);
    requestTone(1320,90,true);
  } else if (next==Phase::Title || next==Phase::Results) {
    stopAudio();
  }
}

static void updateCountdown(uint32_t nowMs,uint32_t nowUs) {
  uint32_t e=elapsedMs(nowMs,g.clock.phaseStartedMs);
  uint8_t stage=(uint8_t)(e/500);
  if (stage>2) stage=2;
  if (stage!=g.countdownStage && e<COUNTDOWN_MS) {
    g.countdownStage=stage;
    g.forceFrame=true;
    requestTone(660,45,false);
  }
  if (e>=COUNTDOWN_MS) setPhase(Phase::Racing,nowMs,nowUs);
}

static void updateFinishCoast(uint32_t nowMs) {
  uint32_t e=elapsedMs(nowMs,g.coastStartedMs);
  float dt=0.016f;
  g.coastSpeed=approach(g.coastSpeed,0,0.35f,dt);
  g.coastZ+=g.coastSpeed*dt;
  updateEffects(dt);
  if (e>=COAST_MS) setPhase(Phase::Results,nowMs,micros());
}

static void updateWipeout(uint32_t deltaUs,uint32_t nowMs) {
  float dt=fminf(deltaUs*0.000001f,0.04f);
  g.player.crashAge=fminf(1.2f,g.player.crashAge+dt);
  g.player.vx*=1.0f/(1.0f+4.0f*dt);
  g.player.v=approach(g.player.v,0.0f,0.22f,dt);
  g.player.x+=g.player.vx*dt;
  g.player.z+=g.player.v*dt;
  updateEffects(dt);
  updateCamera(dt);
  (void)nowMs;
}

// ============================================================
// Public lifecycle
// ============================================================

inline void enter() {
  stopAudio();
  (void)acquireStripBuffer();

  // Reset transient state while deliberately preserving session records.
  memset(&g,0,sizeof(g));
  g.effects.rng=0xA17E5A10u;
  g.tracks.breakNext=true;

  display.setRotation(0);
  display.setTextWrap(false);

  uint32_t nowMs=millis(), nowUs=micros();
  g.clock.lastUpdateUs=nowUs;
  g.clock.lastRenderUs=nowUs-FRAME_INTERVAL_US;
  g.clock.initialized=true;
  setPhase(Phase::Title,nowMs,nowUs);
  renderFrame();
}

inline void update(const GameInput& input) {
  uint32_t nowUs=micros();
  uint32_t nowMs=millis();
  uint32_t deltaUs=g.clock.initialized?elapsedUs(nowUs,g.clock.lastUpdateUs):0;
  g.clock.lastUpdateUs=nowUs;
  g.clock.initialized=true;

  g.controls=sampleControls(input);
  Phase phaseAtStart=g.phase;

  if (phaseAtStart==Phase::Title)
    g.controls.uiTap=updateTapLatch(input,nowMs);

  switch(phaseAtStart) {
    case Phase::Title:
      if (g.controls.uiTap) setPhase(Phase::Countdown,nowMs,nowUs);
      break;
    case Phase::Countdown:
      updateCountdown(nowMs,nowUs);
      break;
    case Phase::Racing:
      advanceRaceClock(deltaUs);
      break;
    case Phase::FinishCoast:
      updateFinishCoast(nowMs);
      break;
    case Phase::Results:
      if (input.leftPressed) {
        stopAudio();
#if ALPINE_HAS_WEAK_MENU_HOOK
        if (::enterMenu) { ::enterMenu(); return; }
#endif
        setPhase(Phase::Title,nowMs,nowUs);
      } else if (input.rightPressed) {
        setPhase(Phase::Countdown,nowMs,nowUs);
      }
      break;
    case Phase::Wipeout:
      updateWipeout(deltaUs,nowMs);
      if (elapsedMs(nowMs,g.wipeoutStartedMs)>=900) {
        if (input.leftPressed) {
          stopAudio();
#if ALPINE_HAS_WEAK_MENU_HOOK
          if (::enterMenu) { ::enterMenu(); return; }
#endif
          setPhase(Phase::Title,nowMs,nowUs);
        } else if (input.rightPressed) {
          setPhase(Phase::Countdown,nowMs,nowUs);
        }
      }
      break;
  }

  serviceAudio(nowMs);

  bool animated=(g.phase==Phase::Countdown || g.phase==Phase::Racing || g.phase==Phase::FinishCoast || g.phase==Phase::Wipeout);
  bool frameDue=elapsedUs(nowUs,g.clock.lastRenderUs)>=FRAME_INTERVAL_US;

  if (g.phase==Phase::Racing && elapsedMs(nowMs,g.clock.lastHudMs)>=HUD_INTERVAL_MS)
    g.hudDirty=true;

  if (g.forceFrame || (animated && frameDue)) {
    g.clock.lastRenderUs=nowUs;
    renderFrame();
  }
}

inline void leave() {
  stopAudio();
  g.tap.candidate=0;
  g.effects.notice=NoticeKind::None;
  g.clock.accumulatorUs=0;
#if defined(ALPINE_HAS_SHARED_RENDER_MEMORY)
  stripPixels=nullptr;
#endif
}

inline bool allowMenuExit() { return true; }

} // namespace AlpineSlalom
