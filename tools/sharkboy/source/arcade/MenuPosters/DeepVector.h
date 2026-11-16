#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace DeepVector {
inline void asteroid(MenuCanvas &c,int x,int y,int r,uint16_t col,int pose){
  int px[7],py[7];const int8_t vx[7]={-8,-3,5,9,7,-2,-9},vy[7]={-3,-9,-8,-1,7,9,4};
  for(int i=0;i<7;++i){int k=(i+pose)%7;px[i]=x+vx[k]*r/10;py[i]=y+vy[k]*r/10;}
  for(int i=0;i<7;++i)c.drawLine(px[i],py[i],px[(i+1)%7],py[(i+1)%7],col);
  c.drawLine(px[0],py[0],px[3],py[3],col);c.drawLine(px[2],py[2],px[5],py[5],col);
}
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t cyan=rgb(69,229,231),dim=rgb(24,88,105);
  c.fillScreen(rgb(4,14,26));stars(c,18,dim,55);
  title(c,"DEEP",21,4,cyan,dim,ANGULAR,20);title(c,"VECTOR",59,3,cyan,dim,ANGULAR,37);
  asteroid(c,111,126,12,dim,0);asteroid(c,44,206,28,rgb(100,223,117),0);asteroid(c,174,170,37,cyan,f.animationStep%7);
  for(int i=-2;i<=2;++i)c.drawLine(119,187,119+i*45,279,dim);
  c.drawCircle(119,187,12,cyan);c.drawFastHLine(99,187,40,dim);c.drawFastVLine(119,167,40,dim);
  c.fillTriangle(81,279,120,250,159,279,dim);c.drawLine(100,279,120,250,cyan);c.drawLine(120,250,140,279,cyan);
}
static const MenuPresentation presentation={draw,MenuArt::rgb(69,229,231),150,1,{{132,129,86,86},{0,0,0,0},{0,0,0,0}}};
}}
