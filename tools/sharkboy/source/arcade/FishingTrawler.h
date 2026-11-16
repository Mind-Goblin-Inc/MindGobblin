#pragma once

#include <Arduino.h>
#include <Adafruit_ST7789.h>
#include <stdio.h>
#include <string.h>
#include "GameAPI.h"
#include "Hardware.h"
#include "MusicPlayer.h"
#include "MenuFooter.h"

// The launcher music system also owns the buzzers. Leave game SFX disabled by
// default so this game cannot fight background music. Set to 1 if you want the
// fishing cues and are not using launcher music at the same time.
#ifndef FISHING_TRAWLER_AUDIO
#define FISHING_TRAWLER_AUDIO 0
#endif

namespace FishingTrawler {

// -----------------------------------------------------------------------------
// Core state
// -----------------------------------------------------------------------------

enum GameState : uint8_t {
  STATE_READY,
  STATE_FISHING,
  STATE_TIMEOUT,
  STATE_TRANSITION,
  STATE_REVEAL,
  STATE_FINAL_SCORE
};

enum PlayMode : uint8_t {
  MODE_SINGLE_PLAYER = 1,
  MODE_TWO_PLAYER = 2
};

enum Species : uint8_t {
  BLUEGILL,
  YELLOW_PERCH,
  CRAPPIE,
  LARGEMOUTH_BASS,
  SMALLMOUTH_BASS,
  WALLEYE,
  CHANNEL_CATFISH,
  COMMON_CARP,
  NORTHERN_PIKE,
  MUSKY,
  SPECIES_COUNT
};

enum SilhouetteType : uint8_t {
  SIL_NORMAL,
  SIL_LONG,
  SIL_BULKY
};

struct SpeciesDef {
  const char *name;
  int16_t meanLengthTenths;
  int16_t deviationTenths;
  int16_t minLengthTenths;
  int16_t maxLengthTenths;
  uint16_t baseValue;
  uint8_t spawnWeight;
  uint8_t preferredDepth;
  uint8_t silhouetteType;
  uint16_t colorA;
  uint16_t colorB;
};

struct Fish {
  bool active;
  uint8_t species;
  int16_t x;
  int16_t y;
  int16_t lengthTenths;
  int16_t vxTenths;       // tenths of pixels / second
  int8_t verticalDrift;
  uint8_t phase;
  uint16_t phaseAccumMs;  // advances wander from real elapsed time, not loop count
  uint8_t schoolId;
  uint8_t apparentDepth;
  int16_t baseY;
  int32_t xMilli;         // fixed-point screen X for smooth slow movement
};

struct CatchFish {
  uint8_t species;
  int16_t lengthTenths;
  uint16_t value;
};

struct PlayerState {
  int16_t targetY;
  int32_t targetYMilli;   // fixed-point depth so movement is independent of loop frequency
  int16_t netY;
  int16_t castTargetY;
  int16_t transitionFromY;
  uint8_t switchState;
  bool castActive;
  bool castResolutionPending;
  bool finalCast;
  bool secured;
  bool timedOut;
  bool hasMissMessage;
  uint32_t castStartedAt;
  uint32_t castDurationMs;
  uint32_t feedbackUntil;
  uint8_t catchCount;
  CatchFish catches[18];
  uint32_t totalValue;
};

struct ToneState {
  bool active;
  uint8_t pin;
  uint32_t endAt;
};

struct FishDirtyRect {
  int16_t x;
  int16_t y;
  int16_t w;
  int16_t h;
};

// -----------------------------------------------------------------------------
// Tuning
// -----------------------------------------------------------------------------

static constexpr uint8_t MAX_ACTIVE_FISH = 18;
static constexpr uint8_t MAX_CAUGHT_FISH = MAX_ACTIVE_FISH;
static constexpr uint8_t INITIAL_FISH_COUNT = 14;
static constexpr uint8_t TARGET_FISH_COUNT = 14;

static constexpr uint32_t ROUND_LENGTH_MS = 60000;
static constexpr uint32_t CAST_MIN_MS = 450;
static constexpr uint32_t CAST_MAX_MS = 950;
static constexpr uint32_t MISS_FEEDBACK_MS = 450;
static constexpr uint32_t MISS_HOLD_MS = 90;
static constexpr uint32_t TRANSITION_MS = 850;
static constexpr uint32_t NET_CINCH_MS = 120;
static constexpr uint32_t REVEAL_BEAT_MS = 1250;
static constexpr uint32_t FISH_REFILL_MS = 550;
static constexpr uint32_t RENDER_INTERVAL_US = 16667; // stable ~60 Hz visual cadence
static constexpr uint8_t MAX_FISH_DIRTY_RECTS = 42;
static constexpr uint16_t FISH_SCRATCH_PIXELS = 2048; // 4 KiB RGB565 off-screen composition

static constexpr int16_t SCREEN_W = 240;
static constexpr int16_t SCREEN_H = 320;
static constexpr int16_t WATER_TOP = 32;
static constexpr int16_t WATER_BOTTOM = 319;
static constexpr int16_t MIN_TARGET_Y = 70;
static constexpr int16_t MAX_TARGET_Y = 270;
static constexpr int16_t NET_CAPTURE_HALF_WIDTH = 18;
static constexpr int16_t NET_CAPTURE_HALF_HEIGHT = 10;
static constexpr int16_t P1_NET_X = 58;
static constexpr int16_t P2_NET_X = 182;
static constexpr int16_t SINGLE_NET_X = SCREEN_W / 2;
static constexpr int16_t DEPTH_SPEED_PX_PER_SEC = 86;

static constexpr uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) {
  return (uint16_t)(((uint16_t)(r & 0xF8) << 8) |
                    ((uint16_t)(g & 0xFC) << 3) |
                    ((uint16_t)b >> 3));
}

static constexpr uint16_t C_SKY_DARK    = rgb565(4, 10, 20);
static constexpr uint16_t C_WATER_TOP   = rgb565(7, 58, 88);
static constexpr uint16_t C_WATER_MID   = rgb565(5, 42, 68);
static constexpr uint16_t C_WATER_DEEP  = rgb565(3, 27, 49);
static constexpr uint16_t C_WATER_LINE  = rgb565(33, 111, 139);
static constexpr uint16_t C_ROCK        = rgb565(43, 54, 62);
static constexpr uint16_t C_ROCK_LIGHT  = rgb565(70, 84, 89);
static constexpr uint16_t C_WEED        = rgb565(25, 93, 68);
static constexpr uint16_t C_WEED_DARK   = rgb565(15, 60, 48);
static constexpr uint16_t C_FISH        = rgb565(19, 30, 37);
static constexpr uint16_t C_FISH_EDGE   = rgb565(57, 75, 80);
static constexpr uint16_t C_P1          = rgb565(40, 205, 255);
static constexpr uint16_t C_P1_DIM      = rgb565(18, 98, 130);
static constexpr uint16_t C_P2          = rgb565(255, 102, 178);
static constexpr uint16_t C_P2_DIM      = rgb565(132, 47, 91);
static constexpr uint16_t C_WARNING     = rgb565(255, 226, 72);
static constexpr uint16_t C_PANEL       = rgb565(8, 17, 29);
static constexpr uint16_t C_PANEL_2     = rgb565(14, 28, 43);
static constexpr uint16_t C_TEXT_DIM    = rgb565(144, 163, 173);

static const SpeciesDef SPECIES[SPECIES_COUNT] = {
  {"BLUEGILL",    80, 15,  45, 120,   5, 28, 0, SIL_BULKY, rgb565(72,160,155),  rgb565(229,181,66)},
  {"YELLOW PERCH",100, 18,  60, 150,   7, 22, 1, SIL_NORMAL,rgb565(221,191,55),  rgb565(55,92,45)},
  {"CRAPPIE",    110, 20,  70, 170,   9, 18, 1, SIL_BULKY, rgb565(181,196,187), rgb565(56,72,70)},
  {"LARGEMOUTH", 180, 35, 100, 270,  28,  8, 1, SIL_BULKY, rgb565(81,143,75),   rgb565(222,213,145)},
  {"SMALLMOUTH", 170, 30, 100, 240,  31,  7, 1, SIL_NORMAL,rgb565(153,123,70),  rgb565(214,184,113)},
  {"WALLEYE",    220, 40, 130, 320,  48,  6, 2, SIL_LONG,  rgb565(139,154,75),  rgb565(234,214,77)},
  {"CATFISH",    270, 50, 150, 400,  38,  5, 2, SIL_LONG,  rgb565(100,113,117), rgb565(177,170,137)},
  {"COMMON CARP",290, 60, 160, 450,  24,  4, 2, SIL_BULKY, rgb565(181,128,57),  rgb565(221,176,78)},
  {"N. PIKE",    310, 55, 180, 450,  62,  3, 2, SIL_LONG,  rgb565(62,121,73),   rgb565(203,211,126)},
  {"MUSKY",      400, 70, 250, 550, 125,  1, 2, SIL_LONG,  rgb565(88,155,116),  rgb565(235,224,173)}
};

// -----------------------------------------------------------------------------
// Runtime storage
// -----------------------------------------------------------------------------

static GameState state = STATE_READY;
static PlayMode playMode = MODE_SINGLE_PLAYER;
static PlayerState players[2];
static Fish fish[MAX_ACTIVE_FISH];
static ToneState tones[2];

static uint32_t stateStartedAt = 0;
static uint32_t roundStartedAt = 0;
static uint32_t lastLogicAt = 0;
static uint32_t lastFrameAt = 0;       // slower presentation screens use milliseconds
static uint32_t lastFrameUs = 0;       // gameplay renderer uses microseconds for even cadence
static uint32_t lastFishRefillAt = 0;
static uint32_t revealBeatStartedAt = 0;
static uint8_t revealIndex = 0;
static uint8_t lastWarningSecond = 255;
static bool screenDirty = true;
// The opening title card must observe a full button release before a new press
// can start the round. This prevents the launcher/menu press used to enter the
// game from leaking through as either the start press or an immediate cast.
static bool startInputArmed = false;
static Fish prevFish[MAX_ACTIVE_FISH];
static PlayerState prevPlayers[2];
static bool previousDynamicFrameValid = false;

// Snapshot the exact visual state drawn last frame. This lets us erase only
// disappearing cable/basket/target pixels instead of repainting tall columns.
static int16_t prevNetEndY[2] = {0, 0};
static int16_t prevNetBodyY[2] = {0, 0};
static bool prevNetClosed[2] = {false, false};
static int16_t prevNetMouthHalf[2] = {15, 15};
static bool prevMissVisible[2] = {false, false};
static bool prevTargetVisible[2] = {false, false};
static int16_t prevTargetY[2] = {0, 0};

// HUD is persistent. Only values that actually change are repainted.
static uint8_t shownTimerSeconds = 255;
static uint8_t shownTimerPulse = 255;
static uint8_t shownPlayerStatus[2] = {255, 255};

// Fish and cleanup regions are composed off-screen, then blitted once. This
// prevents the TFT from ever showing the intermediate "erased fish" frame.
static uint16_t fishScratch[FISH_SCRATCH_PIXELS];
static FishDirtyRect fishScratchRect = {0, 0, 0, 0};
static FishDirtyRect fishDirty[MAX_FISH_DIRTY_RECTS];
static uint8_t fishDirtyCount = 0;

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

static int16_t clamp16(int16_t v, int16_t lo, int16_t hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

static uint16_t clampU16(uint32_t v) {
  return v > 65535UL ? 65535U : (uint16_t)v;
}

static uint8_t activePlayerCount() {
  return playMode == MODE_SINGLE_PLAYER ? 1U : 2U;
}

static bool playerIsActive(uint8_t playerIndex) {
  return playerIndex < activePlayerCount();
}

static int16_t playerNetX(uint8_t playerIndex) {
  if (playMode == MODE_SINGLE_PLAYER) return SINGLE_NET_X;
  return playerIndex == 0 ? P1_NET_X : P2_NET_X;
}

static uint16_t playerAccent(uint8_t playerIndex) {
  if (playMode == MODE_SINGLE_PLAYER) return ST77XX_WHITE;
  return playerIndex == 0 ? C_P1 : C_P2;
}

static uint16_t playerDimAccent(uint8_t playerIndex) {
  if (playMode == MODE_SINGLE_PLAYER) return rgb565(128, 142, 150);
  return playerIndex == 0 ? C_P1_DIM : C_P2_DIM;
}

static bool allActivePlayersSecured() {
  for (uint8_t i = 0; i < activePlayerCount(); ++i) {
    if (!players[i].secured) return false;
  }
  return true;
}

static int16_t randomRange(int16_t lo, int16_t hiInclusive) {
  if (hiInclusive <= lo) return lo;
  return (int16_t)random((long)lo, (long)hiInclusive + 1L);
}

static int16_t randomNormalTenths(const SpeciesDef &def) {
  int32_t sum = 0;
  for (uint8_t i = 0; i < 6; ++i) sum += random(0L, 1001L);
  const int32_t centered = sum - 3000L;
  int32_t value = (int32_t)def.meanLengthTenths +
                  (centered * (int32_t)def.deviationTenths) / 707L;
  if (value < def.minLengthTenths) value = def.minLengthTenths;
  if (value > def.maxLengthTenths) value = def.maxLengthTenths;
  return (int16_t)value;
}

static uint8_t chooseSpecies() {
  uint16_t total = 0;
  for (uint8_t i = 0; i < SPECIES_COUNT; ++i) total += SPECIES[i].spawnWeight;
  uint16_t roll = (uint16_t)random(0L, (long)total);
  for (uint8_t i = 0; i < SPECIES_COUNT; ++i) {
    if (roll < SPECIES[i].spawnWeight) return i;
    roll -= SPECIES[i].spawnWeight;
  }
  return BLUEGILL;
}

static uint16_t calculateFishValue(uint8_t speciesIndex, int16_t lengthTenths) {
  const SpeciesDef &def = SPECIES[speciesIndex];
  uint32_t value = ((uint32_t)def.baseValue * (uint32_t)lengthTenths +
                    (uint32_t)def.meanLengthTenths / 2U) /
                   (uint32_t)def.meanLengthTenths;
  if (value < 1U) value = 1U;
  return clampU16(value);
}

static uint8_t depthToBand(int16_t y) {
  if (y < 135) return 0;
  if (y < 205) return 1;
  return 2;
}

static int16_t bandRandomY(uint8_t band) {
  if (band == 0) return randomRange(76, 128);
  if (band == 1) return randomRange(138, 198);
  return randomRange(210, 277);
}

static int16_t depthToY(uint8_t depth0to100) {
  if (depth0to100 > 100) depth0to100 = 100;
  return MIN_TARGET_Y + ((MAX_TARGET_Y - MIN_TARGET_Y) * depth0to100) / 100;
}

static uint8_t yToDepthBand(int16_t y) {
  return depthToBand(y);
}

// -----------------------------------------------------------------------------
// Audio (compile-time optional)
// -----------------------------------------------------------------------------

static void queueTone(uint8_t pin, uint16_t frequency, uint16_t durationMs) {
#if FISHING_TRAWLER_AUDIO
  if (!Music::gameEffectsAllowed()) return;
  uint8_t slot = (pin == BUZZER_2_PIN) ? 0 : 1;
  tones[slot].active = true;
  tones[slot].pin = pin;
  tones[slot].endAt = millis() + durationMs;
  ledcWriteTone(pin, frequency);
#else
  (void)pin; (void)frequency; (void)durationMs;
#endif
}

static void updateAudio(uint32_t now) {
#if FISHING_TRAWLER_AUDIO
  if (!Music::gameEffectsAllowed()) { tones[0].active = tones[1].active = false; return; }
  for (uint8_t i = 0; i < 2; ++i) {
    if (tones[i].active && (int32_t)(now - tones[i].endAt) >= 0) {
      ledcWriteTone(tones[i].pin, 0);
      tones[i].active = false;
    }
  }
#else
  (void)now;
#endif
}

static void stopAudio() {
#if FISHING_TRAWLER_AUDIO
  if (Music::gameEffectsAllowed()) {
    ledcWriteTone(BUZZER_1_PIN, 0);
    ledcWriteTone(BUZZER_2_PIN, 0);
  }
#endif
  tones[0].active = false;
  tones[1].active = false;
}

// -----------------------------------------------------------------------------
// Input and player depth
// -----------------------------------------------------------------------------

static SwitchState readSwitchState(bool playerTwo) {
  const int upPin = playerTwo ? RIGHT_UP_PIN : LEFT_UP_PIN;
  const int downPin = playerTwo ? RIGHT_DOWN_PIN : LEFT_DOWN_PIN;
  const bool up = digitalRead(upPin) == LOW;
  const bool down = digitalRead(downPin) == LOW;
  if (up && !down) return SWITCH_UP;
  if (!up && down) return SWITCH_DOWN;
  if (!up && !down) return SWITCH_CENTER;
  return SWITCH_ERROR;
}

static SwitchState readSinglePlayerSwitchState() {
  const SwitchState left = readSwitchState(false);
  const SwitchState right = readSwitchState(true);
  const bool anyUp = left == SWITCH_UP || right == SWITCH_UP;
  const bool anyDown = left == SWITCH_DOWN || right == SWITCH_DOWN;

  if (anyUp && !anyDown) return SWITCH_UP;
  if (anyDown && !anyUp) return SWITCH_DOWN;
  // Opposing sticks cancel. Errors are treated as neutral unless the other
  // stick provides one unambiguous direction.
  return SWITCH_CENTER;
}

static void updateReadyModeSelection() {
  const SwitchState left = readSwitchState(false);
  const SwitchState right = readSwitchState(true);
  const bool anyUp = left == SWITCH_UP || right == SWITCH_UP;
  const bool anyDown = left == SWITCH_DOWN || right == SWITCH_DOWN;

  PlayMode next = playMode;
  if (anyUp && !anyDown) next = MODE_SINGLE_PLAYER;
  else if (anyDown && !anyUp) next = MODE_TWO_PLAYER;

  if (next != playMode) {
    playMode = next;
    screenDirty = true;
  }
}

static void updateDepth(PlayerState &p, uint8_t switchState, uint32_t dtMs) {
  if (p.secured || p.castActive || dtMs == 0) return;

  int8_t direction = 0;
  if (switchState == SWITCH_UP) direction = -1;
  else if (switchState == SWITCH_DOWN) direction = 1;
  if (!direction) return;

  p.targetYMilli += (int32_t)direction *
                    (int32_t)DEPTH_SPEED_PX_PER_SEC *
                    (int32_t)dtMs;

  const int32_t minMilli = (int32_t)MIN_TARGET_Y * 1000L;
  const int32_t maxMilli = (int32_t)MAX_TARGET_Y * 1000L;
  if (p.targetYMilli < minMilli) p.targetYMilli = minMilli;
  if (p.targetYMilli > maxMilli) p.targetYMilli = maxMilli;
  p.targetY = (int16_t)(p.targetYMilli / 1000L);
}

// -----------------------------------------------------------------------------
// Fish population
// -----------------------------------------------------------------------------

static uint8_t activeFishCount() {
  uint8_t count = 0;
  for (uint8_t i = 0; i < MAX_ACTIVE_FISH; ++i) if (fish[i].active) ++count;
  return count;
}

static int8_t findSchoolLeader(uint8_t schoolId) {
  if (!schoolId) return -1;
  for (uint8_t i = 0; i < MAX_ACTIVE_FISH; ++i) {
    if (fish[i].active && fish[i].schoolId == schoolId) return (int8_t)i;
  }
  return -1;
}

static void spawnFishAtSlot(uint8_t slot, int8_t forcedDirection = 0,
                            int8_t forcedBand = -1) {
  if (slot >= MAX_ACTIVE_FISH) return;

  Fish &f = fish[slot];
  const uint8_t speciesIndex = chooseSpecies();
  const SpeciesDef &def = SPECIES[speciesIndex];
  int8_t direction = forcedDirection;
  if (direction == 0) direction = random(0L, 2L) ? 1 : -1;

  uint8_t band = (forcedBand >= 0) ? (uint8_t)forcedBand : def.preferredDepth;
  if (forcedBand < 0 && random(0L, 100L) < 30L) {
    int8_t shift = (int8_t)random(-1L, 2L);
    int8_t candidate = (int8_t)band + shift;
    if (candidate < 0) candidate = 0;
    if (candidate > 2) candidate = 2;
    band = (uint8_t)candidate;
  }

  uint8_t schoolId = 0;
  if (speciesIndex <= CRAPPIE && random(0L, 100L) < 58L) {
    schoolId = (uint8_t)random(1L, 4L);
  }

  int16_t y = bandRandomY(band);
  int16_t speed = randomRange(230, 470); // 23..47 px/s

  const int8_t leader = findSchoolLeader(schoolId);
  if (leader >= 0) {
    y = clamp16((int16_t)(fish[leader].baseY + randomRange(-12, 12)), 74, 282);
    direction = fish[leader].vxTenths >= 0 ? 1 : -1;
    int16_t leaderSpeed = fish[leader].vxTenths;
    if (leaderSpeed < 0) leaderSpeed = -leaderSpeed;
    speed = clamp16((int16_t)(leaderSpeed + randomRange(-45, 45)), 210, 500);
  }

  const int16_t startX = direction > 0 ? randomRange(-24, -8) : randomRange(248, 266);

  f.active = true;
  f.species = speciesIndex;
  f.x = startX;
  f.y = y;
  f.lengthTenths = randomNormalTenths(def);
  f.vxTenths = (int16_t)(speed * direction);
  f.verticalDrift = (int8_t)randomRange(1, band == 2 ? 3 : 2);
  f.phase = (uint8_t)random(0L, 256L);
  f.phaseAccumMs = (uint16_t)random(0L, 12L);
  f.schoolId = schoolId;
  f.apparentDepth = yToDepthBand(y);
  f.baseY = y;
  f.xMilli = (int32_t)startX * 1000L;
}

static void resetFishPopulation() {
  for (uint8_t i = 0; i < MAX_ACTIVE_FISH; ++i) fish[i].active = false;

  for (uint8_t i = 0; i < INITIAL_FISH_COUNT; ++i) {
    const int8_t direction = (i & 1U) ? 1 : -1;
    const int8_t band = (i < 6) ? (int8_t)(i % 3) : -1;
    spawnFishAtSlot(i, direction, band);
    // Spread initial population across the screen instead of all entering at once.
    fish[i].x = randomRange(8, 232);
    fish[i].xMilli = (int32_t)fish[i].x * 1000L;
  }
  lastFishRefillAt = millis();
}

static void despawnFish(uint8_t slot) {
  if (slot < MAX_ACTIVE_FISH) fish[slot].active = false;
}

static void wrapOrRespawnFish(uint8_t slot) {
  if (slot >= MAX_ACTIVE_FISH || !fish[slot].active) return;
  const Fish &f = fish[slot];
  if ((f.vxTenths > 0 && f.x > SCREEN_W + 28) ||
      (f.vxTenths < 0 && f.x < -28)) {
    despawnFish(slot);
  }
}

static void maintainFishPopulation(uint32_t now) {
  if ((uint32_t)(now - lastFishRefillAt) < FISH_REFILL_MS) return;
  lastFishRefillAt = now;
  if (activeFishCount() >= TARGET_FISH_COUNT) return;
  for (uint8_t i = 0; i < MAX_ACTIVE_FISH; ++i) {
    if (!fish[i].active) {
      spawnFishAtSlot(i);
      break;
    }
  }
}

static void updateFish(uint32_t dtMs) {
  for (uint8_t i = 0; i < MAX_ACTIVE_FISH; ++i) {
    Fish &f = fish[i];
    if (!f.active) continue;

    // Horizontal movement is fixed-point and depends only on elapsed time.
    f.xMilli += ((int32_t)f.vxTenths * (int32_t)dtMs) / 10L;
    f.x = (int16_t)((f.xMilli >= 0) ? ((f.xMilli + 500L) / 1000L)
                                      : ((f.xMilli - 500L) / 1000L));

    // Advance the gentle vertical wander at a deterministic rate. The previous
    // implementation added at least one phase step every launcher loop, even
    // when dtMs was zero, so fish visibly jittered with loop frequency.
    f.phaseAccumMs = (uint16_t)(f.phaseAccumMs + dtMs);
    while (f.phaseAccumMs >= 12U) {
      f.phaseAccumMs = (uint16_t)(f.phaseAccumMs - 12U);
      ++f.phase;
    }

    int16_t tri = (f.phase < 128U) ? (int16_t)f.phase : (int16_t)(255U - f.phase);
    tri -= 64;
    f.y = clamp16((int16_t)(f.baseY + (tri * f.verticalDrift) / 12), 66, 286);

    wrapOrRespawnFish(i);
  }
}

// -----------------------------------------------------------------------------
// Cast lifecycle and collision ownership
// -----------------------------------------------------------------------------

static uint32_t castDurationForY(int16_t y) {
  const int32_t span = MAX_TARGET_Y - MIN_TARGET_Y;
  const int32_t pos = clamp16(y, MIN_TARGET_Y, MAX_TARGET_Y) - MIN_TARGET_Y;
  return CAST_MIN_MS + (uint32_t)((CAST_MAX_MS - CAST_MIN_MS) * pos / span);
}

static void beginCast(PlayerState &p, uint8_t playerIndex, uint32_t now,
                      bool finalCast) {
  if (p.secured || p.castActive) return;
  p.castActive = true;
  p.castResolutionPending = false;
  p.finalCast = finalCast;
  p.castStartedAt = now;
  p.castTargetY = p.targetY;
  p.netY = WATER_TOP + 2;
  p.castDurationMs = castDurationForY(p.castTargetY);
  p.hasMissMessage = false;
  queueTone(playerIndex == 0 ? BUZZER_2_PIN : BUZZER_1_PIN,
            playerIndex == 0 ? 610 : 760, 45);
}

static void tryStartCast(PlayerState &p, uint8_t playerIndex,
                         bool pressed, uint32_t now) {
  if (!pressed || p.secured || p.castActive || state != STATE_FISHING) return;
  beginCast(p, playerIndex, now, false);
}

static void updateCast(PlayerState &p, uint32_t now) {
  if (!p.castActive || p.castResolutionPending) return;
  const uint32_t elapsed = now - p.castStartedAt;
  if (elapsed >= p.castDurationMs) {
    p.netY = p.castTargetY;
    p.castResolutionPending = true;
    return;
  }

  // A weighted basket should not look like it is sliding down a ruler.  Use a
  // simple ease-out curve: it falls decisively at first, then water drag makes
  // the final approach to the selected depth settle more gently.
  const int32_t travel = p.castTargetY - (WATER_TOP + 2);
  const int32_t t = (int32_t)((elapsed * 1024UL) / p.castDurationMs); // 0..1023
  const int32_t eased = (t * (2048L - t)) / 1024L;                  // 0..1024
  p.netY = (int16_t)((WATER_TOP + 2) + (travel * eased) / 1024L);
}

static int16_t fishVisualWidth(const Fish &f) {
  int16_t w = 7 + f.lengthTenths / 28;
  if (f.species == COMMON_CARP) w += 2;
  return clamp16(w, 9, 28);
}

static int16_t fishVisualHeight(const Fish &f) {
  const uint8_t type = SPECIES[f.species].silhouetteType;
  int16_t h = (type == SIL_BULKY) ? 8 : (type == SIL_LONG ? 5 : 6);
  h += f.lengthTenths / 110;
  return clamp16(h, 5, 13);
}

static bool fishOverlapsNet(const Fish &f, int16_t netX, int16_t netY) {
  const int16_t halfFishW = fishVisualWidth(f) / 2;
  const int16_t halfFishH = fishVisualHeight(f) / 2;
  const int16_t dx = f.x > netX ? f.x - netX : netX - f.x;
  const int16_t dy = f.y > netY ? f.y - netY : netY - f.y;
  return dx <= NET_CAPTURE_HALF_WIDTH + halfFishW &&
         dy <= NET_CAPTURE_HALF_HEIGHT + halfFishH;
}

static void finishMiss(PlayerState &p, uint8_t playerIndex, uint32_t now) {
  p.castActive = false;
  p.castResolutionPending = false;
  p.netY = p.castTargetY;
  p.hasMissMessage = true;
  p.feedbackUntil = now + MISS_FEEDBACK_MS;
  if (p.finalCast) {
    p.secured = true;  // final timeout miss intentionally locks in a $0 result
    p.timedOut = true;
  }
  queueTone(playerIndex == 0 ? BUZZER_2_PIN : BUZZER_1_PIN, 180, 80);
}

static void updateMissReturn(PlayerState &p, uint32_t now) {
  if (!p.hasMissMessage || p.secured) return;

  if ((int32_t)(now - p.feedbackUntil) >= 0) {
    p.hasMissMessage = false;
    p.netY = WATER_TOP + 2;
    return;
  }

  const uint32_t startedAt = p.feedbackUntil - MISS_FEEDBACK_MS;
  const uint32_t elapsed = now - startedAt;
  if (elapsed <= MISS_HOLD_MS) {
    p.netY = p.castTargetY;
    return;
  }

  const uint32_t returnDuration = MISS_FEEDBACK_MS - MISS_HOLD_MS;
  uint32_t returnElapsed = elapsed - MISS_HOLD_MS;
  if (returnElapsed > returnDuration) returnElapsed = returnDuration;

  // Smoothstep makes the recovery feel like a winch taking up slack, then
  // pulling steadily before easing the basket into its parked position.
  const int32_t t = (int32_t)((returnElapsed * 1024UL) / returnDuration);
  const int32_t t2 = (t * t) / 1024L;
  const int32_t smooth = (t2 * (3072L - 2L * t)) / 1024L;
  const int32_t travel = p.castTargetY - (WATER_TOP + 2);
  p.netY = (int16_t)(p.castTargetY - (travel * smooth) / 1024L);
}

static void secureCatch(PlayerState &p, uint8_t playerIndex, uint32_t now,
                        uint8_t newlyCaught) {
  (void)now;
  p.castActive = false;
  p.castResolutionPending = false;
  p.secured = true;
  p.hasMissMessage = false;
  if (newlyCaught) {
    queueTone(playerIndex == 0 ? BUZZER_2_PIN : BUZZER_1_PIN, 980, 120);
  }
}

static uint8_t assignContestedFish() {
  return (uint8_t)random(0L, 2L);
}

static void resolveCast(PlayerState &p, uint8_t playerIndex, uint32_t now,
                        uint8_t newlyCaught) {
  if (newlyCaught) secureCatch(p, playerIndex, now, newlyCaught);
  else finishMiss(p, playerIndex, now);
}

static void resolveBothCastsIfReady(uint32_t now) {
  const bool p1Ready = players[0].castActive && players[0].castResolutionPending;
  const bool p2Ready = playerIsActive(1) &&
                       players[1].castActive && players[1].castResolutionPending;
  if (!p1Ready && !p2Ready) return;

  uint8_t caughtThisResolution[2] = {0, 0};

  // Build ownership from the union of all active eligible nets before mutating
  // fish. In single-player there is only the centered white net, so contested
  // ownership disappears naturally.
  for (uint8_t i = 0; i < MAX_ACTIVE_FISH; ++i) {
    Fish &f = fish[i];
    if (!f.active) continue;

    const bool eligible1 = p1Ready &&
                           fishOverlapsNet(f, playerNetX(0), players[0].castTargetY);
    const bool eligible2 = p2Ready &&
                           fishOverlapsNet(f, playerNetX(1), players[1].castTargetY);
    if (!eligible1 && !eligible2) continue;

    uint8_t owner = 0;
    if (eligible1 && eligible2) owner = assignContestedFish();
    else owner = eligible2 ? 1U : 0U;

    PlayerState &p = players[owner];
    if (p.catchCount < MAX_CAUGHT_FISH) {
      CatchFish &c = p.catches[p.catchCount++];
      c.species = f.species;
      c.lengthTenths = f.lengthTenths;
      c.value = calculateFishValue(f.species, f.lengthTenths);
      p.totalValue += c.value;
      ++caughtThisResolution[owner];
      f.active = false;
    }
  }

  if (p1Ready) resolveCast(players[0], 0, now, caughtThisResolution[0]);
  if (p2Ready) resolveCast(players[1], 1, now, caughtThisResolution[1]);
}

// -----------------------------------------------------------------------------
// Game-state transitions
// -----------------------------------------------------------------------------

static void setState(GameState next, uint32_t now) {
  state = next;
  stateStartedAt = now;
  screenDirty = true;
}

static void clearPlayer(PlayerState &p) {
  p.targetY = depthToY(50);
  p.targetYMilli = (int32_t)p.targetY * 1000L;
  p.netY = WATER_TOP + 2;
  p.castTargetY = p.targetY;
  p.transitionFromY = p.netY;
  p.switchState = SWITCH_CENTER;
  p.castActive = false;
  p.castResolutionPending = false;
  p.finalCast = false;
  p.secured = false;
  p.timedOut = false;
  p.hasMissMessage = false;
  p.castStartedAt = 0;
  p.castDurationMs = 0;
  p.feedbackUntil = 0;
  p.catchCount = 0;
  p.totalValue = 0;
  for (uint8_t i = 0; i < MAX_CAUGHT_FISH; ++i) {
    p.catches[i].species = BLUEGILL;
    p.catches[i].lengthTenths = 0;
    p.catches[i].value = 0;
  }
}

static void resetRound(uint32_t now) {
  clearPlayer(players[0]);
  clearPlayer(players[1]);
  for (uint8_t i = 0; i < MAX_ACTIVE_FISH; ++i) fish[i].active = false;
  startInputArmed = false;
  revealIndex = 0;
  revealBeatStartedAt = 0;
  lastWarningSecond = 255;
  roundStartedAt = 0;
  lastFishRefillAt = now;
  lastLogicAt = now;
  lastFrameAt = 0;
  lastFrameUs = 0;
  stopAudio();
  previousDynamicFrameValid = false;
  shownTimerSeconds = 255;
  shownTimerPulse = 255;
  shownPlayerStatus[0] = 255;
  shownPlayerStatus[1] = 255;
}

static void beginFishing(uint32_t now) {
  resetFishPopulation();
  roundStartedAt = now;
  lastWarningSecond = 255;
  setState(STATE_FISHING, now);
  queueTone(BUZZER_2_PIN, 780, 50);
  queueTone(BUZZER_1_PIN, 980, 50);
}

static void beginTimeout(uint32_t now) {
  setState(STATE_TIMEOUT, now);

  // Timeout cancels any ordinary cast and grants exactly one final forced cast
  // for every active player at their current selected depth.
  for (uint8_t i = 0; i < activePlayerCount(); ++i) {
    PlayerState &p = players[i];
    if (p.secured) continue;
    p.castActive = false;
    p.castResolutionPending = false;
    p.finalCast = true;
    p.timedOut = true;
    beginCast(p, i, now, true);
  }
}

static void beginTransition(uint32_t now) {
  for (uint8_t i = 0; i < activePlayerCount(); ++i) {
    players[i].transitionFromY = players[i].netY;
    players[i].castActive = false;
    players[i].castResolutionPending = false;
  }
  setState(STATE_TRANSITION, now);
}

static void beginReveal(uint32_t now) {
  revealIndex = 0;
  revealBeatStartedAt = now;
  setState(STATE_REVEAL, now);
}

static uint8_t maxCatchCount() {
  if (playMode == MODE_SINGLE_PLAYER) return players[0].catchCount;
  return players[0].catchCount > players[1].catchCount ?
         players[0].catchCount : players[1].catchCount;
}

static void beginFinalScore(uint32_t now) {
  // FINAL_SCORE is the persistent combined results screen. It remains visible
  // until LEFT chooses Menu or RIGHT chooses Replay.
  setState(STATE_FINAL_SCORE, now);
  queueTone(BUZZER_2_PIN, 880, 120);
  if (playMode == MODE_TWO_PLAYER) queueTone(BUZZER_1_PIN, 1040, 120);
}

// -----------------------------------------------------------------------------
// Rendering primitives
// -----------------------------------------------------------------------------

static void drawLakeBackground() {
  display.fillRect(0, WATER_TOP, SCREEN_W, 92, C_WATER_TOP);
  display.fillRect(0, 124, SCREEN_W, 88, C_WATER_MID);
  display.fillRect(0, 212, SCREEN_W, SCREEN_H - 212, C_WATER_DEEP);

  // Surface ripple accents.
  display.drawFastHLine(0, WATER_TOP, SCREEN_W, rgb565(75, 171, 190));
  display.drawFastHLine(14, 39, 47, C_WATER_LINE);
  display.drawFastHLine(83, 43, 34, C_WATER_LINE);
  display.drawFastHLine(146, 38, 61, C_WATER_LINE);
  display.drawFastHLine(194, 47, 30, C_WATER_LINE);

  // Very faint horizontal depth bands.
  display.drawFastHLine(0, 134, SCREEN_W, rgb565(8, 65, 89));
  display.drawFastHLine(0, 205, SCREEN_W, rgb565(7, 48, 70));
}

static void drawEnvironment() {
  // Bottom rocks.
  display.fillCircle(18, 311, 13, C_ROCK);
  display.fillCircle(37, 316, 18, C_ROCK);
  display.fillCircle(216, 313, 17, C_ROCK);
  display.fillCircle(198, 318, 14, C_ROCK);
  display.drawFastHLine(7, 302, 20, C_ROCK_LIGHT);
  display.drawFastHLine(205, 300, 20, C_ROCK_LIGHT);

  // Submerged branch.
  display.drawLine(112, 263, 149, 285, C_ROCK_LIGHT);
  display.drawLine(135, 276, 151, 264, C_ROCK_LIGHT);
  display.drawLine(120, 268, 119, 251, C_ROCK_LIGHT);

  // Weeds.
  const int16_t weedXs[] = {66, 75, 165, 174, 226};
  for (uint8_t i = 0; i < 5; ++i) {
    int16_t x = weedXs[i];
    display.drawLine(x, 319, x - 2, 294, C_WEED_DARK);
    display.drawLine(x - 2, 303, x - 8, 292, C_WEED);
    display.drawLine(x - 1, 310, x + 6, 298, C_WEED);
  }

  // Sparse bubbles.
  display.drawCircle(26, 179, 2, C_WATER_LINE);
  display.drawCircle(31, 165, 1, C_WATER_LINE);
  display.drawCircle(215, 149, 2, C_WATER_LINE);
  display.drawCircle(207, 136, 1, C_WATER_LINE);
  display.drawCircle(108, 224, 1, C_WATER_LINE);
}

static void drawFishSilhouette(const Fish &f) {
  if (!f.active) return;
  const int16_t w = fishVisualWidth(f);
  const int16_t h = fishVisualHeight(f);
  const int16_t x = f.x;
  const int16_t y = f.y;
  if (x < -w - 4 || x > SCREEN_W + w + 4) return;

  const bool right = f.vxTenths > 0;
  const int16_t noseX = right ? x + w / 2 : x - w / 2;
  const int16_t tailX = right ? x - w / 2 : x + w / 2;
  const int16_t tailTip = right ? tailX - 5 : tailX + 5;
  const uint8_t type = SPECIES[f.species].silhouetteType;

  if (type == SIL_BULKY) {
    display.fillCircle(x, y, h / 2, C_FISH);
    display.fillRect(x - w / 3, y - h / 2, (w * 2) / 3, h, C_FISH);
  } else if (type == SIL_LONG) {
    display.fillRect(x - w / 2, y - h / 2, w, h, C_FISH);
    display.fillCircle(noseX, y, h / 2, C_FISH);
  } else {
    display.fillRect(x - w / 3, y - h / 2, (w * 2) / 3, h, C_FISH);
    display.fillCircle(x, y, h / 2, C_FISH);
  }

  display.fillTriangle(tailX, y,
                       tailTip, y - h / 2 - 2,
                       tailTip, y + h / 2 + 2,
                       C_FISH);
  display.drawPixel(noseX, y - 1, C_FISH_EDGE);
}

static void drawPlayerTarget(uint8_t playerIndex) {
  if (!playerIsActive(playerIndex)) return;
  const PlayerState &p = players[playerIndex];
  if (p.secured) return;

  const int16_t x = playerNetX(playerIndex);
  const uint16_t accent = playerAccent(playerIndex);
  const uint16_t dim = playerDimAccent(playerIndex);
  const int16_t halfW = NET_CAPTURE_HALF_WIDTH;
  const int16_t halfH = NET_CAPTURE_HALF_HEIGHT;
  const int16_t arm = 6;

  display.drawFastHLine(x - halfW, p.targetY - halfH, arm, accent);
  display.drawFastVLine(x - halfW, p.targetY - halfH, arm, accent);
  display.drawFastHLine(x + halfW - arm + 1, p.targetY - halfH, arm, accent);
  display.drawFastVLine(x + halfW, p.targetY - halfH, arm, accent);
  display.drawFastHLine(x - halfW, p.targetY + halfH, arm, accent);
  display.drawFastVLine(x - halfW, p.targetY + halfH - arm + 1, arm, accent);
  display.drawFastHLine(x + halfW - arm + 1, p.targetY + halfH, arm, accent);
  display.drawFastVLine(x + halfW, p.targetY + halfH - arm + 1, arm, accent);

  display.drawFastHLine(x - 8, p.targetY, 17, dim);
  display.drawFastVLine(x, p.targetY - 5, 11, dim);

  display.drawLine(x, p.targetY - 3, x + 3, p.targetY, ST77XX_WHITE);
  display.drawLine(x + 3, p.targetY, x, p.targetY + 3, ST77XX_WHITE);
  display.drawLine(x, p.targetY + 3, x - 3, p.targetY, ST77XX_WHITE);
  display.drawLine(x - 3, p.targetY, x, p.targetY - 3, ST77XX_WHITE);
}

static int16_t netOpenHalfWidth(const PlayerState &p, uint32_t now) {
  if (p.secured || state == STATE_TRANSITION) return 4;
  if (!p.castActive) return 16;
  if (!p.castDurationMs) return 16;

  uint32_t elapsed = now - p.castStartedAt;
  if (elapsed > p.castDurationMs) elapsed = p.castDurationMs;

  // This is a lift/drop net rather than a hanging sack: the lower rim is the
  // broad catching opening.  It starts folded beneath the bridle and flares
  // outward as the weights pull the corners apart during the descent.
  const uint32_t openMs = (p.castDurationMs * 2U) / 3U;
  if (elapsed >= openMs || openMs == 0U) return NET_CAPTURE_HALF_WIDTH;
  return (int16_t)(6 + ((NET_CAPTURE_HALF_WIDTH - 6L) * (int32_t)elapsed) /
                         (int32_t)openMs);
}

static void drawNetShape(int16_t x, int16_t y, uint16_t color,
                         int16_t openingHalf, bool closed) {
  const int16_t bridleY = y - 12;
  const int16_t shoulderY = y - 6;
  const int16_t bottomY = y + 9;
  const int16_t shoulderHalf = closed ? 3 : clamp16((int16_t)(openingHalf / 2), 4, 9);
  const int16_t bottomHalf = closed ? 3 : openingHalf;

  // Cable -> short bridle -> narrow upper shoulders.  Keeping the top compact
  // makes the lower flare read clearly as the actual catching opening.
  display.drawLine(x, bridleY, x - shoulderHalf, shoulderY, color);
  display.drawLine(x, bridleY, x + shoulderHalf, shoulderY, color);
  display.drawFastHLine(x - shoulderHalf, shoulderY,
                        shoulderHalf * 2 + 1, color);

  // The mesh flares OUTWARD toward the bottom.  This is the key silhouette:
  // narrow at the suspension point, broad at the weighted lower rim.
  display.drawLine(x - shoulderHalf, shoulderY, x - bottomHalf, bottomY, color);
  display.drawLine(x + shoulderHalf, shoulderY, x + bottomHalf, bottomY, color);

  if (closed) {
    // On a catch the lower opening cinches into a compact bundle before haul-up.
    display.drawLine(x - shoulderHalf, shoulderY + 1, x + bottomHalf, bottomY - 1, color);
    display.drawLine(x + shoulderHalf, shoulderY + 1, x - bottomHalf, bottomY - 1, color);
    display.fillCircle(x, bottomY, 2, color);
  } else {
    // Broad double lower rim: visually the heaviest part of the net and the
    // part the player should read as passing around the target fish.
    display.drawFastHLine(x - bottomHalf, bottomY, bottomHalf * 2 + 1, color);
    if (bottomHalf >= 10) {
      display.drawFastHLine(x - bottomHalf + 2, bottomY - 1,
                            bottomHalf * 2 - 3, color);
    }

    // Sparse converging mesh gives depth without filling the water with pixels.
    display.drawLine(x - shoulderHalf + 2, shoulderY + 2,
                     x - bottomHalf / 2, bottomY - 2, color);
    display.drawLine(x + shoulderHalf - 2, shoulderY + 2,
                     x + bottomHalf / 2, bottomY - 2, color);
    display.drawLine(x - shoulderHalf, shoulderY + 3,
                     x + bottomHalf - 3, bottomY - 2, color);
    display.drawLine(x + shoulderHalf, shoulderY + 3,
                     x - bottomHalf + 3, bottomY - 2, color);
    display.drawFastHLine(x - clamp16((int16_t)(bottomHalf - 5), 3, 13), y + 3,
                          clamp16((int16_t)((bottomHalf - 5) * 2 + 1), 7, 27), color);

    // Corner weights explain why the lower rim stays spread underwater.
    display.fillCircle(x - bottomHalf, bottomY + 1, 1, color);
    display.fillCircle(x + bottomHalf, bottomY + 1, 1, color);
  }
}

static void drawNet(uint8_t playerIndex, uint32_t now) {
  if (!playerIsActive(playerIndex)) return;
  PlayerState &p = players[playerIndex];
  const int16_t x = playerNetX(playerIndex);
  const uint16_t color = playerAccent(playerIndex);
  const bool deployed = p.castActive || p.secured ||
                        (p.hasMissMessage && (int32_t)(p.feedbackUntil - now) > 0) ||
                        state == STATE_TRANSITION;
  const int16_t bodyY = deployed ? p.netY : (WATER_TOP + 15);
  const int16_t cableEndY = bodyY - 12;
  const int16_t mouthHalf = deployed ? netOpenHalfWidth(p, now) : 15;
  const bool closed = p.secured || state == STATE_TRANSITION;

  display.drawFastVLine(x, WATER_TOP,
                        clamp16((int16_t)(cableEndY - WATER_TOP + 1), 1,
                                SCREEN_H - WATER_TOP),
                        color);
  drawNetShape(x, bodyY, color, mouthHalf, closed);

  if (p.hasMissMessage && (int32_t)(p.feedbackUntil - now) > 0) {
    display.setTextSize(1);
    display.setTextColor(C_WARNING);
    display.setCursor(x - 12, clamp16((int16_t)(p.castTargetY + 15), WATER_TOP + 4, 306));
    display.print("MISS");
  }
}

static uint8_t timerSecondsRemaining(uint32_t now) {
  uint32_t elapsed = roundStartedAt ? now - roundStartedAt : 0;
  if (elapsed > ROUND_LENGTH_MS) elapsed = ROUND_LENGTH_MS;
  const uint32_t remainingMs = ROUND_LENGTH_MS - elapsed;
  return (uint8_t)((remainingMs + 999U) / 1000U);
}

static uint8_t playerHudStatus(uint8_t playerIndex) {
  const PlayerState &p = players[playerIndex];
  if (p.secured) return p.catchCount ? 2U : 3U; // LOCKED / $0 LOCK
  if (p.castActive) return state == STATE_TIMEOUT ? 4U : 1U; // FINAL / NET...
  return 0U; // READY
}

static void drawHudBase() {
  display.fillRect(0, 0, SCREEN_W, WATER_TOP, C_PANEL);

  if (playMode == MODE_SINGLE_PLAYER) {
    display.drawFastHLine(0, WATER_TOP - 1, SCREEN_W, C_PANEL_2);
    return;
  }

  display.drawFastVLine(119, 0, WATER_TOP, C_PANEL_2);
  display.setTextSize(1);
  display.setTextColor(C_P1);
  display.setCursor(4, 3);
  display.print("P1");
  display.setTextColor(C_P2);
  display.setCursor(220, 3);
  display.print("P2");
}

static void drawTimerValue(uint32_t now, bool force) {
  const uint8_t seconds = timerSecondsRemaining(now);
  const uint8_t pulse = (seconds <= 10U) ? (uint8_t)((now / 250U) & 1U) : 0U;

  if (!force && seconds == shownTimerSeconds && pulse == shownTimerPulse) return;

  shownTimerSeconds = seconds;
  shownTimerPulse = pulse;

  if (playMode == MODE_SINGLE_PLAYER) display.fillRect(82, 2, 76, 19, C_PANEL);
  else display.fillRect(82, 3, 76, 25, C_PANEL);

  uint16_t color = ST77XX_WHITE;
  if (seconds <= 10U && pulse) color = C_WARNING;

  if (seconds <= 10U && seconds != lastWarningSecond) {
    lastWarningSecond = seconds;
    if (seconds > 0U) {
      queueTone(BUZZER_2_PIN, 520 + seconds * 10, 35);
      queueTone(BUZZER_1_PIN, 620 + seconds * 10, 35);
    }
  }

  display.setTextSize(2);
  display.setTextColor(color);
  display.setCursor(92, playMode == MODE_SINGLE_PLAYER ? 3 : 8);
  display.print("0:");
  if (seconds < 10U) display.print('0');
  display.print(seconds);
}

static void drawPlayerStatusValue(uint8_t playerIndex, bool force) {
  if (!playerIsActive(playerIndex)) return;
  const uint8_t status = playerHudStatus(playerIndex);
  if (!force && shownPlayerStatus[playerIndex] == status) return;
  shownPlayerStatus[playerIndex] = status;

  if (playMode == MODE_SINGLE_PLAYER) {
    display.fillRect(76, 21, 88, 10, C_PANEL);
    display.setTextSize(1);
    switch (status) {
      case 1:
        display.setTextColor(C_TEXT_DIM); display.setCursor(102, 22); display.print("NET..."); break;
      case 2:
        display.setTextColor(ST77XX_WHITE); display.setCursor(102, 22); display.print("LOCKED"); break;
      case 3:
        display.setTextColor(ST77XX_WHITE); display.setCursor(99, 22); display.print("$0 LOCK"); break;
      case 4:
        display.setTextColor(C_WARNING); display.setCursor(105, 22); display.print("FINAL"); break;
      default:
        display.setTextColor(C_TEXT_DIM); display.setCursor(105, 22); display.print("READY"); break;
    }
    return;
  }

  const int16_t x = playerIndex == 0 ? 0 : 174;
  const int16_t cursorX = playerIndex == 0 ? 4 : 187;
  const uint16_t accent = playerAccent(playerIndex);

  display.fillRect(x, 16, 66, 16, C_PANEL);
  display.setTextSize(1);
  display.setCursor(cursorX, 19);

  switch (status) {
    case 1: display.setTextColor(C_TEXT_DIM); display.print("NET..."); break;
    case 2: display.setTextColor(accent); display.print("LOCKED"); break;
    case 3: display.setTextColor(accent); display.print("$0 LOCK"); break;
    case 4: display.setTextColor(C_WARNING); display.print("FINAL"); break;
    default: display.setTextColor(C_TEXT_DIM); display.print("READY"); break;
  }
}

static void drawFishingHud(uint32_t now, bool force) {
  if (force) {
    drawHudBase();
    shownTimerSeconds = 255;
    shownTimerPulse = 255;
    shownPlayerStatus[0] = 255;
    shownPlayerStatus[1] = 255;
  }

  drawTimerValue(now, force);
  drawPlayerStatusValue(0, force);
  if (playMode == MODE_TWO_PLAYER) drawPlayerStatusValue(1, force);
}

static bool rectsIntersect(int16_t ax, int16_t ay, int16_t aw, int16_t ah,
                           int16_t bx, int16_t by, int16_t bw, int16_t bh) {
  return !(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay);
}

static void fillWaterRegion(int16_t x, int16_t y, int16_t w, int16_t h) {
  if (w <= 0 || h <= 0) return;
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (x + w > SCREEN_W) w = SCREEN_W - x;
  if (y < WATER_TOP) {
    h -= (WATER_TOP - y);
    y = WATER_TOP;
  }
  if (y + h > SCREEN_H) h = SCREEN_H - y;
  if (w <= 0 || h <= 0) return;

  int16_t y0 = y;
  int16_t y1 = y + h;

  if (y0 < 124) {
    int16_t segH = (y1 < 124 ? y1 : 124) - y0;
    if (segH > 0) display.fillRect(x, y0, w, segH, C_WATER_TOP);
    y0 = 124;
  }
  if (y0 < 212 && y1 > 124) {
    int16_t segY = y0 < 124 ? 124 : y0;
    int16_t segH = (y1 < 212 ? y1 : 212) - segY;
    if (segH > 0) display.fillRect(x, segY, w, segH, C_WATER_MID);
    y0 = 212;
  }
  if (y1 > 212) {
    int16_t segY = y < 212 ? 212 : y;
    int16_t segH = y1 - segY;
    if (segH > 0) display.fillRect(x, segY, w, segH, C_WATER_DEEP);
  }

  if (y <= WATER_TOP && y + h > WATER_TOP) display.drawFastHLine(x, WATER_TOP, w, rgb565(75, 171, 190));
  if (y <= 39 && y + h > 39 && rectsIntersect(x, y, w, h, 14, 39, 47, 1)) display.drawFastHLine(14, 39, 47, C_WATER_LINE);
  if (y <= 43 && y + h > 43 && rectsIntersect(x, y, w, h, 83, 43, 34, 1)) display.drawFastHLine(83, 43, 34, C_WATER_LINE);
  if (y <= 38 && y + h > 38 && rectsIntersect(x, y, w, h, 146, 38, 61, 1)) display.drawFastHLine(146, 38, 61, C_WATER_LINE);
  if (y <= 47 && y + h > 47 && rectsIntersect(x, y, w, h, 194, 47, 30, 1)) display.drawFastHLine(194, 47, 30, C_WATER_LINE);
  if (y <= 134 && y + h > 134) display.drawFastHLine(x, 134, w, rgb565(8, 65, 89));
  if (y <= 205 && y + h > 205) display.drawFastHLine(x, 205, w, rgb565(7, 48, 70));
}

static void redrawEnvironmentInRegion(int16_t x, int16_t y, int16_t w, int16_t h) {
  if (rectsIntersect(x, y, w, h, 5, 289, 50, 35)) {
    display.fillCircle(18, 311, 13, C_ROCK);
    display.fillCircle(37, 316, 18, C_ROCK);
    display.drawFastHLine(7, 302, 20, C_ROCK_LIGHT);
  }
  if (rectsIntersect(x, y, w, h, 181, 286, 52, 36)) {
    display.fillCircle(216, 313, 17, C_ROCK);
    display.fillCircle(198, 318, 14, C_ROCK);
    display.drawFastHLine(205, 300, 20, C_ROCK_LIGHT);
  }
  if (rectsIntersect(x, y, w, h, 112, 251, 40, 35)) {
    display.drawLine(112, 263, 149, 285, C_ROCK_LIGHT);
    display.drawLine(135, 276, 151, 264, C_ROCK_LIGHT);
    display.drawLine(120, 268, 119, 251, C_ROCK_LIGHT);
  }

  const int16_t weedXs[] = {66, 75, 165, 174, 226};
  for (uint8_t i = 0; i < 5; ++i) {
    int16_t wx = weedXs[i];
    if (!rectsIntersect(x, y, w, h, wx - 9, 291, 16, 29)) continue;
    display.drawLine(wx, 319, wx - 2, 294, C_WEED_DARK);
    display.drawLine(wx - 2, 303, wx - 8, 292, C_WEED);
    display.drawLine(wx - 1, 310, wx + 6, 298, C_WEED);
  }

  if (rectsIntersect(x, y, w, h, 24, 162, 10, 20)) {
    display.drawCircle(26, 179, 2, C_WATER_LINE);
    display.drawCircle(31, 165, 1, C_WATER_LINE);
  }
  if (rectsIntersect(x, y, w, h, 205, 133, 12, 18)) {
    display.drawCircle(215, 149, 2, C_WATER_LINE);
    display.drawCircle(207, 136, 1, C_WATER_LINE);
  }
  if (rectsIntersect(x, y, w, h, 107, 223, 3, 3)) {
    display.drawCircle(108, 224, 1, C_WATER_LINE);
  }
}

static void restoreLakeRegion(int16_t x, int16_t y, int16_t w, int16_t h) {
  fillWaterRegion(x, y, w, h);
  redrawEnvironmentInRegion(x, y, w, h);
}

static FishDirtyRect clipFishRect(FishDirtyRect r) {
  int16_t x1 = r.x < 0 ? 0 : r.x;
  int16_t y1 = r.y < WATER_TOP ? WATER_TOP : r.y;
  int16_t x2 = r.x + r.w;
  int16_t y2 = r.y + r.h;
  if (x2 > SCREEN_W) x2 = SCREEN_W;
  if (y2 > SCREEN_H) y2 = SCREEN_H;
  if (x2 <= x1 || y2 <= y1) return {0, 0, 0, 0};
  return {x1, y1, (int16_t)(x2 - x1), (int16_t)(y2 - y1)};
}

static bool fishRectEmpty(const FishDirtyRect &r) {
  return r.w <= 0 || r.h <= 0;
}

static bool fishRectsTouch(const FishDirtyRect &a, const FishDirtyRect &b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x ||
           a.y + a.h < b.y || b.y + b.h < a.y);
}

static FishDirtyRect unionFishRect(const FishDirtyRect &a, const FishDirtyRect &b) {
  const int16_t x1 = a.x < b.x ? a.x : b.x;
  const int16_t y1 = a.y < b.y ? a.y : b.y;
  const int16_t ax2 = a.x + a.w;
  const int16_t bx2 = b.x + b.w;
  const int16_t ay2 = a.y + a.h;
  const int16_t by2 = b.y + b.h;
  const int16_t x2 = ax2 > bx2 ? ax2 : bx2;
  const int16_t y2 = ay2 > by2 ? ay2 : by2;
  return {x1, y1, (int16_t)(x2 - x1), (int16_t)(y2 - y1)};
}

static uint32_t fishRectArea(const FishDirtyRect &r) {
  return fishRectEmpty(r) ? 0U : (uint32_t)r.w * (uint32_t)r.h;
}

static bool fishRectIntersects(const FishDirtyRect &a, const FishDirtyRect &b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x ||
           a.y + a.h <= b.y || b.y + b.h <= a.y);
}

static FishDirtyRect fishBounds(const Fish &f) {
  const int16_t w = fishVisualWidth(f) + 16;
  const int16_t h = fishVisualHeight(f) + 10;
  return clipFishRect({(int16_t)(f.x - w / 2), (int16_t)(f.y - h / 2), w, h});
}

static void clearFishDirty() {
  fishDirtyCount = 0;
}

static void addFishDirty(FishDirtyRect r) {
  r = clipFishRect(r);
  if (fishRectEmpty(r)) return;

  // Merge nearby/overlapping damage only when the union stays cheap and fits
  // the 4 KiB scratch buffer. This keeps transfers compact and opaque.
  for (uint8_t i = 0; i < fishDirtyCount; ++i) {
    FishDirtyRect &d = fishDirty[i];
    if (!fishRectsTouch(d, r)) continue;
    FishDirtyRect u = unionFishRect(d, r);
    const uint32_t combined = fishRectArea(d) + fishRectArea(r);
    const uint32_t ua = fishRectArea(u);
    if (ua <= FISH_SCRATCH_PIXELS && ua * 4U <= combined * 5U) {
      d = u;
      return;
    }
  }

  if (fishDirtyCount < MAX_FISH_DIRTY_RECTS) {
    fishDirty[fishDirtyCount++] = r;
  } else {
    // Conservative overflow fallback: merge into the cheapest existing rect.
    uint8_t best = 0;
    uint32_t bestCost = 0xFFFFFFFFUL;
    for (uint8_t i = 0; i < fishDirtyCount; ++i) {
      FishDirtyRect u = unionFishRect(fishDirty[i], r);
      const uint32_t ua = fishRectArea(u);
      if (ua > FISH_SCRATCH_PIXELS) continue;
      const uint32_t cost = ua - fishRectArea(fishDirty[i]);
      if (cost < bestCost) { best = i; bestCost = cost; }
    }
    if (bestCost != 0xFFFFFFFFUL) fishDirty[best] = unionFishRect(fishDirty[best], r);
  }
}

static bool fishVisualChanged(const Fish &oldFish, const Fish &newFish) {
  if (oldFish.active != newFish.active) return true;
  if (!oldFish.active) return false;
  return oldFish.x != newFish.x ||
         oldFish.y != newFish.y ||
         oldFish.species != newFish.species ||
         oldFish.lengthTenths != newFish.lengthTenths ||
         ((oldFish.vxTenths < 0) != (newFish.vxTenths < 0));
}

static bool netMissVisible(const PlayerState &p, uint32_t now) {
  return p.hasMissMessage && (int32_t)(p.feedbackUntil - now) > 0;
}

static bool netUsesDeployedVisual(const PlayerState &p, uint32_t now) {
  return p.castActive || p.secured || netMissVisible(p, now) || state == STATE_TRANSITION;
}

static int16_t netBodyVisualY(const PlayerState &p, uint32_t now) {
  return netUsesDeployedVisual(p, now) ? p.netY : (WATER_TOP + 15);
}

static int16_t netCableEndVisualY(const PlayerState &p, uint32_t now) {
  const int16_t bodyY = netBodyVisualY(p, now);
  return clamp16((int16_t)(bodyY - 12), WATER_TOP, SCREEN_H - 1);
}

// -----------------------------------------------------------------------------
// Tiny RGB565 scratch rasterizer used only for dirty lake regions.
// -----------------------------------------------------------------------------

static void scratchPutPixel(int16_t x, int16_t y, uint16_t color) {
  const FishDirtyRect &r = fishScratchRect;
  if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) return;
  fishScratch[(uint32_t)(y - r.y) * (uint16_t)r.w + (uint16_t)(x - r.x)] = color;
}

static void scratchFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
  const FishDirtyRect &r = fishScratchRect;
  int16_t x1 = x > r.x ? x : r.x;
  int16_t y1 = y > r.y ? y : r.y;
  int16_t x2 = x + w < r.x + r.w ? x + w : r.x + r.w;
  int16_t y2 = y + h < r.y + r.h ? y + h : r.y + r.h;
  if (x2 <= x1 || y2 <= y1) return;
  for (int16_t yy = y1; yy < y2; ++yy) {
    uint16_t *dst = &fishScratch[(uint32_t)(yy - r.y) * r.w + (x1 - r.x)];
    for (int16_t xx = x1; xx < x2; ++xx) *dst++ = color;
  }
}

static void scratchHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
  scratchFillRect(x, y, w, 1, color);
}

static void scratchVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
  scratchFillRect(x, y, 1, h, color);
}

static void scratchLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color) {
  int16_t dx = x1 > x0 ? x1 - x0 : x0 - x1;
  int16_t sx = x0 < x1 ? 1 : -1;
  int16_t dyAbs = y1 > y0 ? y1 - y0 : y0 - y1;
  int16_t dy = -dyAbs;
  int16_t sy = y0 < y1 ? 1 : -1;
  int16_t err = dx + dy;
  while (true) {
    scratchPutPixel(x0, y0, color);
    if (x0 == x1 && y0 == y1) break;
    const int16_t e2 = (int16_t)(2 * err);
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

static void scratchFillCircle(int16_t cx, int16_t cy, int16_t radius, uint16_t color) {
  for (int16_t y = -radius; y <= radius; ++y) {
    for (int16_t x = -radius; x <= radius; ++x) {
      if (x * x + y * y <= radius * radius) scratchPutPixel(cx + x, cy + y, color);
    }
  }
}

static void scratchDrawCircle(int16_t cx, int16_t cy, int16_t radius, uint16_t color) {
  int16_t x = radius;
  int16_t y = 0;
  int16_t err = 0;
  while (x >= y) {
    scratchPutPixel(cx + x, cy + y, color); scratchPutPixel(cx + y, cy + x, color);
    scratchPutPixel(cx - y, cy + x, color); scratchPutPixel(cx - x, cy + y, color);
    scratchPutPixel(cx - x, cy - y, color); scratchPutPixel(cx - y, cy - x, color);
    scratchPutPixel(cx + y, cy - x, color); scratchPutPixel(cx + x, cy - y, color);
    if (err <= 0) { ++y; err += 2 * y + 1; }
    if (err > 0) { --x; err -= 2 * x + 1; }
  }
}

static int32_t scratchEdge(int16_t ax, int16_t ay, int16_t bx, int16_t by,
                           int16_t px, int16_t py) {
  return (int32_t)(px - ax) * (by - ay) - (int32_t)(py - ay) * (bx - ax);
}

static void scratchFillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1,
                                int16_t x2, int16_t y2, uint16_t color) {
  int16_t minX = x0 < x1 ? x0 : x1; if (x2 < minX) minX = x2;
  int16_t maxX = x0 > x1 ? x0 : x1; if (x2 > maxX) maxX = x2;
  int16_t minY = y0 < y1 ? y0 : y1; if (y2 < minY) minY = y2;
  int16_t maxY = y0 > y1 ? y0 : y1; if (y2 > maxY) maxY = y2;
  for (int16_t y = minY; y <= maxY; ++y) {
    for (int16_t x = minX; x <= maxX; ++x) {
      int32_t a = scratchEdge(x0, y0, x1, y1, x, y);
      int32_t b = scratchEdge(x1, y1, x2, y2, x, y);
      int32_t c = scratchEdge(x2, y2, x0, y0, x, y);
      if ((a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0)) {
        scratchPutPixel(x, y, color);
      }
    }
  }
}

static void scratchDrawStaticLake() {
  const FishDirtyRect &r = fishScratchRect;

  // Base band color, row by row.
  for (int16_t y = r.y; y < r.y + r.h; ++y) {
    uint16_t color = y < 124 ? C_WATER_TOP : (y < 212 ? C_WATER_MID : C_WATER_DEEP);
    scratchHLine(r.x, y, r.w, color);
  }

  scratchHLine(0, WATER_TOP, SCREEN_W, rgb565(75, 171, 190));
  scratchHLine(14, 39, 47, C_WATER_LINE);
  scratchHLine(83, 43, 34, C_WATER_LINE);
  scratchHLine(146, 38, 61, C_WATER_LINE);
  scratchHLine(194, 47, 30, C_WATER_LINE);
  scratchHLine(0, 134, SCREEN_W, rgb565(8, 65, 89));
  scratchHLine(0, 205, SCREEN_W, rgb565(7, 48, 70));

  // Environment, same layering as drawEnvironment().
  scratchFillCircle(18, 311, 13, C_ROCK);
  scratchFillCircle(37, 316, 18, C_ROCK);
  scratchFillCircle(216, 313, 17, C_ROCK);
  scratchFillCircle(198, 318, 14, C_ROCK);
  scratchHLine(7, 302, 20, C_ROCK_LIGHT);
  scratchHLine(205, 300, 20, C_ROCK_LIGHT);

  scratchLine(112, 263, 149, 285, C_ROCK_LIGHT);
  scratchLine(135, 276, 151, 264, C_ROCK_LIGHT);
  scratchLine(120, 268, 119, 251, C_ROCK_LIGHT);

  const int16_t weedXs[] = {66, 75, 165, 174, 226};
  for (uint8_t i = 0; i < 5; ++i) {
    const int16_t x = weedXs[i];
    scratchLine(x, 319, x - 2, 294, C_WEED_DARK);
    scratchLine(x - 2, 303, x - 8, 292, C_WEED);
    scratchLine(x - 1, 310, x + 6, 298, C_WEED);
  }

  scratchDrawCircle(26, 179, 2, C_WATER_LINE);
  scratchDrawCircle(31, 165, 1, C_WATER_LINE);
  scratchDrawCircle(215, 149, 2, C_WATER_LINE);
  scratchDrawCircle(207, 136, 1, C_WATER_LINE);
  scratchDrawCircle(108, 224, 1, C_WATER_LINE);
}

static void scratchDrawFish(const Fish &f) {
  if (!f.active) return;
  const int16_t w = fishVisualWidth(f);
  const int16_t h = fishVisualHeight(f);
  const int16_t x = f.x;
  const int16_t y = f.y;
  const bool right = f.vxTenths > 0;
  const int16_t noseX = right ? x + w / 2 : x - w / 2;
  const int16_t tailX = right ? x - w / 2 : x + w / 2;
  const int16_t tailTip = right ? tailX - 5 : tailX + 5;
  const uint8_t type = SPECIES[f.species].silhouetteType;

  if (type == SIL_BULKY) {
    scratchFillCircle(x, y, h / 2, C_FISH);
    scratchFillRect(x - w / 3, y - h / 2, (w * 2) / 3, h, C_FISH);
  } else if (type == SIL_LONG) {
    scratchFillRect(x - w / 2, y - h / 2, w, h, C_FISH);
    scratchFillCircle(noseX, y, h / 2, C_FISH);
  } else {
    scratchFillRect(x - w / 3, y - h / 2, (w * 2) / 3, h, C_FISH);
    scratchFillCircle(x, y, h / 2, C_FISH);
  }

  scratchFillTriangle(tailX, y,
                      tailTip, y - h / 2 - 2,
                      tailTip, y + h / 2 + 2,
                      C_FISH);
  scratchPutPixel(noseX, y - 1, C_FISH_EDGE);
}

static void composeFishRegion(FishDirtyRect r) {
  r = clipFishRect(r);
  if (fishRectEmpty(r)) return;

  // Split large/tall damage into opaque strips that fit the static scratch.
  int16_t y = r.y;
  while (y < r.y + r.h) {
    const int16_t maxRows = (int16_t)(FISH_SCRATCH_PIXELS / (uint16_t)r.w);
    const int16_t remaining = (int16_t)(r.y + r.h - y);
    const int16_t h = remaining < maxRows ? remaining : maxRows;
    fishScratchRect = {r.x, y, r.w, h};

    scratchDrawStaticLake();

    for (uint8_t i = 0; i < MAX_ACTIVE_FISH; ++i) {
      if (!fish[i].active) continue;
      if (fishRectIntersects(fishScratchRect, fishBounds(fish[i]))) scratchDrawFish(fish[i]);
    }

    display.drawRGBBitmap(fishScratchRect.x, fishScratchRect.y,
                          fishScratch, fishScratchRect.w, fishScratchRect.h);
    y += h;
  }
}

static void collectDynamicDamage(uint32_t now) {
  clearFishDirty();

  for (uint8_t i = 0; i < MAX_ACTIVE_FISH; ++i) {
    if (!fishVisualChanged(prevFish[i], fish[i])) continue;
    if (prevFish[i].active) addFishDirty(fishBounds(prevFish[i]));
    if (fish[i].active) addFishDirty(fishBounds(fish[i]));
  }

  for (uint8_t p = 0; p < activePlayerCount(); ++p) {
    const int16_t x = playerNetX(p);
    const bool targetVisible = !players[p].secured;
    if (prevTargetVisible[p] && (!targetVisible || prevTargetY[p] != players[p].targetY)) {
      addFishDirty({(int16_t)(x - NET_CAPTURE_HALF_WIDTH - 2),
                    (int16_t)(prevTargetY[p] - NET_CAPTURE_HALF_HEIGHT - 2),
                    (int16_t)(NET_CAPTURE_HALF_WIDTH * 2 + 5),
                    (int16_t)(NET_CAPTURE_HALF_HEIGHT * 2 + 5)});
    }

    const int16_t currentBodyY = netBodyVisualY(players[p], now);
    const int16_t currentEndY = netCableEndVisualY(players[p], now);
    const bool currentClosed = players[p].secured || state == STATE_TRANSITION;
    const int16_t currentMouthHalf = netUsesDeployedVisual(players[p], now) ?
                                      netOpenHalfWidth(players[p], now) : 15;
    const bool currentMiss = netMissVisible(players[p], now);

    if (prevNetBodyY[p] != currentBodyY || prevNetClosed[p] != currentClosed ||
        prevNetMouthHalf[p] != currentMouthHalf) {
      addFishDirty({(int16_t)(x - NET_CAPTURE_HALF_WIDTH - 3),
                    (int16_t)(prevNetBodyY[p] - 14),
                    (int16_t)(NET_CAPTURE_HALF_WIDTH * 2 + 7), 30});
    }

    if (prevNetEndY[p] > currentEndY) {
      addFishDirty({(int16_t)(x - 1), currentEndY, 3,
                    (int16_t)(prevNetEndY[p] - currentEndY + 1)});
    }

    if (prevMissVisible[p] && !currentMiss) {
      addFishDirty({(int16_t)(x - 14),
                    clamp16((int16_t)(players[p].castTargetY + 12), WATER_TOP, 305),
                    31, 12});
    }
  }
}

static void snapshotDynamicFrame(uint32_t now) {
  for (uint8_t i = 0; i < MAX_ACTIVE_FISH; ++i) prevFish[i] = fish[i];

  const uint8_t count = activePlayerCount();
  for (uint8_t p = 0; p < 2; ++p) {
    prevPlayers[p] = players[p];
    if (p >= count) {
      prevTargetVisible[p] = false;
      prevMissVisible[p] = false;
      continue;
    }
    prevNetEndY[p] = netCableEndVisualY(players[p], now);
    prevNetBodyY[p] = netBodyVisualY(players[p], now);
    prevNetClosed[p] = players[p].secured || state == STATE_TRANSITION;
    prevNetMouthHalf[p] = netUsesDeployedVisual(players[p], now) ?
                          netOpenHalfWidth(players[p], now) : 15;
    prevMissVisible[p] = netMissVisible(players[p], now);
    prevTargetVisible[p] = !players[p].secured;
    prevTargetY[p] = players[p].targetY;
  }

  previousDynamicFrameValid = true;
}

static void drawFishingFrameFull(uint32_t now) {
  drawLakeBackground();
  drawEnvironment();
  for (uint8_t i = 0; i < MAX_ACTIVE_FISH; ++i) drawFishSilhouette(fish[i]);
  for (uint8_t p = 0; p < activePlayerCount(); ++p) drawPlayerTarget(p);
  for (uint8_t p = 0; p < activePlayerCount(); ++p) drawNet(p, now);
  drawFishingHud(now, true);
  snapshotDynamicFrame(now);
}

static void drawFishingFrame(uint32_t now) {
  if (!previousDynamicFrameValid || screenDirty) {
    drawFishingFrameFull(now);
    return;
  }

  collectDynamicDamage(now);
  for (uint8_t i = 0; i < fishDirtyCount; ++i) composeFishRegion(fishDirty[i]);

  for (uint8_t p = 0; p < activePlayerCount(); ++p) drawPlayerTarget(p);
  for (uint8_t p = 0; p < activePlayerCount(); ++p) drawNet(p, now);
  drawFishingHud(now, false);

  snapshotDynamicFrame(now);
}

static void drawReadyFrame() {
  display.fillScreen(C_SKY_DARK);

  // Stylized title-card lake background.
  display.fillRect(0, 86, SCREEN_W, 234, C_WATER_TOP);
  display.fillRect(0, 146, SCREEN_W, 92, C_WATER_MID);
  display.fillRect(0, 238, SCREEN_W, 82, C_WATER_DEEP);
  display.drawFastHLine(0, 86, SCREEN_W, rgb565(92, 194, 214));
  display.drawFastHLine(0, 87, SCREEN_W, C_WATER_LINE);
  display.drawFastHLine(12, 96, 44, C_WATER_LINE);
  display.drawFastHLine(86, 101, 58, C_WATER_LINE);
  display.drawFastHLine(175, 94, 42, C_WATER_LINE);

  display.drawCircle(33, 183, 3, C_WATER_LINE);
  display.drawCircle(41, 169, 2, C_WATER_LINE);
  display.drawCircle(197, 205, 3, C_WATER_LINE);
  display.drawCircle(204, 188, 2, C_WATER_LINE);
  display.drawCircle(160, 262, 2, C_WATER_LINE);

  display.fillRect(0, 296, SCREEN_W, 24, rgb565(16, 35, 40));
  display.fillCircle(24, 313, 14, C_ROCK);
  display.fillCircle(214, 313, 17, C_ROCK);
  display.drawLine(59, 319, 56, 284, C_WEED_DARK);
  display.drawLine(56, 300, 47, 287, C_WEED);
  display.drawLine(56, 304, 64, 291, C_WEED);
  display.drawLine(184, 319, 181, 286, C_WEED_DARK);
  display.drawLine(181, 302, 173, 289, C_WEED);
  display.drawLine(182, 307, 191, 292, C_WEED);

  Fish deco;
  deco.active = true; deco.lengthTenths = 230; deco.species = NORTHERN_PIKE; deco.vxTenths = 100;
  deco.x = 56; deco.y = 208; drawFishSilhouette(deco);
  deco.lengthTenths = 165; deco.species = CRAPPIE; deco.vxTenths = -100;
  deco.x = 179; deco.y = 159; drawFishSilhouette(deco);
  deco.lengthTenths = 105; deco.species = BLUEGILL; deco.vxTenths = 100;
  deco.x = 117; deco.y = 248; drawFishSilhouette(deco);
  deco.lengthTenths = 350; deco.species = MUSKY; deco.vxTenths = -100;
  deco.x = 124; deco.y = 118; drawFishSilhouette(deco);

  display.setTextSize(3);
  display.setTextColor(C_PANEL);
  display.setCursor(33, 30); display.print("Fishing");
  display.setCursor(34, 58); display.print("Trawler");
  display.setTextColor(C_P1);
  display.setCursor(31, 28); display.print("Fishing");
  display.setTextColor(C_WARNING);
  display.setCursor(32, 56); display.print("Trawler");
  display.drawFastHLine(38, 24, 162, rgb565(56, 123, 145));
  display.drawFastHLine(44, 86, 150, rgb565(56, 123, 145));

  // Mode menu. Either physical switch can select: UP = 1 player, DOWN = 2 player.
  const bool singleSelected = playMode == MODE_SINGLE_PLAYER;
  display.fillRect(45, 180, 150, 30, C_PANEL);
  display.drawRect(45, 180, 150, 30, singleSelected ? C_WARNING : C_TEXT_DIM);
  display.setTextSize(2);
  display.setTextColor(singleSelected ? ST77XX_WHITE : C_TEXT_DIM);
  display.setCursor(72, 187);
  display.print("1 PLAYER");

  display.fillRect(45, 215, 150, 30, C_PANEL);
  display.drawRect(45, 215, 150, 30, singleSelected ? C_TEXT_DIM : C_WARNING);
  display.setTextColor(singleSelected ? C_TEXT_DIM : ST77XX_WHITE);
  display.setCursor(72, 222);
  display.print("2 PLAYER");

  MenuFooter::draw(display);
}

static uint32_t runningRevealTotal(const PlayerState &p, uint8_t throughIndex) {
  uint32_t total = 0;
  uint8_t end = p.catchCount;
  if (end > throughIndex + 1U) end = throughIndex + 1U;
  for (uint8_t i = 0; i < end; ++i) total += p.catches[i].value;
  return total;
}

static void drawSpeciesArt(const CatchFish &c, int16_t cx, int16_t cy) {
  const SpeciesDef &def = SPECIES[c.species];
  int16_t w = clamp16((int16_t)(20 + c.lengthTenths / 18), 25, 58);
  int16_t h = (def.silhouetteType == SIL_BULKY) ? 18 :
              (def.silhouetteType == SIL_LONG ? 12 : 15);
  if (c.species == MUSKY) { w = 62; h = 13; }

  display.fillTriangle(cx - w / 2, cy,
                       cx - w / 2 - 10, cy - h / 2,
                       cx - w / 2 - 10, cy + h / 2,
                       def.colorB);
  display.fillRect(cx - w / 2, cy - h / 2, w, h, def.colorA);
  display.fillCircle(cx + w / 2, cy, h / 2, def.colorA);
  display.drawFastHLine(cx - w / 3, cy, w / 2, def.colorB);
  display.drawPixel(cx + w / 2 + 1, cy - 2, ST77XX_WHITE);
  if (c.species == CHANNEL_CATFISH) {
    display.drawLine(cx + w / 2, cy + 2, cx + w / 2 + 9, cy + 7, def.colorB);
    display.drawLine(cx + w / 2, cy + 1, cx + w / 2 + 9, cy - 5, def.colorB);
  }
  if (c.species == MUSKY) {
    display.drawRect(cx - w / 2 - 3, cy - h / 2 - 3, w + 10, h + 6, C_WARNING);
  }
}

static void drawCatchText(const CatchFish &c, int16_t x0, uint32_t runningTotal) {
  display.setTextSize(1);
  display.setTextColor(ST77XX_WHITE);
  display.setCursor(x0 + 5, 205);
  display.print(SPECIES[c.species].name);
  display.setTextColor(C_TEXT_DIM);
  display.setCursor(x0 + 5, 222);
  display.print(c.lengthTenths / 10);
  display.print('.');
  display.print(c.lengthTenths % 10);
  display.print(" in");
  display.setTextColor(C_WARNING);
  display.setCursor(x0 + 5, 239);
  display.print('$');
  display.print(c.value);
  display.setTextColor(ST77XX_WHITE);
  display.setCursor(x0 + 5, 265);
  display.print("RUN $ ");
  display.print(runningTotal);
}

static void drawRevealColumn(uint8_t playerIndex, uint8_t index) {
  const int16_t x0 = playerIndex == 0 ? 0 : 120;
  const PlayerState &p = players[playerIndex];
  const uint16_t accent = playerIndex == 0 ? C_P1 : C_P2;

  display.fillRect(x0, 36, 120, 284, playerIndex == 0 ? rgb565(5,25,38) : rgb565(31,11,28));
  display.setTextSize(2);
  display.setTextColor(accent);
  display.setCursor(x0 + 45, 47);
  display.print(playerIndex == 0 ? "P1" : "P2");

  if (index >= p.catchCount) {
    display.setTextSize(2);
    display.setTextColor(C_TEXT_DIM);
    display.setCursor(x0 + 19, 144);
    display.print(p.catchCount == 0 ? "NO FISH" : "NO MORE");
    display.setTextSize(1);
    display.setCursor(x0 + 30, 265);
    display.print("RUN $ ");
    display.print(p.totalValue);
    return;
  }

  const CatchFish &c = p.catches[index];
  drawSpeciesArt(c, x0 + 60, 145);
  drawCatchText(c, x0, runningRevealTotal(p, index));
}

static int16_t centeredTextX(const char *text, uint8_t textSize) {
  const int16_t width = (int16_t)strlen(text) * 6 * textSize;
  return clamp16((int16_t)((SCREEN_W - width) / 2), 0, SCREEN_W - 1);
}

static void drawCenteredText(const char *text, int16_t y, uint8_t textSize, uint16_t color) {
  display.setTextSize(textSize);
  display.setTextColor(color);
  display.setCursor(centeredTextX(text, textSize), y);
  display.print(text);
}

static void drawCenteredTextInRect(const char *text, int16_t x, int16_t w,
                                   int16_t y, int16_t h, uint8_t textSize,
                                   uint16_t color) {
  const int16_t textW = (int16_t)strlen(text) * 6 * textSize;
  const int16_t textH = 8 * textSize;
  int16_t cursorX = x + (w - textW) / 2;
  int16_t cursorY = y + (h - textH) / 2;
  if (cursorX < x) cursorX = x;
  if (cursorY < y) cursorY = y;
  display.setTextSize(textSize);
  display.setTextColor(color);
  display.setCursor(cursorX, cursorY);
  display.print(text);
}

static void drawSpeciesArtLarge(const CatchFish &c, int16_t cx, int16_t cy) {
  const SpeciesDef &def = SPECIES[c.species];
  int16_t w = clamp16((int16_t)(32 + c.lengthTenths / 12), 44, 94);
  int16_t h = (def.silhouetteType == SIL_BULKY) ? 28 :
              (def.silhouetteType == SIL_LONG ? 18 : 23);
  if (c.species == MUSKY) { w = 100; h = 20; }

  display.fillTriangle(cx - w / 2, cy,
                       cx - w / 2 - 14, cy - h / 2,
                       cx - w / 2 - 14, cy + h / 2,
                       def.colorB);
  display.fillRect(cx - w / 2, cy - h / 2, w, h, def.colorA);
  display.fillCircle(cx + w / 2, cy, h / 2, def.colorA);
  display.drawFastHLine(cx - w / 3, cy, w / 2, def.colorB);
  display.drawPixel(cx + w / 2 + 2, cy - 3, ST77XX_WHITE);
  if (c.species == CHANNEL_CATFISH) {
    display.drawLine(cx + w / 2, cy + 3, cx + w / 2 + 12, cy + 9, def.colorB);
    display.drawLine(cx + w / 2, cy + 1, cx + w / 2 + 12, cy - 7, def.colorB);
  }
  if (c.species == MUSKY) {
    display.drawRect(cx - w / 2 - 4, cy - h / 2 - 4, w + 12, h + 8, C_WARNING);
  }
}

static void drawSingleRevealFrame() {
  display.fillScreen(C_PANEL);
  display.fillRect(0, 0, SCREEN_W, 36, C_SKY_DARK);
  drawCenteredText("CATCH REVEAL", 7, 2, ST77XX_WHITE);
  drawCenteredText("PRESS BUTTON", 24, 1, C_TEXT_DIM);

  const PlayerState &p = players[0];
  if (revealIndex >= p.catchCount) {
    drawCenteredText(p.catchCount == 0 ? "NO FISH" : "NO MORE", 135, 3, C_TEXT_DIM);
    char haul[24];
    snprintf(haul, sizeof(haul), "HAUL $%lu", (unsigned long)p.totalValue);
    drawCenteredText(haul, 260, 2, ST77XX_WHITE);
    return;
  }

  const CatchFish &c = p.catches[revealIndex];
  drawCenteredText(SPECIES[c.species].name, 67, 2, ST77XX_WHITE);
  drawSpeciesArtLarge(c, SCREEN_W / 2, 142);

  char line[28];
  snprintf(line, sizeof(line), "%d.%d in", c.lengthTenths / 10, c.lengthTenths % 10);
  drawCenteredText(line, 190, 2, C_TEXT_DIM);
  snprintf(line, sizeof(line), "$%u", c.value);
  drawCenteredText(line, 220, 3, C_WARNING);
  snprintf(line, sizeof(line), "HAUL $%lu", (unsigned long)runningRevealTotal(p, revealIndex));
  drawCenteredText(line, 270, 2, ST77XX_WHITE);

  if (c.species == MUSKY) {
    display.drawRect(2, 38, 236, 278, C_WARNING);
    display.drawRect(4, 40, 232, 274, C_WARNING);
    queueTone(BUZZER_2_PIN, 1180, 110);
    queueTone(BUZZER_1_PIN, 1320, 110);
  }
}

static void drawRevealFrame() {
  if (playMode == MODE_SINGLE_PLAYER) {
    drawSingleRevealFrame();
    return;
  }

  display.fillScreen(C_PANEL);
  display.fillRect(0, 0, SCREEN_W, 36, C_SKY_DARK);
  display.setTextSize(2);
  display.setTextColor(ST77XX_WHITE);
  display.setCursor(48, 7);
  display.print("CATCH REVEAL");
  display.setTextSize(1);
  display.setTextColor(C_TEXT_DIM);
  display.setCursor(64, 24);
  display.print("PRESS BUTTON");
  display.drawFastVLine(119, 36, 284, rgb565(63, 73, 82));
  drawRevealColumn(0, revealIndex);
  drawRevealColumn(1, revealIndex);

  bool muskyBeat = false;
  if (revealIndex < players[0].catchCount && players[0].catches[revealIndex].species == MUSKY) muskyBeat = true;
  if (revealIndex < players[1].catchCount && players[1].catches[revealIndex].species == MUSKY) muskyBeat = true;
  if (muskyBeat) {
    display.drawRect(2, 38, 236, 278, C_WARNING);
    display.drawRect(4, 40, 232, 274, C_WARNING);
    queueTone(BUZZER_2_PIN, 1180, 110);
    queueTone(BUZZER_1_PIN, 1320, 110);
  }
}

static void drawResultActionButtons() {
  // Mirror Horizon Burn's results navigation: two compact bottom-corner boxes,
  // cyan/left for Menu and pink/right for Replay, each with an outward arrow.
  static constexpr int16_t BUTTON_Y = 277;
  static constexpr int16_t BUTTON_H = 27;
  static constexpr int16_t BUTTON_W = 100;
  static constexpr int16_t LEFT_X = 8;
  static constexpr int16_t RIGHT_X = 132;

  display.fillRect(LEFT_X, BUTTON_Y, BUTTON_W, BUTTON_H, C_PANEL);
  display.drawRect(LEFT_X, BUTTON_Y, BUTTON_W, BUTTON_H, C_P1);
  display.fillTriangle(16, 290, 24, 283, 24, 297, C_P1);
  display.setTextSize(2);
  display.setTextColor(ST77XX_WHITE);
  display.setCursor(34, 284);
  display.print("MENU");

  display.fillRect(RIGHT_X, BUTTON_Y, BUTTON_W, BUTTON_H, C_PANEL);
  display.drawRect(RIGHT_X, BUTTON_Y, BUTTON_W, BUTTON_H, C_P2);
  display.setTextSize(2);
  display.setTextColor(ST77XX_WHITE);
  display.setCursor(140, 284);
  display.print("REPLAY");
  display.fillTriangle(224, 290, 216, 283, 216, 297, C_P2);
  MenuFooter::draw(display);
}

static void drawFinalScoreFrame() {
  display.fillScreen(C_PANEL);
  display.drawRect(5, 5, 230, 310, rgb565(59, 73, 82));
  display.drawRect(8, 8, 224, 304, rgb565(34, 46, 55));

  drawCenteredText("FINAL HAUL", 22, 2, ST77XX_WHITE);

  if (playMode == MODE_SINGLE_PLAYER) {
    // One large neutral haul card. Keep both the money and fish count together
    // so this one persistent screen contains the complete result.
    display.fillRect(18, 72, 204, 142, rgb565(11, 25, 34));
    display.drawRect(18, 72, 204, 142, ST77XX_WHITE);

    char line[28];
    snprintf(line, sizeof(line), "$%lu", (unsigned long)players[0].totalValue);
    drawCenteredText(line, 108, 4, C_WARNING);
    snprintf(line, sizeof(line), "%u FISH", players[0].catchCount);
    drawCenteredText(line, 170, 2, ST77XX_WHITE);

    drawResultActionButtons();
    return;
  }

  // Winner/result information now lives on the same screen as the haul cards.
  if (players[0].totalValue > players[1].totalValue) {
    drawCenteredText("P1 WINS", 52, 2, C_P1);
  } else if (players[1].totalValue > players[0].totalValue) {
    drawCenteredText("P2 WINS", 52, 2, C_P2);
  } else {
    drawCenteredText("TIE", 52, 2, C_WARNING);
  }

  // Preserve the two Final Haul boxes, but make each card self-contained by
  // putting the fish count inside with the dollar total.
  display.fillRect(12, 82, 98, 130, rgb565(5, 31, 44));
  display.drawRect(12, 82, 98, 130, C_P1);
  display.fillRect(130, 82, 98, 130, rgb565(37, 12, 31));
  display.drawRect(130, 82, 98, 130, C_P2);

  drawCenteredTextInRect("P1", 12, 98, 82, 22, 2, C_P1);
  drawCenteredTextInRect("P2", 130, 98, 82, 22, 2, C_P2);

  char line[28];
  snprintf(line, sizeof(line), "$%lu", (unsigned long)players[0].totalValue);
  drawCenteredTextInRect(line, 12, 98, 123, 36, 3, C_P1);
  snprintf(line, sizeof(line), "$%lu", (unsigned long)players[1].totalValue);
  drawCenteredTextInRect(line, 130, 98, 123, 36, 3, C_P2);

  snprintf(line, sizeof(line), "%u FISH", players[0].catchCount);
  drawCenteredTextInRect(line, 12, 98, 174, 20, 1, ST77XX_WHITE);
  snprintf(line, sizeof(line), "%u FISH", players[1].catchCount);
  drawCenteredTextInRect(line, 130, 98, 174, 20, 1, ST77XX_WHITE);

  drawResultActionButtons();
}

// -----------------------------------------------------------------------------
// State updates
// -----------------------------------------------------------------------------

static void handleButtons(const GameInput &input, uint32_t now) {
  if (playMode == MODE_SINGLE_PLAYER) {
    // Either button controls the centered net. Ignore a two-button chord so the
    // launcher's hold-both-buttons menu shortcut remains clean.
    const bool bothHeld = input.leftButton && input.rightButton;
    const bool pressed = !bothHeld && (input.leftPressed || input.rightPressed);
    tryStartCast(players[0], 0, pressed, now);
    return;
  }

  tryStartCast(players[0], 0, input.leftPressed, now);
  tryStartCast(players[1], 1, input.rightPressed, now);
}

static void updateFishing(const GameInput &input, uint32_t now, uint32_t dtMs) {
  if ((uint32_t)(now - roundStartedAt) >= ROUND_LENGTH_MS) {
    beginTimeout(now);
    return;
  }

  if (playMode == MODE_SINGLE_PLAYER) {
    players[0].switchState = (uint8_t)readSinglePlayerSwitchState();
    updateDepth(players[0], players[0].switchState, dtMs);
  } else {
    players[0].switchState = (uint8_t)readSwitchState(false);
    players[1].switchState = (uint8_t)readSwitchState(true);
    updateDepth(players[0], players[0].switchState, dtMs);
    updateDepth(players[1], players[1].switchState, dtMs);
  }

  handleButtons(input, now);
  updateFish(dtMs);
  for (uint8_t i = 0; i < activePlayerCount(); ++i) updateCast(players[i], now);
  resolveBothCastsIfReady(now);
  maintainFishPopulation(now);
  for (uint8_t i = 0; i < activePlayerCount(); ++i) updateMissReturn(players[i], now);

  if (allActivePlayersSecured()) beginTransition(now);
}

static void updateTimeout(uint32_t now, uint32_t dtMs) {
  updateFish(dtMs);
  for (uint8_t i = 0; i < activePlayerCount(); ++i) updateCast(players[i], now);
  resolveBothCastsIfReady(now);
  if (allActivePlayersSecured()) beginTransition(now);
}

static void updateTransition(uint32_t now) {
  const uint32_t elapsed = now - stateStartedAt;
  if (elapsed >= TRANSITION_MS) {
    for (uint8_t i = 0; i < activePlayerCount(); ++i) players[i].netY = WATER_TOP + 2;
    beginReveal(now);
    return;
  }

  if (elapsed <= NET_CINCH_MS) {
    for (uint8_t i = 0; i < activePlayerCount(); ++i) {
      players[i].netY = players[i].transitionFromY;
    }
    return;
  }

  const uint32_t haulDuration = TRANSITION_MS - NET_CINCH_MS;
  const uint32_t haulElapsed = elapsed - NET_CINCH_MS;
  const int32_t t = (int32_t)((haulElapsed * 1024UL) / haulDuration);
  const int32_t t2 = (t * t) / 1024L;
  const int32_t smooth = (t2 * (3072L - 2L * t)) / 1024L;

  for (uint8_t i = 0; i < activePlayerCount(); ++i) {
    const int32_t travel = players[i].transitionFromY - (WATER_TOP + 2);
    players[i].netY = (int16_t)(players[i].transitionFromY -
                      (travel * smooth) / 1024L);
  }
}

static void advanceReveal(const GameInput &input, uint32_t now) {
  if (!input.leftPressed && !input.rightPressed) return;
  revealBeatStartedAt = now;
  const uint8_t maxCount = maxCatchCount();

  if (maxCount == 0) {
    beginFinalScore(now);
    return;
  }

  ++revealIndex;
  if (revealIndex >= maxCount) beginFinalScore(now);
  else screenDirty = true;
}

static void replayCurrentMode(uint32_t now) {
  // Replay stays in the chosen 1P/2P mode and begins a fresh round immediately.
  resetRound(now);
  beginFishing(now);
}

static void returnToFishingMenu(uint32_t now) {
  // Results-screen Menu returns to Fishing Trawler's own title/mode selector.
  // resetRound() also clears the start-input arm, so the button used to return
  // must be released before it can start a new game from the menu.
  resetRound(now);
  setState(STATE_READY, now);
}

static bool handleResultsButtons(const GameInput &input, uint32_t now) {
  // The launcher's hold-both chord owns simultaneous input. Never reinterpret
  // it as Menu or Replay.
  if ((input.leftButton && input.rightButton) ||
      (input.leftPressed && input.rightPressed)) return false;

  if (input.leftPressed) {
    returnToFishingMenu(now);
    return true;
  }
  if (input.rightPressed) {
    replayCurrentMode(now);
    return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// Render dispatcher
// -----------------------------------------------------------------------------

static void render(uint32_t now) {
  if (state == STATE_FISHING || state == STATE_TIMEOUT || state == STATE_TRANSITION) {
    const uint32_t nowUs = micros();
    if (!screenDirty && (uint32_t)(nowUs - lastFrameUs) < RENDER_INTERVAL_US) return;
    lastFrameUs = nowUs;
    drawFishingFrame(now);
    screenDirty = false;
    return;
  }

  if (!screenDirty) return;
  screenDirty = false;

  switch (state) {
    case STATE_READY:       drawReadyFrame(); break;
    case STATE_REVEAL:      drawRevealFrame(); break;
    case STATE_FINAL_SCORE: drawFinalScoreFrame(); break;
    default: break;
  }
}

// -----------------------------------------------------------------------------
// Public game entry points
// -----------------------------------------------------------------------------

static void enter() {
  display.setRotation(0);
  display.setTextWrap(false);
  const uint32_t now = millis();
  randomSeed((uint32_t)micros() ^ ((uint32_t)digitalRead(LEFT_UP_PIN) << 10) ^
             ((uint32_t)digitalRead(RIGHT_DOWN_PIN) << 18));
  playMode = MODE_SINGLE_PLAYER;
  resetRound(now);
  setState(STATE_READY, now);
  render(now);
}

static void update(const GameInput &input) {
  const uint32_t now = millis();
  uint32_t dtMs = now - lastLogicAt;
  lastLogicAt = now;
  if (dtMs > 50U) dtMs = 50U;

  switch (state) {
    case STATE_READY: {
      updateReadyModeSelection();
      const bool anyButtonHeld = input.leftButton || input.rightButton;

      // Entering-button presses must be fully released before confirmation can
      // start the selected mode.
      if (!startInputArmed) {
        if (!anyButtonHeld) startInputArmed = true;
        break;
      }

      // A clean single-button press confirms the highlighted mode. The press is
      // consumed here and cannot also become the first cast.
      const bool bothHeld = input.leftButton && input.rightButton;
      if (!bothHeld && (input.leftPressed || input.rightPressed)) beginFishing(now);
      break;
    }

    case STATE_FISHING:
      updateFishing(input, now, dtMs);
      break;

    case STATE_TIMEOUT:
      updateTimeout(now, dtMs);
      break;

    case STATE_TRANSITION:
      updateTransition(now);
      break;

    case STATE_REVEAL:
      advanceReveal(input, now);
      break;

    case STATE_FINAL_SCORE:
      if (handleResultsButtons(input, now)) return;
      break;
  }

  updateAudio(now);
  render(now);
}

} // namespace FishingTrawler
