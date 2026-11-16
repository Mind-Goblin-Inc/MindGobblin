#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace Skyhook {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t steel=rgb(133,154,158),dark=rgb(24,44,57),yellow=rgb(233,185,63),cream=rgb(218,218,182);
  gradient(c,rgb(94,121,137),dark);
  title(c,"SKYHOOK",28,3,cream,dark,SLAB);
  for(int x=0;x<240;x+=31)c.fillRect(x,173+(x%4)*7,26,107,rgb(51,67,80));
  c.fillRoundRect(39,112,162,40,10,dark);c.drawRoundRect(39,112,162,40,10,steel);
  c.fillRect(52,147,29,13,yellow);c.fillRect(164,147,28,13,yellow);c.fillTriangle(157,115,190,124,157,138,rgb(85,213,220));
  c.drawFastHLine(65,122,75,cream);c.drawFastHLine(87,154,65,yellow);
  int sway=wave(f.animationStep,10,8)-4;
  c.drawLine(120,151,120+sway,205,cream);c.fillRect(107+sway,204,27,12,steel);
  c.fillRect(95+sway,217,51,29,yellow);c.drawRect(95+sway,217,51,29,dark);
  c.drawLine(95+sway,217,146+sway,246,dark);c.drawLine(146+sway,217,95+sway,246,dark);
  c.fillRect(10,251,79,12,steel);for(int x=12;x<88;x+=16)c.fillRect(x,251,8,5,yellow);
}
static const MenuPresentation presentation={draw,MenuArt::rgb(233,185,63),150,1,{{87,150,74,99},{0,0,0,0},{0,0,0,0}}};
}}
