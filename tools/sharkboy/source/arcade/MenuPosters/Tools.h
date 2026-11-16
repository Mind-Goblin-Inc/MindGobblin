#pragma once
#include "../MenuArtPrimitives.h"
namespace MenuPosters { namespace Tools {
inline void music(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t bg=rgb(30,18,57),cream=rgb(244,228,185),amber=rgb(232,173,72),cyan=rgb(78,211,216);
  gradient(c,bg,rgb(78,36,92));title(c,"MUSIC",20,4,cream,amber,SLAB);title(c,"PLAYER",61,3,amber,bg,SLAB);
  c.fillRoundRect(24,110,192,135,12,cream);c.fillRoundRect(29,116,182,122,8,bg);
  for(int x=45;x<=195;x+=130){c.fillCircle(x,174,23,amber);c.fillCircle(x,174,16,bg);for(int y=160;y<=188;y+=7)c.drawFastHLine(x-13,y,26,cream);}
  c.fillRect(74,133,92,50,cream);c.fillRect(79,139,82,39,bg);c.drawCircle(101,159,13,amber);c.drawCircle(139,159,13,amber);
  for(int i=0;i<5;++i){int h=7+((f.animationStep*7+i*11)%24);c.fillRect(74+i*20,223-h,12,h,i%2?amber:cyan);}
  for(int i=0;i<4;++i)c.fillRect(82+i*27,227,18,5,cream);
}
static const MenuPresentation musicPresentation={music,MenuArt::rgb(232,173,72),150,1,{{64,191,112,36},{0,0,0,0},{0,0,0,0}}};
inline void settings(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t bg=rgb(14,25,40),cream=rgb(224,229,208),mint=rgb(102,211,174),gray=rgb(95,112,119);
  gradient(c,bg,rgb(35,54,63));title(c,"SETTINGS",29,3,cream,mint,CLEAN);
  c.fillRoundRect(23,109,194,145,8,gray);c.fillRect(29,115,182,133,bg);
  for(int i=0;i<3;++i){int x=59+i*55;c.fillRect(x,133,5,83,gray);c.fillRoundRect(x-9,149+i*17,23,14,4,mint);c.drawFastVLine(x+2,138,73,cream);}
  c.fillCircle(180,171,18,cream);c.fillCircle(180,171,12,bg);c.drawLine(180,171,188,162,mint);
  for(int i=0;i<3;++i)c.fillRect(40+i*32,229,18,8,cream);
  c.fillCircle(172,211,4,(f.animationStep%2)?mint:gray);c.fillCircle(184,211,4,(f.animationStep%2)?gray:mint);
}
static const MenuPresentation settingsPresentation={settings,MenuArt::rgb(102,211,174),250,1,{{164,202,28,18},{0,0,0,0},{0,0,0,0}}};
inline void hardware(MenuCanvas &c,const MenuFrame &f){
  using namespace MenuArt;const uint16_t bg=rgb(8,22,18),green=rgb(75,202,126),cream=rgb(223,232,196),orange=rgb(230,143,68);
  c.fillScreen(bg);title(c,"HARDWARE",19,2,cream,green,ANGULAR);title(c,"TEST",52,4,green,bg,BLOCK);
  c.fillRoundRect(49,110,142,142,14,cream);c.fillRoundRect(56,117,128,128,9,rgb(27,68,50));
  c.fillRect(73,131,94,58,bg);c.drawRect(73,131,94,58,green);
  for(int i=0;i<3;++i)c.fillCircle(97+i*25,148,5,(f.animationStep%3)==(uint32_t)i?orange:green);
  c.fillRect(72,202,32,6,cream);c.fillRect(85,189,6,32,cream);
  c.fillCircle(142,208,9,orange);c.fillCircle(164,220,9,orange);
  bolt(c,60,122,green);bolt(c,180,122,green);bolt(c,60,239,green);bolt(c,180,239,green);
  c.drawLine(6,202,49,202,green);c.drawLine(191,175,235,175,green);
}
static const MenuPresentation hardwarePresentation={hardware,MenuArt::rgb(75,202,126),200,1,{{87,140,68,16},{0,0,0,0},{0,0,0,0}}};
inline const MenuPresentation *at(int i){switch(i){case 0:return &musicPresentation;case 1:return &settingsPresentation;default:return &hardwarePresentation;}}
}}
