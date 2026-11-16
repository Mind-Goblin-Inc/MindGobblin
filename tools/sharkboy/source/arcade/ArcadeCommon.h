#pragma once
#include "GameAPI.h"
#include "Hardware.h"
#include "MenuFooter.h"
#include <math.h>
namespace Arcade {
enum Phase { TITLE, PLAY, BETWEEN, LOST, WON };
inline int sw(int a,int b) { bool u=digitalRead(a)==LOW,d=digitalRead(b)==LOW; return u==d?0:(u?-1:1); }
inline int left(){return sw(LEFT_UP_PIN,LEFT_DOWN_PIN);} inline int right(){return sw(RIGHT_UP_PIN,RIGHT_DOWN_PIN);}
inline int clampi(int v,int a,int b){return v<a?a:(v>b?b:v);} 
inline bool hit(int x,int y,int w,int h,int X,int Y,int W,int H){return x<X+W&&x+w>X&&y<Y+H&&y+h>Y;}
inline uint32_t rng(uint32_t &s){s^=s<<13;s^=s>>17;s^=s<<5;return s;}
inline void label(int x,int y,const char *s,uint16_t color=ST77XX_WHITE,uint8_t size=1){display.setTextSize(size);display.setTextColor(color);display.setCursor(x,y);display.print(s);}
inline void number(int x,int y,long n,uint16_t c=ST77XX_WHITE,uint8_t size=1){display.setTextSize(size);display.setTextColor(c);display.setCursor(x,y);display.print(n);}
inline void panel(const char *title,const char *line1,const char *line2,const char *line3){display.fillScreen(ST77XX_BLACK);display.drawRect(8,12,224,296,ST77XX_CYAN);label(17,30,title,ST77XX_YELLOW,2);label(17,98,line1);label(17,120,line2);label(17,142,line3);label(17,248,"RIGHT BTN: START",ST77XX_GREEN);MenuFooter::draw(display);}
inline void result(const char *title,long score,long best,const char *metric,long value){display.fillScreen(ST77XX_BLACK);label(20,35,title,ST77XX_YELLOW,2);label(20,105,"SCORE");number(115,105,score);label(20,132,"BEST");number(115,132,best);label(20,160,metric);number(115,160,value);label(20,260,"RIGHT BTN: RESTART",ST77XX_GREEN);MenuFooter::draw(display);}
inline bool start(const GameInput &in,bool &armed){if(!in.rightButton)armed=true;if(in.rightPressed&&armed&&!in.leftButton){armed=false;return true;}return false;}
inline bool step(uint32_t &last,uint32_t now,uint16_t period){if(now-last<period)return false;last=now;return true;}
}
