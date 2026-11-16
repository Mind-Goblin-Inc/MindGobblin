#pragma once
#include "MenuCanvas.h"
#include <string.h>
namespace MenuArt {
constexpr uint16_t rgb(uint8_t r,uint8_t g,uint8_t b){return ((r&248)<<8)|((g&252)<<3)|(b>>3);}
inline uint16_t mix(uint16_t a,uint16_t b,uint8_t t){
  uint16_t ar=(a>>11)&31,ag=(a>>5)&63,ab=a&31,br=(b>>11)&31,bg=(b>>5)&63,bb=b&31;
  return (((ar*(255-t)+br*t)/255)<<11)|(((ag*(255-t)+bg*t)/255)<<5)|((ab*(255-t)+bb*t)/255);
}
inline void gradient(MenuCanvas &c,uint16_t top,uint16_t bottom){
  MenuRect r=c.clip();
  for(int y=r.y;y<r.y+r.h;++y)c.drawFastHLine(0,y,240,mix(top,bottom,(uint8_t)(y*255/279)));
}
inline uint32_t hash(uint32_t x){x^=x>>16;x*=0x7feb352dU;x^=x>>15;x*=0x846ca68bU;return x^(x>>16);}
inline void stars(MenuCanvas &c,int n,uint16_t color,uint32_t seed=1){
  MenuRect r=c.clip();
  for(int i=0;i<n;++i){uint32_t h=hash(i+seed);int x=8+h%224,y=103+(h>>10)%166;
    if(x>=r.x-2&&x<r.x+r.w+2&&y>=r.y-2&&y<r.y+r.h+2)c.fillRect(x,y,(h&8)?2:1,(h&8)?2:1,color);
  }
}
enum TitleStyle { BLOCK, ANGULAR, STENCIL, SLAB, CLEAN };
inline int textWidth(const char *s,int scale){return (int)strlen(s)*6*scale;}
inline void title(MenuCanvas &c,const char *s,int y,int scale,uint16_t face,uint16_t shadow,TitleStyle style=BLOCK,int x=-1){
  // Include shadows and style decorations in the rejection bounds.
  MenuRect clip=c.clip();
  if(y+8*scale+3<=clip.y||y-3>=clip.y+clip.h)return;
  if(x<0)x=(240-textWidth(s,scale))/2;
  c.setTextWrap(false);c.setTextSize(scale);
  c.setTextColor(shadow);c.setCursor(x+2,y+2);c.print(s);
  c.setTextColor(face);c.setCursor(x,y);c.print(s);
  if(style==SLAB){c.drawFastHLine(x-3,y-3,textWidth(s,scale)+6,face);c.drawFastHLine(x-3,y+8*scale+1,textWidth(s,scale)+6,face);}
  if(style==ANGULAR)c.drawFastHLine(x,y+8*scale+2,textWidth(s,scale),face);
  if(style==STENCIL){for(int i=0;i<(int)strlen(s);++i)c.drawFastHLine(x+i*6*scale+1,y+5*scale,scale,shadow);}
}
inline int wave(uint32_t step,int period,int amplitude){int p=step%period;return p<period/2?(p*2*amplitude/period):((period-p)*2*amplitude/period);}
inline void fish(MenuCanvas &c,int x,int y,int w,int h,uint16_t color){
  c.fillTriangle(x-w/2,y,x+w/3,y-h/2,x+w/3,y+h/2,color);
  c.fillTriangle(x+w/3,y,x+w/2,y-h/2,x+w/2,y+h/2,color);
  c.drawPixel(x-w/4,y-1,0xffff);
}
inline void bolt(MenuCanvas &c,int x,int y,uint16_t color){c.fillCircle(x,y,3,color);c.drawFastHLine(x-2,y,5,0x2945);}
inline void ship(MenuCanvas &c,int x,int y,int w,int h,uint16_t body,uint16_t glass){
  c.fillTriangle(x,y-h/2,x-w/2,y+h/2,x+w/2,y+h/2,body);
  c.fillTriangle(x,y-h/3,x-5,y+5,x+5,y+5,glass);
  c.fillRect(x-w/3,y+h/3,w*2/3,5,body);
}
inline void rock(MenuCanvas &c,int x,int y,int r,uint16_t color,uint16_t edge){
  c.fillTriangle(x-r,y-r/2,x+r/2,y-r,x+r,y+r/2,color);
  c.fillTriangle(x-r,y-r/2,x+r,y+r/2,x-r/2,y+r,color);
  c.drawLine(x-r,y-r/2,x+r/2,y-r,edge);c.drawLine(x+r/2,y-r,x+r,y+r/2,edge);
  c.drawCircle(x+r/4,y,r/5,edge);
}
}
