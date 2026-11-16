#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <utility>

struct GFXfont;

// Lightweight compatibility implementation of the Adafruit_GFX API used by
// Jakeboy games. Drawing primitives are implemented in terms of drawPixel(),
// so game-specific canvases can subclass Adafruit_GFX exactly as they do on
// the ESP32.
class Adafruit_GFX {
public:
  // The real Adafruit_GFX exposes a width/height constructor. A default is
  // retained for older simulator display shims that did not initialize it.
  Adafruit_GFX() = default;
  Adafruit_GFX(int16_t w, int16_t h)
      : WIDTH(w), HEIGHT(h), _width(w), _height(h) {}
  virtual ~Adafruit_GFX() = default;

  virtual void drawPixel(int16_t x, int16_t y, uint16_t color) = 0;

  // Adafruit_GFX transaction/write API. These are virtual in the real library,
  // which lets framebuffer/canvas helpers override them for faster bulk draws.
  virtual void startWrite() {}
  virtual void endWrite() {}
  virtual void writePixel(int16_t x, int16_t y, uint16_t color) {
    drawPixel(x, y, color);
  }
  virtual void writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
    if (w <= 0) return;
    for (int16_t i = 0; i < w; ++i)
      writePixel(static_cast<int16_t>(x + i), y, color);
  }
  virtual void writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
    if (h <= 0) return;
    for (int16_t i = 0; i < h; ++i)
      writePixel(x, static_cast<int16_t>(y + i), color);
  }
  virtual void writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (w <= 0 || h <= 0) return;
    for (int16_t yy = 0; yy < h; ++yy)
      writeFastHLine(x, static_cast<int16_t>(y + yy), w, color);
  }
  virtual void writeLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color) {
    if (x0 == x1) {
      const int16_t y = std::min(y0, y1);
      writeFastVLine(x0, y, static_cast<int16_t>(std::abs(y1 - y0) + 1), color);
      return;
    }
    if (y0 == y1) {
      const int16_t x = std::min(x0, x1);
      writeFastHLine(x, y0, static_cast<int16_t>(std::abs(x1 - x0) + 1), color);
      return;
    }
    int16_t dx = std::abs(x1 - x0);
    const int16_t sx = x0 < x1 ? 1 : -1;
    int16_t dy = static_cast<int16_t>(-std::abs(y1 - y0));
    const int16_t sy = y0 < y1 ? 1 : -1;
    int16_t err = static_cast<int16_t>(dx + dy);
    while (true) {
      writePixel(x0, y0, color);
      if (x0 == x1 && y0 == y1) break;
      const int16_t e2 = static_cast<int16_t>(2 * err);
      if (e2 >= dy) { err = static_cast<int16_t>(err + dy); x0 = static_cast<int16_t>(x0 + sx); }
      if (e2 <= dx) { err = static_cast<int16_t>(err + dx); y0 = static_cast<int16_t>(y0 + sy); }
    }
  }

  int16_t width() const { return _width; }
  int16_t height() const { return _height; }

  void drawFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
    startWrite();
    writeFastHLine(x, y, w, color);
    endWrite();
  }

  void drawFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
    startWrite();
    writeFastVLine(x, y, h, color);
    endWrite();
  }

  void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color) {
    startWrite();
    writeLine(x0, y0, x1, y1, color);
    endWrite();
  }

  void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (w <= 0 || h <= 0) return;
    drawFastHLine(x, y, w, color);
    drawFastHLine(x, static_cast<int16_t>(y + h - 1), w, color);
    drawFastVLine(x, y, h, color);
    drawFastVLine(static_cast<int16_t>(x + w - 1), y, h, color);
  }

  void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    startWrite();
    writeFillRect(x, y, w, h, color);
    endWrite();
  }

  void fillScreen(uint16_t color) {
    fillRect(0, 0, _width, _height, color);
  }

  void drawCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color) {
    if (r < 0) return;
    int16_t x = r;
    int16_t y = 0;
    int16_t err = 0;
    while (x >= y) {
      drawPixel(static_cast<int16_t>(x0 + x), static_cast<int16_t>(y0 + y), color);
      drawPixel(static_cast<int16_t>(x0 + y), static_cast<int16_t>(y0 + x), color);
      drawPixel(static_cast<int16_t>(x0 - y), static_cast<int16_t>(y0 + x), color);
      drawPixel(static_cast<int16_t>(x0 - x), static_cast<int16_t>(y0 + y), color);
      drawPixel(static_cast<int16_t>(x0 - x), static_cast<int16_t>(y0 - y), color);
      drawPixel(static_cast<int16_t>(x0 - y), static_cast<int16_t>(y0 - x), color);
      drawPixel(static_cast<int16_t>(x0 + y), static_cast<int16_t>(y0 - x), color);
      drawPixel(static_cast<int16_t>(x0 + x), static_cast<int16_t>(y0 - y), color);
      if (err <= 0) { ++y; err = static_cast<int16_t>(err + 2 * y + 1); }
      if (err > 0) { --x; err = static_cast<int16_t>(err - 2 * x + 1); }
    }
  }

  void fillCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color) {
    if (r < 0) return;
    for (int16_t y = static_cast<int16_t>(-r); y <= r; ++y) {
      const int32_t inside = static_cast<int32_t>(r) * r - static_cast<int32_t>(y) * y;
      const int16_t x = static_cast<int16_t>(std::sqrt(static_cast<double>(std::max<int32_t>(0, inside))));
      drawFastHLine(static_cast<int16_t>(x0 - x), static_cast<int16_t>(y0 + y),
                    static_cast<int16_t>(2 * x + 1), color);
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
      const int16_t a = std::min({x0, x1, x2});
      const int16_t b = std::max({x0, x1, x2});
      drawFastHLine(a, y0, static_cast<int16_t>(b - a + 1), color);
      return;
    }

    auto edgeX = [](int16_t xa, int16_t ya, int16_t xb, int16_t yb, int16_t y) -> int16_t {
      if (yb == ya) return xa;
      return static_cast<int16_t>(xa + (static_cast<int32_t>(xb - xa) * (y - ya)) / (yb - ya));
    };

    for (int16_t y = y0; y <= y2; ++y) {
      int16_t a = edgeX(x0, y0, x2, y2, y);
      int16_t b = (y < y1) ? edgeX(x0, y0, x1, y1, y)
                           : edgeX(x1, y1, x2, y2, y);
      if (a > b) std::swap(a, b);
      drawFastHLine(a, y, static_cast<int16_t>(b - a + 1), color);
    }
  }

  void drawRoundRect(int16_t x, int16_t y, int16_t w, int16_t h,
                     int16_t r, uint16_t color) {
    if (w <= 0 || h <= 0) return;
    r = std::max<int16_t>(0, std::min<int16_t>(r, std::min<int16_t>(w, h) / 2));
    drawFastHLine(static_cast<int16_t>(x + r), y, static_cast<int16_t>(w - 2 * r), color);
    drawFastHLine(static_cast<int16_t>(x + r), static_cast<int16_t>(y + h - 1),
                  static_cast<int16_t>(w - 2 * r), color);
    drawFastVLine(x, static_cast<int16_t>(y + r), static_cast<int16_t>(h - 2 * r), color);
    drawFastVLine(static_cast<int16_t>(x + w - 1), static_cast<int16_t>(y + r),
                  static_cast<int16_t>(h - 2 * r), color);
    const int32_t rr = static_cast<int32_t>(r) * r;
    for (int16_t yy = 0; yy <= r; ++yy) {
      const int16_t xx = static_cast<int16_t>(std::sqrt(static_cast<double>(std::max<int32_t>(0, rr - static_cast<int32_t>(yy) * yy))));
      drawPixel(static_cast<int16_t>(x + r - xx), static_cast<int16_t>(y + r - yy), color);
      drawPixel(static_cast<int16_t>(x + w - 1 - r + xx), static_cast<int16_t>(y + r - yy), color);
      drawPixel(static_cast<int16_t>(x + r - xx), static_cast<int16_t>(y + h - 1 - r + yy), color);
      drawPixel(static_cast<int16_t>(x + w - 1 - r + xx), static_cast<int16_t>(y + h - 1 - r + yy), color);
    }
  }

  void fillRoundRect(int16_t x, int16_t y, int16_t w, int16_t h,
                     int16_t r, uint16_t color) {
    if (w <= 0 || h <= 0) return;
    r = std::max<int16_t>(0, std::min<int16_t>(r, std::min<int16_t>(w, h) / 2));
    fillRect(static_cast<int16_t>(x + r), y, static_cast<int16_t>(w - 2 * r), h, color);
    for (int16_t yy = 0; yy < r; ++yy) {
      const int16_t dy = static_cast<int16_t>(r - yy);
      const int32_t inside = static_cast<int32_t>(r) * r - static_cast<int32_t>(dy) * dy;
      const int16_t xx = static_cast<int16_t>(std::sqrt(static_cast<double>(std::max<int32_t>(0, inside))));
      fillRect(static_cast<int16_t>(x + r - xx), static_cast<int16_t>(y + yy),
               static_cast<int16_t>(w - 2 * r + 2 * xx), 1, color);
      fillRect(static_cast<int16_t>(x + r - xx), static_cast<int16_t>(y + h - 1 - yy),
               static_cast<int16_t>(w - 2 * r + 2 * xx), 1, color);
    }
  }

  void setTextWrap(bool w) { wrap_ = w; }
  // Custom GFX fonts are not rendered by the simulator yet, but the API is
  // present so normal setFont(nullptr) / font-selection code compiles.
  void setFont(const GFXfont *f = nullptr) { gfxFont_ = f; }
  void setTextSize(uint8_t s) { textsize_x_ = std::max<uint8_t>(1, s); textsize_y_ = textsize_x_; }
  void setTextSize(uint8_t sx, uint8_t sy) {
    textsize_x_ = std::max<uint8_t>(1, sx);
    textsize_y_ = std::max<uint8_t>(1, sy);
  }
  void setTextColor(uint16_t c) { textcolor_ = c; textbgcolor_ = c; opaqueText_ = false; }
  void setTextColor(uint16_t c, uint16_t bg) { textcolor_ = c; textbgcolor_ = bg; opaqueText_ = true; }
  void setCursor(int16_t x, int16_t y) { cursor_x_ = x; cursor_y_ = y; }
  int16_t getCursorX() const { return cursor_x_; }
  int16_t getCursorY() const { return cursor_y_; }

  void getTextBounds(const char *text, int16_t x, int16_t y,
                     int16_t *x1, int16_t *y1, uint16_t *w, uint16_t *h) const {
    const size_t length = text ? std::strlen(text) : 0;
    if (x1) *x1 = x;
    if (y1) *y1 = y;
    if (w) *w = static_cast<uint16_t>(length * 6u * textsize_x_);
    if (h) *h = length ? static_cast<uint16_t>(8u * textsize_y_) : 0;
  }

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
  size_t print(float v, int digits = 2) { return print(static_cast<double>(v), digits); }
  size_t print(double v, int digits = 2) {
    digits = std::max(0, std::min(digits, 9));
    char format[12];
    std::snprintf(format, sizeof(format), "%%.%df", digits);
    char b[64];
    std::snprintf(b, sizeof(b), format, v);
    return print(b);
  }

protected:
  int16_t WIDTH = 0;
  int16_t HEIGHT = 0;
  int16_t _width = 0;
  int16_t _height = 0;
  int16_t cursor_x_ = 0;
  int16_t cursor_y_ = 0;
  uint16_t textcolor_ = 0xFFFF;
  uint16_t textbgcolor_ = 0xFFFF;
  uint8_t textsize_x_ = 1;
  uint8_t textsize_y_ = 1;
  bool wrap_ = true;
  bool opaqueText_ = false;
  const GFXfont *gfxFont_ = nullptr;

private:
  static const char *glyph(char c) {
    if (c >= 'a' && c <= 'z') c = static_cast<char>(c - 'a' + 'A');
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
      default: return "11111100010001000100000000010000100";
    }
  }

  void writeChar(char c) {
    if (c == '\n') {
      cursor_x_ = 0;
      cursor_y_ = static_cast<int16_t>(cursor_y_ + 8 * textsize_y_);
      return;
    }
    if (c == '\r') return;

    const int16_t cellW = static_cast<int16_t>(6 * textsize_x_);
    const int16_t cellH = static_cast<int16_t>(8 * textsize_y_);
    if (wrap_ && _width > 0 && cursor_x_ + cellW > _width) {
      cursor_x_ = 0;
      cursor_y_ = static_cast<int16_t>(cursor_y_ + cellH);
    }

    const char *g = glyph(c);
    if (opaqueText_) fillRect(cursor_x_, cursor_y_, cellW, cellH, textbgcolor_);
    for (int gy = 0; gy < 7; ++gy) {
      for (int gx = 0; gx < 5; ++gx) {
        if (g[gy * 5 + gx] == '1') {
          fillRect(static_cast<int16_t>(cursor_x_ + gx * textsize_x_),
                   static_cast<int16_t>(cursor_y_ + gy * textsize_y_),
                   textsize_x_, textsize_y_, textcolor_);
        }
      }
    }
    cursor_x_ = static_cast<int16_t>(cursor_x_ + cellW);
  }
};
