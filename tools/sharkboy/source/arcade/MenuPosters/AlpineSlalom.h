#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace AlpineSlalom {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t sky=rgb(169,218,239),navy=rgb(16,45,75),snow=rgb(239,248,249),blue=rgb(37,99,204),red=rgb(228,64,69);
  gradient(c,sky,snow);
  c.fillTriangle(-30,157,76,78,160,157,rgb(68,140,180));c.fillTriangle(65,159,153,72,250,159,navy);
  c.fillTriangle(118,109,153,72,184,109,snow);c.fillTriangle(0,279,240,126,240,279,snow);
  title(c,"ALPINE",20,3,navy,snow,BLOCK,16);title(c,"SLALOM",58,3,navy,snow,ANGULAR,46);
  c.drawLine(22,239,151,181,sky);c.drawLine(31,251,160,192,sky);
  c.drawFastVLine(48,176,70,red);c.fillTriangle(48,177,75,186,48,194,red);
  c.drawFastVLine(190,197,66,blue);c.fillTriangle(190,198,164,209,190,215,blue);
  // Empty, carved slalom course: no skier or other human figure on the poster.
  c.drawLine(153,163,123,181,sky);c.drawLine(123,181,148,199,sky);
  c.drawLine(148,199,111,223,blue);c.drawLine(111,223,79,240,blue);
  c.drawLine(160,166,130,184,sky);c.drawLine(130,184,155,202,sky);
  c.drawLine(155,202,118,226,blue);c.drawLine(118,226,86,243,blue);
  c.fillTriangle(83,238,103,231,96,246,snow);
  const MenuRect regions[3]={{14,111,48,40},{176,110,48,40},{169,228,48,36}};
  for(int j=0;j<3;++j)for(int i=0;i<2;++i){int x=regions[j].x+8+i*19+(f.animationStep+i)%4,y=regions[j].y+8+i*13+(f.animationStep+i*2)%5;c.fillCircle(x,y,2,snow);}
}
static const MenuPresentation presentation={draw,MenuArt::rgb(37,99,204),150,3,{{14,111,48,40},{176,110,48,40},{169,228,48,36}}};
}}
