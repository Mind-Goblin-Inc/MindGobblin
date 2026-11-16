#pragma once

#include <Arduino.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <stdio.h>
#include "GameAPI.h"
#include "Hardware.h"
#include "MusicPlayer.h"
#include "MenuFooter.h"

namespace HorizonBurn {

// ============================================================
// CONSTANTS / PALETTE
// ============================================================

constexpr int16_t SCREEN_W = 240;
constexpr int16_t SCREEN_H = 320;
constexpr int16_t HUD_H = 32;
constexpr int16_t HORIZON_Y = 104;
constexpr int16_t FOOTER_Y = 308;
constexpr uint8_t LEFT_GUN = 1;
constexpr uint8_t RIGHT_GUN = 2;
constexpr uint8_t BOTH_GUNS = 3;
constexpr uint8_t MAX_NOTES = 24;
constexpr uint8_t MAX_EFFECTS = 10;
constexpr uint8_t MAX_PROJECTED = 24;
constexpr uint8_t MAX_VISUAL_EFFECTS = 10;
constexpr int16_t STRIP_H = 8;
constexpr uint32_t FRAME_INTERVAL_US = 33333UL;
constexpr uint32_t RENDER_BUDGET_US = 6000UL;
constexpr uint32_t SWITCH_STABLE_US = 8000UL;
constexpr uint32_t BUTTON_REARM_US = 12000UL;
constexpr uint32_t BUTTON_GAP_US = 20000UL;
constexpr uint32_t MENU_RELEASE_US = 50000UL;
constexpr uint32_t READY_HOLD_US = 250000UL;
constexpr uint32_t RESULT_DWELL_US = 300000UL;
constexpr uint32_t SLIDE_US = 70000UL;
constexpr uint32_t BEAM_US = 55000UL;
constexpr uint32_t MUZZLE_US = 50000UL;
constexpr uint32_t BURST_US = 180000UL;
constexpr uint32_t FLYBY_US = 420000UL;
constexpr uint32_t FEEDBACK_US = 240000UL;
constexpr uint32_t MISS_FEEDBACK_US = 320000UL;
constexpr uint32_t INVULN_FLASH_US = 90000UL;
constexpr uint32_t ENDING_US = 650000UL;
constexpr uint32_t DUAL_SEPARATION_US = 45000UL;
constexpr uint32_t SCORE_CAP = 999999999UL;

constexpr uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) {
  return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

constexpr uint16_t C_DEEP_VOID   = rgb565(0x08,0x06,0x17);
constexpr uint16_t C_UPPER_VIOLET= rgb565(0x1B,0x0B,0x38);
constexpr uint16_t C_HORIZON_PLUM= rgb565(0x65,0x1B,0x69);
constexpr uint16_t C_GROUND_BLACK= rgb565(0x08,0x0D,0x20);
constexpr uint16_t C_GROUND_VIO  = rgb565(0x20,0x10,0x38);
constexpr uint16_t C_HULL_SHADOW = rgb565(0x11,0x0F,0x2B);
constexpr uint16_t C_HULL_LIGHT  = rgb565(0x35,0x20,0x57);
constexpr uint16_t C_HULL_PINK   = rgb565(0x67,0x23,0x4F);
constexpr uint16_t C_DIM_MESH    = rgb565(0x18,0x48,0x6A);
constexpr uint16_t C_CYAN        = rgb565(0x27,0xD9,0xF2);
constexpr uint16_t C_PINK        = rgb565(0xFF,0x3C,0xA5);
constexpr uint16_t C_VIOLET_GLOW = rgb565(0x8D,0x44,0xD8);
constexpr uint16_t C_SUN_GOLD    = rgb565(0xFF,0xD3,0x5A);
constexpr uint16_t C_SUN_CORAL   = rgb565(0xFF,0x78,0x6E);
constexpr uint16_t C_SUN_PINK    = rgb565(0xF5,0x2B,0x97);
constexpr uint16_t C_HIGHLIGHT   = rgb565(0xE4,0xFF,0xFF);
constexpr uint16_t C_MISS        = rgb565(0xFF,0x53,0x77);
constexpr uint16_t C_PANEL       = rgb565(0x13,0x0B,0x2B);

static inline uint16_t lerp565(uint8_t r0,uint8_t g0,uint8_t b0,
                               uint8_t r1,uint8_t g1,uint8_t b1,
                               uint16_t num,uint16_t den) {
  if (!den) return rgb565(r0,g0,b0);
  uint8_t r = (uint8_t)(r0 + ((int32_t)(r1-r0)*num)/den);
  uint8_t g = (uint8_t)(g0 + ((int32_t)(g1-g0)*num)/den);
  uint8_t b = (uint8_t)(b0 + ((int32_t)(b1-b0)*num)/den);
  return rgb565(r,g,b);
}

// ============================================================
// TYPES
// ============================================================

enum class Phase : uint8_t {
  Title, Difficulty, Ready, CountIn, Playing, FailFlyby,
  ClearOutro, Results, Fault
};

enum class Lane : uint8_t { Left=0, Center=1, Right=2 };
enum class DifficultyId : uint8_t { Easy=0, Normal=1, Hard=2, Expert=3, Master=4 };
enum class NoteStatus : uint8_t { Free, Pending, DualPrimed, DualBroken, Flyby };
enum class Judgment : uint8_t { Perfect, Good, Miss };
enum class FxKind : uint8_t { BeamLeft, BeamRight, Burst, MissAccent, ClearAccent };
enum class ResultReason : uint8_t { None, Failed, Cleared, InvalidChart, PoolOverflow };
enum class FeedbackKind : uint8_t { None, Perfect, GoodEarly, GoodLate, Miss, Extra };

struct Rect { int16_t x,y,w,h; };
struct Point16 { int16_t x,y; };

struct DifficultyConfig {
  uint16_t bpm;
  uint8_t leadTicks;
  uint32_t perfectUs;
  uint32_t goodUs;
  const char* name;
  const char* songName;
};

struct ChartNoteDef { uint8_t tick; uint8_t gunMask; };
struct PhraseDef {
  Lane firstBar;
  Lane secondBar;
  uint8_t noteCount;
  const ChartNoteDef* notes;
};
struct ChartEvent {
  uint16_t sequence;
  uint16_t dueTick;
  Lane lane;
  uint8_t mask;
};
struct ChartSummary {
  uint16_t targets;
  uint8_t peakRequiredSlots;
  bool valid;
};

struct ClockState {
  uint32_t lastRawUs=0;
  uint64_t nowUs=0;
  uint64_t songOriginUs=0;
  uint64_t phaseStartedUs=0;
  bool initialized=false;
};

struct SwitchFilter {
  SwitchState raw=SWITCH_ERROR;
  SwitchState candidate=SWITCH_ERROR;
  SwitchState stable=SWITCH_ERROR;
  uint64_t candidateSinceUs=0;
  bool changed=false;
};

struct ButtonFilter {
  bool armed=false;
  bool wasHeld=false;
  bool releaseTracking=false;
  uint64_t releaseSinceUs=0;
  uint64_t lastAcceptedUs=0;
  bool hasAccepted=false;
};

struct ControlState {
  SwitchFilter switches[2];
  ButtonFilter buttons[2];

  // Switch state is retained only for menu navigation/debounce.
  // Switches do not affect gameplay.
  uint8_t owner=0; // retained for compatibility with existing state layout/debugging
  Lane lane=Lane::Center;
  uint8_t menuPressMask=0;
  bool menuChordSeen=false;
  bool menuArmed=false;
  uint64_t allReleasedSinceUs=0;
  bool allReleasedTracking=false;
};

struct ControlFrame {
  uint64_t nowUs=0;
  int64_t songUs=0;
  Lane lane=Lane::Center;
  uint8_t pressedMask=0;
  uint8_t heldMask=0;
  uint8_t clickedMask=0;
  int8_t menuMove=0;
  bool bothCentered=false;
};

struct RunStats {
  uint32_t score=0;
  uint32_t combo=0;
  uint32_t maxCombo=0;
  uint16_t perfect=0;
  uint16_t good=0;
  uint16_t missed=0;
  uint16_t overstrums=0;
  uint16_t resolved=0;
  uint16_t chartTargets=0;
  uint8_t lives=3;
};

struct PlayerVisual {
  Lane logicalLane=Lane::Center;
  int32_t fromXQ8=120*256;
  int16_t toX=120;
  uint64_t slideStartedUs=0;
  uint64_t muzzleStartedUs[2]={0,0};
  uint8_t muzzleActiveMask=0;
};

struct ChartCursor {
  uint8_t phraseIndex=0;
  uint8_t noteIndex=0;
  uint16_t nextSequence=0;
  bool finished=false;
};

struct ActiveNote {
  NoteStatus status=NoteStatus::Free;
  uint16_t sequence=0;
  uint16_t dueTick=0;
  Lane lane=Lane::Center;
  uint8_t requiredMask=0;
  uint8_t receivedMask=0;
  int32_t firstErrorUs=0;
  int64_t firstPressSongUs=0;
  uint64_t flybyStartedUs=0;
  int16_t flybyStartX=0;
  int16_t flybyStartY=0;
  uint16_t flybyStartScaleQ8=256;
  int8_t flybySide=1;
};

struct Effect {
  bool active=false;
  FxKind kind=FxKind::Burst;
  uint64_t startedUs=0;
  uint32_t durationUs=0;
  Point16 origin{0,0};
  Point16 end{0,0};
  uint16_t seed=0;
  uint8_t paletteIndex=0;
  uint16_t id=0;
};

struct FeedbackState {
  FeedbackKind kind=FeedbackKind::None;
  uint64_t startedUs=0;
  uint32_t durationUs=0;
  uint32_t milestoneCombo=0;
};

struct AudioState {
  uint32_t lastHz[2]={0,0};
  uint16_t lastDuty[2]={0,0};
  uint8_t volume=50;
  uint64_t volumeReadUs=0;
  uint8_t sfxId=0;
  uint8_t sfxPriority=0;
  uint64_t sfxStartedUs=0;
};

struct ProjectedNote {
  uint16_t sequence=0;
  int16_t x=0,y=0;
  uint16_t scaleQ8=0;
  uint8_t mask=0;
  NoteStatus status=NoteStatus::Free;
  int32_t timingErrorUs=0;
  Rect bounds{0,0,0,0};
  bool foreground=false;
};

struct EffectVisual {
  uint16_t id=0;
  FxKind kind=FxKind::Burst;
  Point16 origin{0,0};
  Point16 end{0,0};
  uint16_t ageQ10=0;
  uint16_t seed=0;
  uint8_t paletteIndex=0;
  Rect bounds{0,0,0,0};
};

struct RenderSnapshot {
  bool valid=false;
  Phase phase=Phase::Title;
  uint32_t generation=0;
  uint64_t wallUs=0;
  int64_t visualSongUs=0;
  int16_t playerX=120;
  Lane lane=Lane::Center;
  bool playerVisible=true;
  uint8_t engineStep=0;
  ProjectedNote notes[MAX_PROJECTED];
  uint8_t noteCount=0;
  EffectVisual effects[MAX_VISUAL_EFFECTS];
  uint8_t effectCount=0;
  uint32_t score=0;
  uint32_t combo=0;
  uint8_t lives=3;
  uint8_t multiplier=1;
  DifficultyId difficulty=DifficultyId::Normal;
  int8_t countdown=0;
  FeedbackKind feedback=FeedbackKind::None;
  uint8_t selectedDifficulty=1;
  uint16_t progressPx=0;
  uint16_t perfect=0,good=0,missed=0,extras=0;
  uint32_t maxCombo=0;
  uint16_t accuracyPermille=0;
  ResultReason result=ResultReason::None;
};

struct DirtyRows {
  int16_t minX[SCREEN_H];
  int16_t maxX[SCREEN_H];
};

struct RenderState {
  RenderSnapshot presented;
  RenderSnapshot pending;
  DirtyRows dirty;
  uint16_t strip[SCREEN_W*STRIP_H];
  uint16_t scanY=0;
  bool inFlight=false;
  bool fullRepaint=true;
  uint64_t lastSnapshotUs=0;
  uint16_t rowColor[SCREEN_H];
  uint32_t generation=1;
};

struct StarDef { uint8_t x,y,brightness; };

struct GameState {
  Phase phase=Phase::Title;
  DifficultyId selected=DifficultyId::Normal;
  DifficultyId active=DifficultyId::Normal;
  ResultReason result=ResultReason::None;
  ClockState clock;
  ControlState controls;
  RunStats stats;
  PlayerVisual player;
  ChartCursor cursor;
  ActiveNote notes[MAX_NOTES];
  Effect effects[MAX_EFFECTS];
  FeedbackState feedback;
  AudioState audio;
  RenderState render;
  StarDef stars[18];
  uint64_t centeredSinceUs=0;
  bool centerTracking=false;
  uint64_t invulnerableUntilUs=0;
  uint16_t nextEffectId=1;
  uint64_t endingSongUs=0;
};

static GameState G;

// ============================================================
// DIFFICULTY / CHART TABLES
// ============================================================

static const DifficultyConfig DIFFS[5] = {
  { 96, 24, 65000,140000,"EASY",  "AFTERGLOW CIRCUIT"},
  {112, 20, 55000,120000,"NORMAL","RAIL PULSE"},
  // HARD is now halfway between the old NORMAL and old HARD profiles.
  {120, 18, 50000,110000,"HARD",  "STEEL CURRENT"},
  // EXPERT keeps the former MASTER lead and timing windows at 140 BPM.
  {140, 12, 35000, 75000,"EXPERT","SIGNAL FORGE"},
  {160, 12, 35000, 75000,"MASTER","VOLTAGE RUN"}
};

#define HB_NOTE(t,m) {t,m}
#define HB_COUNT(a) (uint8_t)(sizeof(a)/sizeof((a)[0]))

static const ChartNoteDef E0[]={HB_NOTE(0,1),HB_NOTE(8,2),HB_NOTE(16,1),HB_NOTE(24,2)};
static const ChartNoteDef E1[]={HB_NOTE(0,1),HB_NOTE(4,1),HB_NOTE(8,2),HB_NOTE(16,2),HB_NOTE(20,2),HB_NOTE(24,1)};
static const ChartNoteDef E2[]={HB_NOTE(0,2),HB_NOTE(8,1),HB_NOTE(16,2),HB_NOTE(24,1)};
static const ChartNoteDef E3[]={HB_NOTE(0,1),HB_NOTE(8,1),HB_NOTE(16,2),HB_NOTE(24,2)};
static const ChartNoteDef E4[]={HB_NOTE(0,1),HB_NOTE(4,2),HB_NOTE(8,1),HB_NOTE(16,2),HB_NOTE(20,1),HB_NOTE(24,2)};
static const ChartNoteDef E5[]={HB_NOTE(0,2),HB_NOTE(8,1),HB_NOTE(16,1),HB_NOTE(24,2)};
static const ChartNoteDef E6[]={HB_NOTE(0,1),HB_NOTE(8,2),HB_NOTE(16,2),HB_NOTE(24,1)};
static const ChartNoteDef E7[]={HB_NOTE(0,2),HB_NOTE(4,2),HB_NOTE(8,1),HB_NOTE(16,1),HB_NOTE(20,2),HB_NOTE(24,1)};

static const ChartNoteDef N0[]={HB_NOTE(0,1),HB_NOTE(4,2),HB_NOTE(8,1),HB_NOTE(12,2),HB_NOTE(16,1),HB_NOTE(20,2),HB_NOTE(24,1),HB_NOTE(26,2)};
static const ChartNoteDef N1[]={HB_NOTE(0,1),HB_NOTE(4,1),HB_NOTE(6,2),HB_NOTE(8,1),HB_NOTE(16,2),HB_NOTE(20,2),HB_NOTE(22,1),HB_NOTE(24,2)};
static const ChartNoteDef N2[]={HB_NOTE(0,2),HB_NOTE(4,1),HB_NOTE(8,2),HB_NOTE(10,1),HB_NOTE(16,1),HB_NOTE(20,2),HB_NOTE(24,1),HB_NOTE(26,2)};
static const ChartNoteDef N3[]={HB_NOTE(0,1),HB_NOTE(2,2),HB_NOTE(8,1),HB_NOTE(12,2),HB_NOTE(16,2),HB_NOTE(18,1),HB_NOTE(24,2)};
static const ChartNoteDef N4[]={HB_NOTE(0,2),HB_NOTE(4,2),HB_NOTE(8,1),HB_NOTE(12,1),HB_NOTE(16,2),HB_NOTE(20,1),HB_NOTE(24,2),HB_NOTE(26,1)};
static const ChartNoteDef N5[]={HB_NOTE(0,1),HB_NOTE(4,2),HB_NOTE(6,1),HB_NOTE(8,2),HB_NOTE(16,1),HB_NOTE(20,2),HB_NOTE(22,1),HB_NOTE(24,2)};
static const ChartNoteDef N6[]={HB_NOTE(0,2),HB_NOTE(4,1),HB_NOTE(8,2),HB_NOTE(12,1),HB_NOTE(16,1),HB_NOTE(20,2),HB_NOTE(24,1),HB_NOTE(26,2)};
static const ChartNoteDef N7[]={HB_NOTE(0,1),HB_NOTE(2,2),HB_NOTE(4,1),HB_NOTE(8,2),HB_NOTE(16,2),HB_NOTE(18,1),HB_NOTE(20,2),HB_NOTE(24,1)};

static const ChartNoteDef H0[]={HB_NOTE(0,1),HB_NOTE(2,2),HB_NOTE(4,1),HB_NOTE(6,2),HB_NOTE(8,1),HB_NOTE(10,2),HB_NOTE(12,3),HB_NOTE(16,2),HB_NOTE(18,1),HB_NOTE(20,2),HB_NOTE(22,1),HB_NOTE(24,2),HB_NOTE(26,1),HB_NOTE(28,2)};
static const ChartNoteDef H1[]={HB_NOTE(0,1),HB_NOTE(2,1),HB_NOTE(4,2),HB_NOTE(8,1),HB_NOTE(10,2),HB_NOTE(12,1),HB_NOTE(16,2),HB_NOTE(18,2),HB_NOTE(20,1),HB_NOTE(24,2),HB_NOTE(26,1),HB_NOTE(28,2)};
static const ChartNoteDef H2[]={HB_NOTE(0,2),HB_NOTE(3,1),HB_NOTE(4,2),HB_NOTE(6,1),HB_NOTE(8,2),HB_NOTE(10,1),HB_NOTE(12,2),HB_NOTE(16,3),HB_NOTE(19,2),HB_NOTE(20,1),HB_NOTE(22,2),HB_NOTE(24,1),HB_NOTE(26,2),HB_NOTE(28,1)};
static const ChartNoteDef H3[]={HB_NOTE(0,1),HB_NOTE(2,2),HB_NOTE(6,1),HB_NOTE(8,2),HB_NOTE(10,1),HB_NOTE(12,2),HB_NOTE(16,2),HB_NOTE(18,1),HB_NOTE(22,2),HB_NOTE(24,1),HB_NOTE(26,2),HB_NOTE(28,1)};
static const ChartNoteDef H4[]={HB_NOTE(0,1),HB_NOTE(2,2),HB_NOTE(4,1),HB_NOTE(8,2),HB_NOTE(9,1),HB_NOTE(10,2),HB_NOTE(12,3),HB_NOTE(16,2),HB_NOTE(18,1),HB_NOTE(20,2),HB_NOTE(24,1),HB_NOTE(25,2),HB_NOTE(26,1),HB_NOTE(28,2)};
static const ChartNoteDef H5[]={HB_NOTE(0,2),HB_NOTE(2,1),HB_NOTE(4,1),HB_NOTE(6,2),HB_NOTE(8,1),HB_NOTE(12,2),HB_NOTE(16,1),HB_NOTE(18,2),HB_NOTE(20,2),HB_NOTE(22,1),HB_NOTE(24,2),HB_NOTE(28,1)};
static const ChartNoteDef H6[]={HB_NOTE(0,1),HB_NOTE(3,2),HB_NOTE(4,1),HB_NOTE(8,2),HB_NOTE(10,1),HB_NOTE(12,2),HB_NOTE(16,3),HB_NOTE(19,1),HB_NOTE(20,2),HB_NOTE(24,1),HB_NOTE(26,2),HB_NOTE(28,1)};
static const ChartNoteDef H7[]={HB_NOTE(0,1),HB_NOTE(2,2),HB_NOTE(4,1),HB_NOTE(6,2),HB_NOTE(8,1),HB_NOTE(12,2),HB_NOTE(16,2),HB_NOTE(18,1),HB_NOTE(20,2),HB_NOTE(22,1),HB_NOTE(24,2),HB_NOTE(28,1)};

static const ChartNoteDef X0[]={HB_NOTE(0,1),HB_NOTE(1,2),HB_NOTE(2,1),HB_NOTE(4,2),HB_NOTE(6,1),HB_NOTE(8,2),HB_NOTE(10,1),HB_NOTE(12,3),HB_NOTE(16,2),HB_NOTE(17,1),HB_NOTE(18,2),HB_NOTE(20,1),HB_NOTE(22,2),HB_NOTE(24,1),HB_NOTE(26,2),HB_NOTE(28,3)};
static const ChartNoteDef X1[]={HB_NOTE(0,2),HB_NOTE(2,1),HB_NOTE(3,2),HB_NOTE(4,1),HB_NOTE(6,2),HB_NOTE(8,1),HB_NOTE(10,2),HB_NOTE(12,1),HB_NOTE(16,1),HB_NOTE(18,2),HB_NOTE(19,1),HB_NOTE(20,2),HB_NOTE(22,1),HB_NOTE(24,2),HB_NOTE(26,1),HB_NOTE(28,2)};
static const ChartNoteDef X2[]={HB_NOTE(0,3),HB_NOTE(4,1),HB_NOTE(5,2),HB_NOTE(6,1),HB_NOTE(8,2),HB_NOTE(10,1),HB_NOTE(12,2),HB_NOTE(16,3),HB_NOTE(20,2),HB_NOTE(21,1),HB_NOTE(22,2),HB_NOTE(24,1),HB_NOTE(26,2),HB_NOTE(28,1)};
static const ChartNoteDef X3[]={HB_NOTE(0,1),HB_NOTE(2,2),HB_NOTE(4,1),HB_NOTE(5,2),HB_NOTE(6,1),HB_NOTE(8,2),HB_NOTE(10,1),HB_NOTE(12,2),HB_NOTE(16,2),HB_NOTE(18,1),HB_NOTE(20,2),HB_NOTE(21,1),HB_NOTE(22,2),HB_NOTE(24,1),HB_NOTE(26,2),HB_NOTE(28,1)};
static const ChartNoteDef X4[]={HB_NOTE(0,2),HB_NOTE(1,1),HB_NOTE(2,2),HB_NOTE(4,1),HB_NOTE(6,2),HB_NOTE(8,1),HB_NOTE(12,3),HB_NOTE(16,1),HB_NOTE(17,2),HB_NOTE(18,1),HB_NOTE(20,2),HB_NOTE(22,1),HB_NOTE(24,2),HB_NOTE(28,3)};
static const ChartNoteDef X5[]={HB_NOTE(0,1),HB_NOTE(2,2),HB_NOTE(3,1),HB_NOTE(4,2),HB_NOTE(6,1),HB_NOTE(8,2),HB_NOTE(10,1),HB_NOTE(12,2),HB_NOTE(16,2),HB_NOTE(18,1),HB_NOTE(19,2),HB_NOTE(20,1),HB_NOTE(22,2),HB_NOTE(24,1),HB_NOTE(26,2),HB_NOTE(28,1)};
static const ChartNoteDef X6[]={HB_NOTE(0,3),HB_NOTE(4,2),HB_NOTE(6,1),HB_NOTE(7,2),HB_NOTE(8,1),HB_NOTE(10,2),HB_NOTE(12,1),HB_NOTE(16,3),HB_NOTE(20,1),HB_NOTE(22,2),HB_NOTE(23,1),HB_NOTE(24,2),HB_NOTE(26,1),HB_NOTE(28,2)};
static const ChartNoteDef X7[]={HB_NOTE(0,1),HB_NOTE(2,2),HB_NOTE(4,1),HB_NOTE(6,2),HB_NOTE(8,1),HB_NOTE(9,2),HB_NOTE(10,1),HB_NOTE(12,2),HB_NOTE(16,2),HB_NOTE(18,1),HB_NOTE(20,2),HB_NOTE(22,1),HB_NOTE(24,2),HB_NOTE(25,1),HB_NOTE(26,2),HB_NOTE(28,1)};

static const ChartNoteDef M0[]={HB_NOTE(0,1),HB_NOTE(1,2),HB_NOTE(2,1),HB_NOTE(3,2),HB_NOTE(4,1),HB_NOTE(6,2),HB_NOTE(8,1),HB_NOTE(9,2),HB_NOTE(10,1),HB_NOTE(11,2),HB_NOTE(12,1),HB_NOTE(16,2),HB_NOTE(17,1),HB_NOTE(18,2),HB_NOTE(19,1),HB_NOTE(20,2),HB_NOTE(22,1),HB_NOTE(24,2),HB_NOTE(25,1),HB_NOTE(26,2),HB_NOTE(27,1),HB_NOTE(28,2)};
static const ChartNoteDef M1[]={HB_NOTE(0,3),HB_NOTE(4,1),HB_NOTE(5,2),HB_NOTE(6,1),HB_NOTE(7,2),HB_NOTE(8,1),HB_NOTE(10,2),HB_NOTE(12,1),HB_NOTE(16,3),HB_NOTE(20,2),HB_NOTE(21,1),HB_NOTE(22,2),HB_NOTE(23,1),HB_NOTE(24,2),HB_NOTE(26,1),HB_NOTE(28,2)};
static const ChartNoteDef M2[]={HB_NOTE(0,2),HB_NOTE(1,1),HB_NOTE(2,2),HB_NOTE(4,1),HB_NOTE(5,2),HB_NOTE(6,1),HB_NOTE(8,2),HB_NOTE(9,1),HB_NOTE(10,2),HB_NOTE(12,3),HB_NOTE(16,1),HB_NOTE(17,2),HB_NOTE(18,1),HB_NOTE(20,2),HB_NOTE(21,1),HB_NOTE(22,2),HB_NOTE(24,1),HB_NOTE(25,2),HB_NOTE(26,1),HB_NOTE(28,3)};
static const ChartNoteDef M3[]={HB_NOTE(0,1),HB_NOTE(1,2),HB_NOTE(2,1),HB_NOTE(3,2),HB_NOTE(4,1),HB_NOTE(6,2),HB_NOTE(8,1),HB_NOTE(10,2),HB_NOTE(11,1),HB_NOTE(12,2),HB_NOTE(16,2),HB_NOTE(17,1),HB_NOTE(18,2),HB_NOTE(19,1),HB_NOTE(20,2),HB_NOTE(22,1),HB_NOTE(24,2),HB_NOTE(26,1),HB_NOTE(27,2),HB_NOTE(28,1)};
static const ChartNoteDef M4[]={HB_NOTE(0,2),HB_NOTE(2,1),HB_NOTE(3,2),HB_NOTE(4,1),HB_NOTE(5,2),HB_NOTE(6,1),HB_NOTE(8,2),HB_NOTE(9,1),HB_NOTE(10,2),HB_NOTE(12,1),HB_NOTE(16,1),HB_NOTE(18,2),HB_NOTE(19,1),HB_NOTE(20,2),HB_NOTE(21,1),HB_NOTE(22,2),HB_NOTE(24,1),HB_NOTE(25,2),HB_NOTE(26,1),HB_NOTE(28,2)};
static const ChartNoteDef M5[]={HB_NOTE(0,3),HB_NOTE(4,2),HB_NOTE(5,1),HB_NOTE(6,2),HB_NOTE(8,1),HB_NOTE(9,2),HB_NOTE(10,1),HB_NOTE(12,2),HB_NOTE(16,3),HB_NOTE(20,1),HB_NOTE(21,2),HB_NOTE(22,1),HB_NOTE(24,2),HB_NOTE(25,1),HB_NOTE(26,2),HB_NOTE(28,1)};
static const ChartNoteDef M6[]={HB_NOTE(0,1),HB_NOTE(1,2),HB_NOTE(2,1),HB_NOTE(4,2),HB_NOTE(6,1),HB_NOTE(7,2),HB_NOTE(8,1),HB_NOTE(9,2),HB_NOTE(10,1),HB_NOTE(12,3),HB_NOTE(16,2),HB_NOTE(17,1),HB_NOTE(18,2),HB_NOTE(20,1),HB_NOTE(22,2),HB_NOTE(23,1),HB_NOTE(24,2),HB_NOTE(25,1),HB_NOTE(26,2),HB_NOTE(28,3)};
static const ChartNoteDef M7[]={HB_NOTE(0,2),HB_NOTE(1,1),HB_NOTE(2,2),HB_NOTE(3,1),HB_NOTE(4,2),HB_NOTE(6,1),HB_NOTE(8,2),HB_NOTE(9,1),HB_NOTE(10,2),HB_NOTE(11,1),HB_NOTE(12,2),HB_NOTE(16,1),HB_NOTE(17,2),HB_NOTE(18,1),HB_NOTE(19,2),HB_NOTE(20,1),HB_NOTE(22,2),HB_NOTE(24,1),HB_NOTE(25,2),HB_NOTE(26,1),HB_NOTE(27,2),HB_NOTE(28,1)};

static const PhraseDef EASY_BANK[8] = {
  {Lane::Center,Lane::Center,HB_COUNT(E0),E0},{Lane::Center,Lane::Center,HB_COUNT(E1),E1},
  {Lane::Left,Lane::Left,HB_COUNT(E2),E2},{Lane::Left,Lane::Left,HB_COUNT(E3),E3},
  {Lane::Center,Lane::Center,HB_COUNT(E4),E4},{Lane::Center,Lane::Center,HB_COUNT(E5),E5},
  {Lane::Right,Lane::Right,HB_COUNT(E6),E6},{Lane::Right,Lane::Right,HB_COUNT(E7),E7}
};
static const PhraseDef NORMAL_BANK[8] = {
  {Lane::Center,Lane::Center,HB_COUNT(N0),N0},{Lane::Left,Lane::Left,HB_COUNT(N1),N1},
  {Lane::Center,Lane::Center,HB_COUNT(N2),N2},{Lane::Right,Lane::Right,HB_COUNT(N3),N3},
  {Lane::Center,Lane::Center,HB_COUNT(N4),N4},{Lane::Left,Lane::Left,HB_COUNT(N5),N5},
  {Lane::Right,Lane::Right,HB_COUNT(N6),N6},{Lane::Center,Lane::Center,HB_COUNT(N7),N7}
};
static const PhraseDef HARD_BANK[8] = {
  {Lane::Center,Lane::Left,HB_COUNT(H0),H0},{Lane::Left,Lane::Center,HB_COUNT(H1),H1},
  {Lane::Center,Lane::Right,HB_COUNT(H2),H2},{Lane::Right,Lane::Center,HB_COUNT(H3),H3},
  {Lane::Center,Lane::Left,HB_COUNT(H4),H4},{Lane::Left,Lane::Right,HB_COUNT(H5),H5},
  {Lane::Right,Lane::Center,HB_COUNT(H6),H6},{Lane::Center,Lane::Center,HB_COUNT(H7),H7}
};
static const PhraseDef EXPERT_BANK[8] = {
  {Lane::Center,Lane::Left,HB_COUNT(X0),X0},{Lane::Left,Lane::Right,HB_COUNT(X1),X1},
  {Lane::Right,Lane::Center,HB_COUNT(X2),X2},{Lane::Center,Lane::Right,HB_COUNT(X3),X3},
  {Lane::Right,Lane::Left,HB_COUNT(X4),X4},{Lane::Left,Lane::Center,HB_COUNT(X5),X5},
  {Lane::Center,Lane::Left,HB_COUNT(X6),X6},{Lane::Right,Lane::Center,HB_COUNT(X7),X7}
};
static const PhraseDef MASTER_BANK[8] = {
  {Lane::Center,Lane::Left,HB_COUNT(M0),M0},{Lane::Left,Lane::Right,HB_COUNT(M1),M1},
  {Lane::Right,Lane::Center,HB_COUNT(M2),M2},{Lane::Center,Lane::Right,HB_COUNT(M3),M3},
  {Lane::Right,Lane::Left,HB_COUNT(M4),M4},{Lane::Left,Lane::Center,HB_COUNT(M5),M5},
  {Lane::Center,Lane::Left,HB_COUNT(M6),M6},{Lane::Right,Lane::Center,HB_COUNT(M7),M7}
};

#undef HB_NOTE
#undef HB_COUNT

static inline const PhraseDef* bankFor(DifficultyId id) {
  switch (id) {
    case DifficultyId::Easy: return EASY_BANK;
    case DifficultyId::Normal: return NORMAL_BANK;
    case DifficultyId::Hard: return HARD_BANK;
    case DifficultyId::Expert: return EXPERT_BANK;
    default: return MASTER_BANK;
  }
}

static inline Lane mirrorLane(Lane lane) {
  if (lane==Lane::Left) return Lane::Right;
  if (lane==Lane::Right) return Lane::Left;
  return lane;
}
static inline uint8_t swapGunMask(uint8_t m) {
  if (m==LEFT_GUN) return RIGHT_GUN;
  if (m==RIGHT_GUN) return LEFT_GUN;
  return m;
}

// ============================================================
// FONT (5x7, column-major)
// ============================================================

static const uint8_t FONT_DIGITS[10][5] = {
 {0x3E,0x51,0x49,0x45,0x3E},{0x00,0x42,0x7F,0x40,0x00},
 {0x42,0x61,0x51,0x49,0x46},{0x21,0x41,0x45,0x4B,0x31},
 {0x18,0x14,0x12,0x7F,0x10},{0x27,0x45,0x45,0x45,0x39},
 {0x3C,0x4A,0x49,0x49,0x30},{0x01,0x71,0x09,0x05,0x03},
 {0x36,0x49,0x49,0x49,0x36},{0x06,0x49,0x49,0x29,0x1E}
};
static const uint8_t FONT_ALPHA[26][5] = {
 {0x7E,0x11,0x11,0x11,0x7E},{0x7F,0x49,0x49,0x49,0x36},
 {0x3E,0x41,0x41,0x41,0x22},{0x7F,0x41,0x41,0x22,0x1C},
 {0x7F,0x49,0x49,0x49,0x41},{0x7F,0x09,0x09,0x09,0x01},
 {0x3E,0x41,0x49,0x49,0x7A},{0x7F,0x08,0x08,0x08,0x7F},
 {0x00,0x41,0x7F,0x41,0x00},{0x20,0x40,0x41,0x3F,0x01},
 {0x7F,0x08,0x14,0x22,0x41},{0x7F,0x40,0x40,0x40,0x40},
 {0x7F,0x02,0x0C,0x02,0x7F},{0x7F,0x04,0x08,0x10,0x7F},
 {0x3E,0x41,0x41,0x41,0x3E},{0x7F,0x09,0x09,0x09,0x06},
 {0x3E,0x41,0x51,0x21,0x5E},{0x7F,0x09,0x19,0x29,0x46},
 {0x46,0x49,0x49,0x49,0x31},{0x01,0x01,0x7F,0x01,0x01},
 {0x3F,0x40,0x40,0x40,0x3F},{0x1F,0x20,0x40,0x20,0x1F},
 {0x3F,0x40,0x38,0x40,0x3F},{0x63,0x14,0x08,0x14,0x63},
 {0x07,0x08,0x70,0x08,0x07},{0x61,0x51,0x49,0x45,0x43}
};
static const uint8_t GLYPH_SPACE[5]={0,0,0,0,0};
static const uint8_t GLYPH_COLON[5]={0,0x36,0x36,0,0};
static const uint8_t GLYPH_DOT[5]={0,0x60,0x60,0,0};
static const uint8_t GLYPH_PERCENT[5]={0x63,0x13,0x08,0x64,0x63};
static const uint8_t GLYPH_SLASH[5]={0x20,0x10,0x08,0x04,0x02};
static const uint8_t GLYPH_MINUS[5]={0x08,0x08,0x08,0x08,0x08};
static const uint8_t GLYPH_PLUS[5]={0x08,0x08,0x3E,0x08,0x08};
static const uint8_t GLYPH_EXCL[5]={0,0,0x5F,0,0};
static const uint8_t GLYPH_LT[5]={0x08,0x14,0x22,0x41,0};
static const uint8_t GLYPH_GT[5]={0,0x41,0x22,0x14,0x08};
static const uint8_t GLYPH_Q[5]={0x02,0x01,0x51,0x09,0x06};

static inline const uint8_t* glyphFor(char c) {
  if (c>='0' && c<='9') return FONT_DIGITS[c-'0'];
  if (c>='a' && c<='z') c = (char)(c-'a'+'A');
  if (c>='A' && c<='Z') return FONT_ALPHA[c-'A'];
  switch (c) {
    case ':': return GLYPH_COLON; case '.': return GLYPH_DOT;
    case '%': return GLYPH_PERCENT; case '/': return GLYPH_SLASH;
    case '-': return GLYPH_MINUS; case '+': return GLYPH_PLUS;
    case '!': return GLYPH_EXCL; case '<': return GLYPH_LT;
    case '>': return GLYPH_GT; case '?': return GLYPH_Q;
    default: return GLYPH_SPACE;
  }
}

// ============================================================
// TIME / CHART HELPERS
// ============================================================

static inline const DifficultyConfig& cfg() { return DIFFS[(uint8_t)G.active]; }
static inline const DifficultyConfig& cfg(DifficultyId d) { return DIFFS[(uint8_t)d]; }

static inline int64_t tickToUs(int32_t tick, const DifficultyConfig& c) {
  const int64_t D = (int64_t)c.bpm * 4LL;
  if (tick < 0) return -tickToUs(-tick, c);
  return ((int64_t)tick * 60000000LL + D/2LL) / D;
}
static inline int64_t floorDiv(int64_t n, int64_t d) {
  int64_t q=n/d, r=n%d;
  if (r!=0 && n<0) --q;
  return q;
}
static inline int32_t songTickAt(int64_t song, const DifficultyConfig& c) {
  int64_t D=(int64_t)c.bpm*4LL;
  int32_t est=(int32_t)floorDiv(song*D,60000000LL);
  while (tickToUs(est+1,c)<=song) ++est;
  while (tickToUs(est,c)>song) --est;
  return est;
}

static inline uint64_t advanceClock(uint32_t raw) {
  if (!G.clock.initialized) {
    G.clock.initialized=true;
    G.clock.lastRawUs=raw;
    return G.clock.nowUs;
  }
  G.clock.nowUs += (uint32_t)(raw - G.clock.lastRawUs);
  G.clock.lastRawUs=raw;
  return G.clock.nowUs;
}

static inline ChartEvent decodeEvent(const ChartCursor& cur, DifficultyId diff) {
  ChartEvent e{};
  const PhraseDef* bank=bankFor(diff);
  uint8_t motif=cur.phraseIndex/8;
  uint8_t base=cur.phraseIndex%8;
  const PhraseDef& p=bank[base];
  const ChartNoteDef& n=p.notes[cur.noteIndex];
  uint8_t mask=n.gunMask;
  if (motif==1 || motif==3) mask=swapGunMask(mask);

  // Two-lane button-only gameplay:
  // LEFT button targets always occupy the left lane.
  // RIGHT button targets always occupy the right lane.
  // Dual targets visually span both lanes and use Center only as a render anchor.
  Lane lane = mask==LEFT_GUN ? Lane::Left :
              mask==RIGHT_GUN ? Lane::Right :
                                Lane::Center;

  e.sequence=cur.nextSequence;
  e.dueTick=(uint16_t)(cur.phraseIndex*32 + n.tick);
  e.lane=lane;
  e.mask=mask;
  return e;
}

static inline void advanceChartCursor(ChartCursor& cur, DifficultyId diff) {
  if (cur.finished) return;
  const PhraseDef* bank=bankFor(diff);
  const PhraseDef& p=bank[cur.phraseIndex%8];
  ++cur.noteIndex; ++cur.nextSequence;
  if (cur.noteIndex>=p.noteCount) {
    cur.noteIndex=0;
    if (cur.phraseIndex>=31) cur.finished=true;
    else ++cur.phraseIndex;
  }
}

static inline bool eventAtTick(DifficultyId diff, int32_t tick, uint8_t& maskOut) {
  if (tick<0 || tick>=1024) return false;
  uint8_t phrase=(uint8_t)(tick/32);
  uint8_t local=(uint8_t)(tick%32);
  uint8_t motif=phrase/8;
  const PhraseDef& p=bankFor(diff)[phrase%8];
  for (uint8_t i=0;i<p.noteCount;i++) {
    if (p.notes[i].tick==local) {
      uint8_t m=p.notes[i].gunMask;
      if (motif==1 || motif==3) m=swapGunMask(m);
      maskOut=m;
      return true;
    }
  }
  return false;
}

static inline uint16_t countTargets(DifficultyId diff) {
  uint16_t motifCount=0;
  const PhraseDef* b=bankFor(diff);
  for (uint8_t i=0;i<8;i++) motifCount += b[i].noteCount;
  return (uint16_t)(motifCount*4);
}

static inline bool validateChart(DifficultyId diff, ChartSummary& s) {
  s={0,0,true};
  const DifficultyConfig& dc=cfg(diff);
  ChartCursor c{};
  ChartEvent prev{};
  bool havePrev=false;
  int64_t activeEnds[MAX_NOTES]{};
  uint8_t activeCount=0;

  while (!c.finished) {
    ChartEvent e=decodeEvent(c,diff);
    if (e.dueTick>=1024 || (havePrev && e.dueTick<=prev.dueTick)) s.valid=false;
    if ((uint8_t)diff<(uint8_t)DifficultyId::Hard && e.mask==BOTH_GUNS) s.valid=false;
    if (e.mask<LEFT_GUN || e.mask>BOTH_GUNS) s.valid=false;
    if (havePrev) {
      if ((e.mask==BOTH_GUNS || prev.mask==BOTH_GUNS) && e.dueTick-prev.dueTick<2) s.valid=false;
    }

    int64_t due=tickToUs((int32_t)e.dueTick,dc);
    int64_t spawn=due-tickToUs(dc.leadTicks,dc);
    uint8_t write=0;
    for (uint8_t i=0;i<activeCount;i++) if (activeEnds[i]>spawn) activeEnds[write++]=activeEnds[i];
    activeCount=write;
    if (activeCount>=MAX_NOTES) s.valid=false;
    else activeEnds[activeCount++]=due+(int64_t)dc.goodUs+(int64_t)FLYBY_US;
    if (activeCount>s.peakRequiredSlots) s.peakRequiredSlots=activeCount;

    prev=e; havePrev=true; ++s.targets;
    advanceChartCursor(c,diff);
  }
  if (s.targets!=countTargets(diff)) s.valid=false;
  return s.valid;
}

// ============================================================
// INPUT
// ============================================================

static inline SwitchState readGameSwitch(uint8_t upPin,uint8_t downPin) {
  bool up=digitalRead(upPin)==LOW;
  bool down=digitalRead(downPin)==LOW;
  if (up && !down) return SWITCH_UP;
  if (!up && down) return SWITCH_DOWN;
  if (!up && !down) return SWITCH_CENTER;
  return SWITCH_ERROR;
}
static inline Lane laneFromSwitch(SwitchState s) {
  if (s==SWITCH_UP) return Lane::Left;
  if (s==SWITCH_DOWN) return Lane::Right;
  return Lane::Center;
}
static inline bool validSwitch(SwitchState s) { return s!=SWITCH_ERROR; }

static inline bool updateSwitchFilter(SwitchFilter& f,SwitchState raw,uint64_t now) {
  f.changed=false;
  if (raw!=f.raw) { f.raw=raw; f.candidate=raw; f.candidateSinceUs=now; return false; }
  if (f.candidate!=raw) { f.candidate=raw; f.candidateSinceUs=now; return false; }
  if (f.stable!=f.candidate && now-f.candidateSinceUs>=SWITCH_STABLE_US) {
    f.stable=f.candidate; f.changed=true; return true;
  }
  return false;
}

static inline bool acceptButtonEdge(ButtonFilter& f,bool held,bool pressed,uint64_t now) {
  if (!held) {
    if (!f.releaseTracking) { f.releaseTracking=true; f.releaseSinceUs=now; }
    if (!f.armed && now-f.releaseSinceUs>=BUTTON_REARM_US) f.armed=true;
  } else {
    f.releaseTracking=false;
  }
  bool accepted=false;
  if (pressed && f.armed) {
    if (!f.hasAccepted || now-f.lastAcceptedUs>=BUTTON_GAP_US) {
      accepted=true; f.lastAcceptedUs=now; f.hasAccepted=true;
    }
    f.armed=false; f.releaseTracking=false;
  }
  f.wasHeld=held;
  return accepted;
}

static inline void resetInputArming(uint64_t now) {
  G.controls.menuPressMask=0;
  G.controls.menuChordSeen=false;
  G.controls.menuArmed=false;
  G.controls.allReleasedSinceUs=now;
  G.controls.allReleasedTracking=false;
  for (uint8_t i=0;i<2;i++) {
    G.controls.buttons[i].armed=false;
    G.controls.buttons[i].releaseTracking=false;
  }
}

static inline Lane stepLane(Lane lane,int8_t delta) {
  int8_t v=(int8_t)lane + delta;
  if(v<0) v=0;
  if(v>2) v=2;
  return (Lane)v;
}

static inline void resolveStepMovement() {
  // Intentionally empty.
  // Gameplay is button-only; physical switches are reserved for menus.
}


static inline void updateMenuClickLatch(ControlFrame& f) {
  if (f.heldMask==0) {
    if (!G.controls.allReleasedTracking) {
      G.controls.allReleasedTracking=true;
      G.controls.allReleasedSinceUs=f.nowUs;
    }
    if (!G.controls.menuArmed && f.nowUs-G.controls.allReleasedSinceUs>=MENU_RELEASE_US)
      G.controls.menuArmed=true;
    if (G.controls.menuArmed && G.controls.menuPressMask) {
      if (!G.controls.menuChordSeen && (G.controls.menuPressMask==LEFT_GUN || G.controls.menuPressMask==RIGHT_GUN))
        f.clickedMask=G.controls.menuPressMask;
      G.controls.menuPressMask=0;
      G.controls.menuChordSeen=false;
    }
  } else {
    G.controls.allReleasedTracking=false;
    if (f.heldMask==BOTH_GUNS) G.controls.menuChordSeen=true;
  }
  if (f.pressedMask && G.controls.menuArmed) {
    G.controls.menuPressMask |= f.pressedMask;
    if (G.controls.menuPressMask==BOTH_GUNS) G.controls.menuChordSeen=true;
  }
}

static inline ControlFrame sampleControls(const GameInput& input,uint64_t now) {
  ControlFrame f{}; f.nowUs=now;
  SwitchState lr=readGameSwitch(LEFT_UP_PIN,LEFT_DOWN_PIN);
  SwitchState rr=readGameSwitch(RIGHT_UP_PIN,RIGHT_DOWN_PIN);
  updateSwitchFilter(G.controls.switches[0],lr,now);
  updateSwitchFilter(G.controls.switches[1],rr,now);

  bool lacc=acceptButtonEdge(G.controls.buttons[0],input.leftButton,input.leftPressed,now);
  bool racc=acceptButtonEdge(G.controls.buttons[1],input.rightButton,input.rightPressed,now);
  if (lacc) f.pressedMask|=LEFT_GUN;
  if (racc) f.pressedMask|=RIGHT_GUN;
  if (input.leftButton) f.heldMask|=LEFT_GUN;
  if (input.rightButton) f.heldMask|=RIGHT_GUN;

  if (G.phase==Phase::Difficulty) {
    bool lu=G.controls.switches[0].changed && G.controls.switches[0].stable==SWITCH_UP;
    bool ld=G.controls.switches[0].changed && G.controls.switches[0].stable==SWITCH_DOWN;
    bool ru=G.controls.switches[1].changed && G.controls.switches[1].stable==SWITCH_UP;
    bool rd=G.controls.switches[1].changed && G.controls.switches[1].stable==SWITCH_DOWN;
    int8_t up=(lu||ru)?1:0, down=(ld||rd)?1:0;
    f.menuMove=(int8_t)(down-up);
  }
  f.lane=G.controls.lane;
  f.bothCentered=(G.controls.switches[0].stable==SWITCH_CENTER &&
                  G.controls.switches[1].stable==SWITCH_CENTER);
  updateMenuClickLatch(f);
  return f;
}

// ============================================================
// GEOMETRY / RECT HELPERS
// ============================================================

static inline Rect emptyRect(){return {0,0,0,0};}
static inline bool rectEmpty(const Rect& r){return r.w<=0||r.h<=0;}
static inline Rect unionRect(Rect a,Rect b){
  if(rectEmpty(a)) return b;
  if(rectEmpty(b)) return a;
  int32_t x0=a.x<b.x?a.x:b.x, y0=a.y<b.y?a.y:b.y;
  int32_t x1=(int32_t)a.x+a.w>((int32_t)b.x+b.w)?(int32_t)a.x+a.w:(int32_t)b.x+b.w;
  int32_t y1=(int32_t)a.y+a.h>((int32_t)b.y+b.h)?(int32_t)a.y+a.h:(int32_t)b.y+b.h;
  return {(int16_t)x0,(int16_t)y0,(int16_t)(x1-x0),(int16_t)(y1-y0)};
}
static inline Rect clipRect(Rect r,Rect c){
  int32_t x0=r.x>c.x?r.x:c.x, y0=r.y>c.y?r.y:c.y;
  int32_t x1=(int32_t)r.x+r.w < (int32_t)c.x+c.w ? (int32_t)r.x+r.w : (int32_t)c.x+c.w;
  int32_t y1=(int32_t)r.y+r.h < (int32_t)c.y+c.h ? (int32_t)r.y+r.h : (int32_t)c.y+c.h;
  if(x1<=x0||y1<=y0)return emptyRect();
  return {(int16_t)x0,(int16_t)y0,(int16_t)(x1-x0),(int16_t)(y1-y0)};
}
static inline int16_t laneX(Lane l){ return l==Lane::Left?40:(l==Lane::Right?200:120); }
static inline int16_t gateX(Lane l){ return l==Lane::Left?66:(l==Lane::Right?174:120); }

static inline int16_t playerXAt(uint64_t now) {
  uint64_t age=now-G.player.slideStartedUs;
  if (age>=SLIDE_US) return G.player.toX;
  int32_t q=(int32_t)((age*256ULL)/SLIDE_US);
  int32_t inv=256-q;
  int32_t ease=256 - (inv*inv)/256;
  int32_t from=G.player.fromXQ8/256;
  return (int16_t)(from + ((G.player.toX-from)*ease)/256);
}

static inline void setPlayerLane(Lane lane,uint64_t now) {
  if (lane==G.player.logicalLane) return;
  int16_t current=playerXAt(now);
  G.player.fromXQ8=(int32_t)current*256;
  G.player.toX=laneX(lane);
  G.player.slideStartedUs=now;
  G.player.logicalLane=lane;
}

static inline ProjectedNote projectActive(const ActiveNote& n,int64_t visualSong,uint64_t wall,const DifficultyConfig& c) {
  ProjectedNote p{}; p.sequence=n.sequence; p.mask=n.requiredMask; p.status=n.status;
  if(n.status==NoteStatus::Flyby) {
    uint64_t age=wall-n.flybyStartedUs;
    if(age>FLYBY_US) age=FLYBY_US;
    int32_t v=(int32_t)((age*1024ULL)/FLYBY_US);
    int32_t vv=(v*v)/1024;
    p.x=(int16_t)(n.flybyStartX + n.flybySide*((35*v + 45*vv)/1024));
    p.y=(int16_t)(n.flybyStartY + ((338-n.flybyStartY)*v)/1024);
    p.scaleQ8=(uint16_t)((n.flybyStartScaleQ8*(1024 + (768*v)/1024))/1024);
    p.foreground=p.y>=235;
  } else {
    int64_t due=tickToUs(n.dueTick,c);
    int64_t lead=tickToUs(c.leadTicks,c);
    int64_t spawn=due-lead;
    int64_t rel=visualSong-spawn;
    if(rel<0) { p.bounds=emptyRect(); return p; }
    int32_t u=(int32_t)((rel*1024LL)/lead);
    int32_t prog;
    if(u<=1024) {
      int32_t den=3072-2*u;
      prog=den>0?(u*1024)/den:1024;
    } else prog=1024 + 3*(u-1024);
    int32_t gx=gateX(n.lane);
    p.x=(int16_t)(120 + ((gx-120)*prog)/1024);
    p.y=(int16_t)(104 + (108*prog)/1024);
    int32_t scale=(int32_t)(46 + (210*prog)/1024); // .18..1.00 Q8
    if(scale>422)scale=422;
    p.scaleQ8=(uint16_t)scale;
    p.timingErrorUs=(int32_t)(visualSong-due);
  }
  int16_t hw=(n.requiredMask==BOTH_GUNS?14:11);
  int16_t hh=(n.requiredMask==BOTH_GUNS?8:7);
  hw=(int16_t)((hw*p.scaleQ8+255)/256 + 6);
  hh=(int16_t)((hh*p.scaleQ8+255)/256 + 7);

  // The timing cue bracket reaches x +/-19 and y +/-8 from the note center.
  // Keep the dirty bounds large enough for the entire cue at every scale so
  // purple/white bracket pixels cannot be left behind as the note moves.
  if(n.status!=NoteStatus::Flyby && n.status!=NoteStatus::DualBroken){
    if(hw<20) hw=20;
    if(hh<9) hh=9;
  }

  p.bounds={ (int16_t)(p.x-hw),(int16_t)(p.y-hh),(int16_t)(2*hw+1),(int16_t)(2*hh+1)};
  return p;
}

// ============================================================
// RUN / SCORING / EFFECTS
// ============================================================

static inline uint8_t multiplierFor(uint32_t combo) {
  uint8_t m=(uint8_t)(1 + (combo/10)); return m>4?4:m;
}
static inline uint16_t accuracyPermille(const RunStats& s) {
  if(!s.resolved) return 0;
  // Accuracy is hit rate: Perfect and Good are both successful hits.
  // Only resolved misses reduce the percentage; extra shots are tracked separately.
  uint32_t hits=(uint32_t)s.perfect + (uint32_t)s.good;
  uint32_t num=1000UL*hits;
  return (uint16_t)((num + s.resolved/2)/s.resolved);
}

static inline void clearNotesEffects() {
  for(uint8_t i=0;i<MAX_NOTES;i++) G.notes[i]=ActiveNote{};
  for(uint8_t i=0;i<MAX_EFFECTS;i++) G.effects[i]=Effect{};
  G.feedback=FeedbackState{};
}

static inline void resetRun(DifficultyId d) {
  G.active=d;
  G.stats=RunStats{};
  G.stats.lives=3;
  G.stats.chartTargets=countTargets(d);
  G.cursor=ChartCursor{};
  clearNotesEffects();
  G.player=PlayerVisual{};
  G.player.logicalLane=Lane::Center;
  G.player.fromXQ8=120*256;
  G.player.toX=120;
  G.player.slideStartedUs=G.clock.nowUs;
  G.controls.lane=Lane::Center;
  G.controls.owner=0;
  G.centerTracking=false;
  G.invulnerableUntilUs=0;
}

static inline int findEffectSlot() {
  int oldest=-1; uint64_t oldestT=UINT64_MAX;
  for(uint8_t i=0;i<MAX_EFFECTS;i++) {
    if(!G.effects[i].active) return i;
    if(G.effects[i].startedUs<oldestT){oldestT=G.effects[i].startedUs;oldest=i;}
  }
  return oldest;
}
static inline void addEffect(FxKind kind,Point16 a,Point16 b,uint32_t dur,uint16_t seed,uint8_t pal,uint64_t now) {
  int i=findEffectSlot(); if(i<0)return;
  Effect& e=G.effects[i]; e.active=true;e.kind=kind;e.startedUs=now;e.durationUs=dur;
  e.origin=a;e.end=b;e.seed=seed;e.paletteIndex=pal;e.id=G.nextEffectId++;
}

static inline void setFeedback(FeedbackKind kind,uint64_t now) {
  if(G.feedback.kind==FeedbackKind::Miss && now-G.feedback.startedUs<MISS_FEEDBACK_US && kind!=FeedbackKind::Miss) return;
  G.feedback.kind=kind;G.feedback.startedUs=now;
  G.feedback.durationUs=(kind==FeedbackKind::Miss)?MISS_FEEDBACK_US:FEEDBACK_US;
}

static inline void requestSfx(uint8_t id,uint8_t priority,uint64_t now) {
  if(priority>G.audio.sfxPriority || priority==G.audio.sfxPriority || G.audio.sfxId==0) {
    G.audio.sfxId=id;G.audio.sfxPriority=priority;G.audio.sfxStartedUs=now;
  }
}

static inline void awardHit(Judgment grade,uint8_t mask) {
  uint8_t mult=multiplierFor(G.stats.combo);
  uint32_t base=(grade==Judgment::Perfect)?100:60;
  if(mask==BOTH_GUNS) base*=2;
  uint64_t next=(uint64_t)G.stats.score + (uint64_t)base*mult;
  G.stats.score=(uint32_t)(next>SCORE_CAP?SCORE_CAP:next);
  ++G.stats.combo; if(G.stats.combo>G.stats.maxCombo)G.stats.maxCombo=G.stats.combo;
  if(grade==Judgment::Perfect)++G.stats.perfect; else ++G.stats.good;
  ++G.stats.resolved;
  if(G.stats.combo==10||G.stats.combo==20||G.stats.combo==30)G.feedback.milestoneCombo=G.stats.combo;
}

static inline int findFreeNoteSlot() {
  int oldestFly=-1; uint64_t oldest=UINT64_MAX;
  for(uint8_t i=0;i<MAX_NOTES;i++) {
    if(G.notes[i].status==NoteStatus::Free)return i;
    if(G.notes[i].status==NoteStatus::Flyby && G.notes[i].flybyStartedUs<oldest){oldest=G.notes[i].flybyStartedUs;oldestFly=i;}
  }
  return oldestFly;
}

static inline void beginEnding(ResultReason why,uint64_t now);

// Recovery lasts four beats. This keeps the protection musical: about 2.5 s
// on Easy and 1.5 s on Master, long enough for several targets to pass.
static inline uint32_t missRecoveryUs() {
  int64_t us=tickToUs(16,cfg());
  if(us<1) us=1;
  if(us>0xFFFFFFFFLL) us=0xFFFFFFFFLL;
  return (uint32_t)us;
}

static inline bool playerInvulnerable(uint64_t now) {
  return now<G.invulnerableUntilUs;
}

static inline bool applyMissDamage(uint64_t now) {
  if(playerInvulnerable(now)) return false;
  if(G.stats.lives>0)--G.stats.lives;
  G.invulnerableUntilUs=now+(uint64_t)missRecoveryUs();
  setFeedback(FeedbackKind::Miss,now);
  requestSfx(G.stats.lives?6:7,G.stats.lives?80:100,now);
  return true;
}

static inline void applyMissToSlot(int idx,int64_t song,uint64_t now) {
  if(idx<0||idx>=MAX_NOTES)return;
  ActiveNote& n=G.notes[idx];
  if(n.status==NoteStatus::Free||n.status==NoteStatus::Flyby)return;
  ProjectedNote p=projectActive(n,song,now,cfg());
  n.status=NoteStatus::Flyby;
  n.flybyStartedUs=now;n.flybyStartX=p.x;n.flybyStartY=p.y;n.flybyStartScaleQ8=p.scaleQ8;
  n.flybySide=n.lane==Lane::Left?-1:(n.lane==Lane::Right?1:((n.sequence&1)?1:-1));
  ++G.stats.missed;++G.stats.resolved;G.stats.combo=0;
  const bool damaged=applyMissDamage(now);
  addEffect(FxKind::MissAccent,{p.x,p.y},{p.x,(int16_t)(p.y+18)},120000,n.sequence,2,now);
  if(damaged && G.stats.lives==0)beginEnding(ResultReason::Failed,now);
}

static inline void applyMissEvent(const ChartEvent& e,uint64_t now) {
  ++G.stats.missed;++G.stats.resolved;G.stats.combo=0;
  const bool damaged=applyMissDamage(now);
  (void)e;
  if(damaged && G.stats.lives==0)beginEnding(ResultReason::Failed,now);
}

static inline void applyOverstrum(uint64_t now) {
  ++G.stats.overstrums;G.stats.combo=0;setFeedback(FeedbackKind::Extra,now);requestSfx(5,60,now);
}

static inline void completeTarget(int idx,Judgment grade,int32_t error,uint64_t now) {
  ActiveNote n=G.notes[idx];
  if(n.status==NoteStatus::Free||n.status==NoteStatus::Flyby)return;
  ProjectedNote p=projectActive(n,(int64_t)G.clock.nowUs-(int64_t)G.clock.songOriginUs,now,cfg());
  awardHit(grade,n.requiredMask);
  if(grade==Judgment::Perfect){setFeedback(FeedbackKind::Perfect,now);requestSfx(n.requiredMask==BOTH_GUNS?4:3,n.requiredMask==BOTH_GUNS?55:50,now);} 
  else {setFeedback(error<0?FeedbackKind::GoodEarly:FeedbackKind::GoodLate,now);requestSfx(2,40,now);}
  addEffect(FxKind::Burst,{p.x,p.y},{p.x,p.y},BURST_US,(uint16_t)(n.sequence^0x9E37),n.requiredMask,now);
  G.notes[idx]=ActiveNote{};
}

static inline void spawnDueNotes(int64_t song,uint64_t now) {
  if(G.cursor.finished)return;
  for(uint8_t iter=0;iter<24 && !G.cursor.finished;iter++) {
    ChartEvent e=decodeEvent(G.cursor,G.active);
    int64_t due=tickToUs(e.dueTick,cfg());
    int64_t spawn=due-tickToUs(cfg().leadTicks,cfg());
    if(song<spawn)break;
    if(song>due+(int64_t)cfg().goodUs) {
      applyMissEvent(e,now);advanceChartCursor(G.cursor,G.active);
      if(G.phase==Phase::FailFlyby)return;
      continue;
    }
    int slot=findFreeNoteSlot();
    if(slot<0){G.result=ResultReason::PoolOverflow;beginEnding(ResultReason::PoolOverflow,now);return;}
    ActiveNote& n=G.notes[slot];n=ActiveNote{};n.status=NoteStatus::Pending;n.sequence=e.sequence;n.dueTick=e.dueTick;n.lane=e.lane;n.requiredMask=e.mask;
    advanceChartCursor(G.cursor,G.active);
  }
}

static inline void expirePendingNotes(int64_t song,uint64_t now) {
  while(true) {
    int idx=-1;uint16_t best=0xFFFF;
    for(uint8_t i=0;i<MAX_NOTES;i++) {
      ActiveNote& n=G.notes[i];
      if(n.status==NoteStatus::Pending||n.status==NoteStatus::DualPrimed||n.status==NoteStatus::DualBroken) {
        if(n.dueTick<best){best=n.dueTick;idx=i;}
      }
    }
    if(idx<0)break;
    ActiveNote& n=G.notes[idx];
    if(n.status==NoteStatus::DualPrimed && song-n.firstPressSongUs>(int64_t)DUAL_SEPARATION_US)n.status=NoteStatus::DualBroken;
    int64_t deadline=tickToUs(n.dueTick,cfg())+(int64_t)cfg().goodUs;
    if(song<=deadline)break;
    applyMissToSlot(idx,song,now);
    if(G.phase==Phase::FailFlyby)break;
  }
}

static inline int findShotCandidate(uint8_t gun,int64_t pressSong) {
  int best=-1;uint16_t bestTick=0xFFFF,bestSeq=0xFFFF;
  for(uint8_t i=0;i<MAX_NOTES;i++) {
    ActiveNote& n=G.notes[i];
    if(!(n.status==NoteStatus::Pending||n.status==NoteStatus::DualPrimed))continue;

    const Lane buttonLane = gun==LEFT_GUN ? Lane::Left : Lane::Right;
    const bool laneMatches =
        n.requiredMask==BOTH_GUNS || n.lane==buttonLane;

    if(!laneMatches || !(n.requiredMask&gun) || (n.receivedMask&gun))continue;
    int64_t err=pressSong-tickToUs(n.dueTick,cfg());
    int64_t ae=err<0?-err:err;
    if(ae>(int64_t)cfg().goodUs)continue;
    if(n.dueTick<bestTick || (n.dueTick==bestTick&&n.sequence<bestSeq)){best=i;bestTick=n.dueTick;bestSeq=n.sequence;}
  }
  return best;
}

struct Completion { int slot=-1; Judgment grade=Judgment::Good; int32_t error=0; uint16_t due=0; uint16_t seq=0; };

static inline void judgePresses(const ControlFrame& f) {
  if(!f.pressedMask)return;
  int64_t song=f.songUs;
  if(G.phase==Phase::CountIn && song<-(int64_t)cfg().goodUs)return;
  uint8_t remaining=f.pressedMask;
  Completion comp[2];uint8_t cc=0;

  // True simultaneous dual gets first refusal on both edges.
  if(remaining==BOTH_GUNS) {
    int best=-1;uint16_t bt=0xFFFF;
    for(uint8_t i=0;i<MAX_NOTES;i++) {
      ActiveNote& n=G.notes[i];
      if(n.status!=NoteStatus::Pending || n.requiredMask!=BOTH_GUNS)continue;
      int64_t err=song-tickToUs(n.dueTick,cfg());int64_t ae=err<0?-err:err;
      if(ae<=(int64_t)cfg().goodUs && n.dueTick<bt){best=i;bt=n.dueTick;}
    }
    if(best>=0){
      int32_t err=(int32_t)(song-tickToUs(G.notes[best].dueTick,cfg()));
      int32_t ae=err<0?-err:err;
      comp[cc++]={best,ae<=(int32_t)cfg().perfectUs?Judgment::Perfect:Judgment::Good,err,G.notes[best].dueTick,G.notes[best].sequence};
      remaining=0;
    }
  }

  const uint8_t bits[2]={LEFT_GUN,RIGHT_GUN};
  for(uint8_t bi=0;bi<2;bi++) {
    uint8_t bit=bits[bi]; if(!(remaining&bit))continue;
    int idx=findShotCandidate(bit,song);
    if(idx<0)continue;
    ActiveNote& n=G.notes[idx];
    int32_t err=(int32_t)(song-tickToUs(n.dueTick,cfg()));
    if(n.requiredMask==BOTH_GUNS) {
      if(n.status==NoteStatus::Pending) {
        n.receivedMask=bit;n.firstPressSongUs=song;n.firstErrorUs=err;n.status=NoteStatus::DualPrimed;
        remaining&=(uint8_t)~bit;requestSfx(1,20,f.nowUs);
      } else if(n.status==NoteStatus::DualPrimed) {
        int64_t sep=song-n.firstPressSongUs;if(sep<0)sep=-sep;
        if(sep<=(int64_t)DUAL_SEPARATION_US) {
          n.receivedMask|=bit;
          int32_t ae1=n.firstErrorUs<0?-n.firstErrorUs:n.firstErrorUs;
          int32_t ae2=err<0?-err:err;
          int32_t rep=ae2>ae1?err:n.firstErrorUs;
          Judgment gr=(ae1<=(int32_t)cfg().perfectUs&&ae2<=(int32_t)cfg().perfectUs)?Judgment::Perfect:Judgment::Good;
          comp[cc++]={idx,gr,rep,n.dueTick,n.sequence};remaining&=(uint8_t)~bit;
        } else n.status=NoteStatus::DualBroken;
      }
    } else {
      int32_t ae=err<0?-err:err;
      comp[cc++]={idx,ae<=(int32_t)cfg().perfectUs?Judgment::Perfect:Judgment::Good,err,n.dueTick,n.sequence};
      remaining&=(uint8_t)~bit;
    }
  }

  if(cc==2 && (comp[1].due<comp[0].due || (comp[1].due==comp[0].due&&comp[1].seq<comp[0].seq))) {
    Completion t=comp[0];comp[0]=comp[1];comp[1]=t;
  }
  for(uint8_t i=0;i<cc;i++) completeTarget(comp[i].slot,comp[i].grade,comp[i].error,f.nowUs);
  if(remaining) applyOverstrum(f.nowUs);

  if(f.pressedMask&LEFT_GUN){G.player.muzzleStartedUs[0]=f.nowUs;G.player.muzzleActiveMask|=LEFT_GUN;
    addEffect(FxKind::BeamLeft,{(int16_t)(playerXAt(f.nowUs)-17),256},{gateX(f.lane),212},BEAM_US,0,0,f.nowUs);}
  if(f.pressedMask&RIGHT_GUN){G.player.muzzleStartedUs[1]=f.nowUs;G.player.muzzleActiveMask|=RIGHT_GUN;
    addEffect(FxKind::BeamRight,{(int16_t)(playerXAt(f.nowUs)+17),256},{gateX(f.lane),212},BEAM_US,0,1,f.nowUs);}
}

static inline void retireVisualNotes(uint64_t now) {
  for(uint8_t i=0;i<MAX_NOTES;i++) if(G.notes[i].status==NoteStatus::Flyby && now-G.notes[i].flybyStartedUs>=FLYBY_US)G.notes[i]=ActiveNote{};
  for(uint8_t i=0;i<MAX_EFFECTS;i++) if(G.effects[i].active && now-G.effects[i].startedUs>=G.effects[i].durationUs)G.effects[i].active=false;
  if(G.feedback.kind!=FeedbackKind::None && now-G.feedback.startedUs>=G.feedback.durationUs)G.feedback.kind=FeedbackKind::None;
}

static inline bool trackIsComplete(int64_t song) {
  return song>=tickToUs(1024,cfg()) && G.cursor.finished && G.stats.resolved==G.stats.chartTargets && G.stats.lives>0;
}

// ============================================================
// AUDIO
// ============================================================

struct VoiceCommand { uint32_t hz=0; uint8_t envelope=0; bool active=false; };

static inline void hardwareWriteVoice(uint8_t voice,uint32_t hz,uint16_t duty) {
#if defined(ARDUINO_ARCH_ESP32) || defined(SIM_ARCADE)
  if (!Music::gameEffectsAllowed()) return;
  uint8_t pin=voice==0?BUZZER_2_PIN:BUZZER_1_PIN;
  if(hz==0 || duty==0) { ledcWriteTone(pin,0); ledcWrite(pin,0); return; }
  ledcWriteTone(pin,hz); ledcWrite(pin,duty);
#else
  (void)voice;(void)hz;(void)duty;
#endif
}

static inline uint8_t currentGameVolume() {
#if defined(GAME_API_LIFECYCLE_VERSION) && GAME_API_LIFECYCLE_VERSION >= 1
  return gameAudioVolume();
#else
  return 50;
#endif
}

static inline void writeVoice(uint8_t voice,uint32_t hz,uint8_t env) {
  uint16_t duty=(uint16_t)((Music::dutyForVolume(G.audio.volume)*env)/255UL);
  if(hz==0||env==0||G.audio.volume==0)duty=0;
  if(G.audio.lastHz[voice]==hz && G.audio.lastDuty[voice]==duty)return;
  hardwareWriteVoice(voice,hz,duty);
  G.audio.lastHz[voice]=hz;G.audio.lastDuty[voice]=duty;
}

struct SongPattern {
  uint16_t melody[64];  // Eight bars of eighth notes; zero is a rest.
  uint16_t bass[32];    // Eight bars of quarter notes.
};

// Original two-voice arrangements, one for each difficulty and tempo.
static const SongPattern SONG_PATTERNS[5] = {
  { // Afterglow Circuit: relaxed minor-key pulse, 96 BPM.
    {440,0,523,659,0,587,523,0, 392,0,440,523,0,659,587,0,
     440,523,659,0,784,659,523,0, 587,523,440,0,392,0,440,0,
     659,0,784,880,0,784,659,0, 523,0,587,659,0,587,523,0,
     440,523,659,784,880,0,784,659, 587,523,440,392,440,0,0,0},
    {220,0,165,0, 175,0,196,0, 220,0,165,0, 196,0,220,0,
     175,0,262,0, 196,0,165,0, 220,0,196,0, 165,0,220,0}
  },
  { // Rail Pulse: chromatic blues melody and a moving bass, 112 BPM.
    {330,392,440,466,494,0,440,392, 330,0,392,440,494,587,494,0,
     392,440,494,0,659,587,494,440, 392,330,294,0,330,392,330,0,
     659,587,494,440,392,0,330,0, 330,392,466,494,587,0,494,392,
     440,494,587,659,740,659,587,0, 494,440,392,330,294,0,330,0},
    {165,247,165,247, 196,294,196,294, 220,330,220,330, 247,294,247,165,
     220,330,220,330, 196,294,196,294, 233,349,233,349, 247,294,247,165}
  },
  { // Steel Current: clipped industrial motif and marching low notes, 120 BPM.
    {392,392,0,587,466,0,392,0, 349,349,0,523,440,0,349,0,
     392,466,587,0,698,587,466,0, 523,466,392,0,349,0,392,0,
     784,0,698,587,0,466,392,0, 698,0,587,523,0,440,349,0,
     392,392,466,587,698,0,587,0, 523,466,392,0,349,0,392,0},
    {196,196,294,196, 175,175,262,175, 156,156,233,156, 196,294,175,196,
     233,233,349,233, 175,175,262,175, 156,156,233,156, 196,294,175,196}
  },
  { // Signal Forge: urgent minor-key hooks over a heavy pulse, 140 BPM.
    {466,523,587,0,698,587,523,0, 392,466,523,587,698,0,587,0,
     466,523,698,784,698,587,523,0, 587,523,466,392,466,0,0,0,
     698,784,932,0,784,698,587,0, 523,587,698,0,784,698,523,0,
     466,523,587,698,784,932,784,0, 698,587,523,466,392,466,523,0},
    {196,294,196,294, 156,233,156,233, 175,262,175,262, 147,220,147,220,
     196,294,196,294, 156,233,175,262, 175,262,175,262, 147,220,196,196}
  },
  { // Voltage Run: bright, fast arpeggios over a driving bass, 160 BPM.
    {659,784,988,784,659,587,494,0, 587,740,880,740,587,494,440,0,
     659,784,988,1175,988,784,659,0, 740,659,587,494,440,494,659,0,
     988,1175,1319,1175,988,784,659,0, 880,988,1175,988,880,740,587,0,
     784,988,1175,1319,1175,988,784,659, 740,659,587,494,440,494,659,0},
    {165,247,165,196, 147,220,147,185, 131,196,131,165, 165,247,196,165,
     196,294,196,247, 185,277,185,220, 175,262,175,220, 165,247,196,165}
  }
};

static inline VoiceCommand musicVoiceAt(uint8_t voice,int64_t song) {
  VoiceCommand v{};
  const DifficultyConfig& c=cfg();
  if(song<0) {
    if(voice!=0)return v;
    int32_t tick=songTickAt(song,c);
    int32_t beatTick=(int32_t)floorDiv(tick,4)*4;
    if(beatTick<-32 || beatTick>=0)return v;
    int64_t age=song-tickToUs(beatTick,c);
    if(age>=0&&age<10000){int beat=((beatTick+32)/4)%4;v={beat==0?880U:660U,180,true};}
    return v;
  }

  const SongPattern& pattern=SONG_PATTERNS[(uint8_t)G.active];
  const int32_t tick=songTickAt(song,c);
  const int32_t stepTicks=voice==0?4:2;
  const int32_t step=tick/stepTicks;
  const uint16_t hz=voice==0?pattern.bass[step%32]:pattern.melody[step%64];
  const int64_t age=song-tickToUs(step*stepTicks,c);
  const int64_t gate=tickToUs(stepTicks,c)*(voice==0?68:78)/100;
  if(hz&&age>=0&&age<gate)v={hz,(uint8_t)(voice==0?145:175),true};
  return v;
}

static inline VoiceCommand sfxVoiceAt(uint64_t now) {
  VoiceCommand v{};if(!G.audio.sfxId)return v;
  uint64_t a=now-G.audio.sfxStartedUs;
  switch(G.audio.sfxId) {
    case 1: if(a<8000)v={1200,100,true};else if(a<16000)v={800,100,true};break;
    case 2: if(a<12000)v={988,150,true};else if(a<28000)v={659,150,true};break;
    case 3: if(a<12000)v={1319,170,true};else if(a<28000)v={1760,170,true};break;
    case 4: if(a<10000)v={1319,170,true};else if(a<20000)v={1760,170,true};else if(a<30000)v={2093,170,true};break;
    case 5: if(a<20000)v={330,100,true};break;
    case 6: if(a<25000)v={220,170,true};else if(a<60000)v={165,170,true};break;
    case 7: if(a<70000)v={330,180,true};else if(a<140000)v={247,180,true};else if(a<210000)v={165,180,true};break;
    case 8: if(a<70000)v={523,160,true};else if(a<140000)v={659,160,true};else if(a<210000)v={784,160,true};else if(a<280000)v={1047,160,true};break;
    case 9: if(a<12000)v={740,90,true};break;
  }
  if(!v.active){G.audio.sfxId=0;G.audio.sfxPriority=0;}
  return v;
}

static inline void updateAudio(int64_t song,uint64_t now) {
  if(now-G.audio.volumeReadUs>=100000 || G.audio.volumeReadUs==0){G.audio.volume=currentGameVolume();G.audio.volumeReadUs=now;}
  VoiceCommand s=sfxVoiceAt(now);
  const bool playing=G.phase==Phase::CountIn||G.phase==Phase::Playing;
  VoiceCommand bass=playing?musicVoiceAt(0,song):VoiceCommand{};
  VoiceCommand melody=playing?musicVoiceAt(1,song):VoiceCommand{};
  if(s.active)melody=s;
  writeVoice(0,bass.hz,bass.envelope);
  writeVoice(1,melody.hz,melody.envelope);
}

static inline void stopAudio() {
  hardwareWriteVoice(0,0,0);hardwareWriteVoice(1,0,0);
  G.audio.lastHz[0]=G.audio.lastHz[1]=0;G.audio.lastDuty[0]=G.audio.lastDuty[1]=0;
  G.audio.sfxId=0;G.audio.sfxPriority=0;
}

// ============================================================
// STRIP RASTERIZER
// ============================================================

struct StripCanvas { uint16_t* pixels; Rect region; int16_t stride; };
static inline void plot(StripCanvas& c,int16_t x,int16_t y,uint16_t color){
  if(x<c.region.x||y<c.region.y||x>=c.region.x+c.region.w||y>=c.region.y+c.region.h)return;
  c.pixels[(y-c.region.y)*c.stride+(x-c.region.x)]=color;
}
static inline void hspan(StripCanvas& c,int16_t x0,int16_t x1,int16_t y,uint16_t color){
  if(y<c.region.y||y>=c.region.y+c.region.h) return;
  if(x0>x1){int16_t t=x0;x0=x1;x1=t;}
  if(x1<c.region.x||x0>=c.region.x+c.region.w) return;
  if(x0<c.region.x) x0=c.region.x;
  if(x1>=c.region.x+c.region.w) x1=c.region.x+c.region.w-1;
  uint16_t* p=&c.pixels[(y-c.region.y)*c.stride+(x0-c.region.x)];for(int16_t x=x0;x<=x1;x++)*p++=color;
}
static inline void fillRectLocal(StripCanvas& c,Rect r,uint16_t color){r=clipRect(r,c.region);if(rectEmpty(r))return;for(int16_t y=r.y;y<r.y+r.h;y++)hspan(c,r.x,r.x+r.w-1,y,color);}
static inline void lineLocal(StripCanvas& c,Point16 a,Point16 b,uint16_t color){
  // Most scene lines are outside a four-row strip. Reject them before walking
  // every pixel of the line, especially while drawing the ship and mountains.
  if(max(a.x,b.x)<c.region.x || min(a.x,b.x)>=c.region.x+c.region.w ||
     max(a.y,b.y)<c.region.y || min(a.y,b.y)>=c.region.y+c.region.h)return;
  int16_t x0=a.x,y0=a.y,x1=b.x,y1=b.y;int16_t dx=abs(x1-x0),sx=x0<x1?1:-1,dy=-abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;
  for(uint16_t guard=0;guard<700;guard++){plot(c,x0,y0,color);if(x0==x1&&y0==y1)break;int16_t e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}
}
static inline int16_t edgeX(Point16 a,Point16 b,int16_t y){if(a.y==b.y)return a.x;return (int16_t)(a.x+((int32_t)(b.x-a.x)*(y-a.y))/(b.y-a.y));}
static inline void triangleLocal(StripCanvas& c,Point16 a,Point16 b,Point16 d,uint16_t color){
  if(a.y>b.y){Point16 t=a;a=b;b=t;}if(b.y>d.y){Point16 t=b;b=d;d=t;}if(a.y>b.y){Point16 t=a;a=b;b=t;}
  if(a.y==d.y){int16_t mn=min(a.x,min(b.x,d.x)),mx=max(a.x,max(b.x,d.x));hspan(c,mn,mx,a.y,color);return;}
  int16_t y0=max<int16_t>(a.y,c.region.y), y1=min<int16_t>(d.y,c.region.y+c.region.h-1);
  for(int16_t y=y0;y<=y1;y++){
    bool lower=y>b.y;Point16 p0=a,p1=lower?d:b,p2=lower?b:a,p3=d;
    int16_t xa=edgeX(p0,p1,y),xb=edgeX(p2,p3,y);hspan(c,xa,xb,y,color);
  }
}
static inline void glyphLocal(StripCanvas& c,char ch,int16_t x,int16_t y,uint8_t scale,uint16_t color){
  const uint8_t* g=glyphFor(ch);for(uint8_t col=0;col<5;col++){uint8_t bits=g[col];for(uint8_t row=0;row<7;row++)if(bits&(1<<row))fillRectLocal(c,{(int16_t)(x+col*scale),(int16_t)(y+row*scale),scale,scale},color);}
}
static inline int16_t textWidth(const char* s,uint8_t scale){return (int16_t)(strlen(s)*6*scale-(strlen(s)?scale:0));}
static inline void textLocal(StripCanvas& c,const char* s,Rect r,uint8_t align,uint8_t scale,uint16_t color){
  int16_t w=textWidth(s,scale),x=r.x;if(align==1)x=r.x+(r.w-w)/2;else if(align==2)x=r.x+r.w-w;
  int16_t y=r.y;for(size_t i=0;s[i]&&x<r.x+r.w;i++,x+=6*scale)glyphLocal(c,s[i],x,y,scale,color);
}

// 8x11 nearest-neighbor version of the 5x7 font. This sits between scale 1
// and scale 2, which is useful for the tight second row of the gameplay HUD.
static inline void glyphLocalHud(StripCanvas& c,char ch,int16_t x,int16_t y,uint16_t color){
  const uint8_t* g=glyphFor(ch);
  for(uint8_t ty=0;ty<11;ty++){
    uint8_t row=(uint8_t)((ty*7U)/11U);
    for(uint8_t tx=0;tx<8;tx++){
      uint8_t col=(uint8_t)((tx*5U)/8U);
      if(g[col]&(1U<<row)) plot(c,(int16_t)(x+tx),(int16_t)(y+ty),color);
    }
  }
}
static inline int16_t hudTextWidth(const char* s){return (int16_t)(strlen(s)*9-(strlen(s)?1:0));}
static inline void textLocalHud(StripCanvas& c,const char* s,Rect r,uint8_t align,uint16_t color){
  int16_t w=hudTextWidth(s),x=r.x;if(align==1)x=r.x+(r.w-w)/2;else if(align==2)x=r.x+r.w-w;
  int16_t y=r.y;for(size_t i=0;s[i]&&x<r.x+r.w;i++,x+=9)glyphLocalHud(c,s[i],x,y,color);
}

// ============================================================
// SCENE ART
// ============================================================

static inline bool sunGapRow(int16_t y){return (y>=84&&y<=85)||(y>=90&&y<=92)||(y>=98&&y<=101)||(y>=107&&y<=110);}
static inline uint16_t sunColorAt(int16_t y){if(y<=75)return lerp565(0xFF,0xD3,0x5A,0xFF,0x78,0x6E,(uint16_t)(y-41),34);return lerp565(0xFF,0x78,0x6E,0xF5,0x2B,0x97,(uint16_t)(y-75),40);}
static inline int16_t sunHalfWidth(int16_t y){int16_t dy=y-78;int32_t q=37*37-dy*dy;if(q<=0)return 0;int16_t x=0;while((x+1)*(x+1)<=q)++x;return x;}

static inline void drawBackgroundRows(StripCanvas& c){for(int16_t y=c.region.y;y<c.region.y+c.region.h;y++)hspan(c,c.region.x,c.region.x+c.region.w-1,y,G.render.rowColor[y]);}
static inline void drawSkySun(StripCanvas& c){
  for(uint8_t i=0;i<18;i++){const StarDef&s=G.stars[i];plot(c,s.x,s.y,s.brightness?C_HIGHLIGHT:C_DIM_MESH);if(s.brightness>1){plot(c,s.x-1,s.y,C_DIM_MESH);plot(c,s.x+1,s.y,C_DIM_MESH);}}
  for(int16_t y=max<int16_t>(41,c.region.y);y<=min<int16_t>(115,c.region.y+c.region.h-1);y++){if(sunGapRow(y))continue;int16_t hw=sunHalfWidth(y);if(hw>0)hspan(c,120-hw,120+hw,y,sunColorAt(y));}
}
static inline void drawMountainsOneSide(StripCanvas& c,bool mirror){
  Point16 tris[4][3]={{{0,112},{15,79},{43,115}},{{16,119},{38,67},{77,121}},{{0,138},{10,101},{55,132}},{{36,130},{62,86},{94,124}}};
  for(uint8_t i=0;i<4;i++){Point16 a=tris[i][0],b=tris[i][1],d=tris[i][2];if(mirror){a.x=239-a.x;b.x=239-b.x;d.x=239-d.x;if(i==1)b.y+=8;if(i==3)b.y-=5;}triangleLocal(c,a,b,d,(i&1)?C_HULL_SHADOW:C_PANEL);lineLocal(c,a,b,C_DIM_MESH);lineLocal(c,b,d,(i==3)?C_CYAN:C_DIM_MESH);lineLocal(c,d,a,C_DIM_MESH);Point16 m1{(int16_t)((a.x+b.x)/2),(int16_t)((a.y+b.y)/2)},m2{(int16_t)((b.x+d.x)/2),(int16_t)((b.y+d.y)/2)};lineLocal(c,m1,m2,C_DIM_MESH);}
}
static inline void drawMountains(StripCanvas& c){
  // subtle skyline behind terrain
  const int8_t lx[5]={4,22,50,68,78}, lw[5]={5,7,4,6,3}, lh[5]={12,19,9,15,21};
  for(uint8_t i=0;i<5;i++){fillRectLocal(c,{lx[i],(int16_t)(104-lh[i]),lw[i],lh[i]},C_HULL_SHADOW);fillRectLocal(c,{(int16_t)(239-lx[i]-lw[i]),(int16_t)(104-lh[4-i]),lw[i],lh[4-i]},C_HULL_SHADOW);}
  drawMountainsOneSide(c,false);drawMountainsOneSide(c,true);
}
static inline void drawGround(StripCanvas& c,const RenderSnapshot& s){
  // Bresenham's rounded coordinate at each major-axis step gives the same
  // pixels as the full lines, while visiting only steps inside this strip.
  const int16_t y0=max<int16_t>(HORIZON_Y,c.region.y);
  const int16_t y1=min<int16_t>(FOOTER_Y,c.region.y+c.region.h-1);
  if(y0>y1)return;
  const int16_t ends[9]={-96,-24,24,72,120,168,216,264,336};
  for(uint8_t i=0;i<9;i++){
    const int16_t dx=abs(ends[i]-120);
    const int16_t sx=ends[i]<120?-1:1;
    const uint16_t color=(i==0||i==8)?C_HULL_PINK:C_DIM_MESH;
    if(dx<=FOOTER_Y-HORIZON_Y){
      for(int16_t y=y0;y<=y1;y++){
        int16_t step=y-HORIZON_Y;
        int16_t x=120+sx*((step*dx+(FOOTER_Y-HORIZON_Y)/2)/(FOOTER_Y-HORIZON_Y));
        plot(c,x,y,color);
      }
    } else {
      const int16_t dy=FOOTER_Y-HORIZON_Y;
      int16_t first=((int32_t)(y0-HORIZON_Y)*dx-dx/2+dy-1)/dy;
      int16_t last=((int32_t)(y1-HORIZON_Y+1)*dx-1-dx/2)/dy;
      if(first<0)first=0;
      if(last>dx)last=dx;
      for(int16_t step=first;step<=last;step++){
        int16_t y=HORIZON_Y+(step*dy+dx/2)/dx;
        plot(c,120+sx*step,y,color);
      }
    }
  }
}
static inline void drawBracket(StripCanvas& c,int16_t cx,int16_t cy,uint16_t col){
  int16_t x0=cx-19,x1=cx+19,y0=cy-8,y1=cy+8;lineLocal(c,{x0,y0},{(int16_t)(x0+8),y0},col);lineLocal(c,{x0,y0},{x0,(int16_t)(y0+5)},col);lineLocal(c,{x1,y0},{(int16_t)(x1-8),y0},col);lineLocal(c,{x1,y0},{x1,(int16_t)(y0+5)},col);lineLocal(c,{x0,y1},{(int16_t)(x0+8),y1},col);lineLocal(c,{x0,y1},{x0,(int16_t)(y1-5)},col);lineLocal(c,{x1,y1},{(int16_t)(x1-8),y1},col);lineLocal(c,{x1,y1},{x1,(int16_t)(y1-5)},col);
}
static inline void drawGates(StripCanvas& c,const RenderSnapshot& s){
  // Two permanent lanes: cyan/left button and pink/right button.
  drawBracket(c,gateX(Lane::Left),212,C_CYAN);
  drawBracket(c,gateX(Lane::Right),212,C_PINK);

  // A small locator follows the last button-fired side. Center is used only
  // briefly for simultaneous dual presses / initial neutral presentation.
  if(s.lane==Lane::Left || s.lane==Lane::Right) {
    const int16_t sx=laneX(s.lane);
    const uint16_t col=s.lane==Lane::Left?C_CYAN:C_PINK;
    hspan(c,gateX(s.lane)-6,gateX(s.lane)+6,222,col);
    triangleLocal(c,{sx,227},{(int16_t)(sx-4),233},{(int16_t)(sx+4),233},col);
  }
}

static const Point16 PLAYER_VERTS[14]={{0,-29},{8,-13},{27,-2},{17,1},{28,20},{7,12},{0,22},{-7,12},{-28,20},{-17,1},{-27,-2},{-8,-13},{0,-6},{0,8}};
static const uint8_t PLAYER_TRIS[14][3]={{0,1,12},{0,12,11},{11,12,10},{10,12,9},{1,2,12},{2,3,12},{9,12,8},{8,12,7},{12,13,7},{12,5,13},{7,13,6},{6,13,5},{3,4,12},{4,5,12}};
static inline Point16 pv(uint8_t i,int16_t cx){return {(int16_t)(cx+PLAYER_VERTS[i].x),(int16_t)(264+PLAYER_VERTS[i].y)};}
static inline void drawPlayer(StripCanvas& c,const RenderSnapshot& s){
  if(!s.playerVisible) return;
  for(uint8_t i=0;i<14;i++){uint16_t col=(i==4||i==13)?C_HULL_PINK:((i&1)?C_HULL_LIGHT:C_HULL_SHADOW);triangleLocal(c,pv(PLAYER_TRIS[i][0],s.playerX),pv(PLAYER_TRIS[i][1],s.playerX),pv(PLAYER_TRIS[i][2],s.playerX),col);}
  for(uint8_t i=0;i<12;i++){Point16 a=pv(i,s.playerX),b=pv((i+1)%12,s.playerX);lineLocal(c,a,b,(i<6)?C_PINK:C_CYAN);}lineLocal(c,pv(0,s.playerX),pv(6,s.playerX),C_HIGHLIGHT);
  fillRectLocal(c,{(int16_t)(s.playerX-1),245,3,12},C_HIGHLIGHT);
  fillRectLocal(c,{(int16_t)(s.playerX-18),255,3,8},C_CYAN);fillRectLocal(c,{(int16_t)(s.playerX+16),255,3,8},C_PINK);
  int16_t len=5+s.engineStep;lineLocal(c,{(int16_t)(s.playerX-8),280},{(int16_t)(s.playerX-8),(int16_t)(280+len)},C_CYAN);lineLocal(c,{(int16_t)(s.playerX+8),280},{(int16_t)(s.playerX+8),(int16_t)(280+len)},C_PINK);
}

static inline void drawSignatureShip(StripCanvas& c,int16_t cx,int16_t cy){
  const int16_t q=166; // ~65% size for title composition
  auto sp=[&](uint8_t i){return Point16{(int16_t)(cx+(PLAYER_VERTS[i].x*q)/256),(int16_t)(cy+(PLAYER_VERTS[i].y*q)/256)};};
  for(uint8_t i=0;i<14;i++){uint16_t col=(i==4||i==13)?C_HULL_PINK:((i&1)?C_HULL_LIGHT:C_HULL_SHADOW);triangleLocal(c,sp(PLAYER_TRIS[i][0]),sp(PLAYER_TRIS[i][1]),sp(PLAYER_TRIS[i][2]),col);}
  for(uint8_t i=0;i<12;i++)lineLocal(c,sp(i),sp((i+1)%12),(i<6)?C_PINK:C_CYAN);
  lineLocal(c,sp(0),sp(6),C_HIGHLIGHT);
  lineLocal(c,{(int16_t)(cx-6),(int16_t)(cy+12)},{(int16_t)(cx-6),(int16_t)(cy+20)},C_CYAN);
  lineLocal(c,{(int16_t)(cx+6),(int16_t)(cy+12)},{(int16_t)(cx+6),(int16_t)(cy+20)},C_PINK);
}

static inline void drawEnemy(StripCanvas& c,const ProjectedNote& n){
  if(rectEmpty(n.bounds)) return;
  int32_t q=n.scaleQ8;
  auto sx=[&](int16_t v){return (int16_t)(n.x+(v*q)/256);};
  auto sy=[&](int16_t v){return (int16_t)(n.y+(v*q)/256);};

  // Simple wide-diamond notes. Color indicates the required button.
  if(n.mask==BOTH_GUNS){
    Point16 top{n.x,sy(-6)};
    Point16 left{sx(-16),n.y};
    Point16 bottom{n.x,sy(7)};
    Point16 right{sx(16),n.y};
    Point16 center{n.x,n.y};

    triangleLocal(c,top,left,center,C_HULL_SHADOW);
    triangleLocal(c,left,bottom,center,C_HULL_LIGHT);
    triangleLocal(c,top,center,right,C_HULL_PINK);
    triangleLocal(c,center,bottom,right,C_HULL_LIGHT);

    lineLocal(c,top,left,C_CYAN);
    lineLocal(c,left,bottom,C_CYAN);
    lineLocal(c,bottom,right,C_PINK);
    lineLocal(c,right,top,C_PINK);
  } else {
    const uint16_t edge=(n.mask==LEFT_GUN)?C_CYAN:C_PINK;
    Point16 top{n.x,sy(-6)};
    Point16 left{sx(-14),n.y};
    Point16 bottom{n.x,sy(7)};
    Point16 right{sx(14),n.y};
    Point16 center{n.x,n.y};

    triangleLocal(c,top,left,center,C_HULL_SHADOW);
    triangleLocal(c,left,bottom,center,C_HULL_LIGHT);
    triangleLocal(c,top,center,right,C_HULL_LIGHT);
    triangleLocal(c,center,bottom,right,C_HULL_SHADOW);

    lineLocal(c,top,left,edge);
    lineLocal(c,left,bottom,edge);
    lineLocal(c,bottom,right,edge);
    lineLocal(c,right,top,edge);
  }

  int32_t ae=n.timingErrorUs<0?-n.timingErrorUs:n.timingErrorUs;
  if(n.status!=NoteStatus::Flyby && n.status!=NoteStatus::DualBroken && ae<=(int32_t)cfg().goodUs){uint16_t cue=ae<=(int32_t)cfg().perfectUs?C_HIGHLIGHT:C_VIOLET_GLOW;drawBracket(c,n.x,n.y,cue);}
}

static inline void drawEffects(StripCanvas& c,const RenderSnapshot& s,bool foreground){
  static const int16_t dirs[8][2]={{256,0},{181,181},{0,256},{-181,181},{-256,0},{-181,-181},{0,-256},{181,-181}};
  for(uint8_t i=0;i<s.effectCount;i++){const EffectVisual&e=s.effects[i];if(e.kind==FxKind::Burst ? ((e.origin.y>=235)!=foreground) : !foreground)continue;
    if(e.kind==FxKind::BeamLeft||e.kind==FxKind::BeamRight){lineLocal(c,e.origin,e.end,e.kind==FxKind::BeamLeft?C_CYAN:C_PINK);continue;}
    if(e.kind==FxKind::MissAccent){lineLocal(c,e.origin,e.end,C_MISS);continue;}
    if(e.kind==FxKind::Burst){uint16_t age=e.ageQ10;uint8_t start=(uint8_t)(e.seed&7),step=(e.seed&1)?3:1;int16_t rad=(int16_t)(2+(16*age)/1024);for(uint8_t k=0;k<6;k++){uint8_t di=(start+k*step)&7;int16_t x=(int16_t)(e.origin.x+(dirs[di][0]*rad)/256),y=(int16_t)(e.origin.y+(dirs[di][1]*rad)/256);Point16 a{x,y},b{(int16_t)(x+2),(int16_t)(y+1)},d{(int16_t)(x-1),(int16_t)(y+2)};triangleLocal(c,a,b,d,(k&1)?C_SUN_GOLD:(e.paletteIndex==RIGHT_GUN?C_PINK:C_CYAN));}}
  }
}

static inline const char* feedbackText(FeedbackKind f){switch(f){case FeedbackKind::Perfect:return "PERFECT";case FeedbackKind::GoodEarly:return "GOOD EARLY";case FeedbackKind::GoodLate:return "GOOD LATE";case FeedbackKind::Miss:return "MISS";case FeedbackKind::Extra:return "EXTRA";default:return "";}}

static inline void drawHUD(StripCanvas& c,const RenderSnapshot& s){
  fillRectLocal(c,{0,0,240,32},C_DEEP_VOID);char buf[32];snprintf(buf,sizeof(buf),"%lu",(unsigned long)s.score);textLocal(c,buf,{8,1,112,14},2,2,C_HIGHLIGHT);
  snprintf(buf,sizeof(buf),"X%u",s.multiplier);textLocal(c,buf,{126,1,40,14},1,2,s.multiplier>1?C_PINK:C_CYAN);
  for(uint8_t i=0;i<3;i++){int16_t x=193+i*16;uint16_t col=i<s.lives?C_PINK:C_DIM_MESH;lineLocal(c,{x,6},{(int16_t)(x+4),10},col);lineLocal(c,{(int16_t)(x+4),10},{x,14},col);lineLocal(c,{x,14},{(int16_t)(x-4),10},col);lineLocal(c,{(int16_t)(x-4),10},{x,6},col);}
  // The second HUD row uses an intermediate 8x11 font: still larger than
  // the original scale-1 labels, but short enough to stay clear of the divider.
  snprintf(buf,sizeof(buf),"COMBO %lu",(unsigned long)s.combo);textLocalHud(c,buf,{8,17,122,11},0,C_CYAN);textLocalHud(c,DIFFS[(uint8_t)s.difficulty].name,{144,17,88,11},2,C_HIGHLIGHT);
  hspan(c,8,231,31,C_DIM_MESH);if(s.progressPx>0)hspan(c,8,(int16_t)(8+s.progressPx),31,C_PINK);
}

static inline void drawFooter(StripCanvas& c){fillRectLocal(c,{0,308,240,12},C_DEEP_VOID);}
static inline void drawMenuFooter(StripCanvas& c){
  fillRectLocal(c,{0,MenuFooter::Y,MenuFooter::WIDTH,MenuFooter::HEIGHT},MenuFooter::BACKGROUND);
  textLocal(c,MenuFooter::TEXT,{0,MenuFooter::Y+4,MenuFooter::WIDTH,8},1,1,MenuFooter::FOREGROUND);
}

static inline void drawTitle(StripCanvas& c,const RenderSnapshot& s){
  drawSkySun(c);drawMountains(c);drawGround(c,s);textLocal(c,"HORIZON",{0,118,240,30},1,4,C_CYAN);textLocal(c,"BURN",{0,151,240,30},1,4,C_PINK);
  drawSignatureShip(c,120,246);textLocal(c,"PRESS TO START",{0,287,240,16},1,2,C_HIGHLIGHT);drawMenuFooter(c);
}

static inline void drawDifficulty(StripCanvas& c,const RenderSnapshot& s){
  drawSkySun(c);drawMountains(c);textLocal(c,"DIFFICULTY",{0,100,240,22},1,3,C_HIGHLIGHT);
  for(uint8_t i=0;i<5;i++){
    int16_t y=126+i*24;
    if(i==s.selectedDifficulty){
      fillRectLocal(c,{20,y,200,22},C_PANEL);
      hspan(c,20,219,y,C_CYAN);
      hspan(c,20,219,(int16_t)(y+21),C_CYAN);
    }
    textLocal(c,DIFFS[i].name,{20,(int16_t)(y+4),200,14},1,2,
              i==s.selectedDifficulty?C_HIGHLIGHT:C_VIOLET_GLOW);
  }
  textLocal(c,DIFFS[s.selectedDifficulty].songName,{0,248,240,14},1,2,C_HIGHLIGHT);

  // Bottom navigation buttons: left button goes back, right button starts play.
  const Rect backBtn{8,277,100,27};
  const Rect playBtn{132,277,100,27};
  fillRectLocal(c,backBtn,C_PANEL);
  hspan(c,backBtn.x,(int16_t)(backBtn.x+backBtn.w-1),backBtn.y,C_CYAN);
  hspan(c,backBtn.x,(int16_t)(backBtn.x+backBtn.w-1),(int16_t)(backBtn.y+backBtn.h-1),C_CYAN);
  lineLocal(c,{backBtn.x,backBtn.y},{backBtn.x,(int16_t)(backBtn.y+backBtn.h-1)},C_CYAN);
  lineLocal(c,{(int16_t)(backBtn.x+backBtn.w-1),backBtn.y},{(int16_t)(backBtn.x+backBtn.w-1),(int16_t)(backBtn.y+backBtn.h-1)},C_CYAN);
  triangleLocal(c,{16,290},{24,283},{24,297},C_CYAN);
  textLocal(c,"BACK",{28,284,70,14},1,2,C_HIGHLIGHT);

  fillRectLocal(c,playBtn,C_PANEL);
  hspan(c,playBtn.x,(int16_t)(playBtn.x+playBtn.w-1),playBtn.y,C_PINK);
  hspan(c,playBtn.x,(int16_t)(playBtn.x+playBtn.w-1),(int16_t)(playBtn.y+playBtn.h-1),C_PINK);
  lineLocal(c,{playBtn.x,playBtn.y},{playBtn.x,(int16_t)(playBtn.y+playBtn.h-1)},C_PINK);
  lineLocal(c,{(int16_t)(playBtn.x+playBtn.w-1),playBtn.y},{(int16_t)(playBtn.x+playBtn.w-1),(int16_t)(playBtn.y+playBtn.h-1)},C_PINK);
  textLocal(c,"PLAY",{142,284,66,14},1,2,C_HIGHLIGHT);
  triangleLocal(c,{224,290},{216,283},{216,297},C_PINK);
  drawMenuFooter(c);
}

static inline void drawGameplayScene(StripCanvas& c,const RenderSnapshot& s){
  drawSkySun(c);drawMountains(c);drawGround(c,s);drawGates(c,s);
  for(uint8_t i=0;i<s.noteCount;i++)if(!s.notes[i].foreground)drawEnemy(c,s.notes[i]);
  drawEffects(c,s,false);drawPlayer(c,s);
  for(uint8_t i=0;i<s.noteCount;i++)if(s.notes[i].foreground)drawEnemy(c,s.notes[i]);
  drawEffects(c,s,true);drawHUD(c,s);
  if(s.phase==Phase::CountIn && s.countdown>0){char b[6];snprintf(b,sizeof(b),"%d",(int)s.countdown);fillRectLocal(c,{98,149,44,38},C_PANEL);textLocal(c,b,{98,154,44,28},1,4,C_HIGHLIGHT);}
  const char* ft=feedbackText(s.feedback);if(ft[0]){fillRectLocal(c,{28,287,184,18},C_DEEP_VOID);textLocal(c,ft,{28,289,184,14},1,2,s.feedback==FeedbackKind::Miss?C_MISS:(s.feedback==FeedbackKind::Perfect?C_HIGHLIGHT:C_PINK));}
  if(s.phase==Phase::FailFlyby)textLocal(c,"SYSTEM BURNOUT",{0,142,240,18},1,2,C_MISS);
  if(s.phase==Phase::ClearOutro)textLocal(c,"TRACK CLEAR",{0,140,240,22},1,3,C_HIGHLIGHT);
  drawFooter(c);
}

static inline void drawResults(StripCanvas& c,const RenderSnapshot& s){
  drawSkySun(c);
  textLocal(c,s.result==ResultReason::Cleared?"TRACK CLEAR":"RUN OVER",{0,32,240,22},1,3,s.result==ResultReason::Cleared?C_HIGHLIGHT:C_MISS);
  char b[32];
  snprintf(b,sizeof(b),"%lu",(unsigned long)s.score);textLocal(c,b,{8,65,224,30},1,4,C_PINK);
  textLocal(c,DIFFS[(uint8_t)s.difficulty].name,{0,103,240,14},1,2,C_CYAN);

  fillRectLocal(c,{12,122,216,145},C_PANEL);
  snprintf(b,sizeof(b),"MAX COMBO %lu",(unsigned long)s.maxCombo);textLocal(c,b,{20,130,200,14},0,2,C_HIGHLIGHT);
  snprintf(b,sizeof(b),"ACCURACY %u.%u%%",s.accuracyPermille/10,s.accuracyPermille%10);textLocal(c,b,{20,153,200,14},0,2,C_HIGHLIGHT);
  snprintf(b,sizeof(b),"PERFECT %u",s.perfect);textLocal(c,b,{20,176,200,14},0,2,C_CYAN);
  snprintf(b,sizeof(b),"GOOD %u",s.good);textLocal(c,b,{20,199,200,14},0,2,C_PINK);
  snprintf(b,sizeof(b),"MISSES %u",s.missed);textLocal(c,b,{20,222,200,14},0,2,C_MISS);
  snprintf(b,sizeof(b),"EXTRA SHOTS %u",s.extras);textLocal(c,b,{20,245,200,14},0,2,C_VIOLET_GLOW);

  // Match the difficulty screen navigation: left button goes back, right button plays again.
  const Rect backBtn{8,277,100,27};
  const Rect playBtn{132,277,100,27};
  fillRectLocal(c,backBtn,C_PANEL);
  hspan(c,backBtn.x,(int16_t)(backBtn.x+backBtn.w-1),backBtn.y,C_CYAN);
  hspan(c,backBtn.x,(int16_t)(backBtn.x+backBtn.w-1),(int16_t)(backBtn.y+backBtn.h-1),C_CYAN);
  lineLocal(c,{backBtn.x,backBtn.y},{backBtn.x,(int16_t)(backBtn.y+backBtn.h-1)},C_CYAN);
  lineLocal(c,{(int16_t)(backBtn.x+backBtn.w-1),backBtn.y},{(int16_t)(backBtn.x+backBtn.w-1),(int16_t)(backBtn.y+backBtn.h-1)},C_CYAN);
  triangleLocal(c,{16,290},{24,283},{24,297},C_CYAN);
  textLocal(c,"BACK",{28,284,70,14},1,2,C_HIGHLIGHT);

  fillRectLocal(c,playBtn,C_PANEL);
  hspan(c,playBtn.x,(int16_t)(playBtn.x+playBtn.w-1),playBtn.y,C_PINK);
  hspan(c,playBtn.x,(int16_t)(playBtn.x+playBtn.w-1),(int16_t)(playBtn.y+playBtn.h-1),C_PINK);
  lineLocal(c,{playBtn.x,playBtn.y},{playBtn.x,(int16_t)(playBtn.y+playBtn.h-1)},C_PINK);
  lineLocal(c,{(int16_t)(playBtn.x+playBtn.w-1),playBtn.y},{(int16_t)(playBtn.x+playBtn.w-1),(int16_t)(playBtn.y+playBtn.h-1)},C_PINK);
  textLocal(c,"PLAY",{142,284,66,14},1,2,C_HIGHLIGHT);
  triangleLocal(c,{224,290},{216,283},{216,297},C_PINK);
  drawMenuFooter(c);
}
static inline void drawFault(StripCanvas& c,const RenderSnapshot& s){fillRectLocal(c,{0,0,240,320},C_DEEP_VOID);textLocal(c,"CANNOT START",{0,96,240,22},1,3,C_MISS);const char* r=s.result==ResultReason::PoolOverflow?"NOTE POOL FULL":"CHART ERROR";textLocal(c,r,{0,142,240,14},1,2,C_HIGHLIGHT);drawMenuFooter(c);}

static inline void composeRegion(const RenderSnapshot& s,Rect r,uint16_t* dst){StripCanvas c{dst,r,r.w};drawBackgroundRows(c);switch(s.phase){case Phase::Title:drawTitle(c,s);break;case Phase::Difficulty:drawDifficulty(c,s);break;case Phase::Ready:case Phase::CountIn:case Phase::Playing:case Phase::FailFlyby:case Phase::ClearOutro:drawGameplayScene(c,s);break;case Phase::Results:drawResults(c,s);break;case Phase::Fault:drawFault(c,s);break;}}

// ============================================================
// RENDERER
// ============================================================

static inline void clearDirtyRows(){for(int16_t y=0;y<SCREEN_H;y++){G.render.dirty.minX[y]=SCREEN_W;G.render.dirty.maxX[y]=-1;}}
static inline void markDirty(Rect r){r=clipRect(r,{0,0,SCREEN_W,SCREEN_H});if(rectEmpty(r))return;for(int16_t y=r.y;y<r.y+r.h;y++){if(r.x<G.render.dirty.minX[y])G.render.dirty.minX[y]=r.x;int16_t x1=r.x+r.w-1;if(x1>G.render.dirty.maxX[y])G.render.dirty.maxX[y]=x1;}}
static inline void markFull(){for(int16_t y=0;y<SCREEN_H;y++){G.render.dirty.minX[y]=0;G.render.dirty.maxX[y]=SCREEN_W-1;}}
static inline int layoutKind(Phase p){if(p==Phase::Title)return 0;if(p==Phase::Difficulty)return 1;if(p==Phase::Results)return 3;if(p==Phase::Fault)return 4;return 2;}
static inline Rect playerBounds(int16_t x){return {(int16_t)(x-32),231,64,68};}
static inline Rect laneLocatorBounds(Lane lane){
  int16_t x0=min<int16_t>(laneX(lane)-5,gateX(lane)-7);
  int16_t x1=max<int16_t>(laneX(lane)+5,gateX(lane)+7);
  return {x0,221,(int16_t)(x1-x0+1),13};
}
static inline Rect effectBounds(const EffectVisual& e){return e.bounds;}

static inline void captureRenderSnapshot(RenderSnapshot& s,uint64_t now,int64_t song){
  s=RenderSnapshot{};s.valid=true;s.phase=G.phase;s.generation=G.render.generation;s.wallUs=now;s.visualSongUs=song;s.playerX=playerXAt(now);s.lane=G.player.logicalLane;s.difficulty=G.active;s.selectedDifficulty=(uint8_t)G.selected;s.score=G.stats.score;s.combo=G.stats.combo;s.lives=G.stats.lives;s.multiplier=multiplierFor(G.stats.combo);s.feedback=G.feedback.kind;s.maxCombo=G.stats.maxCombo;s.perfect=G.stats.perfect;s.good=G.stats.good;s.missed=G.stats.missed;s.extras=G.stats.overstrums;s.accuracyPermille=accuracyPermille(G.stats);s.result=G.result;
  if(playerInvulnerable(now)) s.playerVisible=((now/INVULN_FLASH_US)&1ULL)==0;
  int32_t t=songTickAt(song,cfg());if(t<0)t=0;if(t>1024)t=1024;s.progressPx=(uint16_t)((223L*t)/1024L);
  if(G.phase==Phase::CountIn){int64_t rem=-song;if(rem>0){int64_t b=tickToUs(4,cfg());int n=(int)((rem+b-1)/b);if(n<1)n=1;if(n>8)n=8;s.countdown=0;}}
  s.engineStep=(uint8_t)((now/50000ULL)&3);
  for(uint8_t i=0;i<MAX_NOTES&&s.noteCount<MAX_PROJECTED;i++)if(G.notes[i].status!=NoteStatus::Free){ProjectedNote p=projectActive(G.notes[i],song,now,cfg());if(!rectEmpty(p.bounds))s.notes[s.noteCount++]=p;}
  // Far-to-near insertion sort by y.
  for(uint8_t i=1;i<s.noteCount;i++){ProjectedNote key=s.notes[i];int j=i-1;while(j>=0&&s.notes[j].y>key.y){s.notes[j+1]=s.notes[j];--j;}s.notes[j+1]=key;}
  for(uint8_t i=0;i<MAX_EFFECTS&&s.effectCount<MAX_VISUAL_EFFECTS;i++)if(G.effects[i].active){Effect&e=G.effects[i];uint64_t age=now-e.startedUs;if(age>e.durationUs)age=e.durationUs;EffectVisual v{};v.id=e.id;v.kind=e.kind;v.origin=e.origin;v.end=e.end;v.seed=e.seed;v.paletteIndex=e.paletteIndex;v.ageQ10=e.durationUs?(uint16_t)((age*1024ULL)/e.durationUs):1024;if(e.kind==FxKind::Burst)v.bounds={(int16_t)(e.origin.x-20),(int16_t)(e.origin.y-20),41,41};else {int16_t x0=min(e.origin.x,e.end.x)-3,y0=min(e.origin.y,e.end.y)-3,x1=max(e.origin.x,e.end.x)+3,y1=max(e.origin.y,e.end.y)+3;v.bounds={x0,y0,(int16_t)(x1-x0+1),(int16_t)(y1-y0+1)};}s.effects[s.effectCount++]=v;}
}

static inline const ProjectedNote* findProjected(const RenderSnapshot& s,uint16_t seq){for(uint8_t i=0;i<s.noteCount;i++)if(s.notes[i].sequence==seq)return &s.notes[i];return nullptr;}
static inline uint8_t noteCueState(const ProjectedNote& n){
  if(n.status==NoteStatus::Flyby || n.status==NoteStatus::DualBroken) return 0;
  int32_t ae=n.timingErrorUs<0?-n.timingErrorUs:n.timingErrorUs;
  if(ae<=(int32_t)cfg().perfectUs) return 2;
  if(ae<=(int32_t)cfg().goodUs) return 1;
  return 0;
}
static inline const EffectVisual* findEffectVisual(const RenderSnapshot& s,uint16_t id){for(uint8_t i=0;i<s.effectCount;i++)if(s.effects[i].id==id)return &s.effects[i];return nullptr;}

static inline void collectDirty(const RenderSnapshot& old,const RenderSnapshot& next){
  clearDirtyRows();
  if(G.render.fullRepaint||!old.valid||old.generation!=next.generation||layoutKind(old.phase)!=layoutKind(next.phase)){markFull();return;}
  if(layoutKind(next.phase)==2){
    if(old.playerX!=next.playerX){markDirty(playerBounds(old.playerX));markDirty(playerBounds(next.playerX));}
    else if(old.playerVisible!=next.playerVisible)markDirty(playerBounds(next.playerX));
    else if(old.engineStep!=next.engineStep && next.playerVisible)markDirty({(int16_t)(next.playerX-9),279,19,12});
    if(old.lane!=next.lane){
      // Only the lane locators change; the two bracket outlines stay fixed.
      if(old.lane!=Lane::Center)markDirty(laneLocatorBounds(old.lane));
      if(next.lane!=Lane::Center)markDirty(laneLocatorBounds(next.lane));
    }
    for(uint8_t i=0;i<old.noteCount;i++){const ProjectedNote*n=findProjected(next,old.notes[i].sequence);if(!n||memcmp(&old.notes[i].bounds,&n->bounds,sizeof(Rect))||old.notes[i].status!=n->status||noteCueState(old.notes[i])!=noteCueState(*n))markDirty(old.notes[i].bounds);}
    for(uint8_t i=0;i<next.noteCount;i++){const ProjectedNote*o=findProjected(old,next.notes[i].sequence);if(!o||memcmp(&o->bounds,&next.notes[i].bounds,sizeof(Rect))||o->status!=next.notes[i].status||noteCueState(*o)!=noteCueState(next.notes[i]))markDirty(next.notes[i].bounds);}
    for(uint8_t i=0;i<old.effectCount;i++){const EffectVisual*n=findEffectVisual(next,old.effects[i].id);if(!n||n->ageQ10!=old.effects[i].ageQ10)markDirty(old.effects[i].bounds);}
    for(uint8_t i=0;i<next.effectCount;i++){const EffectVisual*o=findEffectVisual(old,next.effects[i].id);if(!o||o->ageQ10!=next.effects[i].ageQ10)markDirty(next.effects[i].bounds);}
    if(old.score!=next.score) markDirty({8,2,112,16});
    if(old.combo!=next.combo||old.multiplier!=next.multiplier) markDirty({8,2,160,28});
    if(old.lives!=next.lives) markDirty({185,2,52,16});
    if(old.progressPx!=next.progressPx) markDirty({8,30,224,2});
    if(old.feedback!=next.feedback) markDirty({28,287,184,18});
    if(old.countdown!=next.countdown||old.phase!=next.phase) markDirty({20,142,200,66});
  } else if(layoutKind(next.phase)==1){if(old.selectedDifficulty!=next.selectedDifficulty)markDirty({0,128,240,140});}
  // Title, results, and fault screens have no animation. Layout changes already
  // request a full repaint above, so an unchanged screen needs no SPI transfer.
}

static inline void invalidateLayout(){G.render.inFlight=false;G.render.fullRepaint=true;G.render.presented.valid=false;++G.render.generation;}
static inline bool beginRenderFrame(uint64_t now,int64_t song){
  if(G.render.inFlight) return false;
  if(!G.render.fullRepaint && now-G.render.lastSnapshotUs<FRAME_INTERVAL_US) return false;
  captureRenderSnapshot(G.render.pending,now,song);collectDirty(G.render.presented,G.render.pending);G.render.scanY=0;G.render.inFlight=true;G.render.lastSnapshotUs=now;return true;
}
static inline bool nextDirtyStrip(Rect& out){
  int16_t y=G.render.scanY;while(y<SCREEN_H&&G.render.dirty.maxX[y]<G.render.dirty.minX[y])++y;if(y>=SCREEN_H)return false;int16_t x0=G.render.dirty.minX[y],x1=G.render.dirty.maxX[y],h=1;while(h<STRIP_H&&y+h<SCREEN_H&&G.render.dirty.minX[y+h]==x0&&G.render.dirty.maxX[y+h]==x1)++h;out={x0,y,(int16_t)(x1-x0+1),h};return true;
}
static inline void flushRegion(Rect r,uint16_t* pixels){display.startWrite();display.setAddrWindow(r.x,r.y,r.w,r.h);display.writePixels(pixels,(uint32_t)r.w*r.h);display.endWrite();}
static inline void serviceRenderer(uint32_t budgetUs){
  if(!G.render.inFlight) return;
  uint32_t start=(uint32_t)micros();
  Rect r;
  while(nextDirtyStrip(r)){
    composeRegion(G.render.pending,r,G.render.strip);flushRegion(r,G.render.strip);for(int16_t y=r.y;y<r.y+r.h;y++){G.render.dirty.minX[y]=SCREEN_W;G.render.dirty.maxX[y]=-1;}G.render.scanY=r.y+r.h;
    if((uint32_t)((uint32_t)micros()-start)>=budgetUs)return;
  }
  G.render.presented=G.render.pending;G.render.inFlight=false;G.render.fullRepaint=false;
}
static inline bool currentPhasePresented(){return G.render.presented.valid && G.render.presented.phase==G.phase;}

static inline void buildRowPalette(){
  for(int16_t y=0;y<SCREEN_H;y++){
    if(y<32)G.render.rowColor[y]=C_DEEP_VOID;
    else if(y<=72)G.render.rowColor[y]=lerp565(0x08,0x06,0x17,0x1B,0x0B,0x38,(uint16_t)(y-32),40);
    else if(y<=114)G.render.rowColor[y]=lerp565(0x1B,0x0B,0x38,0x65,0x1B,0x69,(uint16_t)(y-73),41);
    else if(y<308)G.render.rowColor[y]=lerp565(0x20,0x10,0x38,0x08,0x0D,0x20,(uint16_t)(y-115),192);
    else G.render.rowColor[y]=C_DEEP_VOID;
  }
}
static inline uint32_t xorshift32(uint32_t& x){x^=x<<13;x^=x>>17;x^=x<<5;return x;}
static inline void buildStars(){uint32_t s=0x4842524EUL;uint8_t n=0;while(n<18){uint32_t v=xorshift32(s);uint8_t x=8+(v%224);uint8_t y=36+((v>>8)%57);int16_t dx=x-120,dy=y-78;if(dx*dx+dy*dy<44*44)continue;G.stars[n++]={x,y,(uint8_t)((v>>16)%3)};}}

// ============================================================
// STATE MACHINE
// ============================================================

static inline void enterTitle(uint64_t now,bool fresh=false){stopAudio();G.phase=Phase::Title;G.result=ResultReason::None;G.clock.phaseStartedUs=now;if(fresh)G.selected=DifficultyId::Normal;resetInputArming(now);invalidateLayout();}
static inline void enterDifficulty(uint64_t now){G.phase=Phase::Difficulty;G.clock.phaseStartedUs=now;resetInputArming(now);G.controls.switches[0].changed=G.controls.switches[1].changed=false;invalidateLayout();requestSfx(9,10,now);}
static inline void enterFault(ResultReason why,uint64_t now){stopAudio();G.phase=Phase::Fault;G.result=why;G.clock.phaseStartedUs=now;resetInputArming(now);invalidateLayout();}
static inline void enterReady(uint64_t now){ChartSummary s{};if(!validateChart(G.selected,s)){enterFault(ResultReason::InvalidChart,now);return;}resetRun(G.selected);G.phase=Phase::Ready;G.clock.phaseStartedUs=now;G.centerTracking=false;resetInputArming(now);invalidateLayout();}
// Countdown removed: Ready transitions directly into live gameplay.
static inline void startCountIn(uint64_t now){
  resetRun(G.selected);
  G.active=G.selected;
  G.phase=Phase::CountIn;
  G.clock.phaseStartedUs=now;

  // Restore the original 8-beat pre-roll, but keep its numeric overlay hidden.
  // Targets/music use this negative song-time window to approach naturally.
  G.clock.songOriginUs=now+(uint64_t)tickToUs(32,cfg());

  G.controls.lane=Lane::Center;
  G.controls.owner=0;
  G.player.logicalLane=Lane::Center;
  G.player.toX=120;
  G.player.fromXQ8=120*256;
  G.player.slideStartedUs=now;
  G.centerTracking=false;
  G.render.fullRepaint=false;
  G.render.lastSnapshotUs=0;
}
static inline void enterPlaying(uint64_t now){G.phase=Phase::Playing;G.clock.phaseStartedUs=now;}
static inline void beginEnding(ResultReason why,uint64_t now){
  if(G.phase==Phase::FailFlyby||G.phase==Phase::ClearOutro||G.phase==Phase::Results||G.phase==Phase::Fault)return;
  if(why==ResultReason::PoolOverflow||why==ResultReason::InvalidChart){enterFault(why,now);return;}
  G.result=why;G.clock.phaseStartedUs=now;G.endingSongUs=(uint64_t)((int64_t)now-(int64_t)G.clock.songOriginUs);
  G.phase=why==ResultReason::Failed?Phase::FailFlyby:Phase::ClearOutro;
  if(why==ResultReason::Cleared)requestSfx(8,100,now);else requestSfx(7,100,now);
}
static inline void enterResults(uint64_t now){stopAudio();G.phase=Phase::Results;G.clock.phaseStartedUs=now;for(uint8_t i=0;i<MAX_NOTES;i++)G.notes[i]=ActiveNote{};for(uint8_t i=0;i<MAX_EFFECTS;i++)G.effects[i]=Effect{};resetInputArming(now);invalidateLayout();}

static inline void updateMenuPhase(const ControlFrame& f){
  if(G.phase==Phase::Title){if(f.clickedMask){enterDifficulty(f.nowUs);return;}}
  else if(G.phase==Phase::Difficulty){if(f.menuMove){int v=(int)G.selected+f.menuMove;if(v<0)v=4;if(v>4)v=0;G.selected=(DifficultyId)v;requestSfx(9,10,f.nowUs);}if(f.clickedMask==RIGHT_GUN){requestSfx(9,10,f.nowUs);enterReady(f.nowUs);return;}if(f.clickedMask==LEFT_GUN){enterTitle(f.nowUs,false);return;}}
  else if(G.phase==Phase::Results){if(f.nowUs-G.clock.phaseStartedUs<RESULT_DWELL_US)return;if(f.clickedMask==RIGHT_GUN){enterReady(f.nowUs);return;}if(f.clickedMask==LEFT_GUN){enterDifficulty(f.nowUs);return;}}
}
static inline void updateReady(const ControlFrame& f){
  // No pre-song instruction splash: once the start button has been released
  // and the gameplay scene is available, begin the hidden-count-in immediately.
  if(f.heldMask==0 && currentPhasePresented()) startCountIn(f.nowUs);
}
static inline void updateEnding(uint64_t now){if(now-G.clock.phaseStartedUs>=ENDING_US)enterResults(now);}

// ============================================================
// PUBLIC LIFECYCLE
// ============================================================

inline void enter(){
  stopAudio();
  G=GameState{};
  G.clock.initialized=true;G.clock.lastRawUs=(uint32_t)micros();G.clock.nowUs=0;
  display.setRotation(0);display.setTextWrap(false);
  buildRowPalette();buildStars();clearDirtyRows();
  SwitchState l=readGameSwitch(LEFT_UP_PIN,LEFT_DOWN_PIN),r=readGameSwitch(RIGHT_UP_PIN,RIGHT_DOWN_PIN);
  G.controls.switches[0].raw=G.controls.switches[0].candidate=G.controls.switches[0].stable=l;
  G.controls.switches[1].raw=G.controls.switches[1].candidate=G.controls.switches[1].stable=r;
  G.controls.switches[0].candidateSinceUs=G.controls.switches[1].candidateSinceUs=0;
  G.controls.owner=0;G.controls.lane=Lane::Center;
  enterTitle(0,true);
}

inline void leave(){stopAudio();G.render.inFlight=false;clearNotesEffects();G.controls.menuPressMask=0;}
inline bool allowMenuExit(){return true;}

inline void update(const GameInput& input){
  uint64_t now=advanceClock((uint32_t)micros());
  ControlFrame controls=sampleControls(input,now);
  int64_t song=(int64_t)now-(int64_t)G.clock.songOriginUs;controls.songUs=song;

  if(G.phase==Phase::Title||G.phase==Phase::Difficulty||G.phase==Phase::Results)updateMenuPhase(controls);
  else if(G.phase==Phase::Ready)updateReady(controls);
  else if(G.phase==Phase::CountIn||G.phase==Phase::Playing){
    // Button-only movement/firing. A single button selects that visual lane and
    // fires it; a simultaneous pair recenters the ship while firing both lanes.
    if(controls.pressedMask==LEFT_GUN) {
      G.controls.lane=Lane::Left;
      setPlayerLane(Lane::Left,now);
    } else if(controls.pressedMask==RIGHT_GUN) {
      G.controls.lane=Lane::Right;
      setPlayerLane(Lane::Right,now);
    } else if(controls.pressedMask==BOTH_GUNS) {
      G.controls.lane=Lane::Center;
      setPlayerLane(Lane::Center,now);
    }

    expirePendingNotes(song,now);
    if(G.phase==Phase::CountIn||G.phase==Phase::Playing)spawnDueNotes(song,now);
    if(G.phase==Phase::CountIn||G.phase==Phase::Playing)judgePresses(controls);
    if(G.phase==Phase::CountIn&&song>=0)enterPlaying(now);
    if(G.phase==Phase::Playing&&trackIsComplete(song))beginEnding(ResultReason::Cleared,now);
    retireVisualNotes(now);
  } else if(G.phase==Phase::FailFlyby||G.phase==Phase::ClearOutro)updateEnding(now);

  int64_t audioSong=(int64_t)G.clock.nowUs-(int64_t)G.clock.songOriginUs;
  updateAudio(audioSong,G.clock.nowUs);
  beginRenderFrame(G.clock.nowUs,audioSong);
  serviceRenderer(RENDER_BUDGET_US);
  uint64_t refreshed=advanceClock((uint32_t)micros());
  int64_t refreshedSong=(int64_t)refreshed-(int64_t)G.clock.songOriginUs;
  updateAudio(refreshedSong,refreshed);
}

} // namespace HorizonBurn
