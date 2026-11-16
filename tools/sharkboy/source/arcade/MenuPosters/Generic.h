#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace Generic {
inline uint16_t accent(const char *title){
  uint32_t h=2166136261u;for(const char *p=title?title:"GAME";*p;++p)h=(h^(uint8_t)*p)*16777619u;
  static const uint16_t colors[4]={MenuArt::rgb(91,183,192),MenuArt::rgb(221,165,95),MenuArt::rgb(170,155,220),MenuArt::rgb(151,203,142)};
  return colors[h&3];
}
inline void draw(MenuCanvas &c,const MenuFrame &f){
  MenuArt::gradient(c,MenuArt::rgb(14,24,43),MenuArt::rgb(40,55,67));
  const uint16_t edge=accent(f.registryTitle);
  c.drawRect(18,101,204,146,edge);
  c.drawRect(25,108,190,132,edge);
  c.fillTriangle(120,126,49,214,191,214,MenuArt::rgb(29,91,113));
  c.fillCircle(120,173,28,edge);
  c.fillCircle(120,173,19,MenuArt::rgb(14,24,43));
  c.setTextSize(1);c.setTextColor(MenuArt::rgb(227,225,193));c.setCursor(92,117);c.print("JAKEBOY");
  const char *s=f.registryTitle?f.registryTitle:"GAME";
  char line[40];size_t n=strlen(s);if(n>39)n=39;
  if(n<=18){memcpy(line,s,n);line[n]=0;int scale=n>12?1:n>7?2:3;MenuArt::title(c,line,30,scale,0xffff,0x0000,MenuArt::SLAB);}
  else {
    size_t split=n/2;while(split>0&&s[split]!=' ')--split;
    if(split==0)split=n/2;
    memcpy(line,s,split);line[split]=0;MenuArt::title(c,line,21,split>18?1:2,0xffff,0x0000,MenuArt::SLAB);
    size_t start=split+(s[split]==' ');size_t len=n-start;if(len>39)len=39;
    memcpy(line,s+start,len);line[len]=0;MenuArt::title(c,line,55,len>18?1:2,0xffff,0x0000,MenuArt::SLAB);
  }
}
static const MenuPresentation presentation={draw,MenuArt::rgb(91,183,192),0,0,{{0,0,0,0},{0,0,0,0},{0,0,0,0}}};
}}
