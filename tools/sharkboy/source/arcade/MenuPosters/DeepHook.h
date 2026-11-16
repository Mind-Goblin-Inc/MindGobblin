#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace DeepHook {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t abyss=rgb(3,12,24),water=rgb(6,38,61),cyan=rgb(178,224,216),gold=rgb(211,176,92);
  gradient(c,rgb(74,157,184),abyss);c.drawFastHLine(0,97,240,cyan);
  title(c,"DEEP",18,4,cyan,water,ANGULAR,24);title(c,"HOOK",55,4,cyan,water,ANGULAR,68);
  c.fillTriangle(28,98,86,98,72,108,water);c.fillRect(44,88,25,10,cyan);
  c.drawLine(81,99,127,99,gold);c.drawLine(127,99,127,218,gold);
  c.drawCircle(126,218,20,gold);c.fillRect(103,192,26,29,water);c.drawLine(112,234,105,226,gold);
  fish(c,55,183,49,22,rgb(8,27,40));fish(c,207,235,73,33,rgb(8,27,40));
  for(int i=0;i<4;++i){int x=158+i*8+(f.animationStep+i)%3,y=174+((i*17+72-(f.animationStep*3)%72)%72);c.drawCircle(x,y,1+i%3,cyan);}
}
static const MenuPresentation presentation={draw,MenuArt::rgb(178,224,216),150,1,{{151,169,42,80},{0,0,0,0},{0,0,0,0}}};
}}
