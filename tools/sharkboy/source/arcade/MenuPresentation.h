#pragma once
#include <stdint.h>
class MenuCanvas;
struct MenuRect { int16_t x, y, w, h; };
struct MenuFrame { const char *registryTitle; uint32_t animationStep; };
struct MenuPresentation {
  void (*draw)(MenuCanvas &, const MenuFrame &);
  uint16_t accent565;
  uint16_t frameIntervalMs;
  uint8_t animationRegionCount;
  MenuRect animationRegions[3];
};
