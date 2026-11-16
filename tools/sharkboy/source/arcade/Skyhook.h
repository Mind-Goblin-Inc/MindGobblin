#pragma once

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <esp_system.h>
#include <math.h>
#include <new>
#include <string.h>
#include "GameAPI.h"
#include "GameRenderMemory.h"
#include "Hardware.h"
#include "MusicPlayer.h"
#include "MenuFooter.h"

namespace Skyhook {

// ============================================================
// SKYHOOK
// Drop-in Jakeboy Arcade game. No setup()/loop(), no display init.
// ============================================================

// ---------------- Screen / world ----------------
constexpr int SCREEN_W = 240;
constexpr int SCREEN_H = 320;
constexpr int HUD_H = 24;
constexpr int VIEW_H = 296;
constexpr float WORLD_H = 480.0f;
constexpr float CHUNK_W = 192.0f;
constexpr int MAX_ROUTE_SEGMENTS = 24;
constexpr int MAX_STATIC = 128;
constexpr int MAX_CARGO = 12;
constexpr int MAX_BODIES = 14;          // ship + magnet + cargo
constexpr int ROPE_NODES = 5;
constexpr int ROPE_SEGMENTS = 6;
constexpr int MAX_JOINTS = 4;
constexpr int MAX_CONTACTS = 192;
constexpr int MAX_EVENTS = 24;
constexpr int MAX_PARTICLES = 24;
constexpr int MAX_SOUNDS = 8;

// ---------------- Timing ----------------
constexpr float TICK_DT = 1.0f / 60.0f;
constexpr float SUBSTEP_DT = 1.0f / 120.0f;
constexpr int SUBSTEPS = 2;
constexpr int VELOCITY_ITERS = 8;
constexpr int POSITION_ITERS = 3;
constexpr uint32_t PRESENT_INTERVAL_MS = 33;
constexpr uint32_t SWITCH_DEBOUNCE_MS = 12;
constexpr uint32_t SWITCH_ERROR_MS = 100;
constexpr uint32_t BUTTON_DEBOUNCE_MS = 15;
constexpr uint32_t RETRY_HOLD_MS = 1500;

// ---------------- Physics ----------------
constexpr float GRAVITY = 150.0f;
constexpr float SHIP_MASS = 10.0f;
constexpr float MAGNET_MASS = 1.0f;
constexpr float ROPE_NODE_MASS = 0.04f;
constexpr float SHIP_HALF_W = 27.0f;
constexpr float SHIP_HALF_H = 7.0f;
constexpr float MAGNET_HALF_W = 9.0f;
constexpr float MAGNET_HALF_H = 4.0f;
constexpr float ROPE_TOTAL_LENGTH = 48.0f;
constexpr float ROPE_SEGMENT_LENGTH = ROPE_TOTAL_LENGTH / ROPE_SEGMENTS;
constexpr float NORMAL_THRUST = 840.0f;
constexpr float LOW_THRUST = NORMAL_THRUST * 0.25f;
constexpr float HIGH_THRUST = NORMAL_THRUST * 1.90f;
constexpr float LINEAR_DRAG = 0.25f;
constexpr float ANGULAR_DRAG = 0.80f;
constexpr float MAX_SPEED = 240.0f;
constexpr float MAX_ANGULAR_SPEED = 5.0f;
constexpr float RESTITUTION = 0.10f;
constexpr float FRICTION = 0.45f;
constexpr float RESTITUTION_THRESHOLD = 12.0f;
constexpr float MAGNET_RADIUS = 30.0f;
constexpr float MAGNET_CAPTURE_DIST = 4.0f;
constexpr float MAGNET_ATTRACTION_FORCE = 350.0f;
constexpr float MAGNET_HOLDING_FORCE = 1200.0f;
constexpr float MAGNET_BREAK_STRETCH = 10.0f;
constexpr uint32_t MAGNET_RECAPTURE_MS = 300;
constexpr float DELIVERY_SPEED = 8.0f;
constexpr float DELIVERY_ANGULAR_SPEED = 0.4f;
constexpr float DELIVERY_STABLE_TIME = 0.75f;
constexpr float DELIVERY_FINALIZE_TIME = 2.0f;

// ---------------- Rendering ----------------
constexpr int BAND_H = 16;
constexpr int BAND_COUNT = SCREEN_H / BAND_H;
constexpr int TILE_W = 16;
constexpr int TILE_COLS = SCREEN_W / TILE_W;
static_assert(BAND_COUNT == 20, "Expected 20 bands");
static_assert(TILE_COLS == 15, "Expected 15 tile columns");

// Industrial RGB565 palette.
constexpr uint16_t C_BG = 0x0841;
constexpr uint16_t C_BG2 = 0x10A2;
constexpr uint16_t C_BG3 = 0x18E3;
constexpr uint16_t C_SOLID = 0x2945;
constexpr uint16_t C_SOLID_EDGE = 0x5AEB;
constexpr uint16_t C_RUST = 0xC3A2;
constexpr uint16_t C_CREAM = 0xFF18;
constexpr uint16_t C_CYAN = 0x2DFF;
constexpr uint16_t C_YELLOW = 0xFFE0;
constexpr uint16_t C_GREEN = 0x5FEA;
constexpr uint16_t C_RED = 0xF986;
constexpr uint16_t C_AMBER = 0xFD20;
constexpr uint16_t C_WHITE = ST77XX_WHITE;
constexpr uint16_t C_BLACK = ST77XX_BLACK;

// ============================================================
// Math
// ============================================================

struct Vec2 { float x, y; };
struct Aabb { Vec2 min, max; };

inline Vec2 v2(float x, float y) { return {x, y}; }
inline Vec2 add(Vec2 a, Vec2 b) { return {a.x + b.x, a.y + b.y}; }
inline Vec2 sub(Vec2 a, Vec2 b) { return {a.x - b.x, a.y - b.y}; }
inline Vec2 mul(Vec2 a, float s) { return {a.x * s, a.y * s}; }
inline float dot(Vec2 a, Vec2 b) { return a.x*b.x + a.y*b.y; }
inline float cross(Vec2 a, Vec2 b) { return a.x*b.y - a.y*b.x; }
inline Vec2 perp(Vec2 a) { return {-a.y, a.x}; }
inline float lenSq(Vec2 a) { return dot(a, a); }
inline float length(Vec2 a) { return sqrtf(lenSq(a)); }
inline Vec2 normalize(Vec2 a) {
  float l2 = lenSq(a);
  if (l2 < 1.0e-10f) return {1.0f, 0.0f};
  return mul(a, 1.0f / sqrtf(l2));
}
inline float clampf(float x, float lo, float hi) { return x < lo ? lo : (x > hi ? hi : x); }
inline int clampi(int x, int lo, int hi) { return x < lo ? lo : (x > hi ? hi : x); }
inline Vec2 rotate(Vec2 p, float a) {
  float s = sinf(a), c = cosf(a);
  return {c*p.x - s*p.y, s*p.x + c*p.y};
}
inline Vec2 inverseRotate(Vec2 p, float a) {
  float s = sinf(a), c = cosf(a);
  return {c*p.x + s*p.y, -s*p.x + c*p.y};
}
inline float wrapAngle(float a) {
  while (a > PI) a -= 2.0f * PI;
  while (a < -PI) a += 2.0f * PI;
  return a;
}
inline bool finiteVec(Vec2 p) { return isfinite(p.x) && isfinite(p.y); }
inline bool overlaps(const Aabb& a, const Aabb& b) {
  return a.min.x <= b.max.x && a.max.x >= b.min.x &&
         a.min.y <= b.max.y && a.max.y >= b.min.y;
}
inline Vec2 angularVelocityAt(float w, Vec2 r) { return mul(perp(r), w); }

struct Rng { uint32_t state; };
inline uint32_t nextRandom(Rng& r) {
  uint32_t x = r.state ? r.state : 0xA341316Cu;
  x ^= x << 13; x ^= x >> 17; x ^= x << 5;
  r.state = x ? x : 0xA341316Cu;
  return r.state;
}
inline float random01(Rng& r) { return (nextRandom(r) >> 8) * (1.0f / 16777216.0f); }
inline float randomRange(Rng& r, float a, float b) { return a + (b-a) * random01(r); }
inline int randomInt(Rng& r, int a, int bInclusive) {
  if (bInclusive <= a) return a;
  return a + (int)(nextRandom(r) % (uint32_t)(bInclusive-a+1));
}
inline uint32_t hash32(uint32_t x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x;
}

// ============================================================
// Types / state
// ============================================================

enum BodyShape : uint8_t { SHAPE_BOX, SHAPE_CIRCLE };
enum BodyRole : uint8_t { ROLE_SHIP, ROLE_MAGNET, ROLE_CARGO };
enum CargoKind : uint8_t { CARGO_CRATE, CARGO_TANK, CARGO_ENGINE, CARGO_GIRDER };
enum Phase : uint8_t { BRIEFING, PLAYING, RETRY_PROMPT, RESULTS, RECOVERY };
enum RecoveryReason : uint8_t { REC_NONE, REC_CARGO_LOST, REC_SIM_INVALID, REC_CONTACT_OVERFLOW };
enum RequiredStatus : uint8_t { REQ_LOCATE, REQ_HELD, REQ_DROPPED, REQ_DELIVERED };
enum DetachReason : uint8_t { DETACH_COMMAND, DETACH_OVERLOAD, DETACH_STRETCH };
enum EventType : uint8_t { EV_NONE, EV_ATTACH, EV_REQUIRED_ATTACH, EV_DETACH, EV_BANK, EV_COMPLETE, EV_FULL, EV_IMPACT };
enum SoundId : uint8_t { SND_NONE, SND_ON, SND_OFF, SND_ATTACH, SND_REQUIRED, SND_DETACH, SND_BANK, SND_COMPLETE, SND_RECOVERY };

struct RigidBody {
  Vec2 position;
  Vec2 velocity;
  float angle;
  float angularVelocity;
  float inverseMass;
  float inverseInertia;
  Vec2 force;
  float torque;
  Vec2 halfExtents;
  float radius;
  BodyShape shape;
  BodyRole role;
  uint8_t id;
  bool active;
  Aabb aabb;
};

struct Cargo {
  uint8_t bodyIndex;
  CargoKind kind;
  float mass;
  uint16_t value;
  bool required;
  int8_t attachedPad;
  uint32_t recaptureAfterMs;
  float receiverStableTime;
  bool delivered;
  bool bankAnimation;
  uint32_t bankAnimationUntilMs;
};

struct RopeNode {
  Vec2 position;
  Vec2 velocity;
  float inverseMass;
};

struct MagneticJoint {
  bool active;
  uint8_t cargoIndex;
  uint8_t pad;
  Vec2 accumulatedImpulse;
  float filteredLoad;
  float overloadTime;
};

struct StaticCollider {
  Aabb box;
  uint8_t material;
  uint8_t segmentId;
};

struct RouteSegment {
  float xStart;
  float width;
  float floorHeight;
  float ceilingHeight;
  uint8_t type;
  uint32_t decorationSeed;
};

struct Contact {
  int8_t a;
  int8_t b;             // -1 for static
  int16_t staticIndex;
  Vec2 normal;          // from A toward B
  Vec2 point;
  float penetration;
  float normalImpulse;
  float tangentImpulse;
};

struct SwitchFilter {
  SwitchState raw;
  SwitchState stable;
  uint32_t rawChangedAt;
  bool fault;
};

struct ButtonFilter {
  bool raw;
  bool stable;
  uint32_t rawChangedAt;
  bool pressed;
  bool released;
};

struct Event {
  EventType type;
  Vec2 position;
  uint8_t cargo;
  float magnitude;
};

struct Particle {
  bool active;
  Vec2 position;
  Vec2 velocity;
  float life;
  uint16_t color;
};

struct SoundEvent { SoundId id; };

struct DifficultyProfile {
  uint8_t chunkCount;
  uint8_t optionalCount;
  float requiredMass;
  float floorVariance;
  uint16_t basePayout;
};

struct ContractState {
  uint32_t seed;
  uint32_t index;
  uint16_t contractValue;
  uint32_t bankedOptionalValue;
  uint8_t bankedOptionalCount;
  bool resultCommitted;
  bool payoutEligible;
  bool practice;
  RequiredStatus requiredStatus;
  float finalizeTimer;
  bool receiving;
  uint32_t resultPayout;
  uint32_t resultOptional;
};

struct CameraState {
  Vec2 center;
  float left;
  float bottom;
};

struct SnapshotBody {
  bool active;
  BodyRole role;
  BodyShape shape;
  Vec2 position;
  float angle;
  Vec2 halfExtents;
  float radius;
};
struct SnapshotCargo {
  bool delivered;
  bool required;
  CargoKind kind;
  int8_t attachedPad;
  uint16_t value;
  uint8_t bodyIndex;
};
struct SnapshotParticle { bool active; Vec2 position; float life; uint16_t color; };

struct RenderSnapshot {
  SnapshotBody bodies[MAX_BODIES];
  SnapshotCargo cargo[MAX_CARGO];
  Vec2 rope[ROPE_NODES + 2];
  SnapshotParticle particles[MAX_PARTICLES];
  float cameraLeft;
  float cameraBottom;
  Phase phase;
  RecoveryReason recoveryReason;
  bool magnetOn;
  bool receiving;
  float finalizeTimer;
  uint32_t contractIndex;
  uint32_t runMoney;
  uint32_t optionalMoney;
  uint16_t contractValue;
  uint8_t attachedCount;
  uint32_t attachedValue;
  RequiredStatus requiredStatus;
  bool leftSwitchFault;
  bool rightSwitchFault;
  SwitchState rearSwitch;
  SwitchState frontSwitch;
  bool routeReady;
  bool practice;
  bool overload;
  uint32_t resultPayout;
  uint32_t resultOptional;
};

struct SavedBodyState { Vec2 p,v; float a,w; };
struct SavedNodeState { Vec2 p,v; };

struct GameState {
  Phase phase;
  RecoveryReason recoveryReason;
  RigidBody bodies[MAX_BODIES];
  uint8_t bodyCount;
  Cargo cargo[MAX_CARGO];
  uint8_t cargoCount;
  RopeNode ropeNodes[ROPE_NODES];
  MagneticJoint joints[MAX_JOINTS];
  StaticCollider statics[MAX_STATIC];
  uint8_t staticCount;
  RouteSegment segments[MAX_ROUTE_SEGMENTS];
  uint8_t segmentCount;
  Contact contacts[MAX_CONTACTS];
  uint16_t contactCount;
  Event events[MAX_EVENTS];
  uint8_t eventCount;
  Particle particles[MAX_PARTICLES];
  SoundEvent soundQueue[MAX_SOUNDS];
  uint8_t soundHead, soundTail, soundCount;
  SoundId soundPlaying;
  uint8_t soundNote;
  uint32_t soundNoteEndsAt;
  bool ownedToneActive;

  ContractState contract;
  uint32_t runMoney;
  uint32_t runSeed;
  uint32_t completedContractIndex;
  float worldWidth;
  Aabb receiver;
  uint8_t requiredCargoIndex;

  SwitchFilter leftSwitch;
  SwitchFilter rightSwitch;
  ButtonFilter leftButton;
  ButtonFilter rightButton;
  bool magnetOn;
  bool commandOn;
  bool commandOff;
  bool exitChord;
  bool releaseGate;
  bool rightHoldTracking;
  uint32_t rightHoldStartedAt;

  CameraState camera;
  uint32_t lastUpdateUs;
  float accumulator;
  uint32_t lastPresentMs;
  bool presentationActive;
  uint8_t presentationBand;
  uint32_t presentationCounter;
  RenderSnapshot snapshot;

  bool routeReady;
  uint8_t generationAttempt;
  DifficultyProfile generationProfile;

  uint8_t invalidStepCount;
  uint32_t droppedTimeCount;
  uint16_t contactHighWater;
};

// The launcher runs one game at a time. Skyhook reuses the render arena that
// Tank, Deep Vector, and Space Evaders use during their own turns.
struct SharedStorage {
  GameState state;
  uint16_t strip[SCREEN_W * BAND_H];
};
static_assert(sizeof(SharedStorage) <= GameRenderMemory::CAPACITY,
              "Skyhook state and strip exceed shared memory");
static_assert(alignof(SharedStorage) <= 8,
              "Skyhook shared memory needs stronger alignment");
static SharedStorage& shared = *new (GameRenderMemory::bytes) SharedStorage;
static GameState& g = shared.state;
static uint16_t (&stripPixels)[SCREEN_W * BAND_H] = shared.strip;

// ============================================================
// Strip compositor surface
// ============================================================
static uint32_t tileHashes[BAND_COUNT][TILE_COLS];
static bool tileValid[BAND_COUNT][TILE_COLS];

class StripSurface : public Adafruit_GFX {
public:
  StripSurface() : Adafruit_GFX(SCREEN_W, SCREEN_H), bandY(0) {}
  void setBand(int y) { bandY = y; }
  void clear(uint16_t c) {
    for (int i=0;i<SCREEN_W*BAND_H;i++) stripPixels[i]=c;
  }
  void drawPixel(int16_t x, int16_t y, uint16_t color) override {
    if ((unsigned)x >= SCREEN_W || y < bandY || y >= bandY + BAND_H) return;
    stripPixels[(y-bandY)*SCREEN_W + x] = color;
  }
  void writePixel(int16_t x, int16_t y, uint16_t color) override { drawPixel(x,y,color); }
  void writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) override {
    if (y < bandY || y >= bandY+BAND_H || w <= 0) return;
    int x0 = x, x1 = x+w;
    if (x0 < 0) x0=0; if (x1>SCREEN_W) x1=SCREEN_W;
    if (x0>=x1) return;
    uint16_t* row=&stripPixels[(y-bandY)*SCREEN_W];
    for(int xx=x0;xx<x1;xx++) row[xx]=color;
  }
  void writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) override {
    if ((unsigned)x>=SCREEN_W || h<=0) return;
    int y0=y, y1=y+h; if(y0<bandY)y0=bandY; if(y1>bandY+BAND_H)y1=bandY+BAND_H;
    for(int yy=y0;yy<y1;yy++) stripPixels[(yy-bandY)*SCREEN_W+x]=color;
  }
  void writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) override {
    if(w<=0||h<=0) return;
    int x0=x,x1=x+w,y0=y,y1=y+h;
    if(x0<0)x0=0; if(x1>SCREEN_W)x1=SCREEN_W;
    if(y0<bandY)y0=bandY; if(y1>bandY+BAND_H)y1=bandY+BAND_H;
    if(x0>=x1||y0>=y1)return;
    for(int yy=y0;yy<y1;yy++) {
      uint16_t* row=&stripPixels[(yy-bandY)*SCREEN_W];
      for(int xx=x0;xx<x1;xx++) row[xx]=color;
    }
  }
private:
  int bandY;
};

static StripSurface canvas;

// ============================================================
// Forward declarations
// ============================================================

void enter();
void update(const GameInput& input);
void beginContract(uint32_t seed, uint32_t index, bool eligible, bool practice=false);
void restartContract();
void advanceContract();
void changePhase(Phase p);
void enterRecovery(RecoveryReason reason);
void sampleControls(const GameInput& input, uint32_t nowMs);
void updateSwitchFilter(SwitchFilter& f, SwitchState raw, uint32_t nowMs);
void updateButtonFilter(ButtonFilter& f, bool raw, uint32_t nowMs);
SwitchState readLocalSwitch(int upPin, int downPin);
float thrustFor(SwitchState s);
void simulateTick(float dt);
bool simulateSubstep(float dt);
void updateCamera(float dt);
void updateDelivery(float dt);
void processEvents();
void tickEffects(float dt);
void queueSound(SoundId id);
void tickSound(uint32_t nowMs);
void stopOwnedSound();
void captureRenderSnapshot();
void beginPresentation();
void renderNextBands();
void invalidatePresentation();

// ============================================================
// Body helpers
// ============================================================

inline float bodyMass(const RigidBody& b) { return b.inverseMass > 0 ? 1.0f/b.inverseMass : 0.0f; }
inline Vec2 worldPoint(const RigidBody& b, Vec2 local) { return add(b.position, rotate(local, b.angle)); }
inline Vec2 pointVelocity(const RigidBody& b, Vec2 world) {
  Vec2 r=sub(world,b.position); return add(b.velocity, angularVelocityAt(b.angularVelocity,r));
}

void refreshBodyGeometry(RigidBody& b) {
  if (!b.active) return;
  if (b.shape == SHAPE_CIRCLE) {
    b.aabb = {{b.position.x-b.radius,b.position.y-b.radius},{b.position.x+b.radius,b.position.y+b.radius}};
    return;
  }
  float c=fabsf(cosf(b.angle)), s=fabsf(sinf(b.angle));
  float ex=c*b.halfExtents.x+s*b.halfExtents.y;
  float ey=s*b.halfExtents.x+c*b.halfExtents.y;
  b.aabb={{b.position.x-ex,b.position.y-ey},{b.position.x+ex,b.position.y+ey}};
}

bool finiteBody(const RigidBody& b) {
  return finiteVec(b.position)&&finiteVec(b.velocity)&&isfinite(b.angle)&&isfinite(b.angularVelocity);
}

void applyImpulse(RigidBody& b, Vec2 impulse, Vec2 atWorld) {
  if (!b.active || b.inverseMass <= 0.0f) return;
  b.velocity = add(b.velocity, mul(impulse, b.inverseMass));
  b.angularVelocity += cross(sub(atWorld,b.position), impulse) * b.inverseInertia;
}

void addForceAt(RigidBody& b, Vec2 force, Vec2 atWorld) {
  if (!b.active || b.inverseMass <= 0.0f) return;
  b.force=add(b.force,force);
  b.torque += cross(sub(atWorld,b.position),force);
}

float rectangularInertia(float mass, float w, float h, float multiplier=1.0f) {
  return multiplier * mass * (w*w+h*h) / 12.0f;
}

void initBoxBody(RigidBody& b, uint8_t id, BodyRole role, Vec2 p, Vec2 half, float mass, float angle=0) {
  b.position=p; b.velocity={0,0}; b.angle=angle; b.angularVelocity=0; b.force={0,0}; b.torque=0;
  b.halfExtents=half; b.radius=0; b.shape=SHAPE_BOX; b.role=role; b.id=id; b.active=true;
  b.inverseMass = mass>0 ? 1.0f/mass : 0.0f;
  float inertia=rectangularInertia(mass,half.x*2,half.y*2, role==ROLE_SHIP ? 4.0f : 1.0f);
  b.inverseInertia = inertia>0 ? 1.0f/inertia : 0.0f;
  refreshBodyGeometry(b);
}

void initCircleBody(RigidBody& b, uint8_t id, BodyRole role, Vec2 p, float radius, float mass) {
  b.position=p; b.velocity={0,0}; b.angle=0; b.angularVelocity=0; b.force={0,0}; b.torque=0;
  b.halfExtents={radius,radius}; b.radius=radius; b.shape=SHAPE_CIRCLE; b.role=role; b.id=id; b.active=true;
  b.inverseMass=mass>0?1.0f/mass:0; float I=0.5f*mass*radius*radius; b.inverseInertia=I>0?1.0f/I:0;
  refreshBodyGeometry(b);
}

// ============================================================
// Input
// ============================================================

SwitchState readLocalSwitch(int upPin, int downPin) {
  bool up = digitalRead(upPin) == LOW;
  bool down = digitalRead(downPin) == LOW;
  if (up && !down) return SWITCH_UP;
  if (!up && down) return SWITCH_DOWN;
  if (!up && !down) return SWITCH_CENTER;
  return SWITCH_ERROR;
}

void initSwitchFilter(SwitchFilter& f, SwitchState raw, uint32_t nowMs) {
  f.raw=raw; f.stable=(raw==SWITCH_ERROR?SWITCH_CENTER:raw); f.rawChangedAt=nowMs; f.fault=false;
}

void updateSwitchFilter(SwitchFilter& f, SwitchState raw, uint32_t nowMs) {
  if (raw != f.raw) { f.raw=raw; f.rawChangedAt=nowMs; }
  uint32_t held=nowMs-f.rawChangedAt;
  if (f.raw==SWITCH_ERROR) {
    if (held>=SWITCH_ERROR_MS) { f.stable=SWITCH_CENTER; f.fault=true; }
    return;
  }
  if (held>=SWITCH_DEBOUNCE_MS) { f.stable=f.raw; f.fault=false; }
}

void initButtonFilter(ButtonFilter& f, bool raw, uint32_t nowMs) {
  f.raw=raw; f.stable=raw; f.rawChangedAt=nowMs; f.pressed=false; f.released=false;
}

void updateButtonFilter(ButtonFilter& f, bool raw, uint32_t nowMs) {
  f.pressed=false; f.released=false;
  if (raw != f.raw) { f.raw=raw; f.rawChangedAt=nowMs; }
  if (f.stable != f.raw && (uint32_t)(nowMs-f.rawChangedAt)>=BUTTON_DEBOUNCE_MS) {
    bool old=f.stable; f.stable=f.raw;
    f.pressed = !old && f.stable;
    f.released = old && !f.stable;
  }
}

float thrustFor(SwitchState s) {
  if (s==SWITCH_UP) return HIGH_THRUST;
  if (s==SWITCH_DOWN) return LOW_THRUST;
  return NORMAL_THRUST;
}

void sampleControls(const GameInput& input, uint32_t nowMs) {
  // Raw chord owns everything immediately so game audio cannot linger while launcher exits.
  bool chord=input.leftButton && input.rightButton;
  if (chord) {
    if (!g.exitChord) stopOwnedSound();
    g.exitChord=true; g.commandOn=false; g.commandOff=false; g.rightHoldTracking=false;
    g.lastUpdateUs=micros(); g.accumulator=0;
    return;
  }
  if (g.exitChord) {
    g.exitChord=false; g.lastUpdateUs=micros(); g.accumulator=0;
    // Require fresh release/press after a cancelled exit chord.
    g.releaseGate=true;
  }

  updateSwitchFilter(g.leftSwitch, readLocalSwitch(LEFT_UP_PIN,LEFT_DOWN_PIN), nowMs);
  updateSwitchFilter(g.rightSwitch, readLocalSwitch(RIGHT_UP_PIN,RIGHT_DOWN_PIN), nowMs);
  updateButtonFilter(g.leftButton,input.leftButton,nowMs);
  updateButtonFilter(g.rightButton,input.rightButton,nowMs);

  if (g.releaseGate) {
    if (!g.leftButton.stable && !g.rightButton.stable) g.releaseGate=false;
    return;
  }

  if (g.phase==PLAYING) {
    if (g.leftButton.pressed) g.commandOn=true;
    if (g.rightButton.pressed) {
      g.commandOff=true;
      g.rightHoldTracking=true;
      g.rightHoldStartedAt=nowMs;
    }
    if (!g.rightButton.stable) g.rightHoldTracking=false;
    if (g.rightHoldTracking && g.rightButton.stable && !g.leftButton.stable &&
        (uint32_t)(nowMs-g.rightHoldStartedAt)>=RETRY_HOLD_MS) {
      g.rightHoldTracking=false;
      changePhase(RETRY_PROMPT);
      g.releaseGate=true;
    }
  } else if (g.phase==BRIEFING) {
    if (g.routeReady && g.leftSwitch.stable==SWITCH_CENTER && g.rightSwitch.stable==SWITCH_CENTER && g.leftButton.pressed) {
      changePhase(PLAYING);
      g.lastUpdateUs=micros(); g.accumulator=0;
    }
  } else if (g.phase==RETRY_PROMPT) {
    if (g.leftButton.pressed) restartContract();
    else if (g.rightButton.pressed) changePhase(PLAYING);
  } else if (g.phase==RESULTS) {
    if (g.leftButton.pressed) advanceContract();
    else if (g.rightButton.pressed) beginContract(g.contract.seed,g.contract.index,false,true);
  } else if (g.phase==RECOVERY) {
    if (g.leftButton.pressed) restartContract();
  }
}

// ============================================================
// Route generation
// ============================================================

DifficultyProfile profileFor(uint32_t index) {
  uint32_t d=index>0?index-1:0; if(d>7)d=7;
  DifficultyProfile p;
  p.chunkCount=(uint8_t)(8 + d);
  if (p.chunkCount>16) p.chunkCount=16;
  p.optionalCount=(uint8_t)(4+d); if(p.optionalCount>11)p.optionalCount=11;
  p.requiredMass=2.2f + 0.18f*d; if(p.requiredMass>3.5f)p.requiredMass=3.5f;
  p.floorVariance=12.0f + 2.0f*d;
  p.basePayout=(uint16_t)(200 + 50*d);
  return p;
}

bool addStatic(Aabb box, uint8_t material, uint8_t segmentId) {
  if(g.staticCount>=MAX_STATIC) return false;
  if(box.max.x<=box.min.x||box.max.y<=box.min.y) return true;
  g.statics[g.staticCount++]={box,material,segmentId}; return true;
}

float floorAtX(float x) {
  for(uint8_t i=0;i<g.segmentCount;i++) {
    const RouteSegment& s=g.segments[i];
    if(x>=s.xStart && x<s.xStart+s.width) return s.floorHeight;
  }
  return g.segmentCount?g.segments[g.segmentCount-1].floorHeight:40.0f;
}

bool lineBlockedByStatic(Vec2 a, Vec2 b) {
  Vec2 d=sub(b,a);
  for(uint8_t i=0;i<g.staticCount;i++) {
    const Aabb& r=g.statics[i].box;
    float tmin=0.0f,tmax=1.0f;
    for(int axis=0;axis<2;axis++) {
      float p=axis?d.y:d.x, o=axis?a.y:a.x, mn=axis?r.min.y:r.min.x, mx=axis?r.max.y:r.max.x;
      if(fabsf(p)<1e-6f) { if(o<mn||o>mx){tmin=2;break;} }
      else { float t1=(mn-o)/p,t2=(mx-o)/p; if(t1>t2){float q=t1;t1=t2;t2=q;} if(t1>tmin)tmin=t1; if(t2<tmax)tmax=t2; if(tmin>tmax)break; }
    }
    if(tmin<=tmax && tmax>=0.02f && tmin<=0.98f) return true;
  }
  return false;
}

bool buildCandidateRoute(uint32_t seed, const DifficultyProfile& p) {
  g.staticCount=0; g.segmentCount=0; g.cargoCount=0; g.bodyCount=0;
  Rng r{seed};
  float floor=40.0f, ceil=440.0f;
  int chunks=p.chunkCount;
  if(chunks+2>MAX_ROUTE_SEGMENTS) return false;
  g.worldWidth=chunks*CHUNK_W;

  for(int i=0;i<chunks;i++) {
    if(i==0 || i==chunks-1) { floor=40.0f; ceil=440.0f; }
    else {
      float step=(float)randomInt(r,-1,1)*p.floorVariance;
      floor=clampf(floor+step,32.0f,150.0f);
      float desiredGap=randomRange(r,255.0f,330.0f);
      ceil=clampf(floor+desiredGap, floor+220.0f, 448.0f);
    }
    RouteSegment s{(float)i*CHUNK_W,CHUNK_W,floor,ceil,(uint8_t)(i==0?0:(i==chunks-1?1:2)),nextRandom(r)};
    g.segments[g.segmentCount++]=s;
    if(!addStatic({{s.xStart,0},{s.xStart+s.width,floor}},0,i)) return false;
    if(!addStatic({{s.xStart,ceil},{s.xStart+s.width,WORLD_H}},0,i)) return false;

    // Optional shallow industrial intrusion outside the main safety corridor.
    if(i>1 && i<chunks-2 && (nextRandom(r)&3u)==0u) {
      bool fromTop=(nextRandom(r)&1u)!=0;
      float w=randomRange(r,34.0f,58.0f);
      float x=s.xStart+randomRange(r,55.0f,CHUNK_W-w-20.0f);
      if(fromTop) addStatic({{x,ceil-28.0f},{x+w,ceil}},1,i);
      else addStatic({{x,floor},{x+w,floor+26.0f}},1,i);
    }
  }
  // Closed left/right boundaries.
  if(!addStatic({{-12,0},{0,WORLD_H}},0,0)) return false;
  if(!addStatic({{g.worldWidth,0},{g.worldWidth+12,WORLD_H}},0,chunks-1)) return false;

  float endFloor=g.segments[g.segmentCount-1].floorHeight;
  g.receiver={{g.worldWidth-150.0f,endFloor-1.0f},{g.worldWidth-30.0f,endFloor+62.0f}};
  // Receiver side walls, short enough to fly over.
  addStatic({{g.receiver.min.x-8,endFloor},{g.receiver.min.x,g.receiver.min.y+58}},2,chunks-1);
  addStatic({{g.receiver.max.x,g.receiver.min.y-4},{g.receiver.max.x+8,g.receiver.min.y+58}},2,chunks-1);

  // Spawn cargo records; bodies are instantiated later.
  g.cargoCount=(uint8_t)(1+p.optionalCount);
  if(g.cargoCount>MAX_CARGO) return false;
  g.requiredCargoIndex=0;
  for(uint8_t c=0;c<g.cargoCount;c++) {
    Cargo& cg=g.cargo[c];
    cg.bodyIndex=(uint8_t)(2+c); cg.kind=(CargoKind)(c%4); cg.required=(c==0);
    cg.mass=cg.required?p.requiredMass:randomRange(r,0.6f,2.2f);
    cg.value=cg.required?p.basePayout:(uint16_t)randomInt(r,25,120);
    cg.attachedPad=-1; cg.recaptureAfterMs=0; cg.receiverStableTime=0; cg.delivered=false; cg.bankAnimation=false; cg.bankAnimationUntilMs=0;
  }
  g.contract.contractValue=p.basePayout;
  return true;
}

bool validateRoute() {
  if(g.segmentCount<2||g.staticCount>=MAX_STATIC||g.cargoCount<1||g.cargoCount>MAX_CARGO) return false;
  if(g.worldWidth<SCREEN_W || !isfinite(g.worldWidth)) return false;
  // Every chunk keeps a mandatory clear vertical channel.
  for(uint8_t i=0;i<g.segmentCount;i++) {
    const RouteSegment& s=g.segments[i];
    if(s.ceilingHeight-s.floorHeight<220.0f) return false;
    if(!isfinite(s.floorHeight)||!isfinite(s.ceilingHeight)) return false;
  }
  float requiredMass=g.cargo[0].mass;
  if(requiredMass>3.6f) return false;
  return true;
}

void buildFallbackRoute(uint32_t seed, const DifficultyProfile& p) {
  g.staticCount=0; g.segmentCount=0; g.bodyCount=0;
  uint8_t chunks=p.chunkCount; if(chunks<8)chunks=8; if(chunks>16)chunks=16;
  g.worldWidth=chunks*CHUNK_W;
  for(uint8_t i=0;i<chunks;i++) {
    RouteSegment s{(float)i*CHUNK_W,CHUNK_W,40.0f,440.0f,(uint8_t)(i==0?0:(i==chunks-1?1:2)),hash32(seed+i)};
    g.segments[g.segmentCount++]=s;
    addStatic({{s.xStart,0},{s.xStart+s.width,40}},0,i);
    addStatic({{s.xStart,440},{s.xStart+s.width,WORLD_H}},0,i);
  }
  addStatic({{-12,0},{0,WORLD_H}},0,0);
  addStatic({{g.worldWidth,0},{g.worldWidth+12,WORLD_H}},0,chunks-1);
  g.receiver={{g.worldWidth-150,39},{g.worldWidth-30,102}};
  addStatic({{g.receiver.min.x-8,40},{g.receiver.min.x,102}},2,chunks-1);
  addStatic({{g.receiver.max.x,40},{g.receiver.max.x+8,102}},2,chunks-1);
  Rng r{seed^0x51F15EEDu};
  g.cargoCount=(uint8_t)(1+p.optionalCount); if(g.cargoCount>MAX_CARGO)g.cargoCount=MAX_CARGO;
  g.requiredCargoIndex=0;
  for(uint8_t c=0;c<g.cargoCount;c++) {
    Cargo& cg=g.cargo[c]; cg.bodyIndex=2+c; cg.kind=(CargoKind)(c%4); cg.required=c==0;
    cg.mass=c?randomRange(r,0.6f,1.8f):fminf(p.requiredMass,3.2f); cg.value=c?p.basePayout/3:p.basePayout;
    if(c)cg.value=(uint16_t)randomInt(r,25,90);
    cg.attachedPad=-1; cg.recaptureAfterMs=0; cg.receiverStableTime=0; cg.delivered=false; cg.bankAnimation=false; cg.bankAnimationUntilMs=0;
  }
  g.contract.contractValue=p.basePayout;
}

void spawnRouteBodies() {
  g.bodyCount=(uint8_t)(2+g.cargoCount);
  float floor0=g.segments[0].floorHeight;
  initBoxBody(g.bodies[0],0,ROLE_SHIP,{88.0f,floor0+205.0f},{SHIP_HALF_W,SHIP_HALF_H},SHIP_MASS,0);
  Vec2 shipAnchor=worldPoint(g.bodies[0],{0,-8});
  Vec2 magnetPos={shipAnchor.x,shipAnchor.y-ROPE_TOTAL_LENGTH};
  initBoxBody(g.bodies[1],1,ROLE_MAGNET,magnetPos,{MAGNET_HALF_W,MAGNET_HALF_H},MAGNET_MASS,0);
  for(int n=0;n<ROPE_NODES;n++) {
    float t=(float)(n+1)/(ROPE_SEGMENTS);
    g.ropeNodes[n].position={shipAnchor.x,shipAnchor.y-ROPE_TOTAL_LENGTH*t};
    g.ropeNodes[n].velocity={0,0}; g.ropeNodes[n].inverseMass=1.0f/ROPE_NODE_MASS;
  }

  Rng r{g.contract.seed^0xC4A6F00Du};
  for(uint8_t c=0;c<g.cargoCount;c++) {
    Cargo& cg=g.cargo[c];
    float x;
    if(c==0) x=142.0f;
    else {
      int chunk=1 + ((c-1)%(g.segmentCount>2?g.segmentCount-2:1));
      // Cargo pads stay near the open leading side of each chunk; generated intrusions start farther in.
      x=g.segments[chunk].xStart + 32.0f;
    }
    float fl=floorAtX(x);
    Vec2 half={7,7}; float radius=7;
    switch(cg.kind) {
      case CARGO_CRATE: half={8,8}; break;
      case CARGO_TANK: radius=7.0f; break;
      case CARGO_ENGINE: half={10,7}; break;
      case CARGO_GIRDER: half={11,5}; break;
    }
    if(cg.required) half={11,9};
    if(cg.kind==CARGO_TANK && !cg.required) initCircleBody(g.bodies[cg.bodyIndex],cg.bodyIndex,ROLE_CARGO,{x,fl+radius+1},radius,cg.mass);
    else initBoxBody(g.bodies[cg.bodyIndex],cg.bodyIndex,ROLE_CARGO,{x,fl+half.y+1},half,cg.mass,0);
  }
  for(int p=0;p<MAX_JOINTS;p++) { g.joints[p].active=false; g.joints[p].cargoIndex=255; g.joints[p].pad=p; g.joints[p].accumulatedImpulse={0,0}; g.joints[p].filteredLoad=0; g.joints[p].overloadTime=0; }
  g.magnetOn=false; g.commandOn=false; g.commandOff=false;
  g.contactCount=0; g.eventCount=0;
  for(int i=0;i<MAX_PARTICLES;i++)g.particles[i].active=false;
  g.camera.center=g.bodies[0].position;
  g.camera.left=clampf(g.camera.center.x-SCREEN_W*0.5f,0,fmaxf(0,g.worldWidth-SCREEN_W));
  g.camera.bottom=clampf(g.camera.center.y-VIEW_H*0.55f,0,WORLD_H-VIEW_H);
}

bool stepRouteBuild() {
  if(g.routeReady) return true;
  if(g.generationAttempt<8) {
    uint32_t candidateSeed=hash32(g.contract.seed ^ (0x9E3779B9u*(g.generationAttempt+1)));
    g.generationAttempt++;
    if(buildCandidateRoute(candidateSeed,g.generationProfile) && validateRoute()) {
      spawnRouteBodies(); g.routeReady=true; invalidatePresentation(); return true;
    }
    return false;
  }
  buildFallbackRoute(g.contract.seed,g.generationProfile); spawnRouteBodies(); g.routeReady=true; invalidatePresentation(); return true;
}

// ============================================================
// Contacts
// ============================================================

Vec2 boxAxisX(const RigidBody& b){return rotate({1,0},b.angle);} 
Vec2 boxAxisY(const RigidBody& b){return rotate({0,1},b.angle);} 

float projectedRadius(const RigidBody& b, Vec2 axis) {
  if(b.shape==SHAPE_CIRCLE) return b.radius;
  Vec2 ax=boxAxisX(b), ay=boxAxisY(b);
  return fabsf(dot(ax,axis))*b.halfExtents.x + fabsf(dot(ay,axis))*b.halfExtents.y;
}

Vec2 supportPoint(const RigidBody& b, Vec2 dir) {
  if(b.shape==SHAPE_CIRCLE) return add(b.position,mul(normalize(dir),b.radius));
  Vec2 ax=boxAxisX(b), ay=boxAxisY(b);
  float dx=dot(ax,dir), dy=dot(ay,dir);
  float sx=dx>1.0e-5f?b.halfExtents.x:(dx<-1.0e-5f?-b.halfExtents.x:0.0f);
  float sy=dy>1.0e-5f?b.halfExtents.y:(dy<-1.0e-5f?-b.halfExtents.y:0.0f);
  return add(b.position,add(mul(ax,sx),mul(ay,sy)));
}

bool collideCircleCircle(const RigidBody& a,const RigidBody& b,Vec2& n,float& pen,Vec2& point) {
  Vec2 d=sub(b.position,a.position); float ds=lenSq(d); float rr=a.radius+b.radius;
  if(ds>=rr*rr)return false; float dist=sqrtf(fmaxf(ds,1e-10f)); n=dist>1e-5f?mul(d,1.0f/dist):Vec2{1,0}; pen=rr-dist;
  point=add(a.position,mul(n,a.radius-pen*0.5f)); return true;
}

bool collideCircleBox(const RigidBody& circle,const RigidBody& box,Vec2& nCircleToBox,float& pen,Vec2& point) {
  Vec2 local=inverseRotate(sub(circle.position,box.position),box.angle);
  Vec2 q={clampf(local.x,-box.halfExtents.x,box.halfExtents.x),clampf(local.y,-box.halfExtents.y,box.halfExtents.y)};
  Vec2 delta=sub(q,local); float ds=lenSq(delta);
  if(ds>circle.radius*circle.radius)return false;
  if(ds>1e-8f) {
    float d=sqrtf(ds); Vec2 nLocal=mul(delta,1.0f/d); nCircleToBox=rotate(nLocal,box.angle); pen=circle.radius-d; point=add(circle.position,mul(nCircleToBox,circle.radius-pen*0.5f)); return true;
  }
  float dx=box.halfExtents.x-fabsf(local.x), dy=box.halfExtents.y-fabsf(local.y); Vec2 nLocal;
  if(dx<dy){nLocal={local.x>=0?1.0f:-1.0f,0}; pen=circle.radius+dx;} else {nLocal={0,local.y>=0?1.0f:-1.0f}; pen=circle.radius+dy;}
  // Local normal above points from box center to circle; circle->box is opposite.
  nCircleToBox=mul(rotate(nLocal,box.angle),-1.0f); point=add(circle.position,mul(nCircleToBox,circle.radius*0.5f)); return true;
}

bool collideBoxBox(const RigidBody& a,const RigidBody& b,Vec2& normal,float& pen,Vec2& point) {
  Vec2 axes[4]={boxAxisX(a),boxAxisY(a),boxAxisX(b),boxAxisY(b)};
  Vec2 delta=sub(b.position,a.position); float best=1e30f; Vec2 bestAxis={1,0};
  for(int i=0;i<4;i++) {
    Vec2 ax=normalize(axes[i]); float dist=fabsf(dot(delta,ax)); float ov=projectedRadius(a,ax)+projectedRadius(b,ax)-dist;
    if(ov<=0)return false; if(ov<best){best=ov;bestAxis=ax;}
  }
  if(dot(delta,bestAxis)<0)bestAxis=mul(bestAxis,-1);
  normal=bestAxis; pen=best;
  Vec2 pa=supportPoint(a,normal), pb=supportPoint(b,mul(normal,-1)); point=mul(add(pa,pb),0.5f); return true;
}

RigidBody staticAsBody(const StaticCollider& s) {
  RigidBody b{}; b.position=mul(add(s.box.min,s.box.max),0.5f); b.halfExtents=mul(sub(s.box.max,s.box.min),0.5f); b.angle=0; b.shape=SHAPE_BOX; b.active=true; b.inverseMass=0; b.inverseInertia=0; b.role=ROLE_CARGO; refreshBodyGeometry(b); return b;
}

bool addContact(int a,int b,int staticIndex,Vec2 n,float pen,Vec2 p) {
  if(g.contactCount>=MAX_CONTACTS)return false;
  Contact& c=g.contacts[g.contactCount++]; c.a=a;c.b=b;c.staticIndex=staticIndex;c.normal=n;c.point=p;c.penetration=pen;c.normalImpulse=0;c.tangentImpulse=0; return true;
}

bool buildContacts() {
  g.contactCount=0;
  for(uint8_t i=0;i<g.bodyCount;i++) {
    RigidBody& a=g.bodies[i]; if(!a.active)continue; refreshBodyGeometry(a);
    for(uint8_t s=0;s<g.staticCount;s++) {
      if(!overlaps(a.aabb,g.statics[s].box))continue;
      RigidBody b=staticAsBody(g.statics[s]); Vec2 n,p; float pen; bool hit=false;
      if(a.shape==SHAPE_CIRCLE) hit=collideCircleBox(a,b,n,pen,p); else hit=collideBoxBox(a,b,n,pen,p);
      if(hit && !addContact(i,-1,s,n,pen,p))return false;
    }
  }
  for(uint8_t i=0;i<g.bodyCount;i++) for(uint8_t j=i+1;j<g.bodyCount;j++) {
    RigidBody& a=g.bodies[i]; RigidBody& b=g.bodies[j]; if(!a.active||!b.active)continue;
    if(!overlaps(a.aabb,b.aabb))continue;
    Vec2 n,p; float pen; bool hit=false;
    if(a.shape==SHAPE_CIRCLE&&b.shape==SHAPE_CIRCLE)hit=collideCircleCircle(a,b,n,pen,p);
    else if(a.shape==SHAPE_CIRCLE)hit=collideCircleBox(a,b,n,pen,p);
    else if(b.shape==SHAPE_CIRCLE){hit=collideCircleBox(b,a,n,pen,p); n=mul(n,-1);} else hit=collideBoxBox(a,b,n,pen,p);
    if(hit && !addContact(i,j,-1,n,pen,p))return false;
  }
  if(g.contactCount>g.contactHighWater)g.contactHighWater=g.contactCount;
  return true;
}

void solveContactVelocity(Contact& c) {
  RigidBody& a=g.bodies[c.a]; RigidBody* bp=c.b>=0?&g.bodies[c.b]:nullptr;
  Vec2 va=pointVelocity(a,c.point), vb=bp?pointVelocity(*bp,c.point):Vec2{0,0};
  Vec2 rv=sub(vb,va); float vn=dot(rv,c.normal); if(vn>0 && c.penetration<0.5f)return;
  Vec2 ra=sub(c.point,a.position), rb=bp?sub(c.point,bp->position):Vec2{0,0};
  float k=a.inverseMass + (bp?bp->inverseMass:0) + a.inverseInertia*cross(ra,c.normal)*cross(ra,c.normal) + (bp?bp->inverseInertia*cross(rb,c.normal)*cross(rb,c.normal):0);
  if(k<1e-8f)return;
  float e=(vn<-RESTITUTION_THRESHOLD)?RESTITUTION:0.0f;
  float lambda=-(1.0f+e)*vn/k; float old=c.normalImpulse; c.normalImpulse=fmaxf(0.0f,old+lambda); lambda=c.normalImpulse-old;
  Vec2 impulse=mul(c.normal,lambda); applyImpulse(a,mul(impulse,-1),c.point); if(bp)applyImpulse(*bp,impulse,c.point);

  va=pointVelocity(a,c.point); vb=bp?pointVelocity(*bp,c.point):Vec2{0,0}; rv=sub(vb,va);
  Vec2 t=perp(c.normal); float vt=dot(rv,t);
  float kt=a.inverseMass + (bp?bp->inverseMass:0) + a.inverseInertia*cross(ra,t)*cross(ra,t) + (bp?bp->inverseInertia*cross(rb,t)*cross(rb,t):0);
  if(kt>1e-8f){float jt=-vt/kt; float oldT=c.tangentImpulse; float maxF=FRICTION*c.normalImpulse; c.tangentImpulse=clampf(oldT+jt,-maxF,maxF); jt=c.tangentImpulse-oldT; Vec2 impT=mul(t,jt); applyImpulse(a,mul(impT,-1),c.point); if(bp)applyImpulse(*bp,impT,c.point);}
}

void correctContactPosition(Contact& c) {
  RigidBody& a=g.bodies[c.a]; RigidBody* b=c.b>=0?&g.bodies[c.b]:nullptr;
  float inv=a.inverseMass+(b?b->inverseMass:0); if(inv<=0)return;
  float corr=clampf((c.penetration-0.3f)*0.45f,0,2.0f); if(corr<=0)return;
  Vec2 move=mul(c.normal,corr/inv);
  a.position=sub(a.position,mul(move,a.inverseMass)); if(b)b->position=add(b->position,mul(move,b->inverseMass));
}

// ============================================================
// Rope
// ============================================================

enum EndpointKind:uint8_t{END_BODY,END_NODE};
struct EndpointRef { EndpointKind kind; uint8_t index; Vec2 local; };
struct EndpointState { Vec2 p,v,r; float invMass,invI; };

EndpointRef ropeEndpoint(int i) {
  if(i==0)return {END_BODY,0,{0,-8}};
  if(i==ROPE_SEGMENTS)return {END_BODY,1,{0,+MAGNET_HALF_H}};
  return {END_NODE,(uint8_t)(i-1),{0,0}};
}

EndpointState getEndpoint(EndpointRef ref) {
  if(ref.kind==END_NODE){RopeNode& n=g.ropeNodes[ref.index]; return {n.position,n.velocity,{0,0},n.inverseMass,0};}
  RigidBody& b=g.bodies[ref.index]; Vec2 p=worldPoint(b,ref.local); return {p,pointVelocity(b,p),sub(p,b.position),b.inverseMass,b.inverseInertia};
}

void endpointImpulse(EndpointRef ref,Vec2 impulse) {
  if(ref.kind==END_NODE){g.ropeNodes[ref.index].velocity=add(g.ropeNodes[ref.index].velocity,mul(impulse,g.ropeNodes[ref.index].inverseMass));return;}
  Vec2 p=worldPoint(g.bodies[ref.index],ref.local); applyImpulse(g.bodies[ref.index],impulse,p);
}

void endpointPositionMove(EndpointRef ref,Vec2 move) {
  if(ref.kind==END_NODE){g.ropeNodes[ref.index].position=add(g.ropeNodes[ref.index].position,mul(move,g.ropeNodes[ref.index].inverseMass));return;}
  RigidBody& b=g.bodies[ref.index]; Vec2 r=rotate(ref.local,b.angle); b.position=add(b.position,mul(move,b.inverseMass)); b.angle += cross(r,move)*b.inverseInertia; b.angle=wrapAngle(b.angle);
}

void solveRopeVelocity(int seg,float dt) {
  EndpointRef ar=ropeEndpoint(seg), br=ropeEndpoint(seg+1); EndpointState a=getEndpoint(ar),b=getEndpoint(br);
  Vec2 d=sub(b.p,a.p); float l=length(d); if(l<1e-6f)return; Vec2 n=mul(d,1.0f/l);
  float C=l-ROPE_SEGMENT_LENGTH; float rel=dot(sub(b.v,a.v),n);
  if(C<0.0f && rel<=0.0f)return;
  float raN=cross(a.r,n), rbN=cross(b.r,n); float k=a.invMass+b.invMass+a.invI*raN*raN+b.invI*rbN*rbN; if(k<1e-8f)return;
  float bias=C>0?0.18f*C/dt:0; float lambda=fmaxf(0.0f,(rel+bias)/k);
  Vec2 imp=mul(n,lambda); endpointImpulse(ar,imp); endpointImpulse(br,mul(imp,-1));
}

void correctRopeLength(int seg) {
  EndpointRef ar=ropeEndpoint(seg), br=ropeEndpoint(seg+1); EndpointState a=getEndpoint(ar),b=getEndpoint(br);
  Vec2 d=sub(b.p,a.p); float l=length(d); if(l<=ROPE_SEGMENT_LENGTH+0.05f||l<1e-6f)return; Vec2 n=mul(d,1.0f/l);
  float raN=cross(a.r,n),rbN=cross(b.r,n); float k=a.invMass+b.invMass+a.invI*raN*raN+b.invI*rbN*rbN; if(k<1e-8f)return;
  float mag=clampf((l-ROPE_SEGMENT_LENGTH)*0.65f/k,0,2.5f); Vec2 move=mul(n,mag); endpointPositionMove(ar,move); endpointPositionMove(br,mul(move,-1));
}

bool segmentAabbEntry(Vec2 a, Vec2 b, const Aabb& r, float& tEntry, Vec2& outwardNormal) {
  Vec2 d=sub(b,a); float t0=0.0f,t1=1.0f; Vec2 n={0,0};
  for(int axis=0;axis<2;axis++) {
    float o=axis?a.y:a.x, v=axis?d.y:d.x, mn=axis?r.min.y:r.min.x, mx=axis?r.max.y:r.max.x;
    if(fabsf(v)<1e-7f) { if(o<mn||o>mx)return false; continue; }
    float nearT,farT; Vec2 nearN;
    if(v>0) { nearT=(mn-o)/v; farT=(mx-o)/v; nearN=axis?Vec2{0,-1}:Vec2{-1,0}; }
    else { nearT=(mx-o)/v; farT=(mn-o)/v; nearN=axis?Vec2{0,1}:Vec2{1,0}; }
    if(nearT>t0){t0=nearT;n=nearN;} if(farT<t1)t1=farT; if(t0>t1)return false;
  }
  if(t1<0||t0>1)return false; tEntry=clampf(t0,0,1); outwardNormal=n; return true;
}

void resolveRopeStatics() {
  // Node circles against solids.
  const float rad=1.2f;
  for(int n=0;n<ROPE_NODES;n++) {
    RopeNode& p=g.ropeNodes[n];
    for(uint8_t s=0;s<g.staticCount;s++) {
      Aabb r=g.statics[s].box;
      if(p.position.x<r.min.x-rad||p.position.x>r.max.x+rad||p.position.y<r.min.y-rad||p.position.y>r.max.y+rad)continue;
      float left=fabsf(p.position.x-(r.min.x-rad)), right=fabsf((r.max.x+rad)-p.position.x), down=fabsf(p.position.y-(r.min.y-rad)), up=fabsf((r.max.y+rad)-p.position.y);
      float m=left; Vec2 norm={-1,0}; float target=r.min.x-rad;
      if(right<m){m=right;norm={1,0};target=r.max.x+rad;}
      if(down<m){m=down;norm={0,-1};target=r.min.y-rad;}
      if(up<m){m=up;norm={0,1};target=r.max.y+rad;}
      if(norm.x)p.position.x=target; else p.position.y=target;
      float vn=dot(p.velocity,norm); if(vn<0)p.velocity=sub(p.velocity,mul(norm,1.2f*vn));
      p.velocity=mul(p.velocity,0.98f);
    }
  }
  // Segment/static crossing repair. This catches corner crossings that node-only collision misses.
  for(int seg=0;seg<ROPE_SEGMENTS;seg++) {
    EndpointRef ar=ropeEndpoint(seg), br=ropeEndpoint(seg+1);
    EndpointState a=getEndpoint(ar), b=getEndpoint(br);
    for(uint8_t si=0;si<g.staticCount;si++) {
      Aabb expanded={{g.statics[si].box.min.x-1.0f,g.statics[si].box.min.y-1.0f},
                     {g.statics[si].box.max.x+1.0f,g.statics[si].box.max.y+1.0f}};
      float t; Vec2 n;
      if(!segmentAabbEntry(a.p,b.p,expanded,t,n)) continue;
      // Ignore the common case where both points are already on/inside the same solid; node contacts handle it.
      bool aInside=a.p.x>expanded.min.x&&a.p.x<expanded.max.x&&a.p.y>expanded.min.y&&a.p.y<expanded.max.y;
      bool bInside=b.p.x>expanded.min.x&&b.p.x<expanded.max.x&&b.p.y>expanded.min.y&&b.p.y<expanded.max.y;
      if(aInside&&bInside) continue;
      float wa=1.0f-t, wb=t;
      Vec2 corr=mul(n,1.4f);
      endpointPositionMove(ar,mul(corr,wa)); endpointPositionMove(br,mul(corr,wb));
      EndpointState aa=getEndpoint(ar), bb=getEndpoint(br);
      float vna=dot(aa.v,n); if(vna<0)endpointImpulse(ar,mul(n,-vna*0.55f/(aa.invMass+1e-6f)));
      float vnb=dot(bb.v,n); if(vnb<0)endpointImpulse(br,mul(n,-vnb*0.55f/(bb.invMass+1e-6f)));
      a=getEndpoint(ar); b=getEndpoint(br);
    }
  }
}

// ============================================================
// Magnet
// ============================================================

Vec2 padLocal(uint8_t p){static const float xs[4]={-7.5f,-2.5f,2.5f,7.5f};return {xs[p],-MAGNET_HALF_H-3.5f};}
Vec2 cargoLugLocal(const Cargo& c){const RigidBody& b=g.bodies[c.bodyIndex]; return b.shape==SHAPE_CIRCLE?Vec2{0,b.radius}:Vec2{0,b.halfExtents.y};}
int jointForCargo(uint8_t c){for(int j=0;j<MAX_JOINTS;j++)if(g.joints[j].active&&g.joints[j].cargoIndex==c)return j;return -1;}
bool padFree(uint8_t p){for(int j=0;j<MAX_JOINTS;j++)if(g.joints[j].active&&g.joints[j].pad==p)return false;return true;}

void emitEvent(EventType type,Vec2 p,uint8_t cargo=255,float mag=0) {
  if(g.eventCount>=MAX_EVENTS)return; g.events[g.eventCount++]={type,p,cargo,mag};
}

void setMagnetEnabled(bool on) {
  if(g.magnetOn==on)return; g.magnetOn=on;
  if(on){queueSound(SND_ON);} else {
    queueSound(SND_OFF);
    for(int j=0;j<MAX_JOINTS;j++) if(g.joints[j].active) {
      uint8_t c=g.joints[j].cargoIndex; g.joints[j].active=false; g.cargo[c].attachedPad=-1; g.cargo[c].recaptureAfterMs=millis()+MAGNET_RECAPTURE_MS; emitEvent(EV_DETACH,g.bodies[g.cargo[c].bodyIndex].position,c,0);
    }
  }
}

void applyMagneticAttraction(float dt) {
  if(!g.magnetOn)return; RigidBody& m=g.bodies[1]; uint32_t now=millis();
  for(uint8_t c=0;c<g.cargoCount;c++) {
    Cargo& cg=g.cargo[c]; if(cg.delivered||cg.attachedPad>=0||now<cg.recaptureAfterMs)continue;
    RigidBody& b=g.bodies[cg.bodyIndex]; Vec2 lug=worldPoint(b,cargoLugLocal(cg));
    int best=-1; float bestD=1e9f;
    for(int p=0;p<4;p++) if(padFree(p)) {Vec2 pp=worldPoint(m,padLocal(p)); float d=length(sub(pp,lug)); if(d<bestD){bestD=d;best=p;}}
    if(best<0||bestD>MAGNET_RADIUS)continue; Vec2 pp=worldPoint(m,padLocal(best)); if(lineBlockedByStatic(pp,lug))continue;
    Vec2 delta=sub(pp,lug); float d=length(delta); if(d<1e-4f)continue; Vec2 n=mul(delta,1.0f/d); float fall=1.0f-d/MAGNET_RADIUS; Vec2 rel=sub(pointVelocity(m,pp),pointVelocity(b,lug));
    Vec2 F=add(mul(n,MAGNET_ATTRACTION_FORCE*fall*fall),mul(rel,5.0f)); float fl=length(F); if(fl>MAGNET_ATTRACTION_FORCE)F=mul(F,MAGNET_ATTRACTION_FORCE/fl);
    // Don't let damping reverse attraction strongly.
    if(dot(F,n)<0)F={0,0}; addForceAt(b,F,lug); addForceAt(m,mul(F,-1),pp);
  }
}

bool attachCargo(uint8_t c,uint8_t pad) {
  if(c>=g.cargoCount||pad>=4||!padFree(pad)||g.cargo[c].attachedPad>=0)return false;
  for(int j=0;j<MAX_JOINTS;j++) if(!g.joints[j].active) {
    g.joints[j].active=true; g.joints[j].cargoIndex=c; g.joints[j].pad=pad; g.joints[j].accumulatedImpulse={0,0}; g.joints[j].filteredLoad=0; g.joints[j].overloadTime=0; g.cargo[c].attachedPad=pad;
    emitEvent(g.cargo[c].required?EV_REQUIRED_ATTACH:EV_ATTACH,g.bodies[g.cargo[c].bodyIndex].position,c,0); return true;
  }
  return false;
}

void findCaptureCandidates() {
  if(!g.magnetOn)return; uint32_t now=millis(); RigidBody& m=g.bodies[1];
  for(uint8_t c=0;c<g.cargoCount;c++) {
    Cargo& cg=g.cargo[c]; if(cg.delivered||cg.attachedPad>=0||now<cg.recaptureAfterMs)continue; RigidBody& b=g.bodies[cg.bodyIndex];
    Vec2 lug=worldPoint(b,cargoLugLocal(cg)); int best=-1; float bd=1e9f;
    for(int p=0;p<4;p++) if(padFree(p)){Vec2 pp=worldPoint(m,padLocal(p));float d=length(sub(pp,lug));if(d<bd){bd=d;best=p;}}
    if(best<0) {emitEvent(EV_FULL,m.position,c,0); continue;}
    Vec2 pp=worldPoint(m,padLocal(best)); if(bd>MAGNET_CAPTURE_DIST||lineBlockedByStatic(pp,lug))continue;
    float rel=length(sub(pointVelocity(b,lug),pointVelocity(m,pp))); if(rel>45.0f)continue;
    attachCargo(c,(uint8_t)best);
  }
}

void solveMagneticJoint(MagneticJoint& j,float dt) {
  if(!j.active)return; Cargo& cg=g.cargo[j.cargoIndex]; RigidBody& a=g.bodies[1]; RigidBody& b=g.bodies[cg.bodyIndex];
  Vec2 pA=worldPoint(a,padLocal(j.pad)), pB=worldPoint(b,cargoLugLocal(cg)); Vec2 rA=sub(pA,a.position),rB=sub(pB,b.position); Vec2 C=sub(pB,pA);
  Vec2 rv=sub(pointVelocity(b,pB),pointVelocity(a,pA)); float m=a.inverseMass+b.inverseMass; if(m<1e-8f)return;
  float massEff=1.0f/m, w=2.0f*PI*12.0f, k=massEff*w*w, damp=2.0f*0.8f*massEff*w;
  float gamma=1.0f/(dt*(damp+dt*k)); float beta=dt*k*gamma;
  float K11=m+a.inverseInertia*rA.y*rA.y+b.inverseInertia*rB.y*rB.y+gamma;
  float K12=-a.inverseInertia*rA.x*rA.y-b.inverseInertia*rB.x*rB.y;
  float K22=m+a.inverseInertia*rA.x*rA.x+b.inverseInertia*rB.x*rB.x+gamma;
  float det=K11*K22-K12*K12; if(fabsf(det)<1e-9f)return;
  Vec2 rhs={rv.x+beta*C.x+gamma*j.accumulatedImpulse.x,rv.y+beta*C.y+gamma*j.accumulatedImpulse.y};
  Vec2 dI={-( K22*rhs.x-K12*rhs.y)/det,-(-K12*rhs.x+K11*rhs.y)/det};
  float requested=length(dI)/dt; j.filteredLoad += (requested-j.filteredLoad)*clampf(dt/0.05f,0,1);
  Vec2 old=j.accumulatedImpulse; Vec2 next=add(old,dI); float cap=MAGNET_HOLDING_FORCE*dt; float nl=length(next); if(nl>cap)next=mul(next,cap/nl); dI=sub(next,old); j.accumulatedImpulse=next;
  applyImpulse(a,mul(dI,-1),pA); applyImpulse(b,dI,pB);
}

void evaluateJointBreakage(float dt) {
  for(int j=0;j<MAX_JOINTS;j++) if(g.joints[j].active) {
    MagneticJoint& q=g.joints[j]; Cargo& cg=g.cargo[q.cargoIndex]; RigidBody& a=g.bodies[1]; RigidBody& b=g.bodies[cg.bodyIndex];
    float stretch=length(sub(worldPoint(b,cargoLugLocal(cg)),worldPoint(a,padLocal(q.pad))));
    if(q.filteredLoad>MAGNET_HOLDING_FORCE)q.overloadTime+=dt; else q.overloadTime=fmaxf(0,q.overloadTime-dt*2);
    if(stretch>MAGNET_BREAK_STRETCH||q.overloadTime>0.06f) {
      uint8_t c=q.cargoIndex; q.active=false; cg.attachedPad=-1; cg.recaptureAfterMs=millis()+MAGNET_RECAPTURE_MS; emitEvent(EV_DETACH,b.position,c,stretch>MAGNET_BREAK_STRETCH?2:1);
    }
  }
}

// ============================================================
// Physics integration
// ============================================================

void clearForces() {
  for(uint8_t i=0;i<g.bodyCount;i++){g.bodies[i].force={0,0};g.bodies[i].torque=0;}
}

void applyGravityAndDrag(float dt) {
  float ld=expf(-LINEAR_DRAG*dt), ad=expf(-ANGULAR_DRAG*dt);
  for(uint8_t i=0;i<g.bodyCount;i++) {RigidBody& b=g.bodies[i]; if(!b.active)continue; float m=bodyMass(b); b.force.y-=m*GRAVITY; b.velocity=mul(b.velocity,ld); b.angularVelocity*=ad;}
  for(int n=0;n<ROPE_NODES;n++){RopeNode& p=g.ropeNodes[n];p.velocity.y-=GRAVITY*dt;p.velocity=mul(p.velocity,ld);}
}

void applyEngineForces() {
  RigidBody& s=g.bodies[0]; Vec2 up=rotate({0,1},s.angle); Vec2 rear=worldPoint(s,{-23,0}), front=worldPoint(s,{23,0});
  addForceAt(s,mul(up,thrustFor(g.leftSwitch.stable)),rear); addForceAt(s,mul(up,thrustFor(g.rightSwitch.stable)),front);
}

void integrateVelocities(float dt) {
  for(uint8_t i=0;i<g.bodyCount;i++){
    RigidBody& b=g.bodies[i]; if(!b.active||b.inverseMass<=0)continue;
    b.velocity=add(b.velocity,mul(b.force,b.inverseMass*dt)); b.angularVelocity+=b.torque*b.inverseInertia*dt;
    float sp=length(b.velocity);
    if(sp>150.0f){float extra=expf(-(sp-150.0f)*0.01f*dt);b.velocity=mul(b.velocity,extra);sp=length(b.velocity);}
    if(fabsf(b.angularVelocity)>2.5f)b.angularVelocity*=expf(-(fabsf(b.angularVelocity)-2.5f)*0.35f*dt);
    if(sp>MAX_SPEED)b.velocity=mul(b.velocity,MAX_SPEED/sp); b.angularVelocity=clampf(b.angularVelocity,-MAX_ANGULAR_SPEED,MAX_ANGULAR_SPEED);
  }
}

void integrateTransforms(float dt) {
  for(uint8_t i=0;i<g.bodyCount;i++){RigidBody& b=g.bodies[i];if(!b.active)continue;b.position=add(b.position,mul(b.velocity,dt));b.angle=wrapAngle(b.angle+b.angularVelocity*dt);refreshBodyGeometry(b);}
  for(int n=0;n<ROPE_NODES;n++)g.ropeNodes[n].position=add(g.ropeNodes[n].position,mul(g.ropeNodes[n].velocity,dt));
}

bool outsideRecoveryBounds() {
  for(uint8_t i=0;i<g.bodyCount;i++) if(g.bodies[i].active) {
    Vec2 p=g.bodies[i].position; if(p.x<-100||p.x>g.worldWidth+100||p.y<-100||p.y>WORLD_H+100)return true;
  }
  return false;
}

void saveSubstep(SavedBodyState* bs,SavedNodeState* ns) {
  for(uint8_t i=0;i<g.bodyCount;i++)bs[i]={g.bodies[i].position,g.bodies[i].velocity,g.bodies[i].angle,g.bodies[i].angularVelocity};
  for(int n=0;n<ROPE_NODES;n++)ns[n]={g.ropeNodes[n].position,g.ropeNodes[n].velocity};
}
void restoreSubstep(SavedBodyState* bs,SavedNodeState* ns) {
  for(uint8_t i=0;i<g.bodyCount;i++){g.bodies[i].position=bs[i].p;g.bodies[i].velocity=bs[i].v;g.bodies[i].angle=bs[i].a;g.bodies[i].angularVelocity=bs[i].w;refreshBodyGeometry(g.bodies[i]);}
  for(int n=0;n<ROPE_NODES;n++){g.ropeNodes[n].position=ns[n].p;g.ropeNodes[n].velocity=ns[n].v;}
}

bool simulateSubstep(float dt) {
  SavedBodyState bs[MAX_BODIES]; SavedNodeState ns[ROPE_NODES]; saveSubstep(bs,ns);
  clearForces(); applyGravityAndDrag(dt); applyEngineForces(); applyMagneticAttraction(dt); integrateVelocities(dt);
  for(int j=0;j<MAX_JOINTS;j++)g.joints[j].accumulatedImpulse={0,0};
  // Constraint pass before integration reduces rope stretch.
  for(int it=0;it<VELOCITY_ITERS/2;it++){for(int r=0;r<ROPE_SEGMENTS;r++)solveRopeVelocity(r,dt);for(int j=0;j<MAX_JOINTS;j++)solveMagneticJoint(g.joints[j],dt);}
  integrateTransforms(dt);
  if(!buildContacts()){restoreSubstep(bs,ns);return false;}
  for(int it=0;it<VELOCITY_ITERS;it++){for(uint16_t c=0;c<g.contactCount;c++)solveContactVelocity(g.contacts[c]);for(int r=0;r<ROPE_SEGMENTS;r++)solveRopeVelocity(r,dt);for(int j=0;j<MAX_JOINTS;j++)solveMagneticJoint(g.joints[j],dt);}
  for(int it=0;it<POSITION_ITERS;it++){
    if(!buildContacts()){restoreSubstep(bs,ns);return false;} for(uint16_t c=0;c<g.contactCount;c++)correctContactPosition(g.contacts[c]); for(int r=0;r<ROPE_SEGMENTS;r++)correctRopeLength(r); resolveRopeStatics();
  }
  for(uint8_t i=0;i<g.bodyCount;i++){refreshBodyGeometry(g.bodies[i]);if(!finiteBody(g.bodies[i])){restoreSubstep(bs,ns);return false;}}
  for(int n=0;n<ROPE_NODES;n++)if(!finiteVec(g.ropeNodes[n].position)||!finiteVec(g.ropeNodes[n].velocity)){restoreSubstep(bs,ns);return false;}
  if(outsideRecoveryBounds()){restoreSubstep(bs,ns);enterRecovery(REC_CARGO_LOST);return true;}
  evaluateJointBreakage(dt); findCaptureCandidates(); return true;
}

void consumeGameplayCommands() {
  if(g.commandOff){g.commandOff=false;g.commandOn=false;setMagnetEnabled(false);} else if(g.commandOn){g.commandOn=false;setMagnetEnabled(true);}
}

void simulateTick(float dt) {
  consumeGameplayCommands();
  for(int s=0;s<SUBSTEPS;s++) {
    if(!simulateSubstep(SUBSTEP_DT)) {
      g.invalidStepCount++;
      if(g.invalidStepCount>=3){enterRecovery(REC_CONTACT_OVERFLOW);return;}
    } else g.invalidStepCount=0;
    if(g.phase!=PLAYING)return;
  }
  updateDelivery(dt); processEvents(); tickEffects(dt); updateCamera(dt);
}

// ============================================================
// Contract logic
// ============================================================

bool cargoInsideReceiver(const Cargo& cg) {
  const RigidBody& b=g.bodies[cg.bodyIndex]; if(!b.active)return false;
  return b.aabb.min.x>=g.receiver.min.x-1 && b.aabb.max.x<=g.receiver.max.x+1 && b.aabb.min.y>=g.receiver.min.y-1 && b.aabb.max.y<=g.receiver.max.y+1;
}

bool cargoStableForDelivery(const Cargo& cg) {
  if(cg.attachedPad>=0||cg.delivered)return false; const RigidBody& b=g.bodies[cg.bodyIndex];
  return cargoInsideReceiver(cg)&&length(b.velocity)<DELIVERY_SPEED&&fabsf(b.angularVelocity)<DELIVERY_ANGULAR_SPEED;
}

void bankOptionalCargo(uint8_t c) {
  Cargo& cg=g.cargo[c]; if(cg.required||cg.delivered)return; cg.delivered=true; cg.bankAnimation=true; cg.bankAnimationUntilMs=millis()+250; g.contract.bankedOptionalValue+=cg.value; g.contract.bankedOptionalCount++; emitEvent(EV_BANK,g.bodies[cg.bodyIndex].position,c,0);
}

void completeContract() {
  if(g.contract.resultCommitted)return; g.contract.resultCommitted=true; g.contract.requiredStatus=REQ_DELIVERED;
  g.contract.resultPayout=g.contract.contractValue; g.contract.resultOptional=g.contract.bankedOptionalValue;
  uint32_t total=g.contract.resultPayout+g.contract.resultOptional;
  if(g.contract.payoutEligible){uint32_t room=0xFFFFFFFFu-g.runMoney;g.runMoney+=total>room?room:total;g.completedContractIndex=g.contract.index;}
  emitEvent(EV_COMPLETE,g.bodies[g.cargo[g.requiredCargoIndex].bodyIndex].position,g.requiredCargoIndex,0); processEvents(); changePhase(RESULTS);
}

void updateDelivery(float dt) {
  uint32_t now=millis();
  for(uint8_t c=0;c<g.cargoCount;c++) {
    Cargo& cg=g.cargo[c]; if(cg.delivered) {if(cg.bankAnimation&&now>=cg.bankAnimationUntilMs){cg.bankAnimation=false;g.bodies[cg.bodyIndex].active=false;} continue;}
    if(cargoStableForDelivery(cg))cg.receiverStableTime+=dt; else cg.receiverStableTime=0;
    if(!cg.required && cg.receiverStableTime>=DELIVERY_STABLE_TIME)bankOptionalCargo(c);
  }
  Cargo& req=g.cargo[g.requiredCargoIndex];
  if(req.attachedPad>=0)g.contract.requiredStatus=REQ_HELD; else if(req.delivered)g.contract.requiredStatus=REQ_DELIVERED; else if(length(sub(g.bodies[req.bodyIndex].position,{142.0f,floorAtX(142.0f)+12}))>30)g.contract.requiredStatus=REQ_DROPPED; else g.contract.requiredStatus=REQ_LOCATE;
  if(req.receiverStableTime>=DELIVERY_STABLE_TIME && !req.delivered) {
    if(!g.contract.receiving){g.contract.receiving=true;g.contract.finalizeTimer=DELIVERY_FINALIZE_TIME;}
  }
  if(g.contract.receiving) {
    // Once qualified, the two-second receiving window tolerates small settling motion.
    // It cancels only if the required piece leaves the bay or is picked back up.
    if(!cargoInsideReceiver(req) || req.attachedPad>=0){g.contract.receiving=false;g.contract.finalizeTimer=0;}
    else {g.contract.finalizeTimer-=dt; if(g.contract.finalizeTimer<=0){req.delivered=true;completeContract();}}
  }
}

// ============================================================
// Camera
// ============================================================

void updateCamera(float dt) {
  RigidBody& ship=g.bodies[0]; Vec2 target=ship.position; Vec2 centroid={0,0};int count=0;
  for(int j=0;j<MAX_JOINTS;j++)if(g.joints[j].active){centroid=add(centroid,g.bodies[g.cargo[g.joints[j].cargoIndex].bodyIndex].position);count++;}
  if(count){centroid=mul(centroid,1.0f/count);target=add(mul(ship.position,0.75f),mul(centroid,0.25f));}
  target.y-=28.0f; target.x+=clampf(ship.velocity.x*0.10f,-24,24);
  Vec2 d=sub(target,g.camera.center); float dzx=fabsf(d.x)>14?d.x-(d.x>0?14:-14):0; float dzy=fabsf(d.y)>12?d.y-(d.y>0?12:-12):0;
  float alpha=1.0f-expf(-5.0f*dt); g.camera.center=add(g.camera.center,mul({dzx,dzy},alpha));
  float left=g.camera.center.x-SCREEN_W*0.5f, bottom=g.camera.center.y-VIEW_H*0.52f;
  // Containment correction for ship/magnet.
  Vec2 mag=g.bodies[1].position; if(mag.y<bottom+35)bottom=mag.y-35; if(ship.position.y>bottom+VIEW_H-35)bottom=ship.position.y-(VIEW_H-35);
  g.camera.left=floorf(clampf(left,0,fmaxf(0,g.worldWidth-SCREEN_W))+0.5f); g.camera.bottom=floorf(clampf(bottom,0,WORLD_H-VIEW_H)+0.5f);
}

// ============================================================
// Feedback and audio
// ============================================================

void spawnSparks(Vec2 p,uint16_t color,int count,float force) {
  uint32_t seed=hash32((uint32_t)(p.x*17+p.y*31+millis()));
  for(int k=0;k<count;k++) {
    int slot=-1;for(int i=0;i<MAX_PARTICLES;i++)if(!g.particles[i].active){slot=i;break;}if(slot<0)return;
    seed=hash32(seed+k+1); float a=(seed&0xFFFF)*(2.0f*PI/65536.0f); float sp=force*(0.5f+((seed>>16)&255)/255.0f);
    g.particles[slot]={true,p,{cosf(a)*sp,sinf(a)*sp},0.10f+0.15f*((seed>>24)&255)/255.0f,color};
  }
}

void processEvents() {
  for(uint8_t i=0;i<g.eventCount;i++) {
    Event& e=g.events[i];
    switch(e.type){
      case EV_ATTACH: spawnSparks(e.position,C_CYAN,3,35);queueSound(SND_ATTACH);break;
      case EV_REQUIRED_ATTACH: spawnSparks(e.position,C_YELLOW,4,40);queueSound(SND_REQUIRED);break;
      case EV_DETACH: spawnSparks(e.position,C_AMBER,3,30);queueSound(SND_DETACH);break;
      case EV_BANK: spawnSparks(e.position,C_GREEN,4,45);queueSound(SND_BANK);break;
      case EV_COMPLETE: spawnSparks(e.position,C_GREEN,8,60);queueSound(SND_COMPLETE);break;
      default: break;
    }
  }
  g.eventCount=0;
}

void tickEffects(float dt) {
  for(int i=0;i<MAX_PARTICLES;i++)if(g.particles[i].active){Particle& p=g.particles[i];p.life-=dt;if(p.life<=0){p.active=false;continue;}p.position=add(p.position,mul(p.velocity,dt));p.velocity.y-=30.0f*dt;}
}

struct ToneNote { uint16_t hz; uint16_t ms; };

const ToneNote* soundPattern(SoundId id,uint8_t& count) {
  static const ToneNote on[]={{700,45},{1000,55}}; static const ToneNote off[]={{420,70}};
  static const ToneNote attach[]={{1150,45}}; static const ToneNote req[]={{900,45},{1350,65}};
  static const ToneNote detach[]={{650,45},{430,60}}; static const ToneNote bank[]={{900,45},{1200,55},{1500,65}};
  static const ToneNote complete[]={{750,55},{1050,55},{1450,90}}; static const ToneNote recovery[]={{300,80},{240,100}};
  switch(id){case SND_ON:count=2;return on;case SND_OFF:count=1;return off;case SND_ATTACH:count=1;return attach;case SND_REQUIRED:count=2;return req;case SND_DETACH:count=2;return detach;case SND_BANK:count=3;return bank;case SND_COMPLETE:count=3;return complete;case SND_RECOVERY:count=2;return recovery;default:count=0;return nullptr;}
}

void setOwnedTone(uint16_t hz) {
  if(!Music::gameEffectsAllowed())return; if(hz==0||Music::volume==0){ledcWriteTone(BUZZER_1_PIN,0);ledcWrite(BUZZER_1_PIN,0);g.ownedToneActive=false;return;}
  ledcWriteTone(BUZZER_1_PIN,hz); uint32_t duty=Music::dutyForVolume(Music::volume); ledcWrite(BUZZER_1_PIN,duty);g.ownedToneActive=true;
}
void stopOwnedSound(){if(g.ownedToneActive&&Music::gameEffectsAllowed()){ledcWriteTone(BUZZER_1_PIN,0);ledcWrite(BUZZER_1_PIN,0);}g.ownedToneActive=false;g.soundPlaying=SND_NONE;g.soundCount=0;g.soundHead=g.soundTail=0;}
void queueSound(SoundId id){if(id==SND_NONE||!Music::gameEffectsAllowed())return;if(g.soundCount>=MAX_SOUNDS)return;g.soundQueue[g.soundTail]={id};g.soundTail=(g.soundTail+1)%MAX_SOUNDS;g.soundCount++;}
void tickSound(uint32_t nowMs) {
  if(!Music::gameEffectsAllowed()){if(g.ownedToneActive)stopOwnedSound();return;}
  if(g.soundPlaying!=SND_NONE && (int32_t)(nowMs-g.soundNoteEndsAt)>=0){uint8_t count;const ToneNote* p=soundPattern(g.soundPlaying,count);g.soundNote++;if(g.soundNote>=count){setOwnedTone(0);g.soundPlaying=SND_NONE;}else{setOwnedTone(p[g.soundNote].hz);g.soundNoteEndsAt=nowMs+p[g.soundNote].ms;}}
  if(g.soundPlaying==SND_NONE&&g.soundCount){SoundId id=g.soundQueue[g.soundHead].id;g.soundHead=(g.soundHead+1)%MAX_SOUNDS;g.soundCount--;uint8_t count;const ToneNote* p=soundPattern(id,count);if(count){g.soundPlaying=id;g.soundNote=0;setOwnedTone(p[0].hz);g.soundNoteEndsAt=nowMs+p[0].ms;}}
}

// ============================================================
// Lifecycle
// ============================================================

void invalidatePresentation() {
  for(int b=0;b<BAND_COUNT;b++)for(int x=0;x<TILE_COLS;x++)tileValid[b][x]=false;
  g.presentationActive=false; g.presentationBand=0;
}

void changePhase(Phase p) {
  g.phase=p; g.releaseGate=true; g.lastUpdateUs=micros();g.accumulator=0;invalidatePresentation();
}

void enterRecovery(RecoveryReason reason) {
  g.recoveryReason=reason; queueSound(SND_RECOVERY); changePhase(RECOVERY);
}

void beginContract(uint32_t seed,uint32_t index,bool eligible,bool practice) {
  g.contract={}; g.contract.seed=seed; g.contract.index=index; g.contract.payoutEligible=eligible; g.contract.practice=practice;g.contract.requiredStatus=REQ_LOCATE;
  g.routeReady=false;g.generationAttempt=0;g.generationProfile=profileFor(index);g.recoveryReason=REC_NONE;g.phase=BRIEFING;g.releaseGate=true;g.invalidStepCount=0;
  g.commandOn=g.commandOff=false;g.magnetOn=false;g.accumulator=0;g.lastUpdateUs=micros();invalidatePresentation();
}

void restartContract(){beginContract(g.contract.seed,g.contract.index,g.contract.payoutEligible,g.contract.practice);}

void advanceContract() {
  uint32_t nextIndex=g.contract.index;
  if(g.contract.resultCommitted) nextIndex=g.contract.index+1;
  if(g.contract.practice && g.completedContractIndex>=g.contract.index) nextIndex=g.completedContractIndex+1;
  uint32_t seed=hash32(g.runSeed ^ (0x9E3779B9u*nextIndex)); beginContract(seed,nextIndex,true,false);
}

void enter() {
  new (&shared) SharedStorage;
  memset(&g,0,sizeof(g));
  ::display.setRotation(0); ::display.setTextWrap(false); ::display.setTextSize(1); ::display.setTextColor(C_WHITE);
  uint32_t nowMs=millis(); initSwitchFilter(g.leftSwitch,readLocalSwitch(LEFT_UP_PIN,LEFT_DOWN_PIN),nowMs);initSwitchFilter(g.rightSwitch,readLocalSwitch(RIGHT_UP_PIN,RIGHT_DOWN_PIN),nowMs);initButtonFilter(g.leftButton,false,nowMs);initButtonFilter(g.rightButton,false,nowMs);
  g.runSeed=hash32(esp_random() ^ micros() ^ 0x534B5948u); g.runMoney=0;g.completedContractIndex=0;g.soundPlaying=SND_NONE;g.lastPresentMs=0;
  if(Music::gameEffectsAllowed()){ledcWriteTone(BUZZER_1_PIN,0);ledcWrite(BUZZER_1_PIN,0);} invalidatePresentation();
  beginContract(hash32(g.runSeed^1u),1,true,false);
}

// ============================================================
// Render snapshot
// ============================================================

void summarizeLoad(uint8_t& count,uint32_t& value) {
  count=0;value=0;for(int j=0;j<MAX_JOINTS;j++)if(g.joints[j].active){count++;value+=g.cargo[g.joints[j].cargoIndex].value;}
}

void captureRenderSnapshot() {
  RenderSnapshot& s=g.snapshot; memset(&s,0,sizeof(s));
  for(uint8_t i=0;i<g.bodyCount;i++){s.bodies[i]={g.bodies[i].active,g.bodies[i].role,g.bodies[i].shape,g.bodies[i].position,g.bodies[i].angle,g.bodies[i].halfExtents,g.bodies[i].radius};}
  for(uint8_t c=0;c<g.cargoCount;c++){s.cargo[c]={g.cargo[c].delivered,g.cargo[c].required,g.cargo[c].kind,g.cargo[c].attachedPad,g.cargo[c].value,g.cargo[c].bodyIndex};}
  s.rope[0]=worldPoint(g.bodies[0],{0,-8});for(int n=0;n<ROPE_NODES;n++)s.rope[n+1]=g.ropeNodes[n].position;s.rope[ROPE_NODES+1]=worldPoint(g.bodies[1],{0,MAGNET_HALF_H});
  for(int i=0;i<MAX_PARTICLES;i++)s.particles[i]={g.particles[i].active,g.particles[i].position,g.particles[i].life,g.particles[i].color};
  s.cameraLeft=g.camera.left;s.cameraBottom=g.camera.bottom;s.phase=g.phase;s.recoveryReason=g.recoveryReason;s.magnetOn=g.magnetOn;s.receiving=g.contract.receiving;s.finalizeTimer=g.contract.finalizeTimer;s.contractIndex=g.contract.index;s.runMoney=g.runMoney;s.optionalMoney=g.contract.bankedOptionalValue;s.contractValue=g.contract.contractValue;s.requiredStatus=g.contract.requiredStatus;s.leftSwitchFault=g.leftSwitch.fault;s.rightSwitchFault=g.rightSwitch.fault;s.rearSwitch=g.leftSwitch.stable;s.frontSwitch=g.rightSwitch.stable;s.routeReady=g.routeReady;s.practice=g.contract.practice;s.resultPayout=g.contract.resultPayout;s.resultOptional=g.contract.resultOptional;s.attachedValue=0;s.attachedCount=0;summarizeLoad(s.attachedCount,s.attachedValue); float supportedMass=SHIP_MASS+MAGNET_MASS+ROPE_NODE_MASS*ROPE_NODES; for(int j=0;j<MAX_JOINTS;j++) if(g.joints[j].active) supportedMass+=g.cargo[g.joints[j].cargoIndex].mass; s.overload=(supportedMass*GRAVITY>2.0f*HIGH_THRUST);
}

struct ScreenPoint { int16_t x,y; };
ScreenPoint worldToScreen(Vec2 p,const RenderSnapshot& s) {return {(int16_t)lroundf(p.x-s.cameraLeft),(int16_t)lroundf(HUD_H+VIEW_H-1-(p.y-s.cameraBottom))};}

void fillWorldRect(Aabb w,uint16_t color,const RenderSnapshot& s) {
  int x=(int)floorf(w.min.x-s.cameraLeft);int x2=(int)ceilf(w.max.x-s.cameraLeft);int y=(int)floorf(HUD_H+VIEW_H-(w.max.y-s.cameraBottom));int y2=(int)ceilf(HUD_H+VIEW_H-(w.min.y-s.cameraBottom));
  canvas.fillRect(x,y,x2-x,y2-y,color);
}

void drawRotatedBox(Vec2 p,float angle,Vec2 half,uint16_t fill,uint16_t edge,const RenderSnapshot& s) {
  Vec2 local[4]={{-half.x,-half.y},{half.x,-half.y},{half.x,half.y},{-half.x,half.y}};ScreenPoint q[4];
  for(int i=0;i<4;i++)q[i]=worldToScreen(add(p,rotate(local[i],angle)),s);
  canvas.fillTriangle(q[0].x,q[0].y,q[1].x,q[1].y,q[2].x,q[2].y,fill);canvas.fillTriangle(q[0].x,q[0].y,q[2].x,q[2].y,q[3].x,q[3].y,fill);
  for(int i=0;i<4;i++)canvas.drawLine(q[i].x,q[i].y,q[(i+1)%4].x,q[(i+1)%4].y,edge);
}

void drawBackground(const RenderSnapshot& s) {
  // World-anchored industrial silhouettes. Deterministic hash, no gameplay RNG.
  int first=(int)floorf(s.cameraLeft/64.0f)-1,last=(int)ceilf((s.cameraLeft+SCREEN_W)/64.0f)+1;
  for(int i=first;i<=last;i++){uint32_t h=hash32((uint32_t)i*2654435761u);float wx=i*64.0f;int x=(int)(wx-s.cameraLeft);int base=HUD_H+VIEW_H-1-(int)(70-s.cameraBottom);int hh=35+(h%55);canvas.fillRect(x,base-hh,30,hh,C_BG2);canvas.drawFastVLine(x+8,base-hh-18,18,C_BG3);canvas.drawFastHLine(x+3,base-hh+10,20,C_BG3);}
}

void drawStaticGeometry(const RenderSnapshot& s) {
  for(uint8_t i=0;i<g.staticCount;i++){const StaticCollider& c=g.statics[i];if(c.box.max.x<s.cameraLeft||c.box.min.x>s.cameraLeft+SCREEN_W||c.box.max.y<s.cameraBottom||c.box.min.y>s.cameraBottom+VIEW_H)continue;fillWorldRect(c.box,C_SOLID,s);
    // Exposed top edge.
    ScreenPoint a=worldToScreen({c.box.min.x,c.box.max.y},s),b=worldToScreen({c.box.max.x,c.box.max.y},s);canvas.drawLine(a.x,a.y,b.x,b.y,C_SOLID_EDGE);
  }
}

void drawReceiver(const RenderSnapshot& s) {
  int x=(int)(g.receiver.min.x-s.cameraLeft),w=(int)(g.receiver.max.x-g.receiver.min.x);int y=worldToScreen({0,g.receiver.max.y},s).y;int y2=worldToScreen({0,g.receiver.min.y},s).y;canvas.drawRect(x,y,w,y2-y,C_GREEN);
  for(int xx=x;xx<x+w;xx+=12){canvas.drawLine(xx,y2,xx+6,y2-6,((xx/12)&1)?C_YELLOW:C_RUST);} 
  canvas.setTextSize(1);canvas.setTextColor(C_GREEN);canvas.setCursor(x+8,y+5);canvas.print("RECEIVER");
}

void drawShip(const RenderSnapshot& s) {
  const SnapshotBody& b=s.bodies[0]; if(!b.active)return;
  Vec2 lp[7]={{-28,-5},{-21,7},{11,8},{28,2},{21,-6},{5,-8},{-18,-8}}; ScreenPoint p[7];for(int i=0;i<7;i++)p[i]=worldToScreen(add(b.position,rotate(lp[i],b.angle)),s);
  for(int i=1;i<6;i++)canvas.fillTriangle(p[0].x,p[0].y,p[i].x,p[i].y,p[i+1].x,p[i+1].y,C_CREAM);
  for(int i=0;i<7;i++)canvas.drawLine(p[i].x,p[i].y,p[(i+1)%7].x,p[(i+1)%7].y,C_SOLID_EDGE);
  // Cockpit near nose.
  ScreenPoint cp=worldToScreen(add(b.position,rotate({16,3},b.angle)),s);canvas.fillCircle(cp.x,cp.y,3,C_CYAN);
  // Engine nacelles and exhaust lengths map directly to three fixed outputs.
  float rearL=g.snapshot.rearSwitch==SWITCH_UP?12:(g.snapshot.rearSwitch==SWITCH_DOWN?3:7);float frontL=g.snapshot.frontSwitch==SWITCH_UP?12:(g.snapshot.frontSwitch==SWITCH_DOWN?3:7);
  Vec2 up=rotate({0,1},b.angle);Vec2 down=mul(up,-1);Vec2 ra=add(b.position,rotate({-21,-7},b.angle)),fa=add(b.position,rotate({19,-7},b.angle));ScreenPoint rs=worldToScreen(ra,s),re=worldToScreen(add(ra,mul(down,rearL)),s),fs=worldToScreen(fa,s),fe=worldToScreen(add(fa,mul(down,frontL)),s);canvas.drawLine(rs.x,rs.y,re.x,re.y,C_RUST);canvas.drawLine(fs.x,fs.y,fe.x,fe.y,C_RUST);
}

void drawCableAndMagnet(const RenderSnapshot& s) {
  for(int i=0;i<ROPE_NODES+1;i++){ScreenPoint a=worldToScreen(s.rope[i],s),b=worldToScreen(s.rope[i+1],s);canvas.drawLine(a.x+1,a.y,b.x+1,b.y,C_BLACK);canvas.drawLine(a.x,a.y,b.x,b.y,C_CREAM);}
  const SnapshotBody& m=s.bodies[1];drawRotatedBox(m.position,m.angle,m.halfExtents,C_SOLID,s.magnetOn?C_CYAN:C_SOLID_EDGE,s);
  static const float xs[4]={-7.5f,-2.5f,2.5f,7.5f};for(int p=0;p<4;p++){ScreenPoint q=worldToScreen(add(m.position,rotate({xs[p],-5},m.angle)),s);bool occupied=false;for(uint8_t c=0;c<g.cargoCount;c++)if(s.cargo[c].attachedPad==p)occupied=true;canvas.fillRect(q.x-1,q.y-1,3,3,occupied?C_CYAN:C_BG3);}
}

void drawCargo(const RenderSnapshot& s) {
  for(uint8_t c=0;c<g.cargoCount;c++){const SnapshotCargo& cg=s.cargo[c];const SnapshotBody& b=s.bodies[cg.bodyIndex];if(!b.active)continue;uint16_t fill=cg.required?0x9C65:C_RUST;uint16_t edge=cg.required?C_YELLOW:C_CREAM;
    if(b.shape==SHAPE_CIRCLE){ScreenPoint p=worldToScreen(b.position,s);canvas.fillCircle(p.x,p.y,(int)b.radius,fill);canvas.drawCircle(p.x,p.y,(int)b.radius,edge);canvas.drawFastHLine(p.x-(int)b.radius+2,p.y,(int)b.radius*2-3,C_SOLID_EDGE);} else {drawRotatedBox(b.position,b.angle,b.halfExtents,fill,edge,s);ScreenPoint p=worldToScreen(b.position,s);if(cg.kind==CARGO_ENGINE){canvas.drawFastHLine(p.x-5,p.y-2,10,C_SOLID_EDGE);canvas.drawFastHLine(p.x-5,p.y+2,10,C_SOLID_EDGE);}else if(cg.kind==CARGO_CRATE){canvas.drawLine(p.x-5,p.y-5,p.x+5,p.y+5,C_SOLID_EDGE);canvas.drawLine(p.x-5,p.y+5,p.x+5,p.y-5,C_SOLID_EDGE);}else if(cg.kind==CARGO_GIRDER){canvas.drawFastHLine(p.x-7,p.y,14,C_SOLID_EDGE);}}
    if(cg.required){ScreenPoint p=worldToScreen(b.position,s);canvas.fillRect(p.x-2,p.y-2,4,4,C_YELLOW);}
  }
}

void drawParticles(const RenderSnapshot& s){for(int i=0;i<MAX_PARTICLES;i++)if(s.particles[i].active){ScreenPoint p=worldToScreen(s.particles[i].position,s);canvas.drawPixel(p.x,p.y,s.particles[i].color);}}

const char* reqName(RequiredStatus s){switch(s){case REQ_HELD:return"HELD";case REQ_DROPPED:return"DROPPED";case REQ_DELIVERED:return"DELIVERED";default:return"LOCATE";}}

void drawRequiredIndicator(const RenderSnapshot& s) {
  if(g.cargoCount==0||s.requiredStatus==REQ_DELIVERED)return; Vec2 target;
  if(s.requiredStatus==REQ_HELD)target=mul(add(g.receiver.min,g.receiver.max),0.5f);else target=s.bodies[s.cargo[g.requiredCargoIndex].bodyIndex].position;
  ScreenPoint p=worldToScreen(target,s); if(p.x>=6&&p.x<SCREEN_W-6&&p.y>=HUD_H+6&&p.y<SCREEN_H-6)return;
  float cx=SCREEN_W*0.5f, cy=HUD_H+(VIEW_H*0.5f); float dx=p.x-cx, dy=p.y-cy; float dl=sqrtf(dx*dx+dy*dy); if(dl<1.0f)return; dx/=dl;dy/=dl;
  int x=clampi((int)lroundf(cx+dx*108.0f),7,SCREEN_W-8), y=clampi((int)lroundf(cy+dy*132.0f),HUD_H+7,SCREEN_H-8);
  float px=-dy,py=dx; int tipX=(int)lroundf(x+dx*5),tipY=(int)lroundf(y+dy*5);int aX=(int)lroundf(x-dx*4+px*4),aY=(int)lroundf(y-dy*4+py*4);int bX=(int)lroundf(x-dx*4-px*4),bY=(int)lroundf(y-dy*4-py*4);
  canvas.fillTriangle(tipX,tipY,aX,aY,bX,bY,C_YELLOW);
}

void drawHudAndOverlay(const RenderSnapshot& s) {
  canvas.fillRect(0,0,SCREEN_W,HUD_H,C_BLACK);canvas.drawFastHLine(0,HUD_H-1,SCREEN_W,C_SOLID_EDGE);canvas.setTextSize(1);canvas.setTextColor(C_CREAM);canvas.setCursor(3,3);canvas.print("C");if(s.contractIndex<10)canvas.print("0");canvas.print(s.contractIndex);canvas.print("  $");canvas.print(s.runMoney);canvas.setCursor(132,3);canvas.print("MAG ");canvas.setTextColor(s.magnetOn?C_CYAN:C_SOLID_EDGE);canvas.print(s.magnetOn?"ON":"OFF");canvas.setTextColor(C_CREAM);canvas.setCursor(3,13);canvas.print(reqName(s.requiredStatus));canvas.setCursor(82,13);canvas.print("LOAD ");canvas.print(s.attachedCount);canvas.print(" $");canvas.print(s.attachedValue);if(s.overload){canvas.setTextColor(C_AMBER);canvas.setCursor(178,13);canvas.print("OVERLOAD");}else if(s.leftSwitchFault||s.rightSwitchFault){canvas.setTextColor(C_AMBER);canvas.setCursor(205,13);canvas.print("SW!");}
  if(s.receiving){canvas.setTextColor(C_GREEN);canvas.setCursor(165,13);canvas.print("RX ");int tenths=(int)ceilf(s.finalizeTimer*10);canvas.print(tenths/10);canvas.print('.');canvas.print(tenths%10);}

  if(s.phase==BRIEFING){canvas.fillRect(17,72,206,170,C_BLACK);canvas.drawRect(17,72,206,170,C_SOLID_EDGE);canvas.setTextColor(C_CYAN);canvas.setTextSize(2);canvas.setCursor(65,84);canvas.print("SKYHOOK");canvas.setTextSize(1);canvas.setTextColor(C_CREAM);canvas.setCursor(49,116);canvas.print(s.practice?"PRACTICE ROUTE":"SALVAGE CONTRACT");canvas.setCursor(63,132);canvas.print("CONTRACT ");canvas.print(s.contractIndex);canvas.setCursor(58,148);canvas.print("PAYOUT $");canvas.print(s.contractValue);canvas.setCursor(48,172);canvas.print("TILT TO TRAVEL");canvas.setCursor(38,188);canvas.print("LEFT BTN: MAGNET ON");canvas.setCursor(31,202);canvas.print("RIGHT BTN: RELEASE");canvas.setCursor(38,218);canvas.print(s.routeReady?"CENTER SWITCHES":"PREPARING ROUTE...");if(s.routeReady){canvas.setTextColor(C_GREEN);canvas.setCursor(55,230);canvas.print("LEFT: START");}}
  else if(s.phase==RETRY_PROMPT){canvas.fillRect(30,112,180,92,C_BLACK);canvas.drawRect(30,112,180,92,C_AMBER);canvas.setTextColor(C_AMBER);canvas.setTextSize(2);canvas.setCursor(72,124);canvas.print("PAUSED");canvas.setTextSize(1);canvas.setTextColor(C_CREAM);canvas.setCursor(55,157);canvas.print("LEFT: RETRY");canvas.setCursor(52,175);canvas.print("RIGHT: RESUME");}
  else if(s.phase==RESULTS){canvas.fillRect(25,78,190,160,C_BLACK);canvas.drawRect(25,78,190,160,C_GREEN);canvas.setTextColor(C_GREEN);canvas.setTextSize(2);canvas.setCursor(58,90);canvas.print("RECEIVED");canvas.setTextSize(1);canvas.setTextColor(C_CREAM);canvas.setCursor(50,126);canvas.print("CONTRACT  $");canvas.print(s.resultPayout);canvas.setCursor(50,143);canvas.print("SALVAGE   $");canvas.print(s.resultOptional);canvas.setCursor(50,160);canvas.print("RUN TOTAL $");canvas.print(s.runMoney);if(s.practice){canvas.setTextColor(C_AMBER);canvas.setCursor(77,178);canvas.print("PRACTICE");}canvas.setTextColor(C_CREAM);canvas.setCursor(48,205);canvas.print("LEFT: NEXT");canvas.setCursor(48,220);canvas.print("RIGHT: PRACTICE");}
  else if(s.phase==RECOVERY){canvas.fillRect(25,104,190,112,C_BLACK);canvas.drawRect(25,104,190,112,C_RED);canvas.setTextColor(C_RED);canvas.setTextSize(2);canvas.setCursor(48,118);canvas.print(s.recoveryReason==REC_CARGO_LOST?"CARGO LOST":"SIM RESET");canvas.setTextSize(1);canvas.setTextColor(C_CREAM);canvas.setCursor(45,162);canvas.print("SAME SEED PRESERVED");canvas.setCursor(62,188);canvas.print("LEFT: RETRY");}
  if(s.phase==BRIEFING || s.phase==RETRY_PROMPT || s.phase==RESULTS || s.phase==RECOVERY)
    MenuFooter::draw(canvas);
}

void composeBand(int band) {
  RenderSnapshot& s=g.snapshot;canvas.setBand(band*BAND_H);canvas.clear(C_BG);drawBackground(s);drawStaticGeometry(s);drawReceiver(s);drawCargo(s);drawShip(s);drawCableAndMagnet(s);drawParticles(s);drawRequiredIndicator(s);drawHudAndOverlay(s);
}

uint32_t hashTile(int col) {
  uint32_t h=2166136261u;int x0=col*TILE_W;for(int y=0;y<BAND_H;y++)for(int x=0;x<TILE_W;x++){uint16_t v=stripPixels[y*SCREEN_W+x0+x];h^=(uint8_t)(v&0xFF);h*=16777619u;h^=(uint8_t)(v>>8);h*=16777619u;}return h;
}

void flushChangedRuns(int band) {
  uint32_t hashes[TILE_COLS];bool changed[TILE_COLS];int forceCol=(g.presentationCounter%(BAND_COUNT*TILE_COLS))%TILE_COLS;int forceBand=(g.presentationCounter%(BAND_COUNT*TILE_COLS))/TILE_COLS;
  for(int c=0;c<TILE_COLS;c++){hashes[c]=hashTile(c);changed[c]=!tileValid[band][c]||tileHashes[band][c]!=hashes[c]||(band==forceBand&&c==forceCol);}
  int c=0;while(c<TILE_COLS){while(c<TILE_COLS&&!changed[c])c++;if(c>=TILE_COLS)break;int start=c;while(c<TILE_COLS&&changed[c])c++;int end=c;int x=start*TILE_W,w=(end-start)*TILE_W,y=band*BAND_H;::display.startWrite();::display.setAddrWindow(x,y,w,BAND_H);for(int row=0;row<BAND_H;row++)::display.writePixels(&stripPixels[row*SCREEN_W+x],w,true);::display.endWrite();for(int k=start;k<end;k++){tileHashes[band][k]=hashes[k];tileValid[band][k]=true;}}
}

void beginPresentation(){captureRenderSnapshot();g.presentationActive=true;g.presentationBand=0;g.presentationCounter++;}

void renderNextBands() {
  if(!g.presentationActive)return;uint32_t start=micros();int bands=0;while(g.presentationBand<BAND_COUNT&&bands<2){composeBand(g.presentationBand);flushChangedRuns(g.presentationBand);g.presentationBand++;bands++;if((uint32_t)(micros()-start)>4000u)break;}if(g.presentationBand>=BAND_COUNT){g.presentationActive=false;g.lastPresentMs=millis();}
}

// ============================================================
// Main update
// ============================================================

void update(const GameInput& input) {
  uint32_t nowMs=millis();sampleControls(input,nowMs);tickSound(nowMs);if(g.exitChord)return;
  if(g.phase==BRIEFING&&!g.routeReady)stepRouteBuild();

  uint32_t nowUs=micros();uint32_t elapsed=nowUs-g.lastUpdateUs;g.lastUpdateUs=nowUs;if(elapsed>100000u)elapsed=100000u;
  if(g.phase==PLAYING){g.accumulator+=(float)elapsed*1.0e-6f;int steps=0;while(g.accumulator>=TICK_DT&&steps<3&&g.phase==PLAYING){simulateTick(TICK_DT);g.accumulator-=TICK_DT;steps++;}if(steps==3&&g.accumulator>=TICK_DT){g.accumulator=fmodf(g.accumulator,TICK_DT);g.droppedTimeCount++;}}
  else g.accumulator=0;

  // Process any event emitted outside a physics tick (e.g. complete/recovery).
  if(g.eventCount)processEvents();

  if(!g.presentationActive && (uint32_t)(nowMs-g.lastPresentMs)>=PRESENT_INTERVAL_MS)beginPresentation();
  renderNextBands();
}

} // namespace Skyhook
