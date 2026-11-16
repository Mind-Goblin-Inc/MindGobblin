#pragma once

#include <Adafruit_GFX.h>

// Shared layout for game menu and post-game choice screens. Active play must
// never call this helper.
namespace MenuFooter {
constexpr int16_t Y = 304;
constexpr int16_t HEIGHT = 16;
constexpr int16_t WIDTH = 240;
constexpr char TEXT[] = "HOLD BOTH: MENU";
constexpr uint16_t BACKGROUND = 0x11A9;
constexpr uint16_t FOREGROUND = 0xFFFF;

inline void draw(Adafruit_GFX &canvas) {
  canvas.fillRect(0, Y, WIDTH, HEIGHT, BACKGROUND);
  canvas.setTextWrap(false);
  canvas.setTextSize(1);
  canvas.setTextColor(FOREGROUND, BACKGROUND);
  canvas.setCursor((WIDTH - (sizeof(TEXT) - 1) * 6) / 2, Y + 4);
  canvas.print(TEXT);
}

// For renderers that store palette indices rather than RGB565 pixels.
inline void drawIndexed(Adafruit_GFX &canvas, uint8_t background, uint8_t foreground) {
  canvas.fillRect(0, Y, WIDTH, HEIGHT, background);
  canvas.setTextWrap(false);
  canvas.setTextSize(1);
  canvas.setTextColor(foreground, background);
  canvas.setCursor((WIDTH - (sizeof(TEXT) - 1) * 6) / 2, Y + 4);
  canvas.print(TEXT);
}
}
