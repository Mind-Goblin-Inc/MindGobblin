#pragma once
#include <stdint.h>
#include "MenuPresentation.h"
namespace MenuMotion {
struct CartridgePose {int16_t x,y,w,h;};
enum class Phase:uint8_t {Idle,Scroll,Align,Drop,Seat,Dispatch};
struct Drawable {int item;CartridgePose pose;uint32_t artStep;};
struct SceneSnapshot {
  Phase phase=Phase::Idle;
  uint16_t progress=0;
  int titleItem=0;
  uint8_t count=0;
  Drawable cards[4];
};
inline int wrapItem(int value,int count){if(count<=0)return -1;int r=value%count;return r<0?r+count:r;}
inline uint16_t progressQ16(uint32_t now,uint32_t started,uint16_t duration){
  if(!duration)return 65535;
  uint32_t elapsed=now-started;if(elapsed>=duration)return 65535;
  return (uint16_t)((uint64_t)elapsed*65535/duration);
}
inline uint16_t easeOutCubicQ16(uint16_t p){
  uint64_t q=65535u-p;
  return (uint16_t)(65535u-(q*q*q)/(65535ull*65535ull));
}
inline CartridgePose carouselPose(int slot,int direction,uint16_t eased){
  // Q16 slot coordinate, selected at zero. The left/right previews are 78% size.
  int32_t position=(int32_t)slot*65535-(int32_t)direction*eased;
  int32_t distance=position<0?-position:position;
  if(distance>65535)distance=65535;
  int32_t width=164-(36*distance+32767)/65535;
  int32_t height=210-(46*distance+32767)/65535;
  int32_t center=120+(int32_t)((int64_t)158*position/65535);
  return {(int16_t)(center-width/2),(int16_t)(242-height),(int16_t)width,(int16_t)height};
}
inline MenuRect intersect(MenuRect a,MenuRect b){
  int32_t x=a.x>b.x?a.x:b.x,y=a.y>b.y?a.y:b.y;
  int32_t right=(int32_t)a.x+a.w<(int32_t)b.x+b.w?(int32_t)a.x+a.w:(int32_t)b.x+b.w;
  int32_t bottom=(int32_t)a.y+a.h<(int32_t)b.y+b.h?(int32_t)a.y+a.h:(int32_t)b.y+b.h;
  if(right<=x||bottom<=y)return {0,0,0,0};
  return {(int16_t)x,(int16_t)y,(int16_t)(right-x),(int16_t)(bottom-y)};
}
}
