#pragma once
#include "ArcadeCommon.h"
namespace MeteorSweep {
using namespace Arcade;
struct Rock{float x,y,vx,vy;int r,hp,kind;bool live;};struct Shot{float x,y;bool live;};
static Rock rocks[22];static Shot shots[18];static Phase phase;static bool armed,hot;static uint32_t seed,last,spawnAt,betweenUntil,invulnerable,dashUntil,dashReady,fireAt,lastHud;static int wave,budget,hull,score,best,heat;static float x,y,dx,dy;
inline void scene(){display.fillRect(0,28,240,258,0x0009);display.drawRect(2,30,236,254,ST77XX_CYAN);for(int i=0;i<38;i++){int sx=(i*73+17)%230+5,sy=(i*97+51)%246+34;display.drawPixel(sx,sy,i%3?0x4208:0x7bef);}display.fillRect(0,0,240,28,ST77XX_BLACK);display.fillRect(0,286,240,34,ST77XX_BLACK);label(4,295,"HEAT");label(155,295,"L FIRE R DASH");}
inline void hud(){display.fillRect(0,0,240,28,ST77XX_BLACK);label(4,5,"WAVE");number(37,5,wave);label(76,5,"S");number(89,5,score);label(165,5,"HULL");for(int i=0;i<3;i++)display.fillRect(204+i*11,5,8,11,i<hull?ST77XX_RED:0x3186);display.fillRect(37,292,106,10,0x2104);display.fillRect(38,293,heat,8,hot?ST77XX_RED:ST77XX_YELLOW);}
inline void rockDraw(const Rock &r){int X=(int)r.x,Y=(int)r.y,R=r.r;display.fillCircle(X,Y,R,r.kind==3?0xf800:(r.kind==2?0xfd20:0x9b47));display.drawCircle(X-2,Y-2,R/2,0x4208);}
inline void ship(){uint16_t c=millis()<invulnerable&&millis()/100%2?ST77XX_WHITE:ST77XX_CYAN;display.fillTriangle(x,y-10,x-9,y+7,x+9,y+7,c);display.fillRect(x-2,y+3,4,4,ST77XX_BLUE);}
inline void region(int X,int Y,int W,int H){X=clampi(X,3,237);Y=clampi(Y,31,283);W=clampi(W,0,238-X);H=clampi(H,0,284-Y);if(!W||!H)return;display.fillRect(X,Y,W,H,0x0009);for(int i=0;i<38;i++){int sx=(i*73+17)%230+5,sy=(i*97+51)%246+34;if(sx>=X&&sx<X+W&&sy>=Y&&sy<Y+H)display.drawPixel(sx,sy,i%3?0x4208:0x7bef);}for(auto &r:rocks)if(r.live&&hit(X,Y,W,H,r.x-r.r,r.y-r.r,2*r.r+1,2*r.r+1))rockDraw(r);for(auto &s:shots)if(s.live&&hit(X,Y,W,H,s.x-1,s.y-4,3,7))display.fillRect(s.x-1,s.y-4,3,7,ST77XX_YELLOW);if(hit(X,Y,W,H,x-10,y-11,21,20))ship();}
inline void begin(){phase=PLAY;seed=micros()|1;last=millis();x=120;y=233;dx=0;dy=-1;hull=3;score=0;heat=0;hot=false;wave=1;budget=9;spawnAt=last+650;invulnerable=last+800;dashUntil=dashReady=fireAt=0;for(auto &r:rocks)r.live=false;for(auto &s:shots)s.live=false;scene();hud();ship();}
inline void enter(){phase=TITLE;armed=false;panel("METEOR SWEEP","Survive and clear waves","L switch: sideways","R switch: vertical");label(17,167,"L fire / R dash");}
inline void finish(){phase=LOST;if(score>best)best=score;result("SHIP LOST",score,best,"WAVE",wave);}
inline bool addRock(float X,float Y,int kind,float vx,float vy){for(auto &r:rocks)if(!r.live){r={X,Y,vx,vy,kind==3?13:kind==2?11:kind==1?8:5,kind==3?3:1,kind,true};return true;}return false;}
inline void fire(){for(auto &s:shots)if(!s.live){s={x,y-12,true};heat=min(100,heat+12);if(heat>=100)hot=true;fireAt=millis()+105;region(x-3,y-16,7,8);return;}}
inline void tick(uint32_t now){float ox=x,oy=y;int a=left(),b=right();float mag=(a&&b)?0.7071f:1.f;x=clampi((int)(x+a*3.4f*mag),14,226);y=clampi((int)(y+b*3.4f*mag),45,268);if(a||b){dx=a*mag;dy=b*mag;}if(now<dashUntil){x=clampi((int)(x+dx*6),14,226);y=clampi((int)(y+dy*6),45,268);}if(ox!=x||oy!=y){region(ox-12,oy-12,25,24);region(x-12,y-12,25,24);}for(auto &s:shots)if(s.live){int sx=s.x,sy=s.y;s.y-=6;if(s.y<34)s.live=false;for(auto &r:rocks)if(s.live&&r.live&&fabsf(s.x-r.x)<r.r+2&&fabsf(s.y-r.y)<r.r+4){s.live=false;if(--r.hp<=0){int kind=r.kind;float X=r.x,Y=r.y;r.live=false;score+=kind==0?10:kind==1?20:35;if(kind==1||kind==2){int child=kind-1;addRock(X-5,Y,child,-1.6f,r.vy+0.2f);addRock(X+5,Y,child,1.6f,r.vy+0.2f);}}region(r.x-r.r-3,r.y-r.r-3,2*r.r+7,2*r.r+7);}region(sx-2,sy-5,5,13);if(s.live)region(s.x-2,s.y-5,5,9);}
for(auto &r:rocks)if(r.live){float ox=r.x,oy=r.y;r.x+=r.vx;r.y+=r.vy;if(r.y>296||r.x<-24||r.x>264)r.live=false;if(r.live&&now>=invulnerable&&now>=dashUntil&&fabsf(x-r.x)<r.r+7&&fabsf(y-r.y)<r.r+8){hull--;invulnerable=now+1200;if(!hull){finish();return;}}region(ox-r.r-2,oy-r.r-2,2*r.r+5,2*r.r+5);if(r.live)region(r.x-r.r-2,r.y-r.r-2,2*r.r+5,2*r.r+5);}
if(budget>0&&now>=spawnAt){int kind=wave%3==0&&budget==1?3:(rng(seed)%4==0?2:rng(seed)%3==0?1:0);int X=16+rng(seed)%208;float vx=((int)(rng(seed)%21)-10)/15.f;if(addRock(X,36,kind,vx,0.65f+wave*.09f)){budget--;spawnAt=now+max(300,800-wave*28);}}
if(!budget){bool any=false;for(auto &r:rocks)any|=r.live;if(!any){score+=wave*100;hull=min(3,hull+1);phase=BETWEEN;betweenUntil=now+1800;display.fillRect(24,130,192,48,ST77XX_BLACK);label(38,145,"WAVE CLEAR!",ST77XX_GREEN,2);}}if(heat>0)heat=max(0,heat-1);if(heat<50)hot=false;}
inline void update(const GameInput &in){if(phase==TITLE||phase==LOST){if(start(in,armed))begin();return;}uint32_t now=millis();if(phase==BETWEEN){if(now>=betweenUntil){wave++;budget=7+wave*2;spawnAt=now+500;phase=PLAY;scene();hud();ship();}return;}if(in.leftButton&&in.rightButton)return;if(in.rightButton && !hot && now >= fireAt) fire();
if(in.leftPressed && now >= dashReady) {
  dashUntil = now + 180;
  dashReady = now + 1700;
}if(step(last,now,25)){tick(now);if(step(lastHud,now,100))hud();}}
}
