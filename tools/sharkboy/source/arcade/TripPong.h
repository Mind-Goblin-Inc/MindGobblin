#pragma once

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <math.h>
#include <string.h>
#include "GameAPI.h"
#include "Hardware.h"
#include "MusicPlayer.h"
#include "MenuFooter.h"

namespace Pong {

// Rendering revision: stable-kaleidoscope background pass.
// The playfield background is now drawn once per state transition and is NOT
// progressively swept/repainted during rallies.  This prevents background SPI
// writes from ever wiping the moving ball between foreground draws.

// ============================================================
// DISPLAY / GAMEPLAY CONSTANTS
// ============================================================

constexpr int16_t SCREEN_W = 240;
constexpr int16_t SCREEN_H = 320;
constexpr int16_t HUD_H = 36;
constexpr int16_t PLAY_TOP = HUD_H;
constexpr int16_t PLAY_BOTTOM = 319;
constexpr int16_t PLAY_HEIGHT = PLAY_BOTTOM - PLAY_TOP + 1;
constexpr int16_t CENTER_X = SCREEN_W / 2;
constexpr int16_t PLAY_CENTER_Y = (PLAY_TOP + PLAY_BOTTOM) / 2;

constexpr int16_t PADDLE_W = 7;
constexpr int16_t PADDLE_H = 44;
constexpr int16_t PADDLE_GLOW = 4;
constexpr int16_t LEFT_PADDLE_X = 12;
constexpr int16_t RIGHT_PADDLE_X = SCREEN_W - 12 - PADDLE_W;
constexpr float PLAYER_PADDLE_SPEED = 168.0f;
constexpr float CPU_PADDLE_SPEED = 132.0f;

constexpr int16_t BALL_RADIUS = 4;
constexpr float BALL_START_SPEED = 116.0f;
constexpr float BALL_SPEED_STEP = 6.0f;
constexpr float BALL_MAX_SPEED = 206.0f;
constexpr float BALL_MAX_BOUNCE_ANGLE = 1.01229f; // ~58 degrees
constexpr float BALL_MIN_VERTICAL = 18.0f;

constexpr uint32_t SIM_STEP_US = 10000;    // 100 Hz physics
constexpr uint32_t RENDER_STEP_US = 16667; // ~60 Hz render target
constexpr uint8_t MAX_SIM_STEPS = 5;
constexpr uint16_t POINT_HOLD_MS = 620;
constexpr uint8_t WIN_SCORE = 7;

// Full dirty rectangle for the two-line serve prompt. Keep this larger than
// the actual glyph bounds so every text pixel is restored when play begins.
constexpr int16_t SERVE_PROMPT_X = 52;
constexpr int16_t SERVE_PROMPT_Y = PLAY_CENTER_Y + 43;
constexpr int16_t SERVE_PROMPT_W = 136;
constexpr int16_t SERVE_PROMPT_H = 28;

constexpr uint8_t TRAIL_COUNT = 7;
constexpr uint8_t MAX_PARTICLES = 24;
constexpr uint8_t NEON_COUNT = 12;
constexpr uint8_t BG_COUNT = 8;

// ============================================================
// TYPES
// ============================================================

enum GameState : uint8_t {
  STATE_MODE_SELECT,
  STATE_SERVE,
  STATE_PLAYING,
  STATE_POINT,
  STATE_MATCH_OVER
};

enum GameMode : uint8_t {
  MODE_SINGLE_PLAYER,
  MODE_TWO_PLAYER
};

struct Rect {
  int16_t x;
  int16_t y;
  int16_t w;
  int16_t h;
};

struct Paddle {
  float y;
  float speed;
  int8_t direction;
  uint32_t flashUntilMs;
};

struct Ball {
  float x;
  float y;
  float vx;
  float vy;
  float speed;
};

struct TrailPoint {
  int16_t x;
  int16_t y;
  uint8_t hue;
};

struct Particle {
  bool active;
  float x;
  float y;
  float vx;
  float vy;
  uint8_t hue;
  uint32_t bornMs;
  uint16_t lifetimeMs;
};

struct SfxState {
  bool active;
  uint8_t pin;
  uint16_t frequency;
  uint32_t untilMs;
};

// ============================================================
// STATE
// ============================================================

GameState state = STATE_MODE_SELECT;
GameMode mode = MODE_SINGLE_PLAYER;

Paddle leftPaddle;
Paddle rightPaddle;
Ball ball;

uint8_t leftScore = 0;
uint8_t rightScore = 0;
uint8_t pointScorer = 0;
uint8_t winner = 0;
int8_t serveDirection = 1;
int8_t nextServeDirection = 1;
uint8_t servePlayer = 1; // 1 = left/P1, 2 = right/P2 (CPU in 1P)

TrailPoint trail[TRAIL_COUNT];
Particle particles[MAX_PARTICLES];
SfxState sfx = {false, BUZZER_1_PIN, 0, 0};

uint16_t bgPalette[BG_COUNT];
uint16_t neonPalette[NEON_COUNT];
int8_t waveLut[64];
uint16_t scanline[SCREEN_W];
uint8_t bgRowPhase[SCREEN_H];
uint8_t backgroundTargetPhase = 0;

uint32_t lastSimUs = 0;
uint32_t simAccumulatorUs = 0;
uint32_t lastRenderUs = 0;
uint32_t stateStartedMs = 0;
uint32_t lastMenuAnimMs = 0;
uint32_t lastCpuDecisionMs = 0;
uint32_t lastHudAnimMs = 0;

float cpuTargetY = PLAY_CENTER_Y;
float cpuError = 0.0f;

Rect oldLeftPaddleRect = {0, 0, 0, 0};
Rect oldRightPaddleRect = {0, 0, 0, 0};
Rect oldBallRect = {0, 0, 0, 0};
Rect oldParticleRects[MAX_PARTICLES];
Rect oldMenuBallRect = {0, 0, 0, 0};

bool gameplayFrameInitialized = false;
bool victoryFrameInitialized = false;

int16_t menuBallX = 52;
int8_t menuBallDir = 1;
TrailPoint menuTrail[5];
uint8_t menuHuePhase = 0;

// ============================================================
// SMALL HELPERS
// ============================================================

uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) {
  return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

float clampFloat(float v, float lo, float hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

int16_t clampInt16(int16_t v, int16_t lo, int16_t hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

Rect invalidRect() {
  return {0, 0, 0, 0};
}

bool rectValid(const Rect &r) {
  return r.w > 0 && r.h > 0;
}

bool rectsOverlap(const Rect &a, const Rect &b) {
  if (!rectValid(a) || !rectValid(b)) return false;
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

Rect unionRect(const Rect &a, const Rect &b) {
  if (!rectValid(a)) return b;
  if (!rectValid(b)) return a;
  int16_t x1 = min(a.x, b.x);
  int16_t y1 = min(a.y, b.y);
  int16_t x2 = max((int16_t)(a.x + a.w), (int16_t)(b.x + b.w));
  int16_t y2 = max((int16_t)(a.y + a.h), (int16_t)(b.y + b.h));
  return {x1, y1, (int16_t)(x2 - x1), (int16_t)(y2 - y1)};
}

Rect expandedRect(Rect r, int16_t pad) {
  if (!rectValid(r)) return r;
  r.x -= pad;
  r.y -= pad;
  r.w += pad * 2;
  r.h += pad * 2;
  return r;
}

Rect clippedToScreen(Rect r) {
  if (!rectValid(r)) return invalidRect();
  int16_t x1 = max((int16_t)0, r.x);
  int16_t y1 = max((int16_t)0, r.y);
  int16_t x2 = min((int16_t)SCREEN_W, (int16_t)(r.x + r.w));
  int16_t y2 = min((int16_t)SCREEN_H, (int16_t)(r.y + r.h));
  if (x2 <= x1 || y2 <= y1) return invalidRect();
  return {x1, y1, (int16_t)(x2 - x1), (int16_t)(y2 - y1)};
}

Rect clippedToPlayfield(Rect r) {
  if (!rectValid(r)) return invalidRect();
  int16_t x1 = max((int16_t)0, r.x);
  int16_t y1 = max((int16_t)PLAY_TOP, r.y);
  int16_t x2 = min((int16_t)SCREEN_W, (int16_t)(r.x + r.w));
  int16_t y2 = min((int16_t)(PLAY_BOTTOM + 1), (int16_t)(r.y + r.h));
  if (x2 <= x1 || y2 <= y1) return invalidRect();
  return {x1, y1, (int16_t)(x2 - x1), (int16_t)(y2 - y1)};
}

bool actionPressed(const GameInput &input) {
  // Ignore a simultaneous press so the launcher's hold-both-buttons exit chord
  // never doubles as a serve/restart action.
  return (input.leftPressed || input.rightPressed) &&
         !(input.leftButton && input.rightButton);
}

// ============================================================
// COLOR / BACKGROUND SYSTEM
// ============================================================

void initPalette() {
  // Very dark saturated background palette. The game objects stay much brighter.
  bgPalette[0] = rgb565(5, 4, 24);
  bgPalette[1] = rgb565(12, 5, 43);
  bgPalette[2] = rgb565(5, 18, 48);
  bgPalette[3] = rgb565(4, 38, 42);
  bgPalette[4] = rgb565(29, 5, 42);
  bgPalette[5] = rgb565(48, 4, 32);
  bgPalette[6] = rgb565(47, 18, 5);
  bgPalette[7] = rgb565(16, 31, 8);

  neonPalette[0]  = rgb565(0, 245, 255);   // cyan
  neonPalette[1]  = rgb565(0, 170, 255);   // electric blue
  neonPalette[2]  = rgb565(65, 85, 255);   // indigo
  neonPalette[3]  = rgb565(145, 55, 255);  // violet
  neonPalette[4]  = rgb565(245, 40, 255);  // magenta
  neonPalette[5]  = rgb565(255, 35, 145);  // hot pink
  neonPalette[6]  = rgb565(255, 70, 45);   // red-orange
  neonPalette[7]  = rgb565(255, 170, 20);  // orange
  neonPalette[8]  = rgb565(255, 245, 30);  // yellow
  neonPalette[9]  = rgb565(130, 255, 30);  // acid green
  neonPalette[10] = rgb565(10, 255, 125);  // green-cyan
  neonPalette[11] = rgb565(0, 255, 210);   // aqua

  for (uint8_t i = 0; i < 64; ++i) {
    float a = (float)i * 6.28318530718f / 64.0f;
    waveLut[i] = (int8_t)roundf(sinf(a) * 18.0f);
  }
}

uint16_t backgroundColorAt(int16_t x, int16_t y, uint8_t phase) {
  // Stable kaleidoscope / stained-glass tunnel.  `phase` is chosen when the
  // screen/state is entered, then remains fixed during a rally.  The image is
  // therefore psychedelic without a scanline refresh visibly travelling down
  // the TFT behind the ball.
  int16_t mx = abs(x - CENTER_X);
  int16_t my = abs(y - PLAY_CENTER_Y);

  // Diamond rings radiating from center.
  int16_t diamond = mx + my;

  // Fold both diagonals into a mirrored kaleidoscope coordinate.
  int16_t diagA = abs(mx - my);
  int16_t diagB = (mx + (my << 1));

  // A small static warp prevents the geometry from looking like plain tiles.
  // This is a LUT lookup only; no per-pixel sinf() during rendering.
  int16_t warp = waveLut[((diamond >> 1) + phase * 5) & 63] >> 2;

  uint8_t ring = (uint8_t)(((diamond + warp) >> 3) & 7);
  uint8_t facet = (uint8_t)(((diagA >> 3) ^ (diagB >> 4)) & 7);
  uint8_t idx = (uint8_t)((ring + facet + phase) & 7);

  // Thin dark seams create a stained-glass / tunnel structure and keep the
  // playfield subdued enough that the white-hot ball is always dominant.
  bool seam = (((diamond + warp) & 0x0F) <= 1) ||
              (((diagA + phase * 3) & 0x1F) <= 1);
  if (seam) return rgb565(3, 3, 15);

  uint16_t base = bgPalette[idx];

  // Deterministic pinprick stars.  These are part of the static background,
  // so dirty-region restoration recreates them exactly.
  uint16_t hash = (uint16_t)(x * 29u + y * 47u + phase * 83u);
  if ((hash & 0x01FF) == 0) return rgb565(42, 48, 88);
  return base;
}

void writeBackgroundSpan(int16_t x, int16_t y, int16_t w, uint8_t phase) {
  if (w <= 0 || y < 0 || y >= SCREEN_H) return;
  x = max((int16_t)0, x);
  if (x + w > SCREEN_W) w = SCREEN_W - x;
  if (w <= 0) return;

  for (int16_t i = 0; i < w; ++i) {
    scanline[i] = backgroundColorAt(x + i, y, phase);
  }

  display.startWrite();
  display.setAddrWindow(x, y, w, 1);
  display.writePixels(scanline, (uint32_t)w);
  display.endWrite();
}

void drawBackgroundRows(int16_t firstRow, int16_t count, uint8_t phase) {
  int16_t y0 = max((int16_t)0, firstRow);
  int16_t y1 = min((int16_t)SCREEN_H, (int16_t)(firstRow + count));
  if (y1 <= y0) return;

  display.startWrite();
  for (int16_t y = y0; y < y1; ++y) {
    for (int16_t x = 0; x < SCREEN_W; ++x) {
      scanline[x] = backgroundColorAt(x, y, phase);
    }
    display.setAddrWindow(0, y, SCREEN_W, 1);
    display.writePixels(scanline, SCREEN_W);
    bgRowPhase[y] = phase;
  }
  display.endWrite();
}

void drawFullBackground(uint8_t phase) {
  drawBackgroundRows(0, SCREEN_H, phase);
}

void drawPlayfieldBackground(uint8_t phase) {
  drawBackgroundRows(PLAY_TOP, PLAY_HEIGHT, phase);
}

void restoreBackgroundRect(Rect r) {
  r = clippedToPlayfield(r);
  if (!rectValid(r)) return;

  display.startWrite();
  for (int16_t y = r.y; y < r.y + r.h; ++y) {
    uint8_t phase = bgRowPhase[y];
    for (int16_t i = 0; i < r.w; ++i) {
      scanline[i] = backgroundColorAt(r.x + i, y, phase);
    }
    display.setAddrWindow(r.x, y, r.w, 1);
    display.writePixels(scanline, (uint32_t)r.w);
  }
  display.endWrite();
}

// Paddles only move vertically and keep a constant visual width/height.
// Restoring the entire old glowing paddle rectangle every frame caused more
// than 100 tiny ST7789 row writes per rendered frame.  Instead, restore only
// the strip of the old rectangle that is no longer covered by the new paddle.
// The overlapping portion is immediately painted over by drawPaddle().
void restoreExposedPaddleArea(Rect oldRect, Rect newRect) {
  oldRect = clippedToPlayfield(oldRect);
  newRect = clippedToPlayfield(newRect);
  if (!rectValid(oldRect)) return;
  if (!rectValid(newRect)) {
    restoreBackgroundRect(oldRect);
    return;
  }

  // This fast path assumes vertical movement with unchanged X/width, which is
  // exactly how Pong paddles move. Fall back safely if that ever changes.
  if (oldRect.x != newRect.x || oldRect.w != newRect.w) {
    restoreBackgroundRect(oldRect);
    return;
  }

  const int16_t oldBottom = oldRect.y + oldRect.h;
  const int16_t newBottom = newRect.y + newRect.h;

  // No overlap: restore the entire previous paddle footprint.
  if (newRect.y >= oldBottom || newBottom <= oldRect.y) {
    restoreBackgroundRect(oldRect);
    return;
  }

  // Moving downward exposes a strip at the old top.
  if (newRect.y > oldRect.y) {
    restoreBackgroundRect({oldRect.x, oldRect.y, oldRect.w,
                           (int16_t)(newRect.y - oldRect.y)});
  }

  // Moving upward exposes a strip at the old bottom.
  if (newBottom < oldBottom) {
    restoreBackgroundRect({oldRect.x, newBottom, oldRect.w,
                           (int16_t)(oldBottom - newBottom)});
  }
}

// During gameplay the procedural background is deliberately static.  It is
// regenerated only inside dirty rectangles when a sprite moves away.  Visual
// motion comes from the neon foreground, borders, particles and ball trail.

// ============================================================
// SWITCH INPUT
// ============================================================

SwitchState readLocalSwitch(uint8_t upPin, uint8_t downPin) {
  bool up = digitalRead(upPin) == LOW;
  bool down = digitalRead(downPin) == LOW;
  if (up && !down) return SWITCH_UP;
  if (!up && down) return SWITCH_DOWN;
  if (!up && !down) return SWITCH_CENTER;
  return SWITCH_ERROR;
}

int8_t switchDirection(SwitchState s) {
  if (s == SWITCH_UP) return -1;
  if (s == SWITCH_DOWN) return 1;
  return 0;
}

int8_t singlePlayerDirection() {
  int8_t a = switchDirection(readLocalSwitch(LEFT_UP_PIN, LEFT_DOWN_PIN));
  int8_t b = switchDirection(readLocalSwitch(RIGHT_UP_PIN, RIGHT_DOWN_PIN));
  if (a == b) return a;
  if (a == 0) return b;
  if (b == 0) return a;
  return 0; // Opposite simultaneous directions cancel.
}

// ============================================================
// AUDIO
// ============================================================

void startSfx(uint8_t pin, uint16_t frequency, uint16_t durationMs) {
  if (!Music::gameEffectsAllowed()) return;
  if (sfx.active && sfx.pin != pin) ledcWriteTone(sfx.pin, 0);
  sfx.active = true;
  sfx.pin = pin;
  sfx.frequency = frequency;
  sfx.untilMs = millis() + durationMs;
  ledcWriteTone(pin, frequency);
}

void updateSfx() {
  if (!Music::gameEffectsAllowed()) { sfx.active = false; return; }
  if (!sfx.active) return;
  uint32_t now = millis();
  if ((int32_t)(now - sfx.untilMs) >= 0) {
    ledcWriteTone(sfx.pin, 0);
    sfx.active = false;
  } else {
    // Music ticks before the game each launcher loop. Reassert the short game SFX
    // here so the impact remains audible without blocking.
    ledcWriteTone(sfx.pin, sfx.frequency);
  }
}

void playPaddleSound(bool leftSide) {
  startSfx(leftSide ? BUZZER_2_PIN : BUZZER_1_PIN, leftSide ? 620 : 760, 38);
}

void playWallSound() {
  startSfx(BUZZER_1_PIN, 1020, 22);
}

void playServeSound() {
  startSfx(BUZZER_2_PIN, 880, 45);
}

void playScoreSound(uint8_t scorer) {
  startSfx(scorer == 1 ? BUZZER_2_PIN : BUZZER_1_PIN,
           scorer == 1 ? 520 : 430, 90);
}

void playWinSound(uint8_t who) {
  startSfx(who == 1 ? BUZZER_2_PIN : BUZZER_1_PIN,
           who == 1 ? 1180 : 330, 140);
}

// ============================================================
// PARTICLES / TRAIL
// ============================================================

void clearParticles() {
  for (uint8_t i = 0; i < MAX_PARTICLES; ++i) {
    particles[i].active = false;
    oldParticleRects[i] = invalidRect();
  }
}

void spawnParticle(float x, float y, float vx, float vy,
                   uint8_t hue, uint16_t lifetimeMs) {
  for (uint8_t i = 0; i < MAX_PARTICLES; ++i) {
    if (!particles[i].active) {
      particles[i].active = true;
      particles[i].x = x;
      particles[i].y = y;
      particles[i].vx = vx;
      particles[i].vy = vy;
      particles[i].hue = hue % NEON_COUNT;
      particles[i].bornMs = millis();
      particles[i].lifetimeMs = lifetimeMs;
      return;
    }
  }
}

void spawnPaddleBurst(bool leftSide, float y) {
  float baseX = leftSide ? LEFT_PADDLE_X + PADDLE_W + 2 : RIGHT_PADDLE_X - 2;
  float direction = leftSide ? 1.0f : -1.0f;
  uint8_t hueBase = leftSide ? 0 : 4;
  for (uint8_t i = 0; i < 8; ++i) {
    float vx = direction * (float)random(55, 125);
    float vy = (float)random(-100, 101);
    spawnParticle(baseX, y + random(-7, 8), vx, vy,
                  hueBase + i, (uint16_t)random(160, 300));
  }
}

void spawnWallBurst(float x, bool topWall) {
  float y = topWall ? PLAY_TOP + 3 : PLAY_BOTTOM - 3;
  float vertical = topWall ? 1.0f : -1.0f;
  for (uint8_t i = 0; i < 4; ++i) {
    spawnParticle(x + random(-5, 6), y,
                  (float)random(-55, 56),
                  vertical * (float)random(35, 85),
                  menuHuePhase + i * 2,
                  (uint16_t)random(110, 220));
  }
}

void spawnScoreBurst(uint8_t scorer) {
  bool leftScored = scorer == 1;
  float x = leftScored ? SCREEN_W - 7 : 7;
  float direction = leftScored ? -1.0f : 1.0f;
  uint8_t hueBase = leftScored ? 0 : 4;
  for (uint8_t i = 0; i < 18; ++i) {
    spawnParticle(x, (float)random(PLAY_TOP + 18, PLAY_BOTTOM - 18),
                  direction * (float)random(35, 120),
                  (float)random(-80, 81),
                  hueBase + i,
                  (uint16_t)random(260, 520));
  }
}

void spawnVictoryConfetti(uint8_t who) {
  uint8_t hueBase = who == 1 ? 0 : 4;
  for (uint8_t i = 0; i < MAX_PARTICLES; ++i) {
    if (!particles[i].active && random(0, 3) == 0) {
      spawnParticle((float)random(8, SCREEN_W - 8),
                    (float)random(4, 45),
                    (float)random(-25, 26),
                    (float)random(35, 90),
                    hueBase + random(0, 7),
                    (uint16_t)random(700, 1300));
      break;
    }
  }
}

void updateParticles(float dt, bool fullScreen) {
  uint32_t now = millis();
  for (uint8_t i = 0; i < MAX_PARTICLES; ++i) {
    Particle &p = particles[i];
    if (!p.active) continue;
    if ((uint32_t)(now - p.bornMs) >= p.lifetimeMs) {
      p.active = false;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.992f;
    p.vy *= 0.992f;

    int16_t topLimit = fullScreen ? -4 : PLAY_TOP - 4;
    if (p.x < -5 || p.x > SCREEN_W + 5 || p.y < topLimit || p.y > SCREEN_H + 5) {
      p.active = false;
    }
  }
}

void resetTrail() {
  for (uint8_t i = 0; i < TRAIL_COUNT; ++i) {
    trail[i].x = (int16_t)ball.x;
    trail[i].y = (int16_t)ball.y;
    trail[i].hue = i;
  }
  oldBallRect = invalidRect();
}

void pushTrail() {
  for (int i = TRAIL_COUNT - 1; i > 0; --i) trail[i] = trail[i - 1];
  trail[0].x = (int16_t)roundf(ball.x);
  trail[0].y = (int16_t)roundf(ball.y);
  trail[0].hue = menuHuePhase;
}

Rect particleVisualRect(const Particle &p, bool fullScreen) {
  if (!p.active) return invalidRect();
  Rect r = {(int16_t)((int16_t)p.x - 3),
            (int16_t)((int16_t)p.y - 3),
            7, 7};
  return fullScreen ? clippedToScreen(r) : clippedToPlayfield(r);
}

void restoreOldParticleRects(bool fullScreen) {
  for (uint8_t i = 0; i < MAX_PARTICLES; ++i) {
    if (!rectValid(oldParticleRects[i])) continue;
    if (fullScreen) {
      Rect r = clippedToScreen(oldParticleRects[i]);
      if (!rectValid(r)) continue;
      display.startWrite();
      for (int16_t y = r.y; y < r.y + r.h; ++y) {
        uint8_t phase = bgRowPhase[y];
        for (int16_t x = 0; x < r.w; ++x) {
          scanline[x] = backgroundColorAt(r.x + x, y, phase);
        }
        display.setAddrWindow(r.x, y, r.w, 1);
        display.writePixels(scanline, (uint32_t)r.w);
      }
      display.endWrite();
    } else {
      restoreBackgroundRect(oldParticleRects[i]);
    }
  }
}

void saveCurrentParticleRects(bool fullScreen) {
  for (uint8_t i = 0; i < MAX_PARTICLES; ++i) {
    oldParticleRects[i] = particleVisualRect(particles[i], fullScreen);
  }
}

// ============================================================
// PONG RESET / STATE TRANSITIONS
// ============================================================

void centerPaddles() {
  float centered = PLAY_CENTER_Y - PADDLE_H * 0.5f;
  leftPaddle.y = centered;
  rightPaddle.y = centered;
  leftPaddle.speed = PLAYER_PADDLE_SPEED;
  rightPaddle.speed = (mode == MODE_SINGLE_PLAYER) ? CPU_PADDLE_SPEED : PLAYER_PADDLE_SPEED;
  leftPaddle.direction = 0;
  rightPaddle.direction = 0;
  leftPaddle.flashUntilMs = 0;
  rightPaddle.flashUntilMs = 0;
}

void resetBallForServe() {
  ball.x = CENTER_X;
  ball.y = PLAY_CENTER_Y;
  ball.vx = 0.0f;
  ball.vy = 0.0f;
  ball.speed = BALL_START_SPEED;
  serveDirection = nextServeDirection;
  resetTrail();
}

void clearDynamicBounds() {
  oldLeftPaddleRect = invalidRect();
  oldRightPaddleRect = invalidRect();
  oldBallRect = invalidRect();
  for (uint8_t i = 0; i < MAX_PARTICLES; ++i) oldParticleRects[i] = invalidRect();
}

void enterServe();
void drawGameplayBase();
void drawModeSelectBase();
void drawVictoryBase();

void startMatch(GameMode newMode) {
  mode = newMode;
  leftScore = 0;
  rightScore = 0;
  pointScorer = 0;
  winner = 0;
  servePlayer = (random(0, 2) == 0) ? 1 : 2;
  nextServeDirection = (servePlayer == 1) ? 1 : -1;
  clearParticles();
  centerPaddles();
  resetBallForServe();
  state = STATE_SERVE;
  stateStartedMs = millis();
  gameplayFrameInitialized = false;
  victoryFrameInitialized = false;
  backgroundTargetPhase += 3;
  drawGameplayBase();
}

void enterServe() {
  state = STATE_SERVE;
  stateStartedMs = millis();
  centerPaddles();
  resetBallForServe();
  clearParticles();
  clearDynamicBounds();
  drawGameplayBase();
}

void launchBall() {
  if (state != STATE_SERVE) return;
  static const float slopes[] = {-0.31f, -0.21f, 0.21f, 0.31f};
  float frac = slopes[random(0, 4)];
  ball.speed = BALL_START_SPEED;
  ball.vy = ball.speed * frac;
  float vxMag = sqrtf(max(1.0f, ball.speed * ball.speed - ball.vy * ball.vy));
  ball.vx = serveDirection * vxMag;
  state = STATE_PLAYING;
  stateStartedMs = millis();

  // Erase the complete stationary serve ball + largest pulsing ring BEFORE
  // resetTrail() invalidates oldBallRect. The pulse reaches radius 14, so this
  // 18px cleanup radius leaves extra margin for every drawn pixel.
  constexpr int16_t SERVE_PULSE_CLEANUP_RADIUS = 18;
  restoreBackgroundRect({
      (int16_t)((int16_t)roundf(ball.x) - SERVE_PULSE_CLEANUP_RADIUS),
      (int16_t)((int16_t)roundf(ball.y) - SERVE_PULSE_CLEANUP_RADIUS),
      (int16_t)(SERVE_PULSE_CLEANUP_RADIUS * 2 + 1),
      (int16_t)(SERVE_PULSE_CLEANUP_RADIUS * 2 + 1)
  });

  resetTrail();
  // Restore the ENTIRE serve prompt immediately. The previous rectangle was
  // too narrow and too short, leaving the right/bottom edges of the text behind.
  // The divider is redrawn on the next rendered frame.
  restoreBackgroundRect({SERVE_PROMPT_X, SERVE_PROMPT_Y,
                         SERVE_PROMPT_W, SERVE_PROMPT_H});
  playServeSound();
}

void enterPointState(uint8_t scorer) {
  pointScorer = scorer;

  // The player who LOST the point owns the next serve. A left-side serve
  // always launches right toward P2; a right-side serve launches left toward P1.
  servePlayer = (scorer == 1) ? 2 : 1;
  nextServeDirection = (servePlayer == 1) ? 1 : -1;

  state = STATE_POINT;
  stateStartedMs = millis();
  ball.vx = 0.0f;
  ball.vy = 0.0f;
  spawnScoreBurst(scorer);
  playScoreSound(scorer);
}

void enterMatchOver(uint8_t who) {
  winner = who;
  state = STATE_MATCH_OVER;
  stateStartedMs = millis();
  clearParticles();
  clearDynamicBounds();
  victoryFrameInitialized = false;
  drawVictoryBase();
  playWinSound(who);
}

// ============================================================
// PADDLE / CPU SIMULATION
// ============================================================

void movePaddle(Paddle &paddle, int8_t direction, float dt) {
  paddle.direction = direction;
  paddle.y += (float)direction * paddle.speed * dt;
  float minY = PLAY_TOP + 7.0f;
  float maxY = PLAY_BOTTOM - 7.0f - PADDLE_H;
  paddle.y = clampFloat(paddle.y, minY, maxY);
}

void updateCpu(float dt) {
  uint32_t now = millis();
  if ((uint32_t)(now - lastCpuDecisionMs) >= 88) {
    lastCpuDecisionMs = now;
    if (ball.vx > 0.0f && state == STATE_PLAYING) {
      cpuError = (float)random(-18, 19);
      cpuTargetY = ball.y + cpuError;
    } else {
      cpuTargetY = PLAY_CENTER_Y + (float)random(-8, 9);
    }
  }

  float center = rightPaddle.y + PADDLE_H * 0.5f;
  int8_t direction = 0;
  if (cpuTargetY < center - 6.0f) direction = -1;
  else if (cpuTargetY > center + 6.0f) direction = 1;
  movePaddle(rightPaddle, direction, dt);
}

void updatePaddles(float dt) {
  if (mode == MODE_SINGLE_PLAYER) {
    movePaddle(leftPaddle, singlePlayerDirection(), dt);
    updateCpu(dt);
  } else {
    int8_t leftDir = switchDirection(readLocalSwitch(LEFT_UP_PIN, LEFT_DOWN_PIN));
    int8_t rightDir = switchDirection(readLocalSwitch(RIGHT_UP_PIN, RIGHT_DOWN_PIN));
    movePaddle(leftPaddle, leftDir, dt);
    movePaddle(rightPaddle, rightDir, dt);
  }
}

// ============================================================
// BALL PHYSICS
// ============================================================

void applyPaddleBounce(Paddle &paddle, int8_t horizontalDirection, bool leftSide) {
  float paddleCenter = paddle.y + PADDLE_H * 0.5f;
  float offset = (ball.y - paddleCenter) / (PADDLE_H * 0.5f);
  offset = clampFloat(offset, -1.0f, 1.0f);

  ball.speed = min(BALL_MAX_SPEED, ball.speed + BALL_SPEED_STEP);
  float angle = offset * BALL_MAX_BOUNCE_ANGLE;
  float newVy = sinf(angle) * ball.speed;

  if (fabsf(newVy) < BALL_MIN_VERTICAL) {
    if (offset < -0.05f) newVy = -BALL_MIN_VERTICAL;
    else if (offset > 0.05f) newVy = BALL_MIN_VERTICAL;
    else newVy = (ball.vy < 0.0f) ? -BALL_MIN_VERTICAL : BALL_MIN_VERTICAL;
  }

  float newVx = sqrtf(max(1.0f, ball.speed * ball.speed - newVy * newVy));
  ball.vx = horizontalDirection * newVx;
  ball.vy = newVy;

  if (leftSide) {
    ball.x = LEFT_PADDLE_X + PADDLE_W + BALL_RADIUS + 1;
    leftPaddle.flashUntilMs = millis() + 78;
  } else {
    ball.x = RIGHT_PADDLE_X - BALL_RADIUS - 1;
    rightPaddle.flashUntilMs = millis() + 78;
  }

  spawnPaddleBurst(leftSide, ball.y);
  playPaddleSound(leftSide);
}

void updateBall(float dt) {
  float previousX = ball.x;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  float topLimit = PLAY_TOP + 4 + BALL_RADIUS;
  float bottomLimit = PLAY_BOTTOM - 4 - BALL_RADIUS;

  if (ball.y < topLimit) {
    ball.y = topLimit;
    ball.vy = fabsf(ball.vy);
    spawnWallBurst(ball.x, true);
    playWallSound();
  } else if (ball.y > bottomLimit) {
    ball.y = bottomLimit;
    ball.vy = -fabsf(ball.vy);
    spawnWallBurst(ball.x, false);
    playWallSound();
  }

  float leftBallEdge = ball.x - BALL_RADIUS;
  float rightBallEdge = ball.x + BALL_RADIUS;
  float topBallEdge = ball.y - BALL_RADIUS;
  float bottomBallEdge = ball.y + BALL_RADIUS;

  if (ball.vx < 0.0f &&
      leftBallEdge <= LEFT_PADDLE_X + PADDLE_W &&
      previousX - BALL_RADIUS >= LEFT_PADDLE_X + PADDLE_W - 2 &&
      rightBallEdge >= LEFT_PADDLE_X &&
      bottomBallEdge >= leftPaddle.y &&
      topBallEdge <= leftPaddle.y + PADDLE_H) {
    applyPaddleBounce(leftPaddle, 1, true);
  }

  if (ball.vx > 0.0f &&
      rightBallEdge >= RIGHT_PADDLE_X &&
      previousX + BALL_RADIUS <= RIGHT_PADDLE_X + 2 &&
      leftBallEdge <= RIGHT_PADDLE_X + PADDLE_W &&
      bottomBallEdge >= rightPaddle.y &&
      topBallEdge <= rightPaddle.y + PADDLE_H) {
    applyPaddleBounce(rightPaddle, -1, false);
  }

  if (ball.x + BALL_RADIUS < 0.0f) {
    ++rightScore;
    enterPointState(2);
  } else if (ball.x - BALL_RADIUS > SCREEN_W) {
    ++leftScore;
    enterPointState(1);
  }
}

void simulationStep(float dt) {
  if (state == STATE_SERVE) {
    updatePaddles(dt);
    updateParticles(dt, false);
  } else if (state == STATE_PLAYING) {
    updatePaddles(dt);
    updateBall(dt);
    updateParticles(dt, false);
  } else if (state == STATE_POINT) {
    updateParticles(dt, false);
  } else if (state == STATE_MATCH_OVER) {
    updateParticles(dt, true);
  }
}

void runSimulationClock() {
  uint32_t nowUs = micros();
  uint32_t elapsed = nowUs - lastSimUs;
  lastSimUs = nowUs;
  if (elapsed > 60000) elapsed = 60000;
  simAccumulatorUs += elapsed;

  uint8_t steps = 0;
  while (simAccumulatorUs >= SIM_STEP_US && steps < MAX_SIM_STEPS) {
    simulationStep((float)SIM_STEP_US / 1000000.0f);
    simAccumulatorUs -= SIM_STEP_US;
    ++steps;
  }
  if (steps == MAX_SIM_STEPS && simAccumulatorUs >= SIM_STEP_US) {
    simAccumulatorUs = 0;
  }
}

// ============================================================
// NEON DRAWING PRIMITIVES
// ============================================================

uint16_t playerColor(uint8_t player, uint8_t offset = 0) {
  uint8_t base = player == 1 ? 0 : 4;
  return neonPalette[(base + offset) % NEON_COUNT];
}

Rect paddleVisualRect(const Paddle &p, bool leftSide) {
  int16_t x = leftSide ? LEFT_PADDLE_X : RIGHT_PADDLE_X;
  return clippedToPlayfield({
      (int16_t)(x - PADDLE_GLOW),
      (int16_t)((int16_t)roundf(p.y) - PADDLE_GLOW),
      (int16_t)(PADDLE_W + PADDLE_GLOW * 2),
      (int16_t)(PADDLE_H + PADDLE_GLOW * 2)});
}

void drawPaddle(const Paddle &p, bool leftSide) {
  int16_t x = leftSide ? LEFT_PADDLE_X : RIGHT_PADDLE_X;
  int16_t y = (int16_t)roundf(p.y);
  uint8_t player = leftSide ? 1 : 2;
  uint16_t outer = playerColor(player, 2);
  uint16_t body = playerColor(player, 0);
  uint16_t inner = playerColor(player, 1);
  bool flashing = (int32_t)(p.flashUntilMs - millis()) > 0;

  // Aura. Using rectangles rather than alpha keeps this very cheap.
  display.drawRect(x - 3, y - 3, PADDLE_W + 6, PADDLE_H + 6, bgPalette[leftSide ? 2 : 5]);
  display.drawRect(x - 2, y - 2, PADDLE_W + 4, PADDLE_H + 4, outer);
  display.fillRect(x, y, PADDLE_W, PADDLE_H, body);
  display.fillRect(x + 2, y + 2, PADDLE_W - 4, PADDLE_H - 4,
                   flashing ? ST77XX_WHITE : inner);

  // Small segmented notches make the paddle feel constructed rather than flat.
  for (int16_t yy = y + 6; yy < y + PADDLE_H - 5; yy += 9) {
    display.drawFastHLine(x + 1, yy, PADDLE_W - 2,
                          flashing ? rgb565(255, 245, 180) : ST77XX_WHITE);
  }
}

void drawBallTrail() {
  for (int i = TRAIL_COUNT - 1; i >= 1; --i) {
    uint8_t size = (i >= 5) ? 2 : (i >= 3 ? 3 : 4);
    uint8_t hue = (trail[i].hue + i * 2) % NEON_COUNT;
    int16_t x = trail[i].x - size / 2;
    int16_t y = trail[i].y - size / 2;
    if (y >= PLAY_TOP && y <= PLAY_BOTTOM) {
      display.fillRect(x, y, size, size, neonPalette[hue]);
    }
  }
}

void drawBallCore() {
  int16_t x = (int16_t)roundf(ball.x);
  int16_t y = (int16_t)roundf(ball.y);
  uint16_t halo = neonPalette[(menuHuePhase + 8) % NEON_COUNT];
  uint16_t ring = neonPalette[(menuHuePhase + 5) % NEON_COUNT];
  display.drawCircle(x, y, 6, bgPalette[(menuHuePhase >> 1) & 7]);
  display.drawCircle(x, y, 5, halo);
  display.fillCircle(x, y, 4, ring);
  display.fillCircle(x, y, 2, ST77XX_WHITE);
}

Rect ballVisualRect() {
  Rect r = {(int16_t)((int16_t)ball.x - 8),
            (int16_t)((int16_t)ball.y - 8), 17, 17};
  for (uint8_t i = 0; i < TRAIL_COUNT; ++i) {
    Rect tr = {(int16_t)(trail[i].x - 4),
               (int16_t)(trail[i].y - 4), 9, 9};
    r = unionRect(r, tr);
  }
  if (state == STATE_SERVE) r = expandedRect(r, 8);
  return clippedToPlayfield(r);
}

void drawParticles(bool fullScreen) {
  uint32_t now = millis();
  for (uint8_t i = 0; i < MAX_PARTICLES; ++i) {
    const Particle &p = particles[i];
    if (!p.active) continue;
    if (!fullScreen && (p.y < PLAY_TOP || p.y > PLAY_BOTTOM)) continue;
    uint32_t age = now - p.bornMs;
    uint8_t hue = (p.hue + (age / 55)) % NEON_COUNT;
    int16_t x = (int16_t)p.x;
    int16_t y = (int16_t)p.y;
    if ((age & 0x40) == 0) display.fillRect(x - 1, y - 1, 3, 2, neonPalette[hue]);
    else display.fillRect(x, y, 2, 2, neonPalette[hue]);
  }
}

void drawCenterDivider() {
  uint8_t phase = menuHuePhase;
  int index = 0;
  for (int16_t y = PLAY_TOP + 10; y < PLAY_BOTTOM - 7; y += 17, ++index) {
    uint16_t c = neonPalette[(phase + index * 2) % NEON_COUNT];
    display.fillRect(CENTER_X - 2, y, 4, 7, bgPalette[(index + phase) & 7]);
    display.fillRect(CENTER_X - 1, y, 2, 7, c);
  }
}

void drawPlayfieldBorders() {
  uint8_t phase = menuHuePhase;
  display.drawFastHLine(0, PLAY_TOP, SCREEN_W, bgPalette[3]);
  display.drawFastHLine(0, PLAY_TOP + 1, SCREEN_W, neonPalette[(phase + 10) % NEON_COUNT]);
  display.drawFastHLine(0, PLAY_BOTTOM - 1, SCREEN_W, bgPalette[5]);
  display.drawFastHLine(0, PLAY_BOTTOM, SCREEN_W, neonPalette[(phase + 4) % NEON_COUNT]);

  int16_t pulseX = (int16_t)((millis() / 7) % (SCREEN_W + 48)) - 24;
  display.drawFastHLine(max((int16_t)0, pulseX), PLAY_TOP + 1,
                        min((int16_t)24, (int16_t)(SCREEN_W - max((int16_t)0, pulseX))),
                        ST77XX_WHITE);
  int16_t otherX = SCREEN_W - pulseX - 24;
  if (otherX < SCREEN_W && otherX + 24 > 0) {
    int16_t sx = max((int16_t)0, otherX);
    int16_t sw = min((int16_t)24, (int16_t)(SCREEN_W - sx));
    if (sw > 0) display.drawFastHLine(sx, PLAY_BOTTOM - 1, sw, ST77XX_WHITE);
  }
}

// ============================================================
// SCORE / HUD
// ============================================================

const uint8_t DIGIT_SEGMENTS[10] = {
    0b0111111, // 0: A B C D E F
    0b0000110, // 1: B C
    0b1011011, // 2: A B G E D
    0b1001111, // 3: A B C D G
    0b1100110, // 4: F G B C
    0b1101101, // 5: A F G C D
    0b1111101, // 6
    0b0000111, // 7
    0b1111111, // 8
    0b1101111  // 9
};

void drawSegment(int16_t x, int16_t y, int16_t w, int16_t h,
                 uint16_t color, bool horizontal) {
  display.fillRect(x + 1, y + 1, w, h, bgPalette[0]);
  display.fillRect(x, y, w, h, color);
  if (horizontal) display.drawFastHLine(x + 1, y, max((int16_t)1, (int16_t)(w - 2)), ST77XX_WHITE);
  else display.drawFastVLine(x, y + 1, max((int16_t)1, (int16_t)(h - 2)), ST77XX_WHITE);
}

void drawNeonDigit(int16_t x, int16_t y, uint8_t digit, uint16_t color) {
  digit %= 10;
  uint8_t mask = DIGIT_SEGMENTS[digit];
  constexpr int16_t L = 13;
  constexpr int16_t T = 3;
  constexpr int16_t V = 10;

  // A
  if (mask & 0x01) drawSegment(x + T, y, L, T, color, true);
  // B
  if (mask & 0x02) drawSegment(x + L + T, y + T, T, V, color, false);
  // C
  if (mask & 0x04) drawSegment(x + L + T, y + T + V + T, T, V, color, false);
  // D
  if (mask & 0x08) drawSegment(x + T, y + 2 * (V + T), L, T, color, true);
  // E
  if (mask & 0x10) drawSegment(x, y + T + V + T, T, V, color, false);
  // F
  if (mask & 0x20) drawSegment(x, y + T, T, V, color, false);
  // G
  if (mask & 0x40) drawSegment(x + T, y + V + T, L, T, color, true);
}

void drawHudStatic() {
  uint16_t panel = rgb565(5, 4, 19);
  display.fillRect(0, 0, SCREEN_W, HUD_H, panel);
  display.drawFastHLine(0, HUD_H - 2, SCREEN_W, bgPalette[2]);
  display.drawFastHLine(0, HUD_H - 1, SCREEN_W, neonPalette[3]);

  display.setTextSize(1);
  display.setTextColor(playerColor(1), panel);
  display.setCursor(11, 14);
  display.print(mode == MODE_SINGLE_PLAYER ? "YOU" : "P1");
  display.setTextColor(playerColor(2), panel);
  display.setCursor(207, 14);
  display.print(mode == MODE_SINGLE_PLAYER ? "CPU" : "P2");

  display.setTextColor(rgb565(100, 95, 135), panel);
  display.setCursor(113, 14);
  display.print("VS");
}

void drawScores(bool flash = false) {
  uint16_t panel = rgb565(5, 4, 19);
  // Keep the two score panels symmetric around SCREEN_W / 2.
  display.fillRect(72, 3, 42, 31, panel);
  display.fillRect(126, 3, 42, 31, panel);

  uint16_t leftColor = (flash && pointScorer == 1) ? ST77XX_WHITE : playerColor(1, menuHuePhase / 4);
  uint16_t rightColor = (flash && pointScorer == 2) ? ST77XX_WHITE : playerColor(2, menuHuePhase / 4);
  drawNeonDigit(84, 4, leftScore, leftColor);
  drawNeonDigit(138, 4, rightScore, rightColor);

  // drawScores() paints over part of the static VS label, so redraw it last.
  // x=114 keeps the 12px-wide "VS" centered on the 240px display.
  display.setTextSize(1);
  display.setTextColor(rgb565(100, 95, 135), panel);
  display.setCursor(114, 14);
  display.print("VS");
}

// ============================================================
// GAMEPLAY FRAME RENDERING
// ============================================================

void drawServePrompt() {
  int16_t y = PLAY_CENTER_Y + 47;
  uint16_t c = playerColor(servePlayer, menuHuePhase / 3);
  display.setTextSize(1);
  display.setTextColor(c);

  if (mode == MODE_TWO_PLAYER) {
    display.setCursor(96, y);
    display.print(servePlayer == 1 ? "P1 SERVE" : "P2 SERVE");

    display.setTextColor(ST77XX_WHITE);
    display.setCursor(60, y + 11);
    display.print(servePlayer == 1 ? "LEFT BUTTON TO SERVE"
                                   : "RIGHT BUTTON TO SERVE");
  } else if (servePlayer == 1) {
    display.setCursor(90, y);
    display.print("YOUR SERVE");
    display.setTextColor(ST77XX_WHITE);
    display.setCursor(78, y + 11);
    display.print("PRESS A BUTTON");
  } else {
    display.setCursor(93, y);
    display.print("CPU SERVE");
    display.setTextColor(ST77XX_WHITE);
    display.setCursor(93, y + 11);
    display.print("GET READY");
  }

  uint8_t pulse = (uint8_t)((millis() / 90) % 6);
  display.drawCircle((int16_t)ball.x, (int16_t)ball.y, 9 + pulse,
                     neonPalette[(menuHuePhase + pulse) % NEON_COUNT]);
}

void drawPointText() {
  uint16_t c = playerColor(pointScorer, menuHuePhase / 3);
  display.setTextSize(2);
  display.setTextColor(c);
  display.setCursor(77, PLAY_CENTER_Y + 49);
  display.print(pointScorer == 1 ? "LEFT +1" : "RIGHT +1");
}

void drawGameplayBase() {
  display.fillScreen(rgb565(3, 2, 12));
  drawPlayfieldBackground(backgroundTargetPhase);
  drawHudStatic();
  drawScores(false);
  drawCenterDivider();
  drawPlayfieldBorders();
  clearDynamicBounds();
  gameplayFrameInitialized = true;
  lastRenderUs = micros();
  lastSimUs = micros();
  simAccumulatorUs = 0;
}

void renderGameplayFrame() {
  uint32_t nowMs = millis();

  const Rect newLeftPaddleRect = paddleVisualRect(leftPaddle, true);
  const Rect newRightPaddleRect = paddleVisualRect(rightPaddle, false);

  ++menuHuePhase;

  // Prepare the new trail before touching the currently visible ball.  The old
  // ball therefore remains on-screen while all of the expensive background
  // work happens, instead of being erased at the start of every frame.
  if (state == STATE_PLAYING) pushTrail();
  else if (state == STATE_SERVE) {
    for (uint8_t i = 0; i < TRAIL_COUNT; ++i) {
      trail[i].x = (int16_t)ball.x;
      trail[i].y = (int16_t)ball.y;
    }
  }

  // No full-width background refresh happens here.  The kaleidoscope is a
  // stable playfield texture; only dirty regions are regenerated as sprites
  // move.  This removes the old travelling refresh wave entirely.

  // Restore only the newly exposed strips behind moving paddles. This is much
  // cheaper than regenerating both full glow rectangles every frame.
  if (rectValid(oldLeftPaddleRect))
    restoreExposedPaddleArea(oldLeftPaddleRect, newLeftPaddleRect);
  if (rectValid(oldRightPaddleRect))
    restoreExposedPaddleArea(oldRightPaddleRect, newRightPaddleRect);

  restoreOldParticleRects(false);

  // Do every non-ball foreground update while the OLD ball is still visible.
  // SPI TFT writes are visible immediately, so this deliberately minimizes the
  // time between erasing the old ball and drawing the new one.
  drawCenterDivider();
  drawPlayfieldBorders();
  drawParticles(false);
  drawPaddle(leftPaddle, true);
  drawPaddle(rightPaddle, false);

  // Erase the previous ball/trail only after all other frame work is complete.
  // The ball dirty rectangle can overlap a paddle near impact. Since restoring
  // that rectangle paints the procedural background, immediately repaint only
  // the paddle(s) that were touched so the ball cleanup cannot make them blink.
  if (rectValid(oldBallRect)) {
    const bool touchedLeftPaddle = rectsOverlap(oldBallRect, newLeftPaddleRect);
    const bool touchedRightPaddle = rectsOverlap(oldBallRect, newRightPaddleRect);

    restoreBackgroundRect(oldBallRect);

    if (touchedLeftPaddle) drawPaddle(leftPaddle, true);
    if (touchedRightPaddle) drawPaddle(rightPaddle, false);
  }

  if (state == STATE_SERVE || state == STATE_PLAYING) {
    if (state == STATE_PLAYING) drawBallTrail();
    drawBallCore();
  }

  if (state == STATE_SERVE) drawServePrompt();
  else if (state == STATE_POINT) drawPointText();

  if (state == STATE_POINT) {
    bool flash = ((nowMs / 90) & 1) == 0;
    drawScores(flash);
  }

  oldLeftPaddleRect = newLeftPaddleRect;
  oldRightPaddleRect = newRightPaddleRect;
  oldBallRect = (state == STATE_SERVE || state == STATE_PLAYING)
                    ? ballVisualRect()
                    : invalidRect();
  saveCurrentParticleRects(false);
}

// ============================================================
// MODE SELECT ART
// ============================================================

void drawChromaticTitle() {
  uint16_t c1 = neonPalette[(menuHuePhase + 0) % NEON_COUNT];
  uint16_t c2 = neonPalette[(menuHuePhase + 4) % NEON_COUNT];

  display.setTextSize(4);
  display.setTextColor(c1);
  display.setCursor(70, 53);
  display.print("PONG");
  display.setTextColor(c2);
  display.setCursor(74, 57);
  display.print("PONG");
  display.setTextColor(ST77XX_WHITE);
  display.setCursor(72, 55);
  display.print("PONG");

  display.setTextColor(c2);
  display.setCursor(70, 96);
  display.print("PONG");
  display.setTextColor(c1);
  display.setCursor(74, 100);
  display.print("PONG");
  display.setTextColor(ST77XX_WHITE);
  display.setCursor(72, 98);
  display.print("PONG");
}

void drawModeCard(int16_t x, bool single) {
  uint8_t player = single ? 1 : 2;
  uint16_t c = playerColor(player, 0);
  uint16_t c2 = playerColor(player, 2);
  uint16_t panel = rgb565(7, 6, 25);
  display.fillRoundRect(x, 220, 100, 78, 6, panel);
  display.drawRoundRect(x, 220, 100, 78, 6, bgPalette[single ? 2 : 5]);
  display.drawRoundRect(x + 2, 222, 96, 74, 5, c);

  display.setTextSize(2);
  display.setTextColor(c);
  display.setCursor(x + 38, 228);
  display.print(single ? "1P" : "2P");

  display.setTextSize(1);
  display.setTextColor(c2, panel);
  display.setCursor(x + 26, 249);
  display.print(single ? "1 PLAYER" : "2 PLAYER");

  display.setTextColor(ST77XX_WHITE, panel);
  display.setCursor(x + 17, 261);
  display.print(single ? "LEFT BUTTON" : "RIGHT BUTTON");

  // Tiny Pong diagram.
  display.fillRect(x + 16, 278, 3, 12, c);
  display.fillRect(x + 81, 278, 3, 12, c2);
  display.fillCircle(x + 50, 284, 3, ST77XX_WHITE);
  display.drawFastHLine(x + 23, 284, 18, bgPalette[3]);
  display.drawFastHLine(x + 59, 284, 18, bgPalette[5]);
}

Rect menuBallBounds() {
  Rect r = invalidRect();
  for (uint8_t i = 0; i < 5; ++i) {
    r = unionRect(r, {(int16_t)(menuTrail[i].x - 6),
                            (int16_t)(menuTrail[i].y - 6), 13, 13});
  }
  return clippedToScreen(r);
}

void drawMenuBall() {
  for (int i = 4; i >= 1; --i) {
    uint8_t size = (i >= 3) ? 2 : 3;
    display.fillRect(menuTrail[i].x - size / 2,
                     menuTrail[i].y - size / 2,
                     size, size,
                     neonPalette[(menuTrail[i].hue + i * 2) % NEON_COUNT]);
  }
  int16_t x = menuTrail[0].x;
  int16_t y = menuTrail[0].y;
  display.drawCircle(x, y, 5, neonPalette[(menuHuePhase + 5) % NEON_COUNT]);
  display.fillCircle(x, y, 3, ST77XX_WHITE);
}

void drawMenuPaddles() {
  uint16_t left = playerColor(1);
  uint16_t right = playerColor(2);
  display.drawRect(28, 153, 8, 44, left);
  display.fillRect(30, 155, 4, 40, ST77XX_WHITE);
  display.drawRect(204, 153, 8, 44, right);
  display.fillRect(206, 155, 4, 40, ST77XX_WHITE);
}

void drawModeSelectBase() {
  backgroundTargetPhase += 5;
  drawFullBackground(backgroundTargetPhase);
  display.fillRect(0, 0, SCREEN_W, 28, rgb565(4, 3, 17));
  display.drawFastHLine(0, 27, SCREEN_W, neonPalette[3]);

  drawChromaticTitle();
  drawMenuPaddles();
  drawModeCard(8, true);
  drawModeCard(132, false);

  menuBallX = 52;
  menuBallDir = 1;
  for (uint8_t i = 0; i < 5; ++i) {
    menuTrail[i].x = menuBallX - i * 5;
    menuTrail[i].y = 176;
    menuTrail[i].hue = i * 2;
  }
  drawMenuBall();
  oldMenuBallRect = menuBallBounds();
  MenuFooter::draw(display);
  lastMenuAnimMs = millis();
}

void updateModeSelectArt() {
  uint32_t now = millis();
  if ((uint32_t)(now - lastMenuAnimMs) < 55) return;
  lastMenuAnimMs = now;

  if (rectValid(oldMenuBallRect)) {
    Rect r = clippedToScreen(oldMenuBallRect);
    // The menu ball lives only in the clear central strip, so its old area can
    // be restored directly from the procedural background.
    display.startWrite();
    for (int16_t y = r.y; y < r.y + r.h; ++y) {
      uint8_t phase = bgRowPhase[y];
      for (int16_t i = 0; i < r.w; ++i) scanline[i] = backgroundColorAt(r.x + i, y, phase);
      display.setAddrWindow(r.x, y, r.w, 1);
      display.writePixels(scanline, (uint32_t)r.w);
    }
    display.endWrite();
  }

  menuBallX += menuBallDir * 7;
  if (menuBallX >= 190) { menuBallX = 190; menuBallDir = -1; }
  if (menuBallX <= 50) { menuBallX = 50; menuBallDir = 1; }

  for (int i = 4; i > 0; --i) menuTrail[i] = menuTrail[i - 1];
  menuTrail[0].x = menuBallX;
  menuTrail[0].y = 176 + waveLut[((menuBallX >> 2) + menuHuePhase) & 63] / 3;
  menuTrail[0].hue = menuHuePhase;
  ++menuHuePhase;

  drawMenuBall();
  drawMenuPaddles();
  drawChromaticTitle();
  oldMenuBallRect = menuBallBounds();
}

// ============================================================
// VICTORY SCREEN
// ============================================================

void drawWinnerText() {
  uint16_t c = playerColor(winner, (menuHuePhase / 3));
  const char *line1;
  const char *line2 = "WINS";
  if (mode == MODE_SINGLE_PLAYER) {
    line1 = winner == 1 ? "YOU" : "CPU";
  } else {
    line1 = winner == 1 ? "PLAYER 1" : "PLAYER 2";
  }

  display.setTextSize(mode == MODE_SINGLE_PLAYER ? 4 : 3);
  int16_t x1 = (SCREEN_W - (int16_t)strlen(line1) * 6 * (mode == MODE_SINGLE_PLAYER ? 4 : 3)) / 2;
  display.setTextColor(neonPalette[(menuHuePhase + 5) % NEON_COUNT]);
  display.setCursor(x1 - 2, 104);
  display.print(line1);
  display.setTextColor(c);
  display.setCursor(x1 + 2, 108);
  display.print(line1);
  display.setTextColor(ST77XX_WHITE);
  display.setCursor(x1, 106);
  display.print(line1);

  display.setTextSize(4);
  int16_t x2 = (SCREEN_W - 4 * 6 * 4) / 2;
  display.setTextColor(c);
  display.setCursor(x2, 155);
  display.print(line2);

  display.setTextSize(1);
  display.setTextColor(ST77XX_WHITE);
  display.setCursor(68, 245);
  display.print("PRESS EITHER BUTTON");
  display.setCursor(88, 258);
  display.setTextColor(neonPalette[(menuHuePhase + 8) % NEON_COUNT]);
  display.print("TO REMATCH");
}

void drawVictoryBase() {
  backgroundTargetPhase += 7;
  drawFullBackground(backgroundTargetPhase);
  display.fillRect(0, 0, SCREEN_W, 33, rgb565(5, 3, 20));
  display.drawFastHLine(0, 32, SCREEN_W, playerColor(winner));
  display.setTextSize(2);
  display.setTextColor(playerColor(winner), rgb565(5, 3, 20));
  display.setCursor(47, 9);
  display.print("MATCH OVER");
  drawWinnerText();
  MenuFooter::draw(display);
  victoryFrameInitialized = true;
  for (uint8_t i = 0; i < MAX_PARTICLES; ++i) oldParticleRects[i] = invalidRect();
}

void restoreFullScreenBackgroundRect(Rect r) {
  r = clippedToScreen(r);
  if (!rectValid(r)) return;
  display.startWrite();
  for (int16_t y = r.y; y < r.y + r.h; ++y) {
    uint8_t phase = bgRowPhase[y];
    for (int16_t i = 0; i < r.w; ++i) scanline[i] = backgroundColorAt(r.x + i, y, phase);
    display.setAddrWindow(r.x, y, r.w, 1);
    display.writePixels(scanline, (uint32_t)r.w);
  }
  display.endWrite();
}

void renderVictoryFrame() {
  spawnVictoryConfetti(winner);
  restoreOldParticleRects(true);
  drawParticles(true);
  ++menuHuePhase;
  // Redraw the foreground after restoring confetti so particles can travel
  // behind the winner text without permanently erasing it.
  display.fillRect(0, 0, SCREEN_W, 33, rgb565(5, 3, 20));
  display.drawFastHLine(0, 32, SCREEN_W, playerColor(winner));
  display.setTextSize(2);
  display.setTextColor(playerColor(winner), rgb565(5, 3, 20));
  display.setCursor(47, 9);
  display.print("MATCH OVER");
  drawWinnerText();
  MenuFooter::draw(display);
  saveCurrentParticleRects(true);
}

// ============================================================
// GAME UPDATE STATE HANDLERS
// ============================================================

void updateModeSelect(const GameInput &input) {
  if (input.leftPressed && !input.rightButton) {
    startMatch(MODE_SINGLE_PLAYER);
    return;
  }
  if (input.rightPressed && !input.leftButton) {
    startMatch(MODE_TWO_PLAYER);
    return;
  }
  updateModeSelectArt();
}

void updateServe(const GameInput &input) {
  runSimulationClock();

  bool shouldLaunch = false;

  if (mode == MODE_TWO_PLAYER) {
    // Only the player who owns this serve may start the rally. Keep the
    // launcher exit chord safe by rejecting a press while both are held.
    if (!(input.leftButton && input.rightButton)) {
      if (servePlayer == 1) shouldLaunch = input.leftPressed;
      else shouldLaunch = input.rightPressed;
    }
  } else if (servePlayer == 1) {
    // In 1P, both physical buttons belong to the human player.
    shouldLaunch = actionPressed(input);
  } else {
    // The CPU cannot physically click a button, so when it lost the point it
    // performs its own serve after a short readable pause.
    shouldLaunch = (uint32_t)(millis() - stateStartedMs) >= 650;
  }

  if (shouldLaunch) {
    launchBall();
    return;
  }

  uint32_t nowUs = micros();
  if ((uint32_t)(nowUs - lastRenderUs) >= RENDER_STEP_US) {
    lastRenderUs = nowUs;
    renderGameplayFrame();
  }
}

void updatePlaying(const GameInput &) {
  runSimulationClock();
  if (state != STATE_PLAYING) return; // A physics step may have scored.

  uint32_t nowUs = micros();
  if ((uint32_t)(nowUs - lastRenderUs) >= RENDER_STEP_US) {
    lastRenderUs = nowUs;
    renderGameplayFrame();
  }
}

void updatePoint() {
  runSimulationClock();
  uint32_t nowUs = micros();
  if ((uint32_t)(nowUs - lastRenderUs) >= RENDER_STEP_US) {
    lastRenderUs = nowUs;
    renderGameplayFrame();
  }

  if ((uint32_t)(millis() - stateStartedMs) >= POINT_HOLD_MS) {
    if (leftScore >= WIN_SCORE) enterMatchOver(1);
    else if (rightScore >= WIN_SCORE) enterMatchOver(2);
    else enterServe();
  }
}

void updateMatchOver(const GameInput &input) {
  runSimulationClock();
  if (actionPressed(input)) {
    startMatch(mode);
    return;
  }

  uint32_t nowUs = micros();
  if ((uint32_t)(nowUs - lastRenderUs) >= RENDER_STEP_US) {
    lastRenderUs = nowUs;
    renderVictoryFrame();
  }
}

// ============================================================
// PUBLIC GAME API
// ============================================================

void enter() {
  randomSeed((uint32_t)micros() ^ (uint32_t)millis());
  initPalette();
  display.setRotation(0);
  display.setTextWrap(false);

  state = STATE_MODE_SELECT;
  mode = MODE_SINGLE_PLAYER;
  leftScore = 0;
  rightScore = 0;
  pointScorer = 0;
  winner = 0;
  backgroundTargetPhase = 0;
  menuHuePhase = 0;
  clearParticles();
  centerPaddles();
  ball.x = CENTER_X;
  ball.y = PLAY_CENTER_Y;
  resetTrail();
  clearDynamicBounds();
  oldMenuBallRect = invalidRect();
  gameplayFrameInitialized = false;
  victoryFrameInitialized = false;

  lastSimUs = micros();
  simAccumulatorUs = 0;
  lastRenderUs = micros();
  stateStartedMs = millis();
  lastCpuDecisionMs = millis();
  lastHudAnimMs = millis();

  drawModeSelectBase();
}

void update(const GameInput &input) {
  updateSfx();

  switch (state) {
    case STATE_MODE_SELECT:
      updateModeSelect(input);
      break;
    case STATE_SERVE:
      updateServe(input);
      break;
    case STATE_PLAYING:
      updatePlaying(input);
      break;
    case STATE_POINT:
      updatePoint();
      break;
    case STATE_MATCH_OVER:
      updateMatchOver(input);
      break;
  }
}

} // namespace TripPong
