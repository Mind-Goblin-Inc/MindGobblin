#pragma once
#include "MenuMotion.h"
#include "MenuArtPrimitives.h"
#include "GameAPI.h"
namespace MenuCartridge {
using MenuMotion::CartridgePose;
enum class ShellColorId:uint8_t {Gray,DarkGray,Black,Blue,Burgundy,Gold,Count};
struct ShellPalette {uint16_t face,highlight,shadow,groove;uint8_t weight;};
static const ShellPalette palettes[] = {
  {MenuArt::rgb(166,168,164),MenuArt::rgb(211,213,207),MenuArt::rgb(92,96,96),MenuArt::rgb(117,120,119),60},
  {MenuArt::rgb(103,108,110),MenuArt::rgb(153,160,161),MenuArt::rgb(51,57,60),MenuArt::rgb(73,79,82),15},
  {MenuArt::rgb(45,49,55),MenuArt::rgb(98,104,109),MenuArt::rgb(21,24,29),MenuArt::rgb(32,36,41),12},
  {MenuArt::rgb(66,91,126),MenuArt::rgb(121,148,181),MenuArt::rgb(34,51,78),MenuArt::rgb(48,68,96),5},
  {MenuArt::rgb(122,58,66),MenuArt::rgb(172,101,106),MenuArt::rgb(69,32,41),MenuArt::rgb(96,45,53),3},
  {MenuArt::rgb(194,157,66),MenuArt::rgb(238,208,125),MenuArt::rgb(113,87,35),MenuArt::rgb(155,122,49),5}
};
struct SessionAppearance {bool initialized=false;uint8_t assignedGameCount=0;ShellColorId gameColors[MAX_GAMES]={};};
static SessionAppearance session;
inline ShellColorId colorForRoll(uint8_t roll){
  if(roll<60)return ShellColorId::Gray;
  if(roll<75)return ShellColorId::DarkGray;
  if(roll<87)return ShellColorId::Black;
  if(roll<92)return ShellColorId::Blue;
  if(roll<95)return ShellColorId::Burgundy;
  return ShellColorId::Gold;
}
inline uint32_t nextAppearanceRandom(uint32_t &rng){
  if(!rng)rng=0x9e3779b9u;
  rng^=rng<<13;rng^=rng>>17;rng^=rng<<5;return rng;
}
inline uint8_t nextColorRoll(uint32_t &rng){
  uint32_t value;
  do{value=nextAppearanceRandom(rng);}while(value>=4294967200u);
  return (uint8_t)(value%100);
}
inline void beginSession(uint32_t seed){
  session.assignedGameCount=gameCount();
  if(session.assignedGameCount>MAX_GAMES)session.assignedGameCount=MAX_GAMES;
  for(uint8_t i=0;i<session.assignedGameCount;++i)session.gameColors[i]=colorForRoll(nextColorRoll(seed));
  session.initialized=true;
}
inline ShellColorId colorForItem(int item){
  if(session.initialized&&item>=0&&item<session.assignedGameCount)return session.gameColors[item];
  return ShellColorId::Gray;
}
inline MenuRect localRect(const CartridgePose &p,MenuRect local){
  int32_t x0=p.x+(int32_t)local.x*p.w/164,y0=p.y+(int32_t)local.y*p.h/210;
  int32_t x1=p.x+((int32_t)local.x+local.w)*p.w/164,y1=p.y+((int32_t)local.y+local.h)*p.h/210;
  return {(int16_t)x0,(int16_t)y0,(int16_t)(x1-x0),(int16_t)(y1-y0)};
}
inline MenuRect labelRect(const CartridgePose &p){return localRect(p,{8,10,148,173});}
inline void fillLocal(MenuCanvas &c,const CartridgePose &p,MenuRect r,uint16_t color){r=localRect(p,r);c.fillRect(r.x,r.y,r.w,r.h,color);}
inline void drawCartridgeShell(MenuCanvas &c,const CartridgePose &p,ShellColorId id){
  const ShellPalette &s=palettes[(uint8_t)id];
  c.fillRect(p.x+3,p.y+4,p.w,p.h,MenuArt::rgb(4,7,13));
  c.fillRoundRect(p.x,p.y,p.w,p.h,5,s.shadow);
  fillLocal(c,p,{2,2,160,193},s.face);
  fillLocal(c,p,{4,3,156,3},s.highlight);
  fillLocal(c,p,{4,7,3,178},s.highlight);
  fillLocal(c,p,{157,7,3,178},s.groove);
  fillLocal(c,p,{7,184,150,5},s.groove);
  for(int i=0;i<5;++i){
    fillLocal(c,p,{8,(int16_t)(189+i*3),26,1},s.highlight);
    fillLocal(c,p,{130,(int16_t)(189+i*3),26,1},s.highlight);
  }
  fillLocal(c,p,{26,191,112,15},MenuArt::rgb(23,29,36));
  fillLocal(c,p,{30,194,104,9},MenuArt::rgb(194,159,85));
  fillLocal(c,p,{30,201,104,3},MenuArt::rgb(73,62,44));
}
inline void drawSceneBackground(MenuCanvas &c){c.fillScreen(MenuArt::rgb(10,16,28));}
inline void drawSlotBack(MenuCanvas &c){
  c.fillRect(0,244,240,36,MenuArt::rgb(33,41,51));
  c.fillRect(30,248,180,9,MenuArt::rgb(4,8,13));
  c.drawFastHLine(31,247,178,MenuArt::rgb(109,119,129));
}
inline void drawSlotFront(MenuCanvas &c,bool seat){
  c.fillRect(0,256,240,24,MenuArt::rgb(58,66,75));
  c.drawFastHLine(0,256,240,MenuArt::rgb(139,148,153));
  c.fillRect(33,260,174,3,MenuArt::rgb(37,43,50));
  c.drawFastHLine(0,278,240,MenuArt::rgb(22,29,38));
  if(seat)c.fillRect(114,267,12,3,MenuArt::rgb(206,186,91));
}
}
