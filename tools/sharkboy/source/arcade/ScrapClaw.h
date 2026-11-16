#pragma once

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <new>
#include "GameAPI.h"
#include "MenuFooter.h"
#include "Hardware.h"

#ifndef SCRAPCLAW_AUDIO_HOOKS
#define SCRAPCLAW_AUDIO_HOOKS 0
#endif

namespace ScrapClaw {

// -----------------------------------------------------------------------------
// Build / tuning constants
// -----------------------------------------------------------------------------
static constexpr const char *BUILD_ID = "SC-2026.09.27-r1";
static constexpr int SCREEN_W = 240;
static constexpr int SCREEN_H = 320;
static constexpr int HUD_H = 36;
static constexpr int STRIP_H = 16;
static constexpr int STRIP_COUNT = (SCREEN_H + STRIP_H - 1) / STRIP_H;
static constexpr float PX_PER_UNIT = 20.0f;
static constexpr float WORLD_X0 = 0.0f;
static constexpr float WORLD_Y0_PX = 40.0f;
static constexpr float WORLD_W = 12.0f;
static constexpr float WORLD_FLOOR_Y = 13.55f;
static constexpr float PHYS_DT = 1.0f / 60.0f;
static constexpr float SUB_DT = 1.0f / 120.0f;
static constexpr uint32_t PHYS_US = 16667;
static constexpr uint32_t RENDER_MS = 33;
static constexpr int MAX_CATCHUP = 3;
static constexpr int VELOCITY_ITERS = 8;
static constexpr int POSITION_ITERS = 3;

static constexpr int MAX_BODIES = 24;
static constexpr int MAX_FIXTURES = 48;
static constexpr int MAX_CONTACTS = 128;
static constexpr int MAX_SCRAP = 16;
static constexpr int MAX_REMOVE = 16;

static constexpr float JAW_SHANK_W = 0.16f;
static constexpr float JAW_SHANK_H = 0.86f;
static constexpr float JAW_TOE_W = 0.36f;
static constexpr float JAW_TOE_H = 0.16f;
static constexpr float JAW_TOE_X = 0.12f;
static constexpr float JAW_TOE_Y = 0.40f;
static constexpr float JAW_PIVOT_Y = -0.43f;
static constexpr float JAW_A1 = JAW_SHANK_W * JAW_SHANK_H;
static constexpr float JAW_A2 = JAW_TOE_W * JAW_TOE_H;
static constexpr float JAW_COM_X_ABS = (JAW_A2 * JAW_TOE_X) / (JAW_A1 + JAW_A2);
static constexpr float JAW_COM_Y = (JAW_A2 * JAW_TOE_Y) / (JAW_A1 + JAW_A2);

static constexpr float GRAVITY = 9.0f;
static constexpr float CONTACT_SLOP = 0.01f;
static constexpr float MAX_POSITION_CORR = 0.04f;
static constexpr float RESTITUTION_SPEED = 1.25f;

static constexpr float BIN_X0 = 0.75f;
static constexpr float BIN_X1 = 3.75f;
static constexpr float BIN_RIM_Y = 8.70f;
static constexpr float BIN_BOTTOM_Y = 10.70f;

static constexpr uint16_t COL_BG       = 0x0883;
static constexpr uint16_t COL_PANEL    = 0x1127;
static constexpr uint16_t COL_STEEL    = 0x84B4;
static constexpr uint16_t COL_SHADOW   = 0x3A8A;
static constexpr uint16_t COL_RUST     = 0xC347;
static constexpr uint16_t COL_YELLOW   = 0xF629;
static constexpr uint16_t COL_CYAN     = 0x5F1D;
static constexpr uint16_t COL_GREEN    = 0x7ECF;
static constexpr uint16_t COL_CORAL    = 0xEB6C;
static constexpr uint16_t COL_PURPLE   = 0x9BB8;
static constexpr uint16_t COL_TEXT     = 0xEF7D;
static constexpr uint16_t COL_BLACK    = 0x0000;
static constexpr uint16_t COL_WHITE    = 0xFFFF;

static inline float fclamp(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }
static inline float fsq(float v) { return v * v; }
static inline float absf(float v) { return v < 0.0f ? -v : v; }
static inline float signf(float v) { return v < 0.0f ? -1.0f : 1.0f; }

// -----------------------------------------------------------------------------
// Math
// -----------------------------------------------------------------------------
struct Vec2 {
  float x, y;
  Vec2() : x(0), y(0) {}
  Vec2(float X, float Y) : x(X), y(Y) {}
  Vec2 operator+(const Vec2 &o) const { return Vec2(x + o.x, y + o.y); }
  Vec2 operator-(const Vec2 &o) const { return Vec2(x - o.x, y - o.y); }
  Vec2 operator*(float s) const { return Vec2(x * s, y * s); }
  Vec2 operator/(float s) const { return Vec2(x / s, y / s); }
  Vec2 &operator+=(const Vec2 &o) { x += o.x; y += o.y; return *this; }
  Vec2 &operator-=(const Vec2 &o) { x -= o.x; y -= o.y; return *this; }
  Vec2 &operator*=(float s) { x *= s; y *= s; return *this; }
};
static inline Vec2 operator*(float s, const Vec2 &v) { return Vec2(v.x * s, v.y * s); }
static inline float dot(const Vec2 &a, const Vec2 &b) { return a.x*b.x + a.y*b.y; }
static inline float cross(const Vec2 &a, const Vec2 &b) { return a.x*b.y - a.y*b.x; }
static inline Vec2 cross(float w, const Vec2 &r) { return Vec2(-w*r.y, w*r.x); }
static inline Vec2 perp(const Vec2 &v) { return Vec2(-v.y, v.x); }
static inline float len2(const Vec2 &v) { return dot(v,v); }
static inline float len(const Vec2 &v) { return sqrtf(len2(v)); }
static inline Vec2 normalized(const Vec2 &v) { float l = len(v); return l > 1e-6f ? v/l : Vec2(1,0); }
static inline Vec2 rotate(const Vec2 &v, float a) { float c=cosf(a), s=sinf(a); return Vec2(c*v.x-s*v.y, s*v.x+c*v.y); }
static inline Vec2 rotateCS(const Vec2 &v, float c, float s) { return Vec2(c*v.x-s*v.y, s*v.x+c*v.y); }

struct AABB { float minx,miny,maxx,maxy; };
static inline bool aabbOverlap(const AABB&a,const AABB&b) {
  return !(a.maxx < b.minx || b.maxx < a.minx || a.maxy < b.miny || b.maxy < a.miny);
}

struct IRect { int16_t x0,y0,x1,y1; };
static inline IRect rectInvalid(){ return {32767,32767,-32768,-32768}; }
static inline bool rectValid(const IRect&r){ return r.x0<=r.x1 && r.y0<=r.y1; }
static inline IRect rectUnion(IRect a, IRect b){
  if(!rectValid(a)) return b;
  if(!rectValid(b)) return a;
  IRect r; r.x0=min(a.x0,b.x0); r.y0=min(a.y0,b.y0); r.x1=max(a.x1,b.x1); r.y1=max(a.y1,b.y1); return r;
}

// -----------------------------------------------------------------------------
// Catalog and physics storage
// -----------------------------------------------------------------------------
enum BodyKind : uint8_t { BODY_STATIC, BODY_SCRAP, BODY_HOUSING, BODY_JAW };
enum HealthState : uint8_t { HEALTH_INTACT, HEALTH_DAMAGED, HEALTH_DESTROYED };
enum Phase : uint8_t { PHASE_PREPARING, PHASE_READY, PHASE_PLAYING, PHASE_RESULTS, PHASE_UNAVAILABLE };
enum LocalSwitch : int8_t { SW_DOWN=-1, SW_CENTER=0, SW_UP=1 };

enum : uint16_t { CAT_ENV=1, CAT_SCRAP=2, CAT_HOUSING=4, CAT_JAW=8 };

struct ShapeDef { Vec2 center; Vec2 half; float angle; };
struct TypeDef {
  const char *name;
  uint8_t shapeCount;
  ShapeDef shapes[2];
  float mass;
  uint16_t value;
  float friction;
  float magnetFactor;
  bool battery;
  bool magnetic;
  uint16_t color;
  uint16_t accent;
};

static const TypeDef TYPES[] = {
  {"PLATE",1,{{Vec2(0,0),Vec2(.575f,.21f),0},{Vec2(),Vec2(),0}},1.0f,30,.65f,1.0f,false,true,COL_RUST,COL_STEEL},
  {"BEAM",1,{{Vec2(0,0),Vec2(.825f,.14f),0},{Vec2(),Vec2(),0}},1.2f,40,.62f,1.0f,false,true,COL_STEEL,COL_RUST},
  {"PIPE",1,{{Vec2(0,0),Vec2(.65f,.16f),0},{Vec2(),Vec2(),0}},.9f,35,.55f,1.0f,false,true,COL_SHADOW,COL_STEEL},
  {"BENT",2,{{Vec2(-.20f,0),Vec2(.48f,.14f),0},{Vec2(.32f,.20f),Vec2(.34f,.14f),.48f}},1.1f,45,.65f,1.0f,false,true,COL_RUST,COL_YELLOW},
  {"ENGINE",1,{{Vec2(0,0),Vec2(.50f,.425f),0},{Vec2(),Vec2(),0}},4.0f,95,.72f,.28f,false,true,COL_SHADOW,COL_RUST},
  {"HOUSING",1,{{Vec2(0,0),Vec2(.65f,.375f),0},{Vec2(),Vec2(),0}},3.4f,85,.72f,.35f,false,true,COL_STEEL,COL_SHADOW},
  {"MOTOR",1,{{Vec2(0,0),Vec2(.325f,.275f),0},{Vec2(),Vec2(),0}},.8f,100,.70f,1.0f,false,true,0x3C9F,COL_CYAN},
  {"CONTROL",1,{{Vec2(0,0),Vec2(.35f,.21f),0},{Vec2(),Vec2(),0}},.55f,115,.66f,1.0f,false,true,COL_CYAN,COL_WHITE},
  {"BATTERY",1,{{Vec2(0,0),Vec2(.325f,.45f),0},{Vec2(),Vec2(),0}},1.2f,140,.68f,.65f,true,true,COL_YELLOW,COL_CORAL},
  {"CERAMIC",1,{{Vec2(0,0),Vec2(.425f,.30f),0},{Vec2(),Vec2(),0}},.6f,10,.58f,0.0f,false,false,COL_PURPLE,COL_STEEL},
};
static constexpr uint8_t TYPE_COUNT = sizeof(TYPES)/sizeof(TYPES[0]);

struct Body {
  bool active;
  bool dynamic;
  bool awake;
  BodyKind kind;
  uint8_t tag;
  Vec2 p,v,force;
  float a,w,torque;
  float invM, invI;
  float linearDamp, angularDamp;
  float idle;
  uint16_t generation;
};

struct Fixture {
  bool active;
  uint8_t body;
  uint16_t id;
  Vec2 localCenter;
  Vec2 half;
  float localAngle;
  float friction;
  float restitution;
  uint16_t category, mask;
};

struct ShapeCache {
  Vec2 center;
  Vec2 axis[2];
  Vec2 v[4];
  AABB box;
};

struct ContactPoint {
  Vec2 p;
  Vec2 rA,rB;
  float normalImpulse;
  float tangentImpulse;
  float massN,massT;
  float approach;
};
struct Manifold {
  bool active;
  uint8_t fa,fb;
  Vec2 n;
  float penetration;
  uint8_t count;
  ContactPoint cp[2];
};

struct Cable {
  Vec2 anchor;
  Vec2 localAttach;
  float length;
  float lengthRate;
  float impulse;
  float lastForce;
};

struct Hinge {
  uint8_t a,b;
  Vec2 localA,localB;
  float reference;
  float minAngle,maxAngle;
  float target;
  float motorImpulse;
  float maxTorque;
};

struct ScrapInstance {
  bool active;
  bool counted;
  bool everDamaged;
  bool everDestroyed;
  uint8_t body;
  uint8_t type;
  HealthState health;
  float binDwell;
  uint32_t damageCooldownUntil;
};

struct MagnetState {
  float energy;
  float timeLeft;
  float recoveryDelay;
  uint32_t serial;
};

struct SwitchFilter {
  LocalSwitch stable;
  LocalSwitch candidate;
  uint32_t changedAt;
};

struct InputState {
  SwitchFilter left,right;
  bool leftArmed,rightArmed;
  uint32_t leftReleasedAt,rightReleasedAt;
  bool pendingJawToggle;
  bool pendingMagnet;
  bool suppressChord;
  bool centerSeen;
};

struct SnapshotBody { bool active; BodyKind kind; uint8_t tag; Vec2 p; float a; bool awake; };
struct RenderSnapshot {
  SnapshotBody bodies[MAX_BODIES];
  bool scrapActive[MAX_SCRAP];
  uint8_t scrapBody[MAX_SCRAP];
  uint8_t scrapType[MAX_SCRAP];
  HealthState scrapHealth[MAX_SCRAP];
  Vec2 cableAnchor[2];
  Vec2 cableEnd[2];
  bool cableTaut[2];
  float magnetEnergy;
  bool magnetActive;
  float magnetPhase;
  Phase phase;
  uint16_t score,quota;
  uint16_t secondsLeft;
  bool quotaMet;
  uint16_t bestValue;
  uint8_t damaged,destroyed;
  char bestName[12];
};

struct RoundState {
  Phase phase;
  uint32_t seed;
  uint32_t shiftStartMs;
  uint16_t score;
  uint16_t quota;
  bool quotaMet;
  uint8_t damaged,destroyed;
  uint16_t bestValue;
  char bestName[12];
  uint8_t spawnIndex;
  uint16_t prepTicks;
  uint8_t prepRetries;
  uint32_t resultsReadyAt;
};

struct Diagnostics {
  uint32_t droppedPhysicsTime;
  uint32_t contactOverflows;
  uint32_t invalidStates;
  uint16_t peakContacts;
};

struct StripCanvas {
  uint16_t *pix;
  int y0,h;
  void begin(uint16_t *p,int yy,int hh){ pix=p;y0=yy;h=hh; }
  void clear(uint16_t c){ for(int i=0;i<SCREEN_W*h;i++) pix[i]=c; }
  void pixel(int x,int y,uint16_t c){ if(x<0||x>=SCREEN_W||y<y0||y>=y0+h) return; pix[(y-y0)*SCREEN_W+x]=c; }
  void hline(int x0,int x1,int y,uint16_t c){ if(y<y0||y>=y0+h) return; if(x0>x1){int t=x0;x0=x1;x1=t;} x0=max(0,x0);x1=min(SCREEN_W-1,x1); if(x0>x1)return; uint16_t* d=pix+(y-y0)*SCREEN_W+x0; for(int x=x0;x<=x1;x++) *d++=c; }
  void line(int x0,int y0g,int x1,int y1,uint16_t c){ int dx=abs(x1-x0), sx=x0<x1?1:-1; int dy=-abs(y1-y0g), sy=y0g<y1?1:-1; int err=dx+dy; for(;;){ pixel(x0,y0g,c); if(x0==x1&&y0g==y1)break; int e2=2*err; if(e2>=dy){err+=dy;x0+=sx;} if(e2<=dx){err+=dx;y0g+=sy;} } }
  void fillRect(int x,int y,int w,int hh,uint16_t c){ int xa=max(0,x), xb=min(SCREEN_W,x+w); int ya=max(y0,y), yb=min(y0+h,y+hh); if(xa>=xb||ya>=yb)return; for(int yy=ya;yy<yb;yy++) hline(xa,xb-1,yy,c); }
  void triangle(int x0,int y0a,int x1,int y1,int x2,int y2,uint16_t c){
    int miny=max(y0,min(y0a,min(y1,y2))), maxy=min(y0+h-1,max(y0a,max(y1,y2)));
    int minx=max(0,min(x0,min(x1,x2))), maxx=min(SCREEN_W-1,max(x0,max(x1,x2)));
    long A=(long)(y1-y2), B=(long)(x2-x1), C=(long)x1*y2-(long)x2*y1;
    long D=(long)(y2-y0a), E=(long)(x0-x2), F=(long)x2*y0a-(long)x0*y2;
    long G=(long)(y0a-y1), H=(long)(x1-x0), I=(long)x0*y1-(long)x1*y0a;
    long area=A*x0+B*y0a+C; if(area==0)return; bool pos=area>0;
    for(int y=miny;y<=maxy;y++) for(int x=minx;x<=maxx;x++){ long e0=A*x+B*y+C,e1=D*x+E*y+F,e2=G*x+H*y+I; if(pos?(e0>=0&&e1>=0&&e2>=0):(e0<=0&&e1<=0&&e2<=0)) pixel(x,y,c); }
  }
  void quad(const int x[4],const int y[4],uint16_t fill,uint16_t outline){ triangle(x[0],y[0],x[1],y[1],x[2],y[2],fill); triangle(x[0],y[0],x[2],y[2],x[3],y[3],fill); for(int i=0;i<4;i++) line(x[i],y[i],x[(i+1)&3],y[(i+1)&3],outline); }
};

struct Workspace {
  Body bodies[MAX_BODIES];
  Fixture fixtures[MAX_FIXTURES];
  ShapeCache geom[MAX_FIXTURES];
  Manifold contacts[MAX_CONTACTS];
  Manifold previous[MAX_CONTACTS];
  uint16_t contactCount, previousCount;
  ScrapInstance scrap[MAX_SCRAP];
  uint8_t scrapCount;
  Cable cables[2];
  Hinge hinges[2];
  uint8_t housing,leftJaw,rightJaw;
  bool jawsOpen;
  MagnetState magnet;
  InputState input;
  RoundState round;
  Diagnostics diag;
  uint32_t rng;
  uint32_t lastUpdateUs;
  uint32_t physicsAccumUs;
  uint32_t lastRenderMs;
  uint32_t lastHudMs;
  RenderSnapshot snap,oldSnap;
  bool haveOldSnap;
  bool dirty[STRIP_COUNT];
  uint16_t strip[SCREEN_W*STRIP_H];
  StripCanvas canvas;
  uint8_t removeQueue[MAX_REMOVE];
  uint8_t removeCount;
  char lastEvent[20];
  uint32_t lastEventUntil;
};

static Workspace *W = nullptr;
static bool gActive = false;

// -----------------------------------------------------------------------------
// RNG / helpers
// -----------------------------------------------------------------------------
static inline uint32_t rngNext(){ uint32_t x=W->rng; if(!x)x=0xA341316Cu; x^=x<<13; x^=x>>17; x^=x<<5; W->rng=x; return x; }
static inline float rng01(){ return (rngNext() & 0x00FFFFFFu) / 16777215.0f; }
static inline float rngRange(float a,float b){ return a+(b-a)*rng01(); }
static inline int bodyScrapIndex(uint8_t b){ for(int i=0;i<W->scrapCount;i++) if(W->scrap[i].active && W->scrap[i].body==b) return i; return -1; }
static inline Body &B(uint8_t i){ return W->bodies[i<MAX_BODIES?i:0]; }
static inline Vec2 localToWorld(const Body &b,const Vec2 &p){ return b.p + rotate(p,b.a); }
static inline Vec2 velocityAtPoint(const Body &b,const Vec2 &r){ return b.v + cross(b.w,r); }
static inline bool finiteBody(const Body&b){ return isfinite(b.p.x)&&isfinite(b.p.y)&&isfinite(b.a)&&isfinite(b.v.x)&&isfinite(b.v.y)&&isfinite(b.w); }
static inline void wake(uint8_t i){ if(i<MAX_BODIES && B(i).active && B(i).dynamic){ B(i).awake=true; B(i).idle=0; } }
static inline void applyImpulse(uint8_t bi,const Vec2 &imp,const Vec2 &r){ Body&b=B(bi); if(!b.dynamic)return; b.v += imp*b.invM; b.w += b.invI*cross(r,imp); wake(bi); }
static inline void applyForce(uint8_t bi,const Vec2 &f,const Vec2 &worldPoint){ Body&b=B(bi); if(!b.dynamic)return; b.force += f; b.torque += cross(worldPoint-b.p,f); wake(bi); }

static inline int sx(float x){ return (int)lroundf((x-WORLD_X0)*PX_PER_UNIT); }
static inline int sy(float y){ return (int)lroundf(WORLD_Y0_PX+y*PX_PER_UNIT); }

// -----------------------------------------------------------------------------
// Body / fixture creation
// -----------------------------------------------------------------------------
static void clearWorld(){
  for(int i=0;i<MAX_BODIES;i++) W->bodies[i]=Body{};
  for(int i=0;i<MAX_FIXTURES;i++){ W->fixtures[i]=Fixture{}; W->geom[i]=ShapeCache{}; }
  for(int i=0;i<MAX_CONTACTS;i++){ W->contacts[i]=Manifold{}; W->previous[i]=Manifold{}; }
  for(int i=0;i<MAX_SCRAP;i++) W->scrap[i]=ScrapInstance{};
  W->contactCount=W->previousCount=0; W->scrapCount=0; W->removeCount=0;
  Body &s=B(0); s.active=true; s.dynamic=false; s.kind=BODY_STATIC; s.generation++;
}

static uint8_t createBody(BodyKind kind, Vec2 p,float a,float mass,float inertia,float linD=.08f,float angD=.12f){
  for(uint8_t i=1;i<MAX_BODIES;i++) if(!B(i).active){ Body &b=B(i); b=Body{}; b.active=true;b.dynamic=true;b.awake=true;b.kind=kind;b.p=p;b.a=a;b.generation++;
    if(mass<=0) mass=1;
    if(inertia<=0) inertia=mass*.2f;
    b.invM=1.0f/mass;b.invI=1.0f/inertia;b.linearDamp=linD;b.angularDamp=angD; return i; }
  return 255;
}
static int addFixture(uint8_t body,Vec2 lc,Vec2 half,float la,float friction,float restitution,uint16_t cat,uint16_t mask){
  for(int i=0;i<MAX_FIXTURES;i++) if(!W->fixtures[i].active){ Fixture &f=W->fixtures[i]; f.active=true;f.body=body;f.id=i+1;f.localCenter=lc;f.half=half;f.localAngle=la;f.friction=friction;f.restitution=restitution;f.category=cat;f.mask=mask; return i; }
  return -1;
}
static int addStaticBox(Vec2 c,Vec2 half,float friction=.75f){ return addFixture(0,c,half,0,friction,0,CAT_ENV,CAT_SCRAP|CAT_HOUSING|CAT_JAW); }

static void updateFixtureGeometry(int fi){
  Fixture &f=W->fixtures[fi]; if(!f.active)return; Body &b=B(f.body); ShapeCache &g=W->geom[fi];
  float a=b.a+f.localAngle; float c=cosf(a),s=sinf(a); g.axis[0]=Vec2(c,s);g.axis[1]=Vec2(-s,c);g.center=b.p+rotate(f.localCenter,b.a);
  Vec2 ex=g.axis[0]*f.half.x, ey=g.axis[1]*f.half.y;
  g.v[0]=g.center-ex-ey; g.v[1]=g.center+ex-ey; g.v[2]=g.center+ex+ey; g.v[3]=g.center-ex+ey;
  g.box.minx=g.box.maxx=g.v[0].x;g.box.miny=g.box.maxy=g.v[0].y;
  for(int i=1;i<4;i++){g.box.minx=fminf(g.box.minx,g.v[i].x);g.box.maxx=fmaxf(g.box.maxx,g.v[i].x);g.box.miny=fminf(g.box.miny,g.v[i].y);g.box.maxy=fmaxf(g.box.maxy,g.v[i].y);} }
static void updateAllGeometry(){ for(int i=0;i<MAX_FIXTURES;i++) if(W->fixtures[i].active) updateFixtureGeometry(i); }

// -----------------------------------------------------------------------------
// OBB contact generation
// -----------------------------------------------------------------------------
static inline void projectBox(const ShapeCache &g,const Vec2 &ax,float &mn,float &mx){ mn=mx=dot(g.v[0],ax); for(int i=1;i<4;i++){float p=dot(g.v[i],ax);mn=fminf(mn,p);mx=fmaxf(mx,p);} }
static bool pointInside(const Vec2&p,const ShapeCache&g){ Vec2 d=p-g.center; return absf(dot(d,g.axis[0]))<=len(g.v[1]-g.v[0])*.5005f && absf(dot(d,g.axis[1]))<=len(g.v[3]-g.v[0])*.5005f; }
static bool segmentIntersection(Vec2 a,Vec2 b,Vec2 c,Vec2 d,Vec2 &out){ Vec2 r=b-a,s=d-c; float den=cross(r,s); if(absf(den)<1e-6f)return false; float t=cross(c-a,s)/den,u=cross(c-a,r)/den; if(t>=-1e-4f&&t<=1.0001f&&u>=-1e-4f&&u<=1.0001f){out=a+r*t;return true;} return false; }
static void addCandidate(Vec2 *pts,int &n,const Vec2&p){ for(int i=0;i<n;i++) if(len2(pts[i]-p)<0.0004f)return; if(n<16)pts[n++]=p; }

static bool collideBoxes(uint8_t fa,uint8_t fb,Manifold &m){
  const ShapeCache&A=W->geom[fa],&C=W->geom[fb]; Vec2 axes[4]={A.axis[0],A.axis[1],C.axis[0],C.axis[1]}; float best=1e9f;Vec2 n;
  for(int k=0;k<4;k++){ Vec2 ax=axes[k];float a0,a1,b0,b1;projectBox(A,ax,a0,a1);projectBox(C,ax,b0,b1);float ov=fminf(a1,b1)-fmaxf(a0,b0);if(ov<=0)return false;if(ov<best){best=ov;n=ax;} }
  if(dot(C.center-A.center,n)<0)n=n*-1.0f;
  Vec2 cand[16];int cn=0;
  for(int i=0;i<4;i++){ if(pointInside(A.v[i],C))addCandidate(cand,cn,A.v[i]); if(pointInside(C.v[i],A))addCandidate(cand,cn,C.v[i]); }
  for(int i=0;i<4;i++)for(int j=0;j<4;j++){Vec2 p;if(segmentIntersection(A.v[i],A.v[(i+1)&3],C.v[j],C.v[(j+1)&3],p))addCandidate(cand,cn,p);}
  if(cn==0) addCandidate(cand,cn,(A.center+C.center)*.5f);
  Vec2 t=perp(n);int imin=0,imax=0;float pmin=dot(cand[0],t),pmax=pmin;for(int i=1;i<cn;i++){float q=dot(cand[i],t);if(q<pmin){pmin=q;imin=i;}if(q>pmax){pmax=q;imax=i;}}
  m.active=true;m.fa=fa;m.fb=fb;m.n=n;m.penetration=best;m.count=(imax!=imin && absf(pmax-pmin)>.04f)?2:1;
  m.cp[0].p=cand[imin];m.cp[0].normalImpulse=m.cp[0].tangentImpulse=0;
  if(m.count==2){m.cp[1].p=cand[imax];m.cp[1].normalImpulse=m.cp[1].tangentImpulse=0;}
  return true;
}

static void restoreWarmStart(Manifold&m){
  for(int pi=0;pi<m.count;pi++){
    for(int k=0;k<W->previousCount;k++){ Manifold &p=W->previous[k]; if(!p.active||p.fa!=m.fa||p.fb!=m.fb)continue; if(dot(p.n,m.n)<.85f)continue;
      int best=-1;float bd=.04f; for(int q=0;q<p.count;q++){float d=len2(p.cp[q].p-m.cp[pi].p);if(d<bd){bd=d;best=q;}}
      if(best>=0){m.cp[pi].normalImpulse=p.cp[best].normalImpulse;m.cp[pi].tangentImpulse=p.cp[best].tangentImpulse;} break; }
  }
}

static void buildContacts(){
  memcpy(W->previous,W->contacts,sizeof(W->contacts));W->previousCount=W->contactCount;W->contactCount=0; for(int q=0;q<MAX_CONTACTS;q++) W->contacts[q]=Manifold{};
  updateAllGeometry();
  for(int i=0;i<MAX_FIXTURES;i++){ Fixture&a=W->fixtures[i]; if(!a.active)continue; for(int j=i+1;j<MAX_FIXTURES;j++){ Fixture&b=W->fixtures[j]; if(!b.active||a.body==b.body)continue; if(!((a.mask&b.category)&&(b.mask&a.category)))continue; if(!aabbOverlap(W->geom[i].box,W->geom[j].box))continue;
      if(!B(a.body).dynamic&&!B(b.body).dynamic) continue;
      if(W->contactCount>=MAX_CONTACTS){W->diag.contactOverflows++;return;}
      Manifold m{}; if(collideBoxes(i,j,m)){ restoreWarmStart(m); W->contacts[W->contactCount++]=m;
        Body &ba=B(a.body), &bb=B(b.body);
        if(ba.dynamic && bb.dynamic){ if(ba.awake && !bb.awake) wake(b.body); if(bb.awake && !ba.awake) wake(a.body); }
        if(ba.kind==BODY_HOUSING || ba.kind==BODY_JAW) wake(b.body);
        if(bb.kind==BODY_HOUSING || bb.kind==BODY_JAW) wake(a.body);
      } }
  }
  W->diag.peakContacts=max(W->diag.peakContacts,W->contactCount);
}

static void prepareContacts(float h){
  (void)h;
  for(int k=0;k<W->contactCount;k++){ Manifold&m=W->contacts[k]; Fixture&fa=W->fixtures[m.fa];Fixture&fb=W->fixtures[m.fb];Body&a=B(fa.body);Body&b=B(fb.body);Vec2 t=perp(m.n);
    for(int p=0;p<m.count;p++){ ContactPoint&cp=m.cp[p];cp.rA=cp.p-a.p;cp.rB=cp.p-b.p;Vec2 rv=velocityAtPoint(b,cp.rB)-velocityAtPoint(a,cp.rA);cp.approach=dot(rv,m.n);
      float rnA=cross(cp.rA,m.n),rnB=cross(cp.rB,m.n);float K=a.invM+b.invM+a.invI*rnA*rnA+b.invI*rnB*rnB;cp.massN=K>1e-8f?1.0f/K:0;
      float rtA=cross(cp.rA,t),rtB=cross(cp.rB,t);K=a.invM+b.invM+a.invI*rtA*rtA+b.invI*rtB*rtB;cp.massT=K>1e-8f?1.0f/K:0;
    }
  }
}
static void warmStartContacts(){ for(int k=0;k<W->contactCount;k++){Manifold&m=W->contacts[k];Vec2 t=perp(m.n);for(int p=0;p<m.count;p++){auto&cp=m.cp[p];Vec2 imp=m.n*cp.normalImpulse+t*cp.tangentImpulse;applyImpulse(W->fixtures[m.fa].body,imp*-1,cp.rA);applyImpulse(W->fixtures[m.fb].body,imp,cp.rB);}}}
static void solveContactVelocities(){
  for(int k=0;k<W->contactCount;k++){ Manifold&m=W->contacts[k];Fixture&fa=W->fixtures[m.fa];Fixture&fb=W->fixtures[m.fb];Body&a=B(fa.body);Body&b=B(fb.body);Vec2 t=perp(m.n);float mu=sqrtf(fa.friction*fb.friction);float rest=fmaxf(fa.restitution,fb.restitution);
    for(int p=0;p<m.count;p++){ContactPoint&cp=m.cp[p];Vec2 rv=velocityAtPoint(b,cp.rB)-velocityAtPoint(a,cp.rA);float vn=dot(rv,m.n);float target=(cp.approach<-RESTITUTION_SPEED)?(-rest*cp.approach):0.0f;float dl=(target-vn)*cp.massN;float old=cp.normalImpulse;cp.normalImpulse=fmaxf(0,old+dl);dl=cp.normalImpulse-old;Vec2 imp=m.n*dl;applyImpulse(fa.body,imp*-1,cp.rA);applyImpulse(fb.body,imp,cp.rB);
      rv=velocityAtPoint(b,cp.rB)-velocityAtPoint(a,cp.rA);float vt=dot(rv,t);float dt=-vt*cp.massT;float maxF=mu*cp.normalImpulse;old=cp.tangentImpulse;cp.tangentImpulse=fclamp(old+dt,-maxF,maxF);dt=cp.tangentImpulse-old;imp=t*dt;applyImpulse(fa.body,imp*-1,cp.rA);applyImpulse(fb.body,imp,cp.rB); }
  }
}
static void solveContactPositions(){
  for(int k=0;k<W->contactCount;k++){Manifold&m=W->contacts[k];Body&a=B(W->fixtures[m.fa].body);Body&b=B(W->fixtures[m.fb].body);float pen=fmaxf(0,m.penetration-CONTACT_SLOP);if(pen<=0)continue;float inv=a.invM+b.invM;if(inv<=1e-8f)continue;float mag=fminf(MAX_POSITION_CORR,pen*.32f)/inv;Vec2 c=m.n*mag;if(a.dynamic)a.p-=c*a.invM;if(b.dynamic)b.p+=c*b.invM;}
}

// -----------------------------------------------------------------------------
// Hinges / cables
// -----------------------------------------------------------------------------
static void solveHingeVelocity(Hinge &h,float dt){
  Body&a=B(h.a);Body&b=B(h.b);Vec2 rA=rotate(h.localA,a.a),rB=rotate(h.localB,b.a);Vec2 rv=velocityAtPoint(b,rB)-velocityAtPoint(a,rA);
  float k11=a.invM+b.invM+a.invI*rA.y*rA.y+b.invI*rB.y*rB.y;
  float k12=-a.invI*rA.x*rA.y-b.invI*rB.x*rB.y;
  float k22=a.invM+b.invM+a.invI*rA.x*rA.x+b.invI*rB.x*rB.x;float det=k11*k22-k12*k12;
  if(absf(det)>1e-8f){float invDet=1.0f/det;Vec2 imp(( -k22*rv.x + k12*rv.y)*invDet,( k12*rv.x - k11*rv.y)*invDet);applyImpulse(h.a,imp*-1,rA);applyImpulse(h.b,imp,rB);}
  float rel=(b.a-a.a)-h.reference;float err=h.target-rel;float desired=fclamp(err*9.0f,-5.5f,5.5f);float K=a.invI+b.invI;if(K>1e-8f){float imp=(desired-(b.w-a.w))/K;float maxI=h.maxTorque*dt;float old=h.motorImpulse;h.motorImpulse=fclamp(old+imp,-maxI,maxI);imp=h.motorImpulse-old;a.w-=imp*a.invI;b.w+=imp*b.invI;}
}
static void solveHingePosition(Hinge &h){
  Body&a=B(h.a);Body&b=B(h.b);Vec2 rA=rotate(h.localA,a.a),rB=rotate(h.localB,b.a);Vec2 e=(b.p+rB)-(a.p+rA);float inv=a.invM+b.invM;if(inv>1e-8f){Vec2 c=e*(.35f/inv);if(a.dynamic)a.p+=c*a.invM;if(b.dynamic)b.p-=c*b.invM;}
  float rel=(b.a-a.a)-h.reference;float corr=0;if(rel<h.minAngle)corr=rel-h.minAngle;else if(rel>h.maxAngle)corr=rel-h.maxAngle;if(corr!=0){float K=a.invI+b.invI;if(K>1e-8f){float q=fclamp(corr*.25f,-.08f,.08f)/K;a.a+=q*a.invI;b.a-=q*b.invI;}}
}

static void updateWinch(Cable &c,LocalSwitch sw,float h){
  float cmd=0;if(sw==SW_UP)cmd=-.90f;else if(sw==SW_DOWN)cmd=1.10f;
  if(cmd<0 && c.lastForce>40.0f){float f=fclamp((65.0f-c.lastForce)/25.0f,0,1);cmd*=f;}
  c.lengthRate=cmd;c.length=fclamp(c.length+cmd*h,1.5f,16.0f);
}
static void solveCableVelocity(Cable &c,float h,uint8_t body){
  Body&b=B(body);Vec2 r=rotate(c.localAttach,b.a);Vec2 p=b.p+r;Vec2 d=p-c.anchor;float L=len(d);if(L<1e-5f){c.impulse=0;return;}Vec2 n=d/L;float u=dot(velocityAtPoint(b,r),n);float stretch=L-c.length;bool taut=stretch>-.015f || (u-c.lengthRate)*h>fmaxf(0,c.length-L);
  if(!taut){c.impulse=0;c.lastForce=0;return;}float rn=cross(r,n);float K=b.invM+b.invI*rn*rn;if(K<=1e-8f)return;float bias=stretch>0?fminf(stretch*.18f/h,2.0f):0;float lambda=(u-c.lengthRate+bias)/K;float old=c.impulse;float maxI=65.0f*h;c.impulse=fclamp(old+lambda,0,maxI);float dl=c.impulse-old;applyImpulse(body,n*(-dl),r);c.lastForce=c.impulse/h;
}
static void solveCablePosition(Cable &c,uint8_t body){Body&b=B(body);Vec2 r=rotate(c.localAttach,b.a);Vec2 p=b.p+r,d=p-c.anchor;float L=len(d);float over=L-c.length-CONTACT_SLOP;if(over<=0||L<1e-5f)return;Vec2 n=d/L;float rn=cross(r,n),K=b.invM+b.invI*rn*rn;if(K<=1e-8f)return;float q=fminf(over*.25f,.035f)/K;b.p-=n*(q*b.invM);b.a-=q*b.invI*rn;}

// -----------------------------------------------------------------------------
// Arena / claw / scrap construction
// -----------------------------------------------------------------------------
static void buildArena(){
  addStaticBox(Vec2(6.0f,13.72f),Vec2(5.85f,.17f)); addStaticBox(Vec2(.08f,7.15f),Vec2(.17f,6.45f)); addStaticBox(Vec2(11.92f,7.15f),Vec2(.17f,6.45f));
  addStaticBox(Vec2(.65f,9.70f),Vec2(.10f,1.10f)); addStaticBox(Vec2(3.85f,9.70f),Vec2(.10f,1.10f)); addStaticBox(Vec2(2.25f,10.80f),Vec2(1.70f,.10f));
}
static float boxInertia(float mass,float w,float h){ return mass*(w*w+h*h)/12.0f; }
static float jawInertia(float mass){
  float totalA=JAW_A1+JAW_A2, m1=mass*(JAW_A1/totalA), m2=mass*(JAW_A2/totalA);
  Vec2 c1(-JAW_COM_X_ABS,-JAW_COM_Y);
  Vec2 c2(JAW_TOE_X-JAW_COM_X_ABS,JAW_TOE_Y-JAW_COM_Y);
  return boxInertia(m1,JAW_SHANK_W,JAW_SHANK_H)+m1*len2(c1)+boxInertia(m2,JAW_TOE_W,JAW_TOE_H)+m2*len2(c2);
}
static ShapeDef jawShape(bool left,int index){
  float sign=left?1.0f:-1.0f, cx=sign*JAW_COM_X_ABS;
  if(index==0) return {Vec2(-cx,-JAW_COM_Y),Vec2(JAW_SHANK_W*.5f,JAW_SHANK_H*.5f),0};
  return {Vec2(sign*JAW_TOE_X-cx,JAW_TOE_Y-JAW_COM_Y),Vec2(JAW_TOE_W*.5f,JAW_TOE_H*.5f),0};
}
static Vec2 jawPivotLocal(bool left){ float cx=(left?1.0f:-1.0f)*JAW_COM_X_ABS; return Vec2(-cx,JAW_PIVOT_Y-JAW_COM_Y); }
static bool createClaw(){
  float hm=2.0f;W->housing=createBody(BODY_HOUSING,Vec2(6,4),0,hm,boxInertia(hm,1.15f,.45f),.12f,.8f);if(W->housing==255)return false;addFixture(W->housing,Vec2(0,0),Vec2(.575f,.225f),0,.70f,.02f,CAT_HOUSING,CAT_ENV|CAT_SCRAP);
  Vec2 hpL(-.46f,.20f),hpR(.46f,.20f);float aL=.44f,aR=-.44f;Vec2 pivotL=jawPivotLocal(true),pivotR=jawPivotLocal(false);Vec2 wL=localToWorld(B(W->housing),hpL),wR=localToWorld(B(W->housing),hpR);
  float jm=.35f,ji=jawInertia(jm);W->leftJaw=createBody(BODY_JAW,wL-rotate(pivotL,aL),aL,jm,ji,.08f,.22f);W->rightJaw=createBody(BODY_JAW,wR-rotate(pivotR,aR),aR,jm,ji,.08f,.22f);if(W->leftJaw==255||W->rightJaw==255)return false;
  ShapeDef ls0=jawShape(true,0),ls1=jawShape(true,1),rs0=jawShape(false,0),rs1=jawShape(false,1);
  addFixture(W->leftJaw,ls0.center,ls0.half,0,1.05f,.01f,CAT_JAW,CAT_ENV|CAT_SCRAP); addFixture(W->leftJaw,ls1.center,ls1.half,0,1.05f,.01f,CAT_JAW,CAT_ENV|CAT_SCRAP);
  addFixture(W->rightJaw,rs0.center,rs0.half,0,1.05f,.01f,CAT_JAW,CAT_ENV|CAT_SCRAP); addFixture(W->rightJaw,rs1.center,rs1.half,0,1.05f,.01f,CAT_JAW,CAT_ENV|CAT_SCRAP);
  W->hinges[0]={W->housing,W->leftJaw,hpL,pivotL,0.0f, -.20f,.58f,.44f,0,18.0f};
  W->hinges[1]={W->housing,W->rightJaw,hpR,pivotR,0.0f, -.58f,.20f,-.44f,0,18.0f};
  W->cables[0].anchor=Vec2(.65f,.35f);W->cables[0].localAttach=Vec2(-.50f,-.20f);W->cables[0].length=len(localToWorld(B(W->housing),W->cables[0].localAttach)-W->cables[0].anchor);
  W->cables[1].anchor=Vec2(11.35f,.35f);W->cables[1].localAttach=Vec2(.50f,-.20f);W->cables[1].length=len(localToWorld(B(W->housing),W->cables[1].localAttach)-W->cables[1].anchor);
  W->jawsOpen=true;return true;
}
static void addTypeFixtures(uint8_t body,const TypeDef&t){ for(int k=0;k<t.shapeCount;k++) addFixture(body,t.shapes[k].center,t.shapes[k].half,t.shapes[k].angle,t.friction,.02f,CAT_SCRAP,CAT_ENV|CAT_SCRAP|CAT_HOUSING|CAT_JAW); }
static float typeInertia(const TypeDef&t){ float maxr=.4f;for(int i=0;i<t.shapeCount;i++){float r=len(t.shapes[i].center)+len(t.shapes[i].half);maxr=fmaxf(maxr,r);}return t.mass*maxr*maxr*.55f; }
static bool spawnScrap(uint8_t type,Vec2 p,float a){ if(W->scrapCount>=MAX_SCRAP||type>=TYPE_COUNT)return false;const TypeDef&t=TYPES[type];uint8_t b=createBody(BODY_SCRAP,p,a,t.mass,typeInertia(t),.015f,.04f);if(b==255)return false;B(b).tag=W->scrapCount;addTypeFixtures(b,t);ScrapInstance&s=W->scrap[W->scrapCount++];s.active=true;s.body=b;s.type=type;s.health=HEALTH_INTACT;return true; }
static void chooseAndSpawnManifest(){
  static const uint8_t base[14]={0,1,2,3,0,1,4,5,6,7,8,8,2,9};
  for(int i=0;i<14;i++){int col=i%4,row=i/4;float x=5.0f+col*1.75f+rngRange(-.15f,.15f);float y=9.3f+row*.95f+rngRange(-.08f,.08f);if(y>12.3f)y=12.3f;spawnScrap(base[i],Vec2(x,y),rngRange(-.55f,.55f));}
}

// -----------------------------------------------------------------------------
// Input / magnet / game rules
// -----------------------------------------------------------------------------
static LocalSwitch readSwitchRaw(int upPin,int downPin){ bool up=digitalRead(upPin)==LOW,down=digitalRead(downPin)==LOW;if(up&&down)return SW_CENTER;if(up)return SW_UP;if(down)return SW_DOWN;return SW_CENTER; }
static void filterSwitch(SwitchFilter&f,LocalSwitch raw,uint32_t now){if(raw!=f.candidate){f.candidate=raw;f.changedAt=now;}if(raw!=f.stable && (uint32_t)(now-f.changedAt)>=8)f.stable=raw;}
static void sampleInput(const GameInput&in,uint32_t now){
  filterSwitch(W->input.left,readSwitchRaw(LEFT_UP_PIN,LEFT_DOWN_PIN),now);filterSwitch(W->input.right,readSwitchRaw(RIGHT_UP_PIN,RIGHT_DOWN_PIN),now);
  if(!in.leftButton){if(W->input.leftReleasedAt==0)W->input.leftReleasedAt=now;if((uint32_t)(now-W->input.leftReleasedAt)>=20)W->input.leftArmed=true;}else W->input.leftReleasedAt=0;
  if(!in.rightButton){if(W->input.rightReleasedAt==0)W->input.rightReleasedAt=now;if((uint32_t)(now-W->input.rightReleasedAt)>=20)W->input.rightArmed=true;}else W->input.rightReleasedAt=0;
  W->input.suppressChord=in.leftButton&&in.rightButton;
  if(W->input.left.stable==SW_CENTER&&W->input.right.stable==SW_CENTER)W->input.centerSeen=true;
  if(!W->input.suppressChord){if(in.leftPressed&&W->input.leftArmed){W->input.leftArmed=false;W->input.pendingJawToggle=true;}if(in.rightPressed&&W->input.rightArmed){W->input.rightArmed=false;W->input.pendingMagnet=true;}}
}
static void setEvent(const char*s,uint32_t ms=900){strncpy(W->lastEvent,s,sizeof(W->lastEvent)-1);W->lastEvent[sizeof(W->lastEvent)-1]=0;W->lastEventUntil=millis()+ms;}
static bool requestMagnet(){if(W->round.phase!=PHASE_PLAYING||W->magnet.timeLeft>0||W->magnet.energy<12)return false;W->magnet.timeLeft=.55f;W->magnet.serial++;setEvent("MAGNET PULSE");return true;}
static void stepMagnet(float h){
  if(W->magnet.timeLeft>0){float use=fminf(W->magnet.timeLeft,h);W->magnet.timeLeft-=use;W->magnet.energy=fmaxf(0,W->magnet.energy-70.0f*use);W->magnet.recoveryDelay=.20f;if(W->magnet.energy<=0)W->magnet.timeLeft=0;
    Body&hb=B(W->housing);Vec2 center=localToWorld(hb,Vec2(0,.34f));for(int i=0;i<W->scrapCount;i++){ScrapInstance&s=W->scrap[i];if(!s.active||s.counted)continue;const TypeDef&t=TYPES[s.type];if(!t.magnetic||t.magnetFactor<=0)continue;Body&b=B(s.body);Vec2 d=center-b.p;float dist=len(d);if(dist>=2.1f||dist<.03f)continue;float fall=1.0f-dist/2.1f;float F=7.0f*t.magnetFactor*fall*fall;float mass=1.0f/b.invM;F=fminf(F,12.0f*mass);Vec2 f=normalized(d)*F;Vec2 mp=b.p+rotate(Vec2(.15f*fclamp(t.magnetFactor,0,1),0),b.a);applyForce(s.body,f,mp);applyForce(W->housing,f*-1.0f,center);}
  }else{if(W->magnet.recoveryDelay>0)W->magnet.recoveryDelay=fmaxf(0,W->magnet.recoveryDelay-h);else W->magnet.energy=fminf(100.0f,W->magnet.energy+24.0f*h);}
}
static void consumeCommands(){ if(W->round.phase!=PHASE_PLAYING){W->input.pendingJawToggle=false;W->input.pendingMagnet=false;return;}if(W->input.pendingJawToggle){W->jawsOpen=!W->jawsOpen;W->hinges[0].target=W->jawsOpen?.44f:-.14f;W->hinges[1].target=W->jawsOpen?-.44f:.14f;setEvent(W->jawsOpen?"CLAW OPEN":"CLAW CLOSE");}if(W->input.pendingMagnet)requestMagnet();W->input.pendingJawToggle=false;W->input.pendingMagnet=false; }

static bool bodyTouchingJaw(uint8_t body){for(int k=0;k<W->contactCount;k++){Fixture&a=W->fixtures[W->contacts[k].fa],&b=W->fixtures[W->contacts[k].fb];if((a.body==body&&(b.category&CAT_JAW))||(b.body==body&&(a.category&CAT_JAW)))return true;}return false;}
static uint16_t currentValue(const ScrapInstance&s){const TypeDef&t=TYPES[s.type];if(!t.battery)return t.value;if(s.health==HEALTH_DAMAGED)return 80;if(s.health==HEALTH_DESTROYED)return 0;return 140;}
static void queueRemoval(uint8_t body){if(W->removeCount<MAX_REMOVE)W->removeQueue[W->removeCount++]=body;}
static void flushRemovals(){for(int q=0;q<W->removeCount;q++){uint8_t b=W->removeQueue[q];for(int f=0;f<MAX_FIXTURES;f++)if(W->fixtures[f].active&&W->fixtures[f].body==b)W->fixtures[f].active=false;B(b).active=false;for(int i=0;i<W->scrapCount;i++)if(W->scrap[i].body==b)W->scrap[i].active=false;}W->removeCount=0;for(int i=0;i<W->scrapCount;i++)if(W->scrap[i].active)wake(W->scrap[i].body);}
static bool fullyInsideBin(uint8_t body){bool any=false;for(int f=0;f<MAX_FIXTURES;f++)if(W->fixtures[f].active&&W->fixtures[f].body==body){any=true;ShapeCache&g=W->geom[f];for(int v=0;v<4;v++){Vec2 p=g.v[v];if(p.x<BIN_X0+.03f||p.x>BIN_X1-.03f||p.y<BIN_RIM_Y+.02f||p.y>BIN_BOTTOM_Y+.05f)return false;}}return any;}
static void acceptScrap(ScrapInstance&s){if(s.counted)return;s.counted=true;uint16_t v=currentValue(s);W->round.score+=v;if(v>W->round.bestValue){W->round.bestValue=v;strncpy(W->round.bestName,TYPES[s.type].name,sizeof(W->round.bestName)-1);W->round.bestName[sizeof(W->round.bestName)-1]=0;}char msg[20];snprintf(msg,sizeof(msg),"DEPOSIT +$%u",v);setEvent(msg,1100);queueRemoval(s.body);if(!W->round.quotaMet&&W->round.score>=W->round.quota){W->round.quotaMet=true;setEvent("QUOTA MET",1400);} }
static void updateBinDwell(float h){updateAllGeometry();for(int i=0;i<W->scrapCount;i++){ScrapInstance&s=W->scrap[i];if(!s.active||s.counted)continue;Body&b=B(s.body);bool ok=fullyInsideBin(s.body)&&!bodyTouchingJaw(s.body)&&len(b.v)<.15f&&absf(b.w)<.20f;if(ok)s.binDwell+=h;else s.binDwell=0;if(s.binDwell>=.25f)acceptScrap(s);} }
static void collectBatteryImpacts(){uint32_t now=millis();for(int k=0;k<W->contactCount;k++){Manifold&m=W->contacts[k];Fixture&fa=W->fixtures[m.fa],&fb=W->fixtures[m.fb];for(int side=0;side<2;side++){uint8_t body=side?fb.body:fa.body;int si=bodyScrapIndex(body);if(si<0)continue;ScrapInstance&s=W->scrap[si];if(!TYPES[s.type].battery||now<s.damageCooldownUntil)continue;float worstV=0,imp=0;for(int p=0;p<m.count;p++){worstV=fmaxf(worstV,-m.cp[p].approach);imp=fmaxf(imp,m.cp[p].normalImpulse);}if(worstV>2.2f&&imp>.55f){HealthState old=s.health;if(worstV>4.5f&&imp>1.1f)s.health=HEALTH_DESTROYED;else if(s.health==HEALTH_INTACT)s.health=HEALTH_DAMAGED;if(s.health!=old){s.damageCooldownUntil=now+250;if(!s.everDamaged){s.everDamaged=true;W->round.damaged++;}if(s.health==HEALTH_DESTROYED&&!s.everDestroyed){s.everDestroyed=true;W->round.destroyed++;}setEvent(s.health==HEALTH_DESTROYED?"BATTERY LOST":"BATTERY DAMAGED",1000);}}}}
}

// -----------------------------------------------------------------------------
// Physics stepping / sleeping
// -----------------------------------------------------------------------------
static void integrateForces(float h){for(int i=1;i<MAX_BODIES;i++){Body&b=B(i);if(!b.active||!b.dynamic||!b.awake)continue;b.v.y+=GRAVITY*h;b.v+=b.force*(b.invM*h);b.w+=b.torque*b.invI*h;float ld=fmaxf(0,1.0f-b.linearDamp*h),ad=fmaxf(0,1.0f-b.angularDamp*h);b.v*=ld;b.w*=ad;b.force=Vec2();b.torque=0;}}
static void integrateTransforms(float h){for(int i=1;i<MAX_BODIES;i++){Body&b=B(i);if(!b.active||!b.dynamic||!b.awake)continue;b.p+=b.v*h;b.a+=b.w*h;}}
static void updateSleep(float h){for(int i=1;i<MAX_BODIES;i++){Body&b=B(i);if(!b.active||!b.dynamic||b.kind!=BODY_SCRAP)continue;bool neighborAwake=false;for(int k=0;k<W->contactCount;k++){Fixture&a=W->fixtures[W->contacts[k].fa],&c=W->fixtures[W->contacts[k].fb];if(a.body==i&&c.body!=0&&B(c.body).awake)neighborAwake=true;if(c.body==i&&a.body!=0&&B(a.body).awake)neighborAwake=true;}if(len2(b.v)<fsq(.035f)&&absf(b.w)<.06f&&!neighborAwake){b.idle+=h;if(b.idle>.6f){b.awake=false;b.v=Vec2();b.w=0;}}else b.idle=0;}}
static void validateWorld(){for(int i=1;i<MAX_BODIES;i++){Body&b=B(i);if(!b.active)continue;if(!finiteBody(b)||absf(b.p.x)>50||absf(b.p.y)>50){W->diag.invalidStates++;b.v=Vec2();b.w=0;b.p=Vec2(6,6);b.a=0;}}}
static void physicsSubstep(float h,bool gameplay){
  LocalSwitch ls=W->input.suppressChord?SW_CENTER:W->input.left.stable;LocalSwitch rs=W->input.suppressChord?SW_CENTER:W->input.right.stable;
  if(gameplay){updateWinch(W->cables[0],ls,h);updateWinch(W->cables[1],rs,h);stepMagnet(h);}else{W->cables[0].lengthRate=W->cables[1].lengthRate=0;}
  buildContacts();integrateForces(h);prepareContacts(h);warmStartContacts();for(int i=0;i<2;i++)W->hinges[i].motorImpulse=0;
  W->cables[0].impulse=W->cables[1].impulse=0;
  for(int it=0;it<VELOCITY_ITERS;it++){if(it&1){solveCableVelocity(W->cables[1],h,W->housing);solveCableVelocity(W->cables[0],h,W->housing);solveHingeVelocity(W->hinges[1],h);solveHingeVelocity(W->hinges[0],h);}else{solveCableVelocity(W->cables[0],h,W->housing);solveCableVelocity(W->cables[1],h,W->housing);solveHingeVelocity(W->hinges[0],h);solveHingeVelocity(W->hinges[1],h);}solveContactVelocities();}
  integrateTransforms(h);for(int p=0;p<POSITION_ITERS;p++){solveContactPositions();solveHingePosition(W->hinges[0]);solveHingePosition(W->hinges[1]);solveCablePosition(W->cables[0],W->housing);solveCablePosition(W->cables[1],W->housing);updateAllGeometry();}
  if(gameplay){collectBatteryImpacts();updateBinDwell(h);flushRemovals();}updateSleep(h);validateWorld();
}
static void fixedTick(){consumeCommands();physicsSubstep(SUB_DT,W->round.phase==PHASE_PLAYING);physicsSubstep(SUB_DT,W->round.phase==PHASE_PLAYING);}

// -----------------------------------------------------------------------------
// Round setup / preparation
// -----------------------------------------------------------------------------
static bool ensureWorkspace(){if(W)return true;void *mem=malloc(sizeof(Workspace));if(!mem)return false;W=new(mem) Workspace{};return true;}
static void beginRound(uint32_t seed){
  clearWorld();memset(&W->round,0,sizeof(W->round));W->round.phase=PHASE_PREPARING;W->round.seed=seed?seed:0x43A1B55Du;W->round.quota=500;W->rng=W->round.seed;W->magnet={100,0,0,0};W->input.pendingJawToggle=W->input.pendingMagnet=false;W->input.centerSeen=false;W->input.leftArmed=W->input.rightArmed=false;W->input.leftReleasedAt=W->input.rightReleasedAt=0;W->lastEvent[0]=0;W->lastEventUntil=0;
  buildArena();if(!createClaw()){W->round.phase=PHASE_UNAVAILABLE;return;}chooseAndSpawnManifest();W->round.prepTicks=0;W->haveOldSnap=false;for(int i=0;i<STRIP_COUNT;i++)W->dirty[i]=true;
}
static void advancePreparation(){if(W->round.phase!=PHASE_PREPARING)return;for(int n=0;n<3;n++){physicsSubstep(SUB_DT,false);physicsSubstep(SUB_DT,false);W->round.prepTicks++;if(W->round.prepTicks>=90){for(int i=0;i<W->scrapCount;i++){W->scrap[i].health=HEALTH_INTACT;W->scrap[i].everDamaged=W->scrap[i].everDestroyed=false;W->scrap[i].damageCooldownUntil=0;}W->round.phase=PHASE_READY;W->input.pendingJawToggle=W->input.pendingMagnet=false;for(int s=0;s<STRIP_COUNT;s++)W->dirty[s]=true;break;}}}
static void startShift(uint32_t now){W->round.phase=PHASE_PLAYING;W->round.shiftStartMs=now;W->input.pendingJawToggle=W->input.pendingMagnet=false;setEvent("SHIFT START",700);for(int s=0;s<STRIP_COUNT;s++)W->dirty[s]=true;}
static void finishShift(){if(W->round.phase!=PHASE_PLAYING)return;W->round.phase=PHASE_RESULTS;W->magnet.timeLeft=0;W->round.resultsReadyAt=millis()+400;W->input.leftArmed=W->input.rightArmed=false;W->input.leftReleasedAt=W->input.rightReleasedAt=0;for(int s=0;s<STRIP_COUNT;s++)W->dirty[s]=true;}

// -----------------------------------------------------------------------------
// Snapshot / dirty tracking / rendering
// -----------------------------------------------------------------------------
static IRect bodyScreenBounds(const SnapshotBody&sb,uint8_t tag,const RenderSnapshot &snap){
  if(!sb.active) return rectInvalid();
  float r=.8f;
  if(sb.kind==BODY_JAW) r=.75f;
  else if(sb.kind==BODY_SCRAP && tag<MAX_SCRAP){
    uint8_t type=snap.scrapType[tag];
    if(type<TYPE_COUNT){ const TypeDef&t=TYPES[type]; r=.2f; for(int i=0;i<t.shapeCount;i++) r=fmaxf(r,len(t.shapes[i].center)+len(t.shapes[i].half)); }
  }
  int x=sx(sb.p.x),y=sy(sb.p.y),rr=(int)ceilf(r*PX_PER_UNIT)+3;
  return {(int16_t)(x-rr),(int16_t)(y-rr),(int16_t)(x+rr),(int16_t)(y+rr)};
}
static void markDirtyRect(IRect r){
  if(!rectValid(r)) return;
  if(r.x0<0) r.x0=0;
  if(r.x1>SCREEN_W-1) r.x1=SCREEN_W-1;
  if(r.y0<HUD_H) r.y0=HUD_H;
  if(r.y1>SCREEN_H-1) r.y1=SCREEN_H-1;
  if(!rectValid(r)) return;
  int s0=r.y0/STRIP_H,s1=r.y1/STRIP_H;
  for(int s=s0;s<=s1&&s<STRIP_COUNT;s++) W->dirty[s]=true;
}
static void captureSnapshot(){
  RenderSnapshot ns{};for(int i=0;i<MAX_BODIES;i++){Body&b=B(i);ns.bodies[i]={b.active,b.kind,b.tag,b.p,b.a,b.awake};}
  for(int i=0;i<W->scrapCount;i++){ns.scrapActive[i]=W->scrap[i].active;ns.scrapBody[i]=W->scrap[i].body;ns.scrapType[i]=W->scrap[i].type;ns.scrapHealth[i]=W->scrap[i].health;}
  for(int c=0;c<2;c++){ns.cableAnchor[c]=W->cables[c].anchor;ns.cableEnd[c]=localToWorld(B(W->housing),W->cables[c].localAttach);ns.cableTaut[c]=len(ns.cableEnd[c]-ns.cableAnchor[c])>=W->cables[c].length-.03f;}
  ns.magnetEnergy=W->magnet.energy;ns.magnetActive=W->magnet.timeLeft>0;ns.magnetPhase=.55f-W->magnet.timeLeft;ns.phase=W->round.phase;ns.score=W->round.score;ns.quota=W->round.quota;ns.quotaMet=W->round.quotaMet;ns.bestValue=W->round.bestValue;ns.damaged=W->round.damaged;ns.destroyed=W->round.destroyed;strncpy(ns.bestName,W->round.bestName,sizeof(ns.bestName)-1);ns.bestName[sizeof(ns.bestName)-1]=0;
  if(W->round.phase==PHASE_PLAYING){uint32_t e=millis()-W->round.shiftStartMs;ns.secondsLeft=e>=120000?0:(uint16_t)((120000-e+999)/1000);}else ns.secondsLeft=120;
  if(!W->haveOldSnap){for(int s=0;s<STRIP_COUNT;s++)W->dirty[s]=true;}else{
    for(int i=1;i<MAX_BODIES;i++){
      SnapshotBody &o=W->snap.bodies[i], &n=ns.bodies[i];
      bool changed=o.active!=n.active || (n.active && (len2(n.p-o.p)>.00002f || absf(n.a-o.a)>.001f));
      if(changed){ uint8_t oldTag=o.tag,newTag=n.tag; markDirtyRect(bodyScreenBounds(o,oldTag,W->snap)); markDirtyRect(bodyScreenBounds(n,newTag,ns)); }
    }
    for(int c=0;c<2;c++){
      bool cableChanged=len2(ns.cableEnd[c]-W->snap.cableEnd[c])>.00002f || ns.cableTaut[c]!=W->snap.cableTaut[c];
      if(cableChanged){
        IRect r{(int16_t)(min(sx(W->snap.cableAnchor[c].x),sx(W->snap.cableEnd[c].x))-3),(int16_t)(min(sy(W->snap.cableAnchor[c].y),sy(W->snap.cableEnd[c].y))-3),(int16_t)(max(sx(W->snap.cableAnchor[c].x),sx(W->snap.cableEnd[c].x))+3),(int16_t)(max(sy(W->snap.cableAnchor[c].y),sy(W->snap.cableEnd[c].y))+3)};
        IRect q{(int16_t)(min(sx(ns.cableAnchor[c].x),sx(ns.cableEnd[c].x))-3),(int16_t)(min(sy(ns.cableAnchor[c].y),sy(ns.cableEnd[c].y))-3),(int16_t)(max(sx(ns.cableAnchor[c].x),sx(ns.cableEnd[c].x))+3),(int16_t)(max(sy(ns.cableAnchor[c].y),sy(ns.cableEnd[c].y))+3)};
        markDirtyRect(r); markDirtyRect(q);
      }
    }
    if(W->snap.magnetActive||ns.magnetActive) markDirtyRect({55,50,185,210});
    if(W->snap.phase!=ns.phase) for(int s=0;s<STRIP_COUNT;s++) W->dirty[s]=true;
  }
  W->snap=ns;W->haveOldSnap=true;
}

static void worldRect(StripCanvas&c,float cx,float cy,float hx,float hy,uint16_t col){c.fillRect(sx(cx-hx),sy(cy-hy),max(1,(int)lroundf(hx*2*PX_PER_UNIT)),max(1,(int)lroundf(hy*2*PX_PER_UNIT)),col);}
static void drawRotBox(StripCanvas&c,Vec2 bp,float ba,const ShapeDef&sd,uint16_t fill,uint16_t outline){Vec2 center=bp+rotate(sd.center,ba);float a=ba+sd.angle;Vec2 ex=rotate(Vec2(sd.half.x,0),a),ey=rotate(Vec2(0,sd.half.y),a);Vec2 p[4]={center-ex-ey,center+ex-ey,center+ex+ey,center-ex+ey};int x[4],y[4];for(int i=0;i<4;i++){x[i]=sx(p[i].x);y[i]=sy(p[i].y);}c.quad(x,y,fill,outline);}
static void drawBackgroundStrip(StripCanvas&c){c.clear(COL_BG);for(int y=48;y<SCREEN_H;y+=40)c.hline(0,SCREEN_W-1,y,COL_PANEL);for(int x=20;x<SCREEN_W;x+=52)c.line(x,HUD_H,x+8,SCREEN_H,COL_PANEL);c.fillRect(0,40,SCREEN_W,8,COL_SHADOW);for(int x=8;x<SCREEN_W;x+=28)c.fillRect(x,42,8,3,COL_STEEL);
  worldRect(c,6,13.68f,5.85f,.14f,COL_SHADOW);worldRect(c,.08f,7.15f,.14f,6.45f,COL_SHADOW);worldRect(c,11.92f,7.15f,.14f,6.45f,COL_SHADOW);
  worldRect(c,2.25f,9.70f,1.60f,1.00f,0x08A4);
}
static void drawBinForeground(StripCanvas&c){
  worldRect(c,.65f,9.70f,.10f,1.10f,COL_GREEN);
  worldRect(c,3.85f,9.70f,.10f,1.10f,COL_GREEN);
  worldRect(c,2.25f,10.80f,1.70f,.10f,COL_STEEL);
  c.hline(sx(.75f),sx(3.75f),sy(8.70f),COL_GREEN);
}
static void drawCable(StripCanvas&c,Vec2 a,Vec2 b,bool taut,uint16_t col){int x0=sx(a.x),y0=sy(a.y),x1=sx(b.x),y1=sy(b.y);if(taut)c.line(x0,y0,x1,y1,col);else{int mx=(x0+x1)/2,my=(y0+y1)/2+5;c.line(x0,y0,mx,my,col);c.line(mx,my,x1,y1,col);}c.fillRect(x0-2,y0-2,5,5,COL_STEEL);}
static void drawScrap(StripCanvas&c,int si){if(!W->snap.scrapActive[si])return;uint8_t bi=W->snap.scrapBody[si];SnapshotBody&b=W->snap.bodies[bi];const TypeDef&t=TYPES[W->snap.scrapType[si]];uint16_t main=t.color;if(W->snap.scrapHealth[si]==HEALTH_DAMAGED)main=COL_CORAL;if(W->snap.scrapHealth[si]==HEALTH_DESTROYED)main=COL_SHADOW;for(int k=0;k<t.shapeCount;k++)drawRotBox(c,b.p,b.a,t.shapes[k],main,COL_BLACK);
  Vec2 d=rotate(Vec2(.18f,0),b.a);c.line(sx(b.p.x-d.x),sy(b.p.y-d.y),sx(b.p.x+d.x),sy(b.p.y+d.y),t.accent);if(t.battery){Vec2 p=b.p+rotate(Vec2(0,-.28f),b.a);c.fillRect(sx(p.x)-2,sy(p.y)-2,4,4,COL_WHITE);} }
static void drawClaw(StripCanvas&c){SnapshotBody&h=W->snap.bodies[W->housing];drawRotBox(c,h.p,h.a,{Vec2(0,0),Vec2(.575f,.225f),0},COL_YELLOW,COL_BLACK);Vec2 coil=h.p+rotate(Vec2(0,.12f),h.a);c.fillRect(sx(coil.x)-4,sy(coil.y)-2,8,4,W->snap.magnetActive?COL_CYAN:COL_SHADOW);
  SnapshotBody&l=W->snap.bodies[W->leftJaw];drawRotBox(c,l.p,l.a,jawShape(true,0),COL_STEEL,COL_BLACK);drawRotBox(c,l.p,l.a,jawShape(true,1),COL_STEEL,COL_BLACK);
  SnapshotBody&r=W->snap.bodies[W->rightJaw];drawRotBox(c,r.p,r.a,jawShape(false,0),COL_STEEL,COL_BLACK);drawRotBox(c,r.p,r.a,jawShape(false,1),COL_STEEL,COL_BLACK);
  if(W->snap.magnetActive){Vec2 ctr=h.p+rotate(Vec2(0,.34f),h.a);float rr=fclamp(W->snap.magnetPhase/.55f,0,1)*2.1f;int R=(int)(rr*PX_PER_UNIT);int cx=sx(ctr.x),cy=sy(ctr.y);for(int a=0;a<360;a+=15){float ar=a*.0174533f;c.pixel(cx+(int)(cosf(ar)*R),cy+(int)(sinf(ar)*R),COL_CYAN);}}
}
static void drawStrip(int y0,int h){W->canvas.begin(W->strip,y0,h);drawBackgroundStrip(W->canvas);drawCable(W->canvas,W->snap.cableAnchor[0],W->snap.cableEnd[0],W->snap.cableTaut[0],COL_STEEL);drawCable(W->canvas,W->snap.cableAnchor[1],W->snap.cableEnd[1],W->snap.cableTaut[1],COL_STEEL);for(int i=0;i<W->scrapCount;i++)drawScrap(W->canvas,i);drawClaw(W->canvas);drawBinForeground(W->canvas);display.drawRGBBitmap(0,y0,W->strip,SCREEN_W,h);}
static void drawHud(){display.fillRect(0,0,SCREEN_W,HUD_H,COL_BG);display.drawFastHLine(0,HUD_H-1,SCREEN_W,COL_SHADOW);display.setTextWrap(false);display.setTextSize(1);display.setTextColor(W->snap.quotaMet?COL_GREEN:COL_TEXT,COL_BG);display.setCursor(5,4);display.print('$');display.print(W->snap.score);display.print('/');display.print(W->snap.quota);display.setTextColor(W->snap.secondsLeft<=10?COL_CORAL:COL_TEXT,COL_BG);display.setCursor(186,4);display.print(W->snap.secondsLeft/60);display.print(':');if(W->snap.secondsLeft%60<10)display.print('0');display.print(W->snap.secondsLeft%60);
  display.setTextColor(COL_CYAN,COL_BG);display.setCursor(5,20);display.print("MAG");int seg=(int)(W->snap.magnetEnergy/10.0f);for(int i=0;i<10;i++){int x=30+i*10;display.fillRect(x,20,7,7,i<seg?COL_CYAN:COL_SHADOW);}if(millis()<W->lastEventUntil){display.setTextColor(COL_TEXT,COL_BG);display.setCursor(137,20);display.print(W->lastEvent);} }
static void drawOverlay(){
  if(W->snap.phase==PHASE_PREPARING){display.fillRect(28,125,184,52,COL_SHADOW);display.drawRect(28,125,184,52,COL_STEEL);display.setTextColor(COL_TEXT,COL_SHADOW);display.setTextSize(2);display.setCursor(45,137);display.print("PREPARING");display.setTextSize(1);display.setCursor(71,162);display.print("YARD / PHYSICS");}
  else if(W->snap.phase==PHASE_READY){display.fillRect(18,104,204,100,COL_SHADOW);display.drawRect(18,104,204,100,COL_YELLOW);display.setTextColor(COL_YELLOW,COL_SHADOW);display.setTextSize(2);display.setCursor(50,115);display.print("SCRAP CLAW");display.setTextSize(1);display.setTextColor(COL_TEXT,COL_SHADOW);display.setCursor(58,143);display.print("QUOTA $500  /  2:00");display.setCursor(45,159);display.print("L BUTTON: CLAW");display.setCursor(45,172);display.print("R BUTTON: MAGNET");display.setCursor(52,190);display.print(W->input.centerSeen?"PRESS TO START":"CENTER SWITCHES");}
  else if(W->snap.phase==PHASE_RESULTS){display.fillRect(20,88,200,145,COL_SHADOW);display.drawRect(20,88,200,145,W->snap.quotaMet?COL_GREEN:COL_CORAL);display.setTextSize(2);display.setTextColor(W->snap.quotaMet?COL_GREEN:COL_CORAL,COL_SHADOW);display.setCursor(49,100);display.print(W->snap.quotaMet?"QUOTA MET":"QUOTA MISSED");display.setTextSize(1);display.setTextColor(COL_TEXT,COL_SHADOW);display.setCursor(50,132);display.print("TOTAL  $");display.print(W->snap.score);display.setCursor(50,148);display.print("QUOTA  $");display.print(W->snap.quota);display.setCursor(50,164);display.print("DAMAGED ");display.print(W->snap.damaged);display.print("  LOST ");display.print(W->snap.destroyed);display.setCursor(50,180);display.print("BEST   ");display.print(W->snap.bestName[0]?W->snap.bestName:"--");display.print(" $");display.print(W->snap.bestValue);display.setCursor(54,210);display.print("PRESS TO RUN AGAIN");}
  else if(W->snap.phase==PHASE_UNAVAILABLE){display.fillScreen(COL_BG);display.setTextColor(COL_CORAL,COL_BG);display.setTextSize(2);display.setCursor(35,130);display.print("SCRAP CLAW");display.setTextSize(1);display.setCursor(50,160);display.print("WORKSPACE FAILED");}
}
static void drawFrame(){captureSnapshot();for(int s=HUD_H/STRIP_H;s<STRIP_COUNT;s++)if(W->dirty[s]){int y=s*STRIP_H;int h=min(STRIP_H,SCREEN_H-y);drawStrip(y,h);W->dirty[s]=false;}drawHud();drawOverlay();if(W->snap.phase==PHASE_READY||W->snap.phase==PHASE_RESULTS||W->snap.phase==PHASE_UNAVAILABLE)MenuFooter::draw(display);}

// -----------------------------------------------------------------------------
// Public lifecycle
// -----------------------------------------------------------------------------
static void enter(){
  gActive=true;display.setRotation(0);display.setTextWrap(false);if(!ensureWorkspace()){display.fillScreen(COL_BG);display.setTextColor(COL_CORAL,COL_BG);display.setTextSize(2);display.setCursor(35,145);display.print("SCRAP CLAW");display.setTextSize(1);display.setCursor(42,175);display.print("NOT ENOUGH MEMORY");return;}
  W->~Workspace(); new(W) Workspace{}; W->input.left.stable=W->input.left.candidate=SW_CENTER;W->input.right.stable=W->input.right.candidate=SW_CENTER;uint32_t seed=micros()^((uint32_t)millis()<<16)^0x51C4A77Du;beginRound(seed);W->lastUpdateUs=micros();W->lastRenderMs=0;Serial.print("[ScrapClaw] ");Serial.print(BUILD_ID);Serial.print(" workspace=");Serial.println((unsigned)sizeof(Workspace));drawFrame();
}
static void leave(){
  if(!gActive) return;
  gActive=false;
#if SCRAPCLAW_AUDIO_HOOKS
  // Reserved: stop any game-owned LEDC output here when hooks are enabled.
#endif
  if(W){ W->~Workspace(); free(W); W=nullptr; }
}

static void update(const GameInput &in){
  if(!gActive||!W) return;
  uint32_t nowMs=millis(),nowUs=micros();
  sampleInput(in,nowMs);
  if(W->round.phase==PHASE_PREPARING)advancePreparation();
  else if(W->round.phase==PHASE_READY){if(W->input.centerSeen&&(W->input.pendingJawToggle||W->input.pendingMagnet)){W->input.pendingJawToggle=W->input.pendingMagnet=false;startShift(nowMs);}}
  else if(W->round.phase==PHASE_RESULTS){if((int32_t)(nowMs-W->round.resultsReadyAt)>=0&&(W->input.pendingJawToggle||W->input.pendingMagnet)){W->input.pendingJawToggle=W->input.pendingMagnet=false;beginRound(rngNext()^nowUs);}}
  if(W->round.phase==PHASE_PLAYING){if((uint32_t)(nowMs-W->round.shiftStartMs)>=120000){finishShift();}else{uint32_t du=nowUs-W->lastUpdateUs;W->lastUpdateUs=nowUs;uint32_t acc=W->physicsAccumUs+du;W->physicsAccumUs=acc>PHYS_US*8u?PHYS_US*8u:acc;int ticks=0;while(W->physicsAccumUs>=PHYS_US&&ticks<MAX_CATCHUP){fixedTick();W->physicsAccumUs-=PHYS_US;ticks++;}if(W->physicsAccumUs>=PHYS_US){W->diag.droppedPhysicsTime+=W->physicsAccumUs/PHYS_US;W->physicsAccumUs%=PHYS_US;}}}else W->lastUpdateUs=nowUs;
  if((uint32_t)(nowMs-W->lastRenderMs)>=RENDER_MS){W->lastRenderMs=nowMs;drawFrame();}
}

} // namespace ScrapClaw
