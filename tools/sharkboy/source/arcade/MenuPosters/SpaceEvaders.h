#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace SpaceEvaders {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t bg=rgb(4,7,13),cyan=rgb(53,217,244),orange=rgb(255,149,82),gold=rgb(255,211,86);
  gradient(c,bg,rgb(13,27,44));stars(c,22,rgb(84,119,137),17);
  title(c,"SPACE",22,3,cyan,rgb(20,92,147),ANGULAR);title(c,"EVADERS",59,3,orange,rgb(207,68,127),ANGULAR);
  c.fillTriangle(20,179,83,149,68,206,cyan);c.fillTriangle(220,196,156,164,172,222,orange);
  c.fillTriangle(63,181,89,186,62,191,rgb(20,92,147));c.fillTriangle(177,197,151,203,179,208,rgb(207,68,127));
  c.fillRect(46,220,48,15,rgb(20,92,147));c.fillRect(146,225,49,15,rgb(207,68,127));
  c.drawFastVLine(103,175,23,cyan);c.drawFastVLine(138,193,19,orange);
  c.fillCircle(121,205,4,gold);c.drawCircle(121,205,10,gold);
  const MenuRect r[3]={{17,112,34,30},{184,108,34,34},{100,235,40,30}};
  for(int j=0;j<3;++j)for(int i=0;i<2;++i){int x=r[j].x+5+i*12+(f.animationStep%5),y=r[j].y+7+i*11;c.fillRect(x,y,2,2,i?cyan:orange);}
}
static const MenuPresentation presentation={draw,MenuArt::rgb(53,217,244),125,3,{{17,112,34,30},{184,108,34,34},{100,235,40,30}}};
}}
