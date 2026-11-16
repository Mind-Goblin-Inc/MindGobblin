#pragma once

#include "Adafruit_GFX.h"
#include <algorithm>
#include <array>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>

constexpr uint16_t ST77XX_BLACK   = 0x0000;
constexpr uint16_t ST77XX_BLUE    = 0x001F;
constexpr uint16_t ST77XX_RED     = 0xF800;
constexpr uint16_t ST77XX_GREEN   = 0x07E0;
constexpr uint16_t ST77XX_CYAN    = 0x07FF;
constexpr uint16_t ST77XX_MAGENTA = 0xF81F;
constexpr uint16_t ST77XX_YELLOW  = 0xFFE0;
constexpr uint16_t ST77XX_WHITE   = 0xFFFF;

class Adafruit_ST7789 : public Adafruit_GFX {
public:
  static constexpr int16_t NATIVE_W = 240;
  static constexpr int16_t NATIVE_H = 320;

  Adafruit_ST7789(int8_t = -1, int8_t = -1, int8_t = -1)
      : Adafruit_GFX(NATIVE_W, NATIVE_H) { fillScreen(ST77XX_BLACK); }

  void init(uint16_t = NATIVE_W, uint16_t = NATIVE_H) {}
  void setRotation(uint8_t r) {
    rotation_ = r & 3;
    if (rotation_ & 1) { _width = NATIVE_H; _height = NATIVE_W; }
    else { _width = NATIVE_W; _height = NATIVE_H; }
  }
  void setTextWrap(bool w) { textWrap_ = w; }
  void getTextBounds(const char *text, int16_t x, int16_t y,
                     int16_t *x1, int16_t *y1, uint16_t *w, uint16_t *h) const {
    const size_t length = text ? std::strlen(text) : 0;
    if (x1) *x1 = x;
    if (y1) *y1 = y;
    if (w) *w = static_cast<uint16_t>(length * 6 * textSize_);
    if (h) *h = length ? static_cast<uint16_t>(8 * textSize_) : 0;
  }
  int16_t width() const { return (rotation_ & 1) ? NATIVE_H : NATIVE_W; }
  int16_t height() const { return (rotation_ & 1) ? NATIVE_W : NATIVE_H; }

  const uint16_t *pixels() const { return fb_.data(); }
  uint16_t *pixels() { return fb_.data(); }

  void drawPixel(int16_t x, int16_t y, uint16_t color) override {
    mapRotation(x, y);
    if (x < 0 || y < 0 || x >= NATIVE_W || y >= NATIVE_H) return;
    fb_[static_cast<size_t>(y) * NATIVE_W + x] = color;
  }

  void fillScreen(uint16_t color) { fb_.fill(color); }

  void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (w <= 0 || h <= 0) return;
    // Games here use rotation 0. For non-zero rotation, fall back pixel-by-pixel.
    if (rotation_ != 0) {
      for (int16_t yy = 0; yy < h; ++yy)
        for (int16_t xx = 0; xx < w; ++xx) drawPixel(x + xx, y + yy, color);
      return;
    }
    int16_t x0 = std::max<int16_t>(0, x);
    int16_t y0 = std::max<int16_t>(0, y);
    int16_t x1 = std::min<int16_t>(NATIVE_W, static_cast<int16_t>(x + w));
    int16_t y1 = std::min<int16_t>(NATIVE_H, static_cast<int16_t>(y + h));
    if (x1 <= x0 || y1 <= y0) return;
    for (int16_t yy = y0; yy < y1; ++yy) {
      auto *row = fb_.data() + static_cast<size_t>(yy) * NATIVE_W;
      std::fill(row + x0, row + x1, color);
    }
  }

  void drawFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
    fillRect(x, y, w, 1, color);
  }
  void drawFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
    fillRect(x, y, 1, h, color);
  }
  void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (w <= 0 || h <= 0) return;
    drawFastHLine(x, y, w, color);
    drawFastHLine(x, y + h - 1, w, color);
    drawFastVLine(x, y, h, color);
    drawFastVLine(x + w - 1, y, h, color);
  }

  void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color) {
    int16_t dx = std::abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    int16_t dy = -std::abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    int16_t err = dx + dy;
    while (true) {
      drawPixel(x0, y0, color);
      if (x0 == x1 && y0 == y1) break;
      int16_t e2 = static_cast<int16_t>(2 * err);
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  void drawCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color) {
    if (r < 0) return;
    int16_t x = r, y = 0, err = 0;
    while (x >= y) {
      drawPixel(x0 + x, y0 + y, color); drawPixel(x0 + y, y0 + x, color);
      drawPixel(x0 - y, y0 + x, color); drawPixel(x0 - x, y0 + y, color);
      drawPixel(x0 - x, y0 - y, color); drawPixel(x0 - y, y0 - x, color);
      drawPixel(x0 + y, y0 - x, color); drawPixel(x0 + x, y0 - y, color);
      if (err <= 0) { ++y; err += static_cast<int16_t>(2 * y + 1); }
      if (err > 0) { --x; err -= static_cast<int16_t>(2 * x + 1); }
    }
  }

  void fillCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color) {
    if (r < 0) return;
    for (int16_t y = -r; y <= r; ++y) {
      int16_t x = static_cast<int16_t>(std::sqrt(static_cast<double>(r * r - y * y)));
      drawFastHLine(x0 - x, y0 + y, static_cast<int16_t>(2 * x + 1), color);
    }
  }

  void drawRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color) {
    if (w <= 0 || h <= 0) return;
    r = std::max<int16_t>(0, std::min<int16_t>(r, std::min<int16_t>(w, h) / 2));
    drawFastHLine(x + r, y, w - 2 * r, color);
    drawFastHLine(x + r, y + h - 1, w - 2 * r, color);
    drawFastVLine(x, y + r, h - 2 * r, color);
    drawFastVLine(x + w - 1, y + r, h - 2 * r, color);
    int16_t rr = r * r;
    for (int16_t yy = 0; yy <= r; ++yy) {
      int16_t xx = static_cast<int16_t>(std::sqrt(std::max(0, rr - yy * yy)));
      drawPixel(x + r - xx, y + r - yy, color);
      drawPixel(x + w - 1 - r + xx, y + r - yy, color);
      drawPixel(x + r - xx, y + h - 1 - r + yy, color);
      drawPixel(x + w - 1 - r + xx, y + h - 1 - r + yy, color);
    }
  }

  void fillRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color) {
    if (w <= 0 || h <= 0) return;
    r = std::max<int16_t>(0, std::min<int16_t>(r, std::min<int16_t>(w, h) / 2));
    fillRect(x + r, y, w - 2 * r, h, color);
    for (int16_t yy = 0; yy < r; ++yy) {
      int16_t dy = r - yy;
      int16_t xx = static_cast<int16_t>(std::sqrt(std::max(0, r * r - dy * dy)));
      fillRect(x + r - xx, y + yy, w - 2 * r + 2 * xx, 1, color);
      fillRect(x + r - xx, y + h - 1 - yy, w - 2 * r + 2 * xx, 1, color);
    }
  }

  void drawTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1,
                    int16_t x2, int16_t y2, uint16_t color) {
    drawLine(x0, y0, x1, y1, color);
    drawLine(x1, y1, x2, y2, color);
    drawLine(x2, y2, x0, y0, color);
  }

  void fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1,
                    int16_t x2, int16_t y2, uint16_t color) {
    if (y0 > y1) { std::swap(y0, y1); std::swap(x0, x1); }
    if (y1 > y2) { std::swap(y1, y2); std::swap(x1, x2); }
    if (y0 > y1) { std::swap(y0, y1); std::swap(x0, x1); }
    if (y0 == y2) {
      int16_t a = std::min({x0, x1, x2});
      int16_t b = std::max({x0, x1, x2});
      drawFastHLine(a, y0, b - a + 1, color);
      return;
    }
    auto edgeX = [](int16_t xa, int16_t ya, int16_t xb, int16_t yb, int16_t y) -> int16_t {
      if (yb == ya) return xa;
      return static_cast<int16_t>(xa + (static_cast<int32_t>(xb - xa) * (y - ya)) / (yb - ya));
    };
    for (int16_t y = y0; y <= y2; ++y) {
      int16_t a = edgeX(x0, y0, x2, y2, y);
      int16_t b = (y < y1) ? edgeX(x0, y0, x1, y1, y) : edgeX(x1, y1, x2, y2, y);
      if (a > b) std::swap(a, b);
      drawFastHLine(a, y, b - a + 1, color);
    }
  }

  void setCursor(int16_t x, int16_t y) { cursorX_ = x; cursorY_ = y; }
  void setTextSize(uint8_t s) { textSize_ = std::max<uint8_t>(1, s); }
  void setTextColor(uint16_t c) { textColor_ = c; textBg_ = c; opaqueText_ = false; }
  void setTextColor(uint16_t c, uint16_t bg) { textColor_ = c; textBg_ = bg; opaqueText_ = true; }

  size_t print(const char *s) {
    if (!s) return 0;
    size_t n = 0;
    while (*s) { writeChar(*s++); ++n; }
    return n;
  }
  size_t print(const std::string &s) { return print(s.c_str()); }
  size_t print(char c) { writeChar(c); return 1; }
  size_t print(int v) { char b[24]; std::snprintf(b, sizeof(b), "%d", v); return print(b); }
  size_t print(unsigned v) { char b[24]; std::snprintf(b, sizeof(b), "%u", v); return print(b); }
  size_t print(long v) { char b[32]; std::snprintf(b, sizeof(b), "%ld", v); return print(b); }
  size_t print(unsigned long v) { char b[32]; std::snprintf(b, sizeof(b), "%lu", v); return print(b); }
  size_t println() { writeChar('\n'); return 1; }
  template <typename T> size_t println(const T &value) { return print(value) + println(); }

  // Adafruit_GFX-compatible RGB565 bitmap blit.
  void drawRGBBitmap(int16_t x, int16_t y, const uint16_t *bitmap,
                     int16_t w, int16_t h) {
    if (!bitmap || w <= 0 || h <= 0) return;
    for (int16_t yy = 0; yy < h; ++yy) {
      for (int16_t xx = 0; xx < w; ++xx) {
        drawPixel(x + xx, y + yy, bitmap[static_cast<size_t>(yy) * w + xx]);
      }
    }
  }

  void startWrite() override {}
  void endWrite() override {}
  void setAddrWindow(int16_t x, int16_t y, int16_t w, int16_t h) {
    windowX_ = x; windowY_ = y; windowW_ = std::max<int16_t>(0, w); windowH_ = std::max<int16_t>(0, h); windowIndex_ = 0;
  }
  void writePixels(const uint16_t *colors, uint32_t len, bool = false) {
    if (!colors || windowW_ <= 0 || windowH_ <= 0) return;
    const uint32_t maxLen = static_cast<uint32_t>(windowW_) * windowH_;
    len = std::min(len, maxLen - std::min(windowIndex_, maxLen));
    for (uint32_t i = 0; i < len; ++i, ++windowIndex_) {
      int16_t xx = static_cast<int16_t>(windowX_ + (windowIndex_ % windowW_));
      int16_t yy = static_cast<int16_t>(windowY_ + (windowIndex_ / windowW_));
      drawPixel(xx, yy, colors[i]);
    }
  }

private:
  static inline std::array<uint16_t, static_cast<size_t>(NATIVE_W) * NATIVE_H> fb_{};
  uint8_t rotation_ = 0;
  int16_t cursorX_ = 0, cursorY_ = 0;
  uint8_t textSize_ = 1;
  uint16_t textColor_ = ST77XX_WHITE, textBg_ = ST77XX_BLACK;
  bool opaqueText_ = false, textWrap_ = true;
  int16_t windowX_ = 0, windowY_ = 0, windowW_ = 0, windowH_ = 0;
  uint32_t windowIndex_ = 0;

  void mapRotation(int16_t &x, int16_t &y) const {
    int16_t t;
    switch (rotation_) {
      case 1: t = x; x = NATIVE_W - 1 - y; y = t; break;
      case 2: x = NATIVE_W - 1 - x; y = NATIVE_H - 1 - y; break;
      case 3: t = x; x = y; y = NATIVE_H - 1 - t; break;
      default: break;
    }
  }

  static const char *glyph(char c) {
    c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    switch (c) {
      case 'A': return "01110100011000111111100011000110001";
      case 'B': return "11110100011000111110100011000111110";
      case 'C': return "01111100001000010000100001000001111";
      case 'D': return "11110100011000110001100011000111110";
      case 'E': return "11111100001000011110100001000011111";
      case 'F': return "11111100001000011110100001000010000";
      case 'G': return "01111100001000010111100011000101111";
      case 'H': return "10001100011000111111100011000110001";
      case 'I': return "11111001000010000100001000010011111";
      case 'J': return "00111000100001000010000101001001100";
      case 'K': return "10001100101010011000101001001010001";
      case 'L': return "10000100001000010000100001000011111";
      case 'M': return "10001110111010110101100011000110001";
      case 'N': return "10001110011010110011100011000110001";
      case 'O': return "01110100011000110001100011000101110";
      case 'P': return "11110100011000111110100001000010000";
      case 'Q': return "01110100011000110001101011001001101";
      case 'R': return "11110100011000111110101001001010001";
      case 'S': return "01111100001000001110000010000111110";
      case 'T': return "11111001000010000100001000010000100";
      case 'U': return "10001100011000110001100011000101110";
      case 'V': return "10001100011000110001100010101000100";
      case 'W': return "10001100011000110101101011101110001";
      case 'X': return "10001100010101000100010101000110001";
      case 'Y': return "10001100010101000100001000010000100";
      case 'Z': return "11111000010001000100010001000011111";
      case '0': return "01110100011001110101110011000101110";
      case '1': return "00100011000010000100001000010001110";
      case '2': return "01110100010000100010001000100011111";
      case '3': return "11110000010000101110000010000111110";
      case '4': return "00010001100101010010111110001000010";
      case '5': return "11111100001000011110000010000111110";
      case '6': return "01110100001000011110100011000101110";
      case '7': return "11111000010001000100010000100001000";
      case '8': return "01110100011000101110100011000101110";
      case '9': return "01110100011000101111000010000101110";
      case '+': return "00000001000010011111001000010000000";
      case '-': return "00000000000000011111000000000000000";
      case ':': return "00000001000010000000001000010000000";
      case '.': return "00000000000000000000000000110001100";
      case '/': return "00001000100001000100010001000010000";
      case '!': return "00100001000010000100001000000000100";
      case '?': return "01110100010000100010001000000000100";
      case '<': return "00010001000100010000010000010000010";
      case '>': return "01000001000001000001000100010001000";
      case '$': return "00100011101010001110001010111000100";
      case ' ': return "00000000000000000000000000000000000";
      default:  return "11111100010001000100000000010000100";
    }
  }

  void writeChar(char c) {
    if (c == '\n') { cursorX_ = 0; cursorY_ += 8 * textSize_; return; }
    if (c == '\r') return;
    const int16_t cellW = 6 * textSize_;
    const int16_t cellH = 8 * textSize_;
    if (textWrap_ && cursorX_ + cellW > width()) { cursorX_ = 0; cursorY_ += cellH; }
    const char *g = glyph(c);
    if (opaqueText_) fillRect(cursorX_, cursorY_, cellW, cellH, textBg_);
    for (int gy = 0; gy < 7; ++gy) {
      for (int gx = 0; gx < 5; ++gx) {
        if (g[gy * 5 + gx] == '1')
          fillRect(cursorX_ + gx * textSize_, cursorY_ + gy * textSize_, textSize_, textSize_, textColor_);
      }
    }
    cursorX_ += cellW;
  }
};
