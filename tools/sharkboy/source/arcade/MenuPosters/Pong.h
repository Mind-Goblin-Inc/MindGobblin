#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace Pong {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t bg=rgb(14,8,31),pink=rgb(239,75,180),cyan=rgb(63,217,225),amber=rgb(250,190,74);
  gradient(c,bg,rgb(45,20,76));
  c.fillTriangle(0,110,0,210,100,158,rgb(62,25,87));c.fillTriangle(240,110,240,210,140,158,rgb(62,25,87));
  title(c,"PONG",28,6,pink,cyan,BLOCK);
  c.drawRect(18,125,204,132,amber);for(int y=132;y<251;y+=16)c.fillRect(118,y,4,8,cyan);
  c.drawRect(21,177,14,58,cyan);c.fillRect(25,181,7,50,pink);
  c.drawRect(205,177,14,58,pink);c.fillRect(208,181,7,50,cyan);
  int x=37+wave(f.animationStep,34,166),y=202+wave(f.animationStep,18,12);
  c.fillCircle(x-9,y+2,3,rgb(93,75,116));c.fillCircle(x,y,5,0xffff);
  c.drawFastHLine(45,266,150,cyan);
}
static const MenuPresentation presentation={draw,MenuArt::rgb(239,75,180),100,1,{{25,190,194,38},{0,0,0,0},{0,0,0,0}}};
}}
