#pragma once
#include "MenuPosters/Generic.h"
#include "MenuPosters/Tools.h"
#include "MenuCartridge.h"
#include <stdio.h>

// Included after the sketch's registry, input, display, and screen state.
void launch(int item);
namespace LauncherMenu {
using MenuMotion::Phase;
using MenuMotion::SceneSnapshot;
using MenuMotion::CartridgePose;
constexpr uint16_t SCROLL_MS=160,ALIGN_MS=90,DROP_MS=260,SEAT_MS=90,FRAME_INTERVAL_MS=33;
struct DebounceSwitch {SwitchState raw,stable;uint32_t since;};
struct DebounceButton {bool raw,stable;uint32_t since;};
struct State {
  Phase phase=Phase::Idle;
  int centerItem=0,targetItem=0,scrollFrom=0,scrollTo=0,scrollDirection=0,queuedSteps=0,launchItem=-1;
  bool launchPending=false,launchCommitted=false;
  uint32_t phaseStarted=0,idleStarted=0,lastArtStep=0,frozenArtStep=0,lastFrameAt=0;
  bool frameActive=false,frameFull=true;
  uint8_t frameStrip=0,frameStripCount=0;
  MenuRect frameDirty={0,0,240,280};
  SceneSnapshot snapshot;
  uint32_t frameId=0,completedFrameId=0;
  int footerItem=-1;bool footerInserting=false;
  DebounceSwitch left={SWITCH_CENTER,SWITCH_CENTER,0},right={SWITCH_CENTER,SWITCH_CENTER,0};
  DebounceButton leftButton={false,false,0},rightButton={false,false,0};
  bool switchesArmed=false,buttonsArmed=false;
  uint32_t centerSince=0,releaseSince=0,heldSince=0,lastRepeat=0;
  int heldDirection=0;
};
static State state;
static uint16_t stripPixels[240*8];
static MenuCanvas canvas,mappedCanvas;
inline bool validItem(int index){return index>=0&&index<menuCount();}
inline const MenuPresentation *resolve(int index){
  if(!validItem(index))return &MenuPosters::Generic::presentation;
  if(index<gameCount()){
    const GameModule *g=gameAt(index);
    return g&&g->menuPresentation&&g->menuPresentation->draw?g->menuPresentation:&MenuPosters::Generic::presentation;
  }
  return MenuPosters::Tools::at(index-gameCount());
}
inline void footer(){
  int item=state.launchPending?state.launchItem:state.targetItem;
  if(!validItem(item))return;
  if(state.footerItem==item&&state.footerInserting==state.launchPending)return;
  state.footerItem=item;state.footerInserting=state.launchPending;
  const uint16_t bg=MenuArt::rgb(8,12,20),fg=0xffff;
  const MenuPresentation *p=resolve(item);
  const uint16_t accent=p==&MenuPosters::Generic::presentation?MenuPosters::Generic::accent(menuLabel(item)):p->accent565;
  display.fillRect(0,280,240,40,bg);display.drawFastHLine(0,280,240,accent);
  display.fillTriangle(12,287,4,298,20,298,fg);display.fillTriangle(222,299,214,288,230,288,fg);
  char label[24];
  if(item<gameCount())snprintf(label,sizeof(label),"GAME %02d / %02d",item+1,gameCount());
  else snprintf(label,sizeof(label),"TOOL %d / 3",item-gameCount()+1);
  display.setFont(nullptr);display.setTextWrap(false);display.setTextSize(1);display.setTextColor(fg);
  display.setCursor((240-(int)strlen(label)*6)/2,287);display.print(label);
  display.setCursor(6,306);display.print("SWITCH: BROWSE");
  const char *action=state.launchPending?"INSERTING":item<gameCount()?"RIGHT: PLAY":"RIGHT: OPEN";
  display.setCursor(240-(int)strlen(action)*6-6,306);display.print(action);
}
inline void startScroll(int direction,uint32_t now){
  state.scrollFrom=state.centerItem;state.scrollTo=MenuMotion::wrapItem(state.centerItem+direction,menuCount());
  state.scrollDirection=direction;state.phase=Phase::Scroll;state.phaseStarted=now;
  state.frozenArtStep=state.lastArtStep;
}
inline void beginAlign(uint32_t now){state.phase=Phase::Align;state.phaseStarted=now;}
inline void beginDrop(uint32_t now){state.phase=Phase::Drop;state.phaseStarted=now;}
inline void beginSeat(uint32_t now){state.phase=Phase::Seat;state.phaseStarted=now;}
inline void cancel(){
  state.frameActive=false;state.phase=Phase::Idle;state.queuedSteps=0;
  state.launchPending=false;state.launchCommitted=false;state.launchItem=-1;
}
inline void moveAt(int steps,uint32_t now){
  if(currentScreen!=SCREEN_MENU||state.launchPending||steps==0)return;
  int count=menuCount();if(count<=1)return;
  int shift=steps%count;if(!shift)return;
  if(state.phase==Phase::Idle){
    int direction=shift>0?1:-1;
    startScroll(direction,now);state.queuedSteps=shift-direction;
  }else if(state.phase==Phase::Scroll){
    int q=state.queuedSteps+shift;
    if(q>count-1)q=count-1;
    if(q<1-count)q=1-count;
    state.queuedSteps=q;
  }else return;
  state.targetItem=MenuMotion::wrapItem(state.scrollTo+state.queuedSteps,count);
  selectedMenuItem=state.targetItem;footer();
}
inline void move(int steps){moveAt(steps,millis());}
inline void requestLaunchAt(uint32_t now){
  if(currentScreen!=SCREEN_MENU||state.launchPending||!validItem(state.targetItem))return;
  if(state.phase==Phase::Idle)state.frozenArtStep=state.lastArtStep;
  state.launchPending=true;state.launchItem=state.targetItem;footer();
  if(state.phase==Phase::Idle)beginAlign(now);
}
inline void requestLaunch(){requestLaunchAt(millis());}
inline void sample(DebounceSwitch &d,SwitchState value,uint32_t now){
  if(value!=d.raw){d.raw=value;d.since=now;}
  if(value!=d.stable&&(uint32_t)(now-d.since)>=18)d.stable=value;
}
inline bool sample(DebounceButton &d,bool value,uint32_t now){
  if(value!=d.raw){d.raw=value;d.since=now;}
  if(value!=d.stable&&(uint32_t)(now-d.since)>=15){d.stable=value;return value;}
  return false;
}
inline int effectiveDirection(){
  SwitchState a=state.left.stable,b=state.right.stable;
  if(a==SWITCH_ERROR||b==SWITCH_ERROR)return 0;
  if((a==SWITCH_UP&&b==SWITCH_DOWN)||(a==SWITCH_DOWN&&b==SWITCH_UP))return 0;
  if(a==SWITCH_UP||b==SWITCH_UP)return -1;
  if(a==SWITCH_DOWN||b==SWITCH_DOWN)return 1;
  return 0;
}
inline bool contains(const SceneSnapshot &s,int item){for(uint8_t i=0;i<s.count;++i)if(s.cards[i].item==item)return true;return false;}
inline void append(SceneSnapshot &s,int item,CartridgePose pose,uint32_t artStep){
  if(!validItem(item)||contains(s,item)||s.count>=4)return;
  s.cards[s.count++]={item,pose,artStep};
}
inline SceneSnapshot makeSnapshot(uint32_t now){
  SceneSnapshot s;s.phase=state.phase;
  uint16_t duration=state.phase==Phase::Scroll?SCROLL_MS:state.phase==Phase::Align?ALIGN_MS:
                    state.phase==Phase::Drop?DROP_MS:state.phase==Phase::Seat?SEAT_MS:0;
  s.progress=duration?MenuMotion::progressQ16(now,state.phaseStarted,duration):0;
  s.titleItem=state.launchPending?state.launchItem:state.phase==Phase::Scroll?state.scrollTo:state.centerItem;
  if(!validItem(s.titleItem))s.titleItem=state.centerItem;
  int count=menuCount();if(count<=0)return s;
  if(state.phase==Phase::Scroll){
    uint16_t eased=MenuMotion::easeOutCubicQ16(s.progress);
    int d=state.scrollDirection;
    if(count==2){
      int oldItem=state.scrollFrom,newItem=state.scrollTo;
      CartridgePose oldPose=MenuMotion::carouselPose(0,d,eased);
      CartridgePose newPose=MenuMotion::carouselPose(d,d,eased);
      if(s.progress<32768){append(s,newItem,newPose,0);append(s,oldItem,oldPose,state.frozenArtStep);}
      else{append(s,oldItem,oldPose,state.frozenArtStep);append(s,newItem,newPose,0);}
      return s;
    }
    // Draw distant objects first. The center pair comes last, with the arriving
    // cartridge on top in the second half of the movement.
    int slots[4]={d>0?-1:2,d>0?2:-1,d>0?0:1,d>0?1:0};
    if(s.progress<32768){slots[2]=d>0?1:0;slots[3]=d>0?0:1;}
    for(int k=0;k<4;++k){
      int slot=slots[k],item=MenuMotion::wrapItem(state.scrollFrom+slot,count);
      uint32_t step=slot==0?state.frozenArtStep:0;
      append(s,item,MenuMotion::carouselPose(slot,d,eased),step);
    }
  }else{
    int center=state.centerItem;
    CartridgePose left=MenuMotion::carouselPose(-1,1,0),right=MenuMotion::carouselPose(1,1,0);
    if(state.phase==Phase::Align||state.phase==Phase::Drop||state.phase==Phase::Seat){
      uint16_t e=MenuMotion::easeOutCubicQ16(s.progress);
      int shift=state.phase==Phase::Align?(24*e)/65535:24;
      left.x-=shift;right.x+=shift;
    }
    if(count>1){append(s,MenuMotion::wrapItem(center-1,count),left,0);
      append(s,MenuMotion::wrapItem(center+1,count),right,0);}
    CartridgePose middle={38,32,164,210};
    if(state.phase==Phase::Align){
      uint16_t p=s.progress;
      int lift=p<32768?(6*p)/32768:(6*(65535-p))/32767;
      middle.y-=lift;
    }else if(state.phase==Phase::Drop||state.phase==Phase::Seat){
      uint32_t p=state.phase==Phase::Seat?65535u:s.progress;
      middle.y+=(int32_t)(226ull*p*p/(65535ull*65535ull));
    }
    uint32_t step=state.phase==Phase::Idle?state.lastArtStep:state.frozenArtStep;
    append(s,center,middle,step);
  }
  return s;
}
inline void drawSelectedTitle(MenuCanvas &c,int item){
  if(!validItem(item)||c.clip().y>=29)return;
  const char *title=menuLabel(item);int n=(int)strlen(title);
  bool shortened=n>37;if(shortened)n=34;
  c.fillRect(0,0,240,29,MenuArt::rgb(10,16,28));
  c.setFont(nullptr);c.setTextWrap(false);c.setTextSize(1);c.setTextColor(0xffff);
  c.setCursor((240-(n+(shortened?3:0))*6)/2,10);
  for(int i=0;i<n;++i)c.print(title[i]);
  if(shortened)c.print("...");
}
inline void drawCartridgeLabel(MenuRect strip,const CartridgePose &p,int item,uint32_t step){
  MenuRect label=MenuCartridge::labelRect(p);
  if(!mappedCanvas.setMappedClip(strip,stripPixels,label))return;
  mappedCanvas.resetDrawingStyle();
  resolve(item)->draw(mappedCanvas,{menuLabel(item),step});
}
inline void drawCartridge(MenuRect strip,const MenuMotion::Drawable &d){
  MenuRect bounds={(int16_t)(d.pose.x-2),(int16_t)(d.pose.y-2),(int16_t)(d.pose.w+8),(int16_t)(d.pose.h+8)};
  if(!MenuMotion::intersect(bounds,strip).w)return;
  MenuCartridge::drawCartridgeShell(canvas,d.pose,MenuCartridge::colorForItem(d.item));
  drawCartridgeLabel(strip,d.pose,d.item,d.artStep);
  MenuRect r=MenuCartridge::labelRect(d.pose);
  canvas.drawRect(r.x-1,r.y-1,r.w+2,r.h+2,MenuArt::rgb(17,23,28));
}
inline void composeSceneStrip(MenuRect strip,const SceneSnapshot &snapshot){
  if(!canvas.setClip(strip,stripPixels))return;
  MenuRect r=canvas.clip();
  MenuCartridge::drawSceneBackground(canvas);
  MenuCartridge::drawSlotBack(canvas);
  for(uint8_t i=0;i<snapshot.count;++i)drawCartridge(r,snapshot.cards[i]);
  MenuCartridge::drawSlotFront(canvas,snapshot.phase==Phase::Seat&&snapshot.progress<65535);
  drawSelectedTitle(canvas,snapshot.titleItem);
  display.drawRGBBitmap(r.x,r.y,stripPixels,r.w,r.h);
}
inline void beginFrame(const SceneSnapshot &snapshot,MenuRect dirty={0,0,240,280}){
  if(state.frameActive)return;
  dirty=MenuMotion::intersect(dirty,{0,0,240,280});if(dirty.w<=0||dirty.h<=0)return;
  state.snapshot=snapshot;state.frameDirty=dirty;state.frameStrip=0;
  state.frameStripCount=(dirty.h+7)/8;state.frameActive=true;state.frameFull=dirty.x==0&&dirty.w==240&&dirty.y==0&&dirty.h==280;
  ++state.frameId;
}
inline void completeScroll(uint32_t now){
  state.centerItem=state.scrollTo;
  if(state.queuedSteps){int d=state.queuedSteps>0?1:-1;state.queuedSteps-=d;startScroll(d,now);}
  else if(state.launchPending){state.frozenArtStep=0;beginAlign(now);}
  else{state.phase=Phase::Idle;state.idleStarted=now;state.lastArtStep=0;state.targetItem=state.centerItem;selectedMenuItem=state.centerItem;}
}
inline void dispatchLaunch(){
  if(currentScreen!=SCREEN_MENU||!state.launchPending||state.launchCommitted||!validItem(state.launchItem))return;
  int item=state.launchItem;state.launchCommitted=true;cancel();launch(item);
}
inline void advanceAfterPresentedFrame(uint32_t now){
  SceneSnapshot s=state.snapshot;
  if(state.phase!=s.phase||s.progress<65535)return;
  if(s.phase==Phase::Scroll)completeScroll(now);
  else if(s.phase==Phase::Align)beginDrop(now);
  else if(s.phase==Phase::Drop)beginSeat(now);
  else if(s.phase==Phase::Seat){state.phase=Phase::Dispatch;dispatchLaunch();}
}
inline void renderSlice(uint32_t now){
  if(!state.frameActive)return;
  uint32_t start=millis();
  for(int batch=0;batch<4&&state.frameActive;++batch){
    int y=state.frameDirty.y+state.frameStrip*8;
    int remaining=state.frameDirty.y+state.frameDirty.h-y;
    composeSceneStrip({state.frameDirty.x,(int16_t)y,state.frameDirty.w,(int16_t)(remaining<8?remaining:8)},state.snapshot);
    if(++state.frameStrip>=state.frameStripCount){
      state.frameActive=false;state.completedFrameId=state.frameId;
      advanceAfterPresentedFrame(now);
    }
    if((uint32_t)(millis()-start)>=5)break;
  }
}
// Transform the union of the declared source repair regions using exactly
// the label sampler's boundary rule. One rectangle keeps strip state bounded.
inline MenuRect idleDirty(const MenuPresentation &p){
  MenuRect label=MenuCartridge::labelRect({38,32,164,210});
  int x0=240,y0=280,x1=0,y1=0;
  for(uint8_t i=0;i<p.animationRegionCount&&i<3;++i){
    MenuRect r=MenuMotion::intersect(p.animationRegions[i],{0,0,240,280});
    if(r.w<=0||r.h<=0)continue;
    if(r.x<x0)x0=r.x;if(r.y<y0)y0=r.y;
    if(r.x+r.w>x1)x1=r.x+r.w;if(r.y+r.h>y1)y1=r.y+r.h;
  }
  if(x1<=x0||y1<=y0)return label;
  int dx0=(x0*label.w+239)/240,dy0=(y0*label.h+279)/280;
  int dx1=(x1*label.w+239)/240,dy1=(y1*label.h+279)/280;
  return {(int16_t)(label.x+dx0),(int16_t)(label.y+dy0),(int16_t)(dx1-dx0),(int16_t)(dy1-dy0)};
}
inline void scheduleNextFrame(uint32_t now){
  if(state.frameActive||currentScreen!=SCREEN_MENU)return;
  if(state.phase==Phase::Idle){
    const MenuPresentation *p=resolve(state.centerItem);
    if(p->frameIntervalMs&&p->animationRegionCount){
      uint32_t step=(uint32_t)(now-state.idleStarted)/p->frameIntervalMs;
      if(step!=state.lastArtStep){
        state.lastArtStep=step;
        beginFrame(makeSnapshot(now),idleDirty(*p));
        state.lastFrameAt=now;
      }
    }
  }else if(state.phase!=Phase::Dispatch&&(uint32_t)(now-state.lastFrameAt)>=FRAME_INTERVAL_MS){
    beginFrame(makeSnapshot(now));
    state.lastFrameAt=now; // Start-to-start cadence includes composition and SPI time.
  }
}
inline void enter(){
  uint32_t now=millis();int count=menuCount();if(count<=0)return;
  if(!validItem(selectedMenuItem))selectedMenuItem=0;
  state=State();state.centerItem=state.targetItem=selectedMenuItem;
  state.idleStarted=state.phaseStarted=now;state.lastFrameAt=now;
  state.left={leftSwitch,leftSwitch,now};state.right={rightSwitch,rightSwitch,now};
  state.leftButton={leftButton,leftButton,now};state.rightButton={rightButton,rightButton,now};
  state.centerSince=state.releaseSince=now;
  display.setRotation(0);display.setFont(nullptr);display.setTextWrap(false);display.setTextSize(1);display.setTextColor(0xffff);
  footer();beginFrame(makeSnapshot(now));
}
inline void updateAt(uint32_t now){
  sample(state.left,leftSwitch,now);sample(state.right,rightSwitch,now);
  bool rightPress=sample(state.rightButton,rightButton,now);
  sample(state.leftButton,leftButton,now);
  if(!state.switchesArmed){
    if(state.left.stable==SWITCH_CENTER&&state.right.stable==SWITCH_CENTER){
      if((uint32_t)(now-state.centerSince)>=30)state.switchesArmed=true;
    }else state.centerSince=now;
  }
  if(!state.buttonsArmed){
    if(!state.leftButton.stable&&!state.rightButton.stable){
      if((uint32_t)(now-state.releaseSince)>=30)state.buttonsArmed=true;
    }else state.releaseSince=now;
    rightPress=false;
  }
  int dir=state.switchesArmed?effectiveDirection():0;
  if(dir!=state.heldDirection){
    state.heldDirection=dir;state.heldSince=now;state.lastRepeat=now;
    if(dir)moveAt(dir,now);
  }else if(dir&&(uint32_t)(now-state.heldSince)>=400&&(uint32_t)(now-state.lastRepeat)>=140){
    state.lastRepeat=now;moveAt(dir,now);
  }
  if(rightPress&&state.buttonsArmed&&!state.leftButton.stable&&!leftButton)requestLaunchAt(now);
  if(currentScreen==SCREEN_MENU){renderSlice(now);scheduleNextFrame(now);}
}
inline void update(){updateAt(millis());}
}
inline void requestMenuMove(int steps){LauncherMenu::move(steps);}
inline void requestMenuLaunch(){LauncherMenu::requestLaunch();}
