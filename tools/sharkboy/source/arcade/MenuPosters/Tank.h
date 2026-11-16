#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace Tank {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt; const uint16_t dark=rgb(18,23,19),olive=rgb(83,94,52),armor=rgb(126,136,82),sky=rgb(123,133,112),pale=rgb(227,225,193);
  gradient(c,sky,dark); c.fillTriangle(0,165,85,130,141,165,olive);c.fillTriangle(100,165,205,138,240,165,olive);c.fillRect(0,165,240,115,dark);
  title(c,"TANK",25,6,pale,dark,STENCIL);
  c.drawFastHLine(20,84,65,pale);c.drawFastHLine(155,84,65,pale);
  for(int x=35;x<205;x+=31)c.fillRect(x,91,12,3,olive);
  c.fillRect(23,151,22,7,dark);c.fillRect(184,151,27,7,dark);
  for(int i=0;i<3;++i){int x=142+i*20+(wave(f.animationStep+i*2,8,4)-2),y=151-i*13-wave(f.animationStep+i,8,12);c.fillCircle(x,y,7+i%2,rgb(102,110,98));}
  c.fillRoundRect(37,194,52,55,8,0x0861);c.fillRoundRect(151,190,54,58,8,0x0861);
  for(int x=43;x<84;x+=11)c.fillCircle(x,239,5,armor);
  for(int x=159;x<201;x+=11)c.fillCircle(x,239,5,armor);
  c.fillTriangle(55,185,181,178,212,222,olive);c.fillTriangle(55,185,212,222,65,232,armor);
  c.fillRoundRect(96,166,68,34,5,olive);c.drawLine(144,170,204,148,pale);c.drawLine(144,173,204,151,armor);
  c.fillRect(97,179,21,5,pale);c.drawFastHLine(71,217,126,pale);
  c.drawLine(13,252,50,220,armor);c.drawLine(20,219,48,257,armor);c.drawLine(192,251,229,215,armor);
}
static const MenuPresentation presentation={draw,MenuArt::rgb(126,136,82),150,1,{{132,102,72,64},{0,0,0,0},{0,0,0,0}}};
}}
