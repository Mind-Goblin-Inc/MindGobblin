#pragma once
#include "../MenuArtPrimitives.h"
#include <math.h>
namespace MenuPosters { namespace HorizonBurn {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t bg=rgb(8,6,23),pink=rgb(255,60,165),cyan=rgb(39,217,242),gold=rgb(255,211,90);
  gradient(c,bg,rgb(62,19,65));
  for(int y=96;y<165;y+=9){int d=y-135;if(d*d<43*43){int w=(int)sqrt((double)(43*43-d*d));c.drawFastHLine(120-w,y,w*2,y<136?gold:pink);c.drawFastHLine(120-w,y+1,w*2,y<136?gold:pink);}}
  title(c,"HORIZON",22,3,cyan,pink,ANGULAR);title(c,"BURN",58,5,0xffff,pink,ANGULAR);
  c.drawFastHLine(0,165,240,pink);
  for(int x=-100;x<=340;x+=40)c.drawLine(120,165,x,279,rgb(113,39,111));
  for(int y=183;y<280;y+=13)c.drawFastHLine(0,y,240,rgb(113,39,111));
  for(int i=0;i<3;++i){int y=204+((f.animationStep*4+i*9)%28);c.drawFastHLine(14,y,212,cyan);}
  c.fillTriangle(67,177,73,185,61,185,pink);c.fillTriangle(174,180,181,189,167,189,cyan);
  ship(c,120,249,48,45,cyan,pink);c.drawFastHLine(109,265,22,gold);
}
static const MenuPresentation presentation={draw,MenuArt::rgb(39,217,242),125,1,{{12,202,216,30},{0,0,0,0},{0,0,0,0}}};
}}
