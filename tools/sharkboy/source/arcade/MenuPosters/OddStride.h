#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace OddStride {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t paper=rgb(230,219,181),ink=rgb(31,42,50),turq=rgb(56,161,163),coral=rgb(216,101,81);
  c.fillScreen(paper);c.fillTriangle(0,129,85,95,0,280,turq);c.fillTriangle(240,86,149,155,240,279,coral);
  title(c,"ODD",21,4,ink,coral,BLOCK,18);title(c,"STRIDE",61,3,ink,turq,BLOCK,48);
  c.fillCircle(115,128,16,ink);c.fillCircle(119,125,3,paper);
  c.fillTriangle(108,144,128,157,137,188,ink);c.drawLine(118,155,85,177,ink);c.drawLine(127,166,163,179,ink);
  c.drawLine(137,188,104,210,turq);c.drawLine(137,188,164,211,coral);
  c.drawLine(104,210,90,235,turq);c.drawLine(164,211,171,234,coral);
  int roll=wave(f.animationStep,8,4)-2;
  c.fillRoundRect(75+roll,231,35,10,4,turq);c.fillRoundRect(158-roll,231,35,10,4,coral);
  c.fillCircle(104,210,4,ink);c.fillCircle(164,211,4,ink);
  c.drawFastHLine(0,253,240,ink);c.fillTriangle(211,218,235,225,211,232,coral);c.drawFastVLine(211,215,38,ink);
}
static const MenuPresentation presentation={draw,MenuArt::rgb(56,161,163),160,1,{{72,204,124,49},{0,0,0,0},{0,0,0,0}}};
}}
