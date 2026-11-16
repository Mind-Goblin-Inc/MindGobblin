#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace IceColdBeer {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t wood=rgb(133,79,38),brass=rgb(203,161,71),steel=rgb(155,171,171),cream=rgb(242,228,178),dark=rgb(15,19,17);
  c.fillScreen(wood);c.fillRect(13,0,214,280,rgb(72,39,23));c.fillRect(22,8,196,86,brass);c.fillRect(28,14,184,73,cream);
  title(c,"ICE COLD",21,2,dark,brass,SLAB);title(c,"BEER",52,3,dark,brass,SLAB);
  c.fillRect(25,106,190,153,steel);c.drawRect(25,106,190,153,brass);
  for(int x=39;x<207;x+=32)c.drawFastVLine(x,112,140,rgb(127,149,149));
  const int hx[6]={67,119,172,86,147,119},hy[6]={132,145,134,181,179,218};
  for(int i=0;i<6;++i){c.fillCircle(hx[i],hy[i],9,dark);c.drawCircle(hx[i],hy[i],10,brass);}
  c.drawLine(40,218,200,188,rgb(57,68,65));c.drawLine(40,215,200,185,brass);
  int x=104+wave(f.animationStep,12,27);int y=202-(x-104)/6;
  c.fillCircle(x,y,7,cream);c.drawCircle(x,y,7,dark);c.fillCircle(x-2,y-2,2,0xffff);
  for(int x2=18;x2<=222;x2+=204){bolt(c,x2,103,brass);bolt(c,x2,260,brass);}
}
static const MenuPresentation presentation={draw,MenuArt::rgb(203,161,71),160,1,{{95,182,48,37},{0,0,0,0},{0,0,0,0}}};
}}
