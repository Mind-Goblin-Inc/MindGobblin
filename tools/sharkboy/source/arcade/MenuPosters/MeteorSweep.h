#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace MeteorSweep {
inline void draw(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t bg=rgb(4,9,30),cyan=rgb(51,211,235),orange=rgb(244,143,50),rockc=rgb(136,95,69);
  c.fillScreen(bg);for(int i=0;i<15;++i){int x=hash(i+34)%240,y=hash(i+95)%280;c.drawLine(x,y,x-8,y+12,rgb(30,48,75));}
  title(c,"METEOR",22,3,0xffff,orange,BLOCK);title(c,"SWEEP",60,3,orange,rgb(226,65,49),BLOCK);
  rock(c,123,143,26,rockc,orange);rock(c,69,206,18,rockc,rgb(255,220,106));
  int x1=32+wave(f.animationStep,18,39),y1=134+wave(f.animationStep,18,36);
  int x2=164+wave(f.animationStep+8,18,37),y2=177+wave(f.animationStep+8,18,36);
  rock(c,x1,y1,10,rockc,orange);rock(c,x2,y2,9,rockc,orange);
  c.drawLine(x1-12,y1-13,x1-5,y1-5,orange);c.drawLine(x2+11,y2-12,x2+5,y2-4,orange);
  ship(c,120,244,57,57,cyan,0xffff);c.drawFastVLine(108,188,24,orange);c.drawFastVLine(134,207,18,orange);
}
static const MenuPresentation presentation={draw,MenuArt::rgb(244,143,50),125,2,{{20,119,65,75},{151,158,66,78},{0,0,0,0}}};
}}
