#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace Fishing {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t cream=rgb(231,225,193),teal=rgb(22,74,86),sea=rgb(40,120,144),foam=rgb(155,212,201),rust=rgb(161,74,50);
  c.fillScreen(cream);c.fillRect(0,151,240,129,sea);for(int y=160;y<280;y+=19)c.drawFastHLine(0,y,240,teal);
  title(c,"FISHING",28,3,teal,rust,SLAB);
  c.fillTriangle(27,145,211,143,187,172,rust);c.fillTriangle(27,145,187,172,47,170,teal);
  c.fillRect(82,115,70,27,cream);c.drawRect(82,115,70,27,teal);c.fillRect(90,121,18,11,sea);c.fillRect(119,121,18,11,sea);
  c.drawLine(146,116,146,83,teal);c.drawLine(146,87,193,128,teal);c.drawLine(152,133,202,172,teal);
  for(int i=0;i<4;++i)c.drawLine(156+i*10,142,181+i*4,169,foam);
  fish(c,73,218,64,30,teal);
  c.fillRoundRect(144,233,46,15,7,cream);c.fillTriangle(187,240,207,229,207,252,cream);c.drawPixel(152,237,teal);
  const MenuRect r[3]={{14,169,64,20},{88,183,64,20},{164,167,62,20}};
  for(int j=0;j<3;++j)for(int i=0;i<3;++i){int x=r[j].x+5+((f.animationStep*3+i*17)%(r[j].w-12));c.drawFastHLine(x,r[j].y+6+i*3,9,foam);}
}
static const MenuPresentation presentation={draw,MenuArt::rgb(155,212,201),150,3,{{14,169,64,20},{88,183,64,20},{164,167,62,20}}};
}}
