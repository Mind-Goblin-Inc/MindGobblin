#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace ScrapClaw {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t dark=rgb(16,26,40),steel=rgb(127,149,156),rust=rgb(190,91,51),yellow=rgb(241,192,57);
  c.fillScreen(dark);c.fillRect(5,0,15,280,steel);c.fillRect(220,0,15,280,steel);c.fillRect(8,91,224,17,steel);
  title(c,"SCRAP",17,3,yellow,rust,STENCIL);title(c,"CLAW",52,3,yellow,rust,STENCIL);
  c.fillRect(99,106,42,15,rust);c.drawLine(120,120,120,155,steel);
  int spread=wave(f.animationStep,8,8);
  c.fillCircle(120,163,15,steel);c.drawLine(109,172,92-spread,197,steel);c.drawLine(131,172,148+spread,197,steel);c.drawLine(120,177,120,201,steel);
  c.drawLine(92-spread,197,99-spread,191,yellow);c.drawLine(148+spread,197,141+spread,191,yellow);
  c.fillRect(22,245,196,27,rgb(51,67,80));c.fillCircle(53,227,18,steel);c.fillCircle(53,227,8,dark);
  c.fillRect(93,216,34,26,rust);c.drawLine(91,237,132,213,yellow);c.drawLine(140,236,199,214,steel);
  c.fillCircle(169,228,11,rgb(96,202,203));c.drawRect(32,209,190,41,yellow);
  bolt(c,12,101,yellow);bolt(c,227,101,yellow);bolt(c,12,264,yellow);bolt(c,227,264,yellow);
}
static const MenuPresentation presentation={draw,MenuArt::rgb(241,192,57),160,1,{{72,102,96,100},{0,0,0,0},{0,0,0,0}}};
}}
