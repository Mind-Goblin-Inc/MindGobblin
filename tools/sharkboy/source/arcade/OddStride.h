#pragma once

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <stdint.h>
#include <stddef.h>
#include <math.h>
#include <string.h>
#include <stdio.h>
#include <new>
#include "GameAPI.h"
#include "Hardware.h"
#include "MusicPlayer.h"
#include "MenuFooter.h"

#ifndef GAME_API_LIFECYCLE_VERSION
#error "Odd Stride requires the lifecycle-enabled GameAPI.h included with its install package."
#elif GAME_API_LIFECYCLE_VERSION < 1
#error "Odd Stride requires GAME_API_LIFECYCLE_VERSION >= 1."
#endif

#ifndef ODD_STRIDE_DEBUG
#define ODD_STRIDE_DEBUG 0
#endif
#ifndef ODD_STRIDE_PROFILE
#define ODD_STRIDE_PROFILE 0
#endif
#ifndef ODD_STRIDE_ENABLE_SFX
#define ODD_STRIDE_ENABLE_SFX 1
#endif
#ifndef ODD_STRIDE_HOST_TEST
#define ODD_STRIDE_HOST_TEST 0
#endif
#ifndef ODD_STRIDE_TEST_FLAT_WORLD
#define ODD_STRIDE_TEST_FLAT_WORLD 0
#endif

namespace OddStride {

// -----------------------------------------------------------------------------
// Central configuration
// -----------------------------------------------------------------------------
static const float PI_F = 3.14159265358979323846f;
static const float DEG = PI_F / 180.0f;
static const uint32_t LOGICAL_TICK_US = 10000u;
// Deliberate slow-motion play mode. Physics still uses the exact same 5 ms
// substeps and solver quality; only the rate at which wall-clock time is fed
// into the simulation is reduced. 1/2 means 50% speed (2 real seconds per
// simulated second), giving the player substantially more reaction time.
static const uint32_t TIME_SCALE_NUM = 1u;
static const uint32_t TIME_SCALE_DEN = 2u;
static const float SUBSTEP_H = 0.005f;
static const uint8_t VELOCITY_ITERS = 12;
static const uint8_t POSITION_ITERS = 4;
static const float GRAVITY = 9.81f;
static const float MAX_COM_SPEED = 6.0f;
static const float MAX_ANGULAR_SPEED = 12.0f;
static const float LINEAR_DAMPING = 0.03f;
static const float ANGULAR_DAMPING = 0.08f;
static const float HIP_TORQUE = 5.0f;
static const float HIP_DAMPING = 0.40f;
static const float KNEE_RELEASED = 0.10f;
static const float KNEE_HELD = 2.10f;
static const float KNEE_FREQ = 7.0f;
static const float KNEE_ZETA = 1.0f;
static const float KNEE_TORQUE = 16.0f;
static const float KNEE_SLEW = 6.0f;
static const float ANKLE_FREQ = 3.0f;
static const float ANKLE_ZETA = 0.9f;
static const float ANKLE_TORQUE = 1.8f;
static const float TORSO_K = 12.0f;
static const float TORSO_D = 1.8f;
static const float TORSO_CAP = 2.5f;
static const float FOOT_MU = 0.65f;
static const float BODY_MU = 0.45f;
static const float CONTACT_SLOP = 0.003f;
static const float JOINT_SLOP = 0.001f;
static const float ANGULAR_SLOP = 1.0f * DEG;
static const float POSITION_FRACTION = 0.35f;
static const float MAX_CONTACT_CORRECTION = 0.015f;
static const float MAX_ANCHOR_CORRECTION = 0.020f;
static const float MAX_ANGULAR_CORRECTION = 3.0f * DEG;
static const float WARM_SCALE = 0.85f;
static const float CACHE_NORMAL_DOT = 0.98f;
static const float CACHE_LOCAL_DISTANCE = 0.025f;
static const float HEAD_FAIL_TIME = 0.040f;
static const float UPPER_FAIL_TIME = 0.70f;
static const float PIT_Y = -2.2f;
static const float FALL_SETTLE_TIME = 0.45f;
static const float PIXELS_PER_METER = 72.0f;
static const uint32_t INITIAL_FRAME_US = 33333u;
static const uint32_t RENDER_SLICE_US = 3200u;
static const uint8_t MAX_TRANSFER_TILES_PER_SLICE = 16;
static const uint32_t CONTROL_DEBOUNCE_US = 6000u;
static const uint32_t READY_CENTER_US = 200000u;
static const uint32_t TAP_MAX_US = 600000u;
static const uint32_t COURSE_SEED = 0x4F444453u;

static const uint8_t BODY_COUNT = 7;
static const uint8_t JOINT_COUNT = 6;
static const uint8_t PROBE_COUNT = 44;
static const uint8_t MAX_CONTACTS = 56;
static const uint8_t MAX_CONTACTS_PER_BODY = 8;
static const uint8_t MAX_RAW_CONTACTS = 64;
static const uint8_t CHUNK_COUNT = 8;
static const uint8_t MAX_SPANS = 20;
static const uint8_t MAX_EDGES = 24;
static const uint8_t MAX_SCREEN_SHAPES = 48;
static const uint8_t MAX_VISIBLE_EDGES = 64;
static const uint8_t MAX_SOUND_EVENTS = 8;
static const uint8_t CONTROL_QUEUE_CAP = 32;
static const uint16_t TILE_W = 16;
static const uint16_t TILE_H = 16;
static const uint16_t TILES_X = 15;
static const uint16_t TILES_Y = 20;
static const uint16_t TILE_COUNT = 300;
static const uint16_t PACKED_TILE_BYTES = 128;
static const uint32_t PANEL_CACHE_BYTES = 38400u;

// RGB565 palette, indexed by 4-bit values in the retained renderer.
static uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) {
  return (uint16_t)(((r & 0xF8u) << 8) | ((g & 0xFCu) << 3) | (b >> 3));
}
static const uint16_t PALETTE[16] = {
  (uint16_t)((0xF1u & 0xF8u)<<8 | (0xE4u & 0xFCu)<<3 | 0xC9u>>3),
  (uint16_t)((0x17u & 0xF8u)<<8 | (0x2Du & 0xFCu)<<3 | 0x3Bu>>3),
  (uint16_t)((0xBFu & 0xF8u)<<8 | (0x5Au & 0xFCu)<<3 | 0x45u>>3),
  (uint16_t)((0x36u & 0xF8u)<<8 | (0x7Fu & 0xFCu)<<3 | 0x82u>>3),
  (uint16_t)((0xCCu & 0xF8u)<<8 | (0xA4u & 0xFCu)<<3 | 0x5Cu>>3),
  (uint16_t)((0xDDu & 0xF8u)<<8 | (0xCFu & 0xFCu)<<3 | 0xB1u>>3),
  (uint16_t)((0xAAu & 0xF8u)<<8 | (0xBBu & 0xFCu)<<3 | 0xB0u>>3),
  (uint16_t)((0xFAu & 0xF8u)<<8 | (0xF3u & 0xFCu)<<3 | 0xE3u>>3),
  (uint16_t)((0x86u & 0xF8u)<<8 | (0x3Du & 0xFCu)<<3 | 0x35u>>3),
  (uint16_t)((0x24u & 0xF8u)<<8 | (0x57u & 0xFCu)<<3 | 0x5Du>>3),
  (uint16_t)((0x35u & 0xF8u)<<8 | (0x4Cu & 0xFCu)<<3 | 0x59u>>3),
  (uint16_t)((0xDFu & 0xF8u)<<8 | (0xABu & 0xFCu)<<3 | 0x85u>>3),
  (uint16_t)((0x75u & 0xF8u)<<8 | (0x92u & 0xFCu)<<3 | 0x8Cu>>3),
  (uint16_t)((0xE7u & 0xF8u)<<8 | (0xBEu & 0xFCu)<<3 | 0x69u>>3),
  (uint16_t)((0xCBu & 0xF8u)<<8 | (0x30u & 0xFCu)<<3 | 0x2Fu>>3),
  (uint16_t)((0x13u & 0xF8u)<<8 | (0x24u & 0xFCu)<<3 | 0x2Du>>3)
};

enum BodyId : uint8_t { TORSO, L_THIGH, L_SHIN, L_FOOT, R_THIGH, R_SHIN, R_FOOT };
enum JointId : uint8_t { L_HIP, L_KNEE, L_ANKLE, R_HIP, R_KNEE, R_ANKLE };
enum ProbeTag : uint8_t { TAG_PELVIS, TAG_TORSO, TAG_UPPER_TORSO, TAG_HEAD, TAG_THIGH, TAG_KNEE, TAG_SHIN, TAG_FOOT };
enum class Phase : uint8_t { INTRO, READY, PLAYING, FALLEN, GAME_OVER, RESOURCE_ERROR };
enum FailureReason : uint8_t { FAIL_NONE, FAIL_HEAD, FAIL_UPPER, FAIL_PIT, FAIL_NUMERIC, FAIL_COURSE_LIMIT };
enum FaultCode : uint8_t { FAULT_NONE, FAULT_NONFINITE, FAULT_CAPACITY, FAULT_ANCHOR, FAULT_PENETRATION, FAULT_LIMIT, FAULT_INPUT_QUEUE };

// -----------------------------------------------------------------------------
// Math and plain data
// -----------------------------------------------------------------------------
struct Vec2 { float x, y; };
struct Pose { Vec2 p; float angle; };
struct Mat22 { float xx, xy, yy; };
struct Aabb { Vec2 lo, hi; };

static Vec2 v2(float x, float y) { Vec2 v = {x,y}; return v; }
static Vec2 add(Vec2 a, Vec2 b) { return v2(a.x+b.x,a.y+b.y); }
static Vec2 sub(Vec2 a, Vec2 b) { return v2(a.x-b.x,a.y-b.y); }
static Vec2 mul(Vec2 a, float s) { return v2(a.x*s,a.y*s); }
static float dot(Vec2 a, Vec2 b) { return a.x*b.x+a.y*b.y; }
static float cross(Vec2 a, Vec2 b) { return a.x*b.y-a.y*b.x; }
static Vec2 perp(Vec2 a) { return v2(-a.y,a.x); }
static float len2(Vec2 a) { return dot(a,a); }
static float length(Vec2 a) { return sqrtf(len2(a)); }
static float clampf(float v,float lo,float hi){ return v<lo?lo:(v>hi?hi:v); }
static int16_t clampi16(int32_t v){ return (int16_t)(v < -32768 ? -32768 : (v > 32767 ? 32767 : v)); }
static Vec2 safeNormalize(Vec2 a, Vec2 fallback=v2(0,1)) { float l2=len2(a); return l2>1e-12f?mul(a,1.0f/sqrtf(l2)):fallback; }
static Vec2 rotate(Vec2 a,float s,float c){ return v2(c*a.x-s*a.y,s*a.x+c*a.y); }
static Vec2 rotateAngle(Vec2 a,float ang){ return rotate(a,sinf(ang),cosf(ang)); }
static Vec2 invRotateAngle(Vec2 a,float ang){ float s=sinf(ang),c=cosf(ang); return v2(c*a.x+s*a.y,-s*a.x+c*a.y); }
static float wrapPi(float a){ while(a>=PI_F)a-=2*PI_F; while(a< -PI_F)a+=2*PI_F; return a; }
static bool finitef(float x){ return isfinite(x); }
static bool finitev(Vec2 v){ return finitef(v.x)&&finitef(v.y); }
static bool aabbOverlap(const Aabb&a,const Aabb&b){ return a.lo.x<=b.hi.x&&a.hi.x>=b.lo.x&&a.lo.y<=b.hi.y&&a.hi.y>=b.lo.y; }
static bool inverse(const Mat22& k, Mat22& out){ float d=k.xx*k.yy-k.xy*k.xy; if(fabsf(d)<1e-9f)return false; float r=1.0f/d; out.xx=k.yy*r; out.xy=-k.xy*r; out.yy=k.xx*r; return true; }
static Vec2 mulMat(const Mat22&m,Vec2 v){ return v2(m.xx*v.x+m.xy*v.y,m.xy*v.x+m.yy*v.y); }

struct ControlState { int8_t hip[2]; bool kneeHeld[2]; };
static bool sameControl(const ControlState&a,const ControlState&b){ return a.hip[0]==b.hip[0]&&a.hip[1]==b.hip[1]&&a.kneeHeld[0]==b.kneeHeld[0]&&a.kneeHeld[1]==b.kneeHeld[1]; }
struct ControlEvent { uint64_t effectiveTick; ControlState state; };

struct SwitchFilter {
  SwitchState candidate, stable;
  uint32_t candidateSince;
  bool error;
};
struct ButtonFilter {
  bool candidate, stable;
  uint32_t candidateSince;
  bool pressedEdge, releasedEdge;
};
struct InputState {
  SwitchFilter sw[2];
  ButtonFilter btn[2];
  ControlState committed;
  ControlState lastQueued;
  ControlEvent queue[CONTROL_QUEUE_CAP];
  uint8_t queueCount;
  bool readyCentered;
  uint32_t centeredSince;
  bool tapActive;
  uint8_t tapButton;
  uint32_t tapStart;
  bool tapCanceled;
  bool retryReleaseSeen;
};

struct RigidBody {
  Pose pose, previousPose;
  Vec2 velocity;
  float angularVelocity;
  float invMass, invI;
  float s, c;
  Aabb aabb;
  uint8_t probeStart, probeCount;
};
struct CollisionProbe { Vec2 local; float radius; uint8_t body, probeId, tag; };

struct Joint {
  uint8_t a,b;
  Vec2 localA,localB;
  float sign,offset,qMin,qMax;
  Vec2 lambdaAnchor;
  float lambdaLower,lambdaUpper,lambdaMotor;
  float commandAngle,targetAngle;
  float motorFreq,motorZeta,maxTorque;
  Mat22 anchorKInv;
  float motorGamma,motorBias,motorMass;
  bool motorEnabled;
};

struct FeatureKey { int32_t chunk; uint8_t index; uint8_t kind; };
static bool sameFeature(const FeatureKey&a,const FeatureKey&b){ return a.chunk==b.chunk&&a.index==b.index&&a.kind==b.kind; }
struct Contact {
  FeatureKey feature;
  uint8_t body,probe;
  Vec2 normal,tangent,point,localPoint;
  float separation,normalMass,tangentMass;
  float lambdaN,lambdaT;
  float preSolveVn;
  bool actual,speculative;
};
struct RawContact {
  FeatureKey feature;
  uint8_t body,probe;
  Vec2 normal,point;
  float separation;
  bool speculative;
};
struct RawContactBuffer { RawContact items[MAX_RAW_CONTACTS]; uint8_t count; bool overflowActual; };
struct ContactSet { Contact items[MAX_CONTACTS]; uint8_t count; };

struct TopSpan { Vec2 a,b; uint8_t recipeSpan; };
struct TerrainEdge {
  Vec2 a,b,e,n;
  float length;
  Aabb aabb;
  int8_t prev,next;
  uint8_t localIndex;
};
struct TerrainChunk {
  int32_t absoluteIndex;
  uint8_t recipe;
  TopSpan spans[MAX_SPANS]; uint8_t spanCount;
  TerrainEdge edges[MAX_EDGES]; uint8_t edgeCount;
};
struct TerrainState {
  TerrainChunk chunks[CHUNK_COUNT];
  int32_t windowStart;
  int32_t originChunk;
  uint32_t seed;
  uint32_t generationCount,rebaseCount;
};

struct FootState {
  bool support,previousSupport;
  float airborneTime;
  uint32_t cooldownUntil;
  Vec2 contactPoint;
  float impactSpeed;
};
struct TouchSummary {
  bool footSupport[2];
  Vec2 footPoint[2];
  float footImpact[2];
  bool headTouch,upperTouch;
};
struct FailureState {
  float headTimer,upperTimer,settle;
  FailureReason reason;
  FaultCode fault;
  int64_t finalScoreMm;
  Pose lastFinite[BODY_COUNT];
  uint8_t anchorBadCount,insideBadCount,limitBadCount;
};
struct ScoreState { int64_t furthestMm,bestAtStartMm; int32_t shownTenths; int64_t nextMilestoneMm; };
struct CameraState { float x,groundY,prevX,prevGroundY,targetX,targetY,lastSolidY; };

struct ScreenPoint { int16_t x,y; };
enum ShapeType : uint8_t { SHAPE_QUAD, SHAPE_CIRCLE, SHAPE_DIAMOND, SHAPE_FOOT };
struct ScreenShape {
  ShapeType type;
  uint8_t fill,outline;
  ScreenPoint p[4];
  int16_t radius;
  int16_t minX,minY,maxX,maxY;
  uint8_t order;
};
struct VisibleEdge { ScreenPoint a,b; };
struct RenderSnapshot {
  Phase phase;
  FailureReason reason;
  ScreenShape shapes[MAX_SCREEN_SHAPES]; uint8_t shapeCount;
  VisibleEdge terrainEdges[MAX_VISIBLE_EDGES]; uint8_t terrainEdgeCount;
  int16_t terrainTop[240];
  uint8_t terrainGap[240];
  char distanceText[16],bestText[16],centerText[28],resultText[28];
  ControlState controls;
  bool support[2],newBest;
  float cameraX,cameraY;
};

class TileCanvas : public Adafruit_GFX {
public:
  TileCanvas() : Adafruit_GFX(240,320), buf_(nullptr), ox_(0), oy_(0) {}
  void bind(uint8_t* b,int16_t x,int16_t y){ buf_=b; ox_=x; oy_=y; }
  int16_t originX() const { return ox_; }
  int16_t originY() const { return oy_; }
  void drawPixel(int16_t x,int16_t y,uint16_t color) override {
    if(!buf_||x<ox_||x>=ox_+16||y<oy_||y>=oy_+16||x<0||x>=240||y<0||y>=320)return;
    uint16_t i=(uint16_t)(y-oy_)*16u+(uint16_t)(x-ox_);
    uint8_t &b=buf_[i>>1]; uint8_t c=(uint8_t)(color&0x0F);
    if((i&1)==0)b=(uint8_t)((b&0x0F)|(c<<4)); else b=(uint8_t)((b&0xF0)|c);
  }
  void writeFastHLine(int16_t x,int16_t y,int16_t w,uint16_t color) override { for(int16_t i=0;i<w;i++)drawPixel(x+i,y,color); }
  void writeFastVLine(int16_t x,int16_t y,int16_t h,uint16_t color) override { for(int16_t i=0;i<h;i++)drawPixel(x,y+i,color); }
  void writeFillRect(int16_t x,int16_t y,int16_t w,int16_t h,uint16_t color) override { for(int16_t yy=0;yy<h;yy++)writeFastHLine(x,y+yy,w,color); }
private:
  uint8_t* buf_; int16_t ox_,oy_;
};

struct RendererState {
  uint8_t retained[PANEL_CACHE_BYTES];
  uint8_t valid[(TILE_COUNT+7)/8];
  uint8_t candidate[PACKED_TILE_BYTES];
  uint16_t rgb[256];
  TileCanvas canvas;
  RenderSnapshot snapshot;
  bool frameActive,forceFrame;
  uint16_t nextTile;
  uint32_t frameStartUs,nextFrameUs,frameIntervalUs;
  uint16_t slow40,slow55,fastStreak,evalFrames;
  uint32_t changedTiles,bytesTransferred;
};

struct SoundEvent { uint16_t hz[2]; uint16_t durationMs; uint8_t priority; uint32_t startUs; };
struct AudioState { SoundEvent queue[MAX_SOUND_EVENTS]; uint8_t count; bool active; SoundEvent current; uint32_t deadlineUs; uint32_t hardCooldownUntil; };
struct TimingState {
  uint32_t lastRawUs;
  uint64_t acceptedTimelineUs,nextTick;
  uint32_t droppedWallUs,maxBacklogUs;
};
struct ProfileStats { uint32_t ticks,velocityClamps,contactReductionCount,numericFaults; uint32_t maxTickUs,maxContacts; };

struct Context {
  RigidBody bodies[BODY_COUNT];
  CollisionProbe probes[PROBE_COUNT];
  Joint joints[JOINT_COUNT];
  TerrainState terrain;
  ContactSet contacts,previousContacts;
  RawContactBuffer raw;
  InputState input;
  FootState feet[2];
  FailureState failure;
  ScoreState score;
  CameraState camera;
  RendererState renderer;
  AudioState audio;
  TimingState timing;
  ProfileStats profile;
  Phase phase;
  uint32_t phaseEnteredUs;
  bool actuationEnabled;
  bool lastSupportAny;
  bool newBest;
};

static_assert(sizeof(Context) <= 96u*1024u, "OddStride context too large");

static Context* context = nullptr;
static int64_t sessionBestMm = 0;
static bool allocationFailed = false;

// -----------------------------------------------------------------------------
// Utility/platform boundary
// -----------------------------------------------------------------------------
static uint32_t readClockUs(){ return micros(); }
static SwitchState readRawSwitch(uint8_t upPin,uint8_t downPin){
  bool up=digitalRead(upPin)==LOW, down=digitalRead(downPin)==LOW;
  if(up&&!down)return SWITCH_UP; if(!up&&down)return SWITCH_DOWN;
  if(!up&&!down)return SWITCH_CENTER; return SWITCH_ERROR;
}
static void blitTile(int16_t x,int16_t y,uint16_t* rgb){ display.drawRGBBitmap(x,y,rgb,16,16); }
static void setBuzzer(uint8_t voice,uint16_t hz){
#if ODD_STRIDE_ENABLE_SFX
  if (!Music::gameEffectsAllowed()) return;
  if(voice>=2)return;
  uint8_t pin=voice==0?BUZZER_2_PIN:BUZZER_1_PIN;
  uint8_t vol=gameAudioVolume(); if(vol>100)vol=100;
  if(hz){ ledcWriteTone(pin,hz); ledcWrite(pin,Music::dutyForVolume(vol)); }
  else { ledcWriteTone(pin,0); ledcWrite(pin,0); }
#else
  (void)voice; (void)hz;
#endif
}
static void drawResourceError(){
  display.setRotation(0); display.setTextWrap(false); display.setFont(nullptr);
  display.fillScreen(PALETTE[0]); display.setTextColor(PALETTE[1]); display.setTextSize(2);
  display.setCursor(14,105); display.print("ODD STRIDE");
  display.setTextSize(1); display.setCursor(42,154); display.print("NOT ENOUGH MEMORY");
  MenuFooter::draw(display);
}

// -----------------------------------------------------------------------------
// Terrain recipes and deterministic streaming
// -----------------------------------------------------------------------------
struct RecipePoint { float x,y; };

static void clearChunk(TerrainChunk& c,int32_t index,uint8_t recipe){ c.absoluteIndex=index;c.recipe=recipe;c.spanCount=0;c.edgeCount=0; }
static bool addSpan(TerrainChunk& c,Vec2 a,Vec2 b,uint8_t id){
  if(c.spanCount>=MAX_SPANS||b.x<=a.x)return false;
  TopSpan&s=c.spans[c.spanCount++];s.a=a;s.b=b;s.recipeSpan=id;return true;
}
static bool addEdge(TerrainChunk& c,Vec2 a,Vec2 b){
  if(c.edgeCount>=MAX_EDGES)return false; Vec2 d=sub(b,a); float L=length(d); if(L<1e-7f)return false;
  TerrainEdge&e=c.edges[c.edgeCount]; e.a=a;e.b=b;e.length=L;e.e=mul(d,1.0f/L);e.n=v2(-e.e.y,e.e.x);
  e.aabb.lo=v2(fminf(a.x,b.x),fminf(a.y,b.y));e.aabb.hi=v2(fmaxf(a.x,b.x),fmaxf(a.y,b.y));
  e.prev=-1;e.next=-1;e.localIndex=c.edgeCount;c.edgeCount++;return true;
}
static bool buildChain(TerrainChunk& c,const RecipePoint* p,uint8_t n,float baseX,uint8_t& spanId){
  for(uint8_t i=0;i+1<n;i++){
    Vec2 a=v2(baseX+p[i].x,p[i].y),b=v2(baseX+p[i+1].x,p[i+1].y);
    if(!addEdge(c,a,b))return false;
    if(fabsf(b.x-a.x)>1e-7f){ if(!addSpan(c,a,b,spanId++))return false; }
  }
  for(uint8_t i=0;i<c.edgeCount;i++){ if(i>0)c.edges[i].prev=(int8_t)(i-1); if(i+1<c.edgeCount)c.edges[i].next=(int8_t)(i+1); }
  return true;
}
static uint32_t hashChunk(int32_t index){
  uint32_t x=COURSE_SEED ^ ((uint32_t)index*0x9E3779B9u);
  x^=x>>16; x*=0x7FEB352Du; x^=x>>15; x*=0x846CA68Bu; x^=x>>16; return x;
}
static uint8_t chooseRecipe(int32_t index){
#if ODD_STRIDE_TEST_FLAT_WORLD
  (void)index; return 0;
#else
  if(index<0)return 0;
  static const uint8_t first20[20]={0,0,1,2,1,3,4,5,6,7,6,9,10,9,11,12,11,14,17,15};
  if(index<20)return first20[index];
  if((index&3)==0)return 0;
  static const uint8_t late[12]={3,4,5,7,8,9,10,12,13,14,15,16};
  return late[hashChunk(index)%12u];
#endif
}

static bool buildChunk(TerrainChunk& c,int32_t index,int32_t originChunk){
  uint8_t r=chooseRecipe(index); clearChunk(c,index,r); float bx=(float)(index-originChunk)*5.0f; uint8_t sid=0;
#define CHAIN(arr) do{ if(!buildChain(c,arr,(uint8_t)(sizeof(arr)/sizeof(arr[0])),bx,sid))return false; }while(0)
  switch(r){
    case 0:{ static const RecipePoint p[]={{0,0},{5,0}}; CHAIN(p); }break;
    case 1:{ static const RecipePoint p[]={{0,0},{1.2f,0},{2,0.10f},{2.8f,0.10f},{3.6f,0},{5,0}}; CHAIN(p); }break;
    case 2:{ static const RecipePoint p[]={{0,0},{1.2f,0},{2,-0.10f},{2.8f,-0.10f},{3.6f,0},{5,0}}; CHAIN(p); }break;
    case 3:{ static const RecipePoint p[]={{0,0},{1,0},{2.2f,0.24f},{2.8f,0.24f},{4,0},{5,0}}; CHAIN(p); }break;
    case 4:{ static const RecipePoint p[]={{0,0},{1,0},{2.2f,-0.24f},{2.8f,-0.24f},{4,0},{5,0}}; CHAIN(p); }break;
    case 5:{ static const RecipePoint p[]={{0,0},{1.3f,0},{2.1f,0.32f},{2.7f,0.32f},{3.5f,0},{5,0}}; CHAIN(p); }break;
    case 6:{ static const RecipePoint p[]={{0,0},{1.8f,0},{1.8f,0.10f},{2.8f,0.10f},{2.8f,0},{5,0}}; CHAIN(p); }break;
    case 7:{ static const RecipePoint p[]={{0,0},{2,0},{2,0.14f},{2.30f,0.14f},{2.30f,0},{5,0}}; CHAIN(p); }break;
    case 8:{ static const RecipePoint p[]={{0,0},{2,0},{2,0.22f},{2.30f,0.22f},{2.30f,0},{5,0}}; CHAIN(p); }break;
    case 9:{ static const RecipePoint p[]={{0,0},{1.4f,0},{1.4f,.12f},{1.8f,.12f},{1.8f,.24f},{2.6f,.24f},{2.6f,.12f},{3,.12f},{3,0},{5,0}}; CHAIN(p); }break;
    case 10:{ static const RecipePoint p[]={{0,0},{1,0},{1,.10f},{1.35f,.10f},{1.35f,.20f},{1.70f,.20f},{1.70f,.30f},{2.05f,.30f},{2.05f,.40f},{2.75f,.40f},{2.75f,.30f},{3.10f,.30f},{3.10f,.20f},{3.45f,.20f},{3.45f,.10f},{3.80f,.10f},{3.80f,0},{5,0}}; CHAIN(p); }break;
    case 11:
    case 12:
    case 13:{
      float ax=r==11?2.44f:(r==12?2.56f:2.66f);
      static const RecipePoint l[]={{0,0},{2.2f,0}}; RecipePoint rr[2]={{ax,0},{5,0}};
      CHAIN(l); uint8_t leftEdges=c.edgeCount; if(!buildChain(c,rr,2,bx,sid))return false;
      // chain builder linked across gap; sever it and add two downward walls.
      if(leftEdges&&leftEdges<c.edgeCount){c.edges[leftEdges-1].next=-1;c.edges[leftEdges].prev=-1;}
      if(!addEdge(c,v2(bx+2.2f,0),v2(bx+2.2f,-4)))return false;
      if(!addEdge(c,v2(bx+ax,-4),v2(bx+ax,0)))return false;
    }break;
    case 14:{ static const RecipePoint p[]={{0,0},{1.2f,0},{1.2f,.10f},{1.6f,.10f},{1.6f,0},{2,0},{2,.16f},{2.5f,.16f},{2.5f,.06f},{2.9f,.06f},{2.9f,.12f},{3.3f,.12f},{3.3f,0},{5,0}}; CHAIN(p); }break;
    case 15:{ static const RecipePoint p[]={{0,0},{.9f,0},{1.8f,.18f},{2.3f,.18f},{2.3f,.30f},{2.65f,.30f},{2.65f,.18f},{3,.18f},{3.9f,0},{5,0}}; CHAIN(p); }break;
    case 16:{
      static const RecipePoint l[]={{0,0},{1.8f,0}}; static const RecipePoint rr[]={{2.14f,0},{2.7f,.12f},{3.3f,.12f},{4,0},{5,0}};
      CHAIN(l); uint8_t leftEdges=c.edgeCount; if(!buildChain(c,rr,(uint8_t)(sizeof(rr)/sizeof(rr[0])),bx,sid))return false;
      if(leftEdges&&leftEdges<c.edgeCount){c.edges[leftEdges-1].next=-1;c.edges[leftEdges].prev=-1;}
      if(!addEdge(c,v2(bx+1.8f,0),v2(bx+1.8f,-4)))return false;
      if(!addEdge(c,v2(bx+2.14f,-4),v2(bx+2.14f,0)))return false;
    }break;
    case 17:{ static const RecipePoint p[]={{0,0},{1.2f,0},{1.2f,-.10f},{1.6f,-.10f},{1.6f,-.20f},{2.5f,-.20f},{2.5f,-.10f},{2.9f,-.10f},{2.9f,0},{5,0}}; CHAIN(p); }break;
    default:return false;
  }
#undef CHAIN
  return true;
}

static bool validateChunk(const TerrainChunk& c){
  if(c.spanCount>MAX_SPANS||c.edgeCount>MAX_EDGES)return false;
  for(uint8_t i=0;i<c.spanCount;i++)if(c.spans[i].b.x<=c.spans[i].a.x)return false;
  for(uint8_t i=0;i<c.edgeCount;i++)if(c.edges[i].length<=0||!finitev(c.edges[i].n))return false;
  return true;
}
static TerrainChunk* findChunk(TerrainState&t,int32_t idx){ for(uint8_t i=0;i<CHUNK_COUNT;i++)if(t.chunks[i].absoluteIndex==idx)return&t.chunks[i]; return nullptr; }
static const TerrainChunk* findChunk(const TerrainState&t,int32_t idx){ for(uint8_t i=0;i<CHUNK_COUNT;i++)if(t.chunks[i].absoluteIndex==idx)return&t.chunks[i]; return nullptr; }
static void linkChunkNeighbors(TerrainState& t){
  for(uint8_t c=0;c<CHUNK_COUNT;c++){
    TerrainChunk& ch=t.chunks[c];
    for(uint8_t i=0;i<ch.edgeCount;i++){
      if(ch.edges[i].prev>=0||ch.edges[i].next>=0)continue;
      // Gap-wall endpoints intentionally stay disconnected; ordinary seam caps are
      // rejected by the collinearity test in vertex generation.
    }
  }
}
static bool surfaceHeightAt(const TerrainState&t,float x,float&y){
  int32_t idx=t.originChunk+(int32_t)floorf(x/5.0f); const TerrainChunk*c=findChunk(t,idx);
  if(!c)return false; bool found=false; float best=-1e9f;
  for(uint8_t i=0;i<c->spanCount;i++){
    const TopSpan&s=c->spans[i]; const float eps=1e-5f;
    if(x+eps<s.a.x||x-eps>s.b.x)continue;
    float u=(x-s.a.x)/(s.b.x-s.a.x); u=clampf(u,0,1); float yy=s.a.y+u*(s.b.y-s.a.y);
    if(!found||yy>best){best=yy;found=true;}
  }
  if(found)y=best; return found;
}
static bool isSolidAt(const TerrainState&t,Vec2 p){ float y; return surfaceHeightAt(t,p.x,y)&&p.y<=y+1e-5f; }
static bool nearestExposedBoundary(const TerrainState&t,Vec2 p,FeatureKey&key,Vec2&q,Vec2&n,float&dist){
  bool found=false; float best=1e9f;
  for(uint8_t ci=0;ci<CHUNK_COUNT;ci++){
    const TerrainChunk&c=t.chunks[ci];
    for(uint8_t i=0;i<c.edgeCount;i++){
      const TerrainEdge&e=c.edges[i]; Vec2 d=sub(p,e.a); float u=clampf(dot(d,e.e),0,e.length); Vec2 qq=add(e.a,mul(e.e,u)); float dd=length(sub(p,qq));
      if(dd<best){best=dd;q=qq;n=e.n;key.chunk=c.absoluteIndex;key.index=i;key.kind=0;found=true;}
    }
  }
  dist=best; return found;
}

// -----------------------------------------------------------------------------
// Bodies, probes, joints, and reset construction
// -----------------------------------------------------------------------------
static void setBody(Context&c,uint8_t id,float mass,float inertia,uint8_t start,uint8_t count){
  RigidBody&b=c.bodies[id]; b.invMass=1.0f/mass;b.invI=1.0f/inertia;b.probeStart=start;b.probeCount=count;b.velocity=v2(0,0);b.angularVelocity=0;b.s=0;b.c=1;
}
static void addProbe(Context&c,uint8_t&idx,uint8_t body,Vec2 local,float radius,ProbeTag tag){ CollisionProbe&p=c.probes[idx];p.local=local;p.radius=radius;p.body=body;p.probeId=idx;p.tag=(uint8_t)tag;idx++; }
static void setJoint(Context&c,uint8_t id,uint8_t a,uint8_t b,Vec2 la,Vec2 lb,float sign,float qmin,float qmax,float freq,float zeta,float torque,bool motor){
  Joint&j=c.joints[id]; memset(&j,0,sizeof(Joint)); j.a=a;j.b=b;j.localA=la;j.localB=lb;j.sign=sign;j.qMin=qmin;j.qMax=qmax;j.motorFreq=freq;j.motorZeta=zeta;j.maxTorque=torque;j.motorEnabled=motor;
}
static void initializeBodyDefinitions(Context&c){
  uint8_t p=0;
  setBody(c,TORSO,8.0f,.52f,p,6); addProbe(c,p,TORSO,v2(0,-.24f),.14f,TAG_PELVIS);addProbe(c,p,TORSO,v2(0,-.12f),.14f,TAG_TORSO);addProbe(c,p,TORSO,v2(0,0),.14f,TAG_TORSO);addProbe(c,p,TORSO,v2(0,.12f),.13f,TAG_UPPER_TORSO);addProbe(c,p,TORSO,v2(0,.24f),.12f,TAG_UPPER_TORSO);addProbe(c,p,TORSO,v2(0,.40f),.11f,TAG_HEAD);
  setBody(c,L_THIGH,1.8f,.030f,p,7); for(uint8_t i=0;i<7;i++)addProbe(c,p,L_THIGH,v2(0,-.195f+.065f*i),.065f,i==0?TAG_KNEE:TAG_THIGH);
  setBody(c,L_SHIN,1.0f,.0156f,p,7); for(uint8_t i=0;i<7;i++)addProbe(c,p,L_SHIN,v2(0,-.185f+(0.37f/6)*i),.050f,TAG_SHIN);
  setBody(c,L_FOOT,.45f,.00375f,p,5); for(uint8_t i=0;i<5;i++)addProbe(c,p,L_FOOT,v2(-.10f+.05f*i,0),.050f,TAG_FOOT);
  setBody(c,R_THIGH,1.8f,.030f,p,7); for(uint8_t i=0;i<7;i++)addProbe(c,p,R_THIGH,v2(0,-.195f+.065f*i),.065f,i==0?TAG_KNEE:TAG_THIGH);
  setBody(c,R_SHIN,1.0f,.0156f,p,7); for(uint8_t i=0;i<7;i++)addProbe(c,p,R_SHIN,v2(0,-.185f+(0.37f/6)*i),.050f,TAG_SHIN);
  setBody(c,R_FOOT,.45f,.00375f,p,5); for(uint8_t i=0;i<5;i++)addProbe(c,p,R_FOOT,v2(-.10f+.05f*i,0),.050f,TAG_FOOT);
  setJoint(c,L_HIP,TORSO,L_THIGH,v2(0,-.26f),v2(0,.215f),+1,-55*DEG,90*DEG,0,0,0,false);
  setJoint(c,L_KNEE,L_THIGH,L_SHIN,v2(0,-.215f),v2(0,.210f),-1,0,130*DEG,KNEE_FREQ,KNEE_ZETA,KNEE_TORQUE,true);
  setJoint(c,L_ANKLE,L_SHIN,L_FOOT,v2(0,-.210f),v2(-.04f,.045f),+1,-30*DEG,30*DEG,ANKLE_FREQ,ANKLE_ZETA,ANKLE_TORQUE,true);
  setJoint(c,R_HIP,TORSO,R_THIGH,v2(0,-.26f),v2(0,.215f),+1,-55*DEG,90*DEG,0,0,0,false);
  setJoint(c,R_KNEE,R_THIGH,R_SHIN,v2(0,-.215f),v2(0,.210f),-1,0,130*DEG,KNEE_FREQ,KNEE_ZETA,KNEE_TORQUE,true);
  setJoint(c,R_ANKLE,R_SHIN,R_FOOT,v2(0,-.210f),v2(-.04f,.045f),+1,-30*DEG,30*DEG,ANKLE_FREQ,ANKLE_ZETA,ANKLE_TORQUE,true);
}
static Vec2 toWorld(const RigidBody&b,Vec2 local){ return add(b.pose.p,rotate(local,b.s,b.c)); }
static Vec2 toLocal(const RigidBody&b,Vec2 world){ return invRotateAngle(sub(world,b.pose.p),b.pose.angle); }
static Vec2 pointVelocity(const RigidBody&b,Vec2 worldPoint){ return add(b.velocity,mul(perp(sub(worldPoint,b.pose.p)),b.angularVelocity)); }
static void refreshBodyTransform(RigidBody&b,const Context&c){
  b.s=sinf(b.pose.angle);b.c=cosf(b.pose.angle); b.aabb.lo=v2(1e9f,1e9f);b.aabb.hi=v2(-1e9f,-1e9f);
  for(uint8_t k=0;k<b.probeCount;k++){ const CollisionProbe&p=c.probes[b.probeStart+k]; Vec2 w=toWorld(b,p.local); b.aabb.lo.x=fminf(b.aabb.lo.x,w.x-p.radius);b.aabb.lo.y=fminf(b.aabb.lo.y,w.y-p.radius);b.aabb.hi.x=fmaxf(b.aabb.hi.x,w.x+p.radius);b.aabb.hi.y=fmaxf(b.aabb.hi.y,w.y+p.radius); }
}
static void refreshAll(Context&c){ for(uint8_t i=0;i<BODY_COUNT;i++)refreshBodyTransform(c.bodies[i],c); }
static void applyBodyImpulse(RigidBody&b,Vec2 impulse,Vec2 p){ b.velocity=add(b.velocity,mul(impulse,b.invMass));b.angularVelocity+=b.invI*cross(sub(p,b.pose.p),impulse); }
static float jointAngle(const Context&c,const Joint&j){ return j.sign*(c.bodies[j.b].pose.angle-c.bodies[j.a].pose.angle)+j.offset; }
static float jointSpeed(const Context&c,const Joint&j){ return j.sign*(c.bodies[j.b].angularVelocity-c.bodies[j.a].angularVelocity); }
static void applyAngularImpulse(Context&c,Joint&j,float J){ c.bodies[j.a].angularVelocity-=j.sign*c.bodies[j.a].invI*J; c.bodies[j.b].angularVelocity+=j.sign*c.bodies[j.b].invI*J; }
static Vec2 pelvisPosition(const Context&c){ const RigidBody&t=c.bodies[TORSO]; return toWorld(t,v2(0,-.26f)); }

static void buildLegPose(Context&c,uint8_t thigh,uint8_t shin,uint8_t foot,float ankleX,Vec2 hip,float q0){
  const float L1=.43f,L2=.42f; RigidBody&fb=c.bodies[foot]; fb.pose.angle=0;fb.pose.p=v2(ankleX+.04f,.052f);
  float ankleY=.097f; float phi=atan2f(ankleX-hip.x,hip.y-ankleY); float th=phi+atan2f(L2*sinf(q0),L1+L2*cosf(q0)); float sh=th-q0;
  c.bodies[thigh].pose.angle=th;c.bodies[thigh].pose.p=add(hip,rotateAngle(v2(0,-L1*.5f),th)); Vec2 knee=add(hip,rotateAngle(v2(0,-L1),th));
  c.bodies[shin].pose.angle=sh;c.bodies[shin].pose.p=add(knee,rotateAngle(v2(0,-L2*.5f),sh));
}
static void buildStartingPose(Context&c){
  const float q0=.10f,L1=.43f,L2=.42f; float reach2=L1*L1+L2*L2+2*L1*L2*cosf(q0); float py=.097f+sqrtf(fmaxf(0,reach2-.13f*.13f)); Vec2 pelvis=v2(0,py);
  c.bodies[TORSO].pose.angle=0;c.bodies[TORSO].pose.p=add(pelvis,v2(0,.26f));
  buildLegPose(c,L_THIGH,L_SHIN,L_FOOT,+.13f,pelvis,q0); buildLegPose(c,R_THIGH,R_SHIN,R_FOOT,-.13f,pelvis,q0);
  for(uint8_t i=0;i<BODY_COUNT;i++){c.bodies[i].velocity=v2(0,0);c.bodies[i].angularVelocity=0;c.bodies[i].previousPose=c.bodies[i].pose;}
  for(uint8_t i=0;i<JOINT_COUNT;i++){c.joints[i].lambdaAnchor=v2(0,0);c.joints[i].lambdaLower=c.joints[i].lambdaUpper=c.joints[i].lambdaMotor=0;}
  c.joints[L_KNEE].commandAngle=c.joints[R_KNEE].commandAngle=q0; c.joints[L_ANKLE].commandAngle=c.joints[R_ANKLE].commandAngle=0;
  refreshAll(c);
}

// -----------------------------------------------------------------------------
// Input filtering, terrain window, reset
// -----------------------------------------------------------------------------
static int8_t switchCommand(SwitchState s){ switch(s){case SWITCH_UP:return 1;case SWITCH_DOWN:return -1;case SWITCH_CENTER:return 0;default:return 0;} }
static void initializeInput(InputState&s,const GameInput&in,uint32_t now){
  SwitchState ls=readRawSwitch(LEFT_UP_PIN,LEFT_DOWN_PIN),rs=readRawSwitch(RIGHT_UP_PIN,RIGHT_DOWN_PIN);
  s.sw[0].candidate=s.sw[0].stable=ls;s.sw[0].candidateSince=now;s.sw[0].error=ls==SWITCH_ERROR;
  s.sw[1].candidate=s.sw[1].stable=rs;s.sw[1].candidateSince=now;s.sw[1].error=rs==SWITCH_ERROR;
  s.btn[0].candidate=s.btn[0].stable=in.leftButton;s.btn[0].candidateSince=now;s.btn[0].pressedEdge=s.btn[0].releasedEdge=false;
  s.btn[1].candidate=s.btn[1].stable=in.rightButton;s.btn[1].candidateSince=now;s.btn[1].pressedEdge=s.btn[1].releasedEdge=false;
  s.committed.hip[0]=switchCommand(ls);s.committed.hip[1]=switchCommand(rs);s.committed.kneeHeld[0]=in.leftButton;s.committed.kneeHeld[1]=in.rightButton;
  s.lastQueued=s.committed;s.queueCount=0;s.readyCentered=false;s.centeredSince=0;s.tapActive=false;s.tapCanceled=false;s.retryReleaseSeen=false;
}
static void updateSwitchFilter(SwitchFilter&f,SwitchState raw,uint32_t now){
  if(raw==SWITCH_ERROR){f.stable=SWITCH_ERROR;f.error=true;f.candidate=raw;f.candidateSince=now;return;}
  if(raw!=f.candidate){f.candidate=raw;f.candidateSince=now;return;}
  if((uint32_t)(now-f.candidateSince)>=CONTROL_DEBOUNCE_US){f.stable=raw;f.error=false;}
}
static void updateButtonFilter(ButtonFilter&f,bool raw,uint32_t now){
  f.pressedEdge=f.releasedEdge=false; if(raw!=f.candidate){f.candidate=raw;f.candidateSince=now;return;}
  if(raw!=f.stable&&(uint32_t)(now-f.candidateSince)>=CONTROL_DEBOUNCE_US){bool old=f.stable;f.stable=raw;f.pressedEdge=!old&&raw;f.releasedEdge=old&&!raw;}
}
static ControlState normalizeControls(const InputState&s){ ControlState c={{switchCommand(s.sw[0].stable),switchCommand(s.sw[1].stable)},{s.btn[0].stable,s.btn[1].stable}};return c; }
static void enqueueControl(Context&c,ControlState st,uint64_t tick){
  InputState&s=c.input; if(sameControl(st,s.lastQueued))return;
  if(s.queueCount&&s.queue[s.queueCount-1].effectiveTick==tick){s.queue[s.queueCount-1].state=st;s.lastQueued=st;return;}
  if(s.queueCount>=CONTROL_QUEUE_CAP){c.failure.fault=FAULT_INPUT_QUEUE;c.profile.numericFaults++;s.queue[CONTROL_QUEUE_CAP-1].state=st;s.lastQueued=st;return;}
  s.queue[s.queueCount].effectiveTick=tick;s.queue[s.queueCount].state=st;s.queueCount++;s.lastQueued=st;
}
static void commitControlsForTick(Context&c,uint64_t tick){
  InputState&s=c.input;uint8_t consume=0;while(consume<s.queueCount&&s.queue[consume].effectiveTick<=tick){s.committed=s.queue[consume].state;consume++;}
  if(consume){for(uint8_t i=consume;i<s.queueCount;i++)s.queue[i-consume]=s.queue[i];s.queueCount-=consume;}
}
static bool updateUiTap(InputState&s,uint32_t now){
  bool both=s.btn[0].stable&&s.btn[1].stable; if(both&&s.tapActive)s.tapCanceled=true;
  if(!s.tapActive){
    if(s.btn[0].pressedEdge&&!s.btn[1].stable){s.tapActive=true;s.tapButton=0;s.tapStart=now;s.tapCanceled=false;}
    else if(s.btn[1].pressedEdge&&!s.btn[0].stable){s.tapActive=true;s.tapButton=1;s.tapStart=now;s.tapCanceled=false;}
    return false;
  }
  if((uint32_t)(now-s.tapStart)>TAP_MAX_US)s.tapCanceled=true;
  ButtonFilter&b=s.btn[s.tapButton]; if(b.releasedEdge){bool ok=!s.tapCanceled;s.tapActive=false;return ok;} return false;
}
static void ensureTerrainWindow(Context&c){
  Vec2 p=pelvisPosition(c);int32_t center=c.terrain.originChunk+(int32_t)floorf(p.x/5.0f);int32_t start=center-2;
  if(c.terrain.windowStart==start&&findChunk(c.terrain,center))return;
  c.terrain.windowStart=start;
  for(uint8_t i=0;i<CHUNK_COUNT;i++){if(!buildChunk(c.terrain.chunks[i],start+i,c.terrain.originChunk)){c.failure.fault=FAULT_CAPACITY;}}
  linkChunkNeighbors(c.terrain);c.terrain.generationCount++;
  // Feature identities changed for potentially retired chunks; conservative cache reset.
  c.previousContacts.count=0;c.contacts.count=0;
}
static void rebaseWorldIfNeeded(Context&c){
  float px=pelvisPosition(c).x;float shift=0;int32_t chunkShift=0;if(px>24){shift=20;chunkShift=4;}else if(px<-12){shift=-20;chunkShift=-4;}else return;
  for(uint8_t i=0;i<BODY_COUNT;i++){c.bodies[i].pose.p.x-=shift;c.bodies[i].previousPose.p.x-=shift;}
  c.camera.x-=shift;c.camera.prevX-=shift;c.camera.targetX-=shift;
  c.terrain.originChunk+=chunkShift;c.terrain.rebaseCount++;c.terrain.windowStart=INT32_MIN;ensureTerrainWindow(c);refreshAll(c);
}
static void resetTiming(Context&c,uint32_t now){c.timing.lastRawUs=now;c.timing.acceptedTimelineUs=0;c.timing.nextTick=0;c.timing.maxBacklogUs=0;c.input.queueCount=0;c.input.lastQueued=c.input.committed;}
static void stopAudio();
static void resetRun(Context&c){
  uint32_t now=readClockUs(); initializeBodyDefinitions(c);buildStartingPose(c);
  c.terrain.originChunk=0;c.terrain.windowStart=INT32_MIN;c.terrain.seed=COURSE_SEED;c.terrain.generationCount=0;c.terrain.rebaseCount=0;ensureTerrainWindow(c);
  c.contacts.count=c.previousContacts.count=0;c.raw.count=0;
  c.failure.headTimer=c.failure.upperTimer=c.failure.settle=0;c.failure.reason=FAIL_NONE;c.failure.fault=FAULT_NONE;c.failure.anchorBadCount=c.failure.insideBadCount=c.failure.limitBadCount=0;
  for(uint8_t i=0;i<BODY_COUNT;i++)c.failure.lastFinite[i]=c.bodies[i].pose;
  c.score.furthestMm=0;c.score.bestAtStartMm=sessionBestMm;c.score.shownTenths=-1;c.score.nextMilestoneMm=10000;
  c.camera.x=0;c.camera.prevX=0;c.camera.targetX=0;c.camera.groundY=0;c.camera.prevGroundY=0;c.camera.targetY=0;c.camera.lastSolidY=0;
  memset(c.feet,0,sizeof(c.feet));c.lastSupportAny=false;c.newBest=false;c.actuationEnabled=true;
  c.input.readyCentered=false;c.input.centeredSince=0;c.input.queueCount=0;c.input.retryReleaseSeen=false;c.input.tapActive=false;
  resetTiming(c,now);stopAudio();
  c.renderer.frameActive=false;c.renderer.forceFrame=true;c.renderer.nextFrameUs=now;c.renderer.frameIntervalUs=INITIAL_FRAME_US;
}

// -----------------------------------------------------------------------------
// Collision geometry and contact generation
// -----------------------------------------------------------------------------
static float maxProbeRadiusFromCom(const Context&c,const RigidBody&b){float m=0;for(uint8_t k=0;k<b.probeCount;k++){const CollisionProbe&p=c.probes[b.probeStart+k];m=fmaxf(m,length(p.local)+p.radius);}return m;}
static void appendRawContact(Context&c,RawContactBuffer&b,const RawContact&r){
  for(uint8_t i=0;i<b.count;i++)if(b.items[i].body==r.body&&b.items[i].probe==r.probe&&sameFeature(b.items[i].feature,r.feature)&&dot(b.items[i].normal,r.normal)>.995f){if(r.separation<b.items[i].separation)b.items[i]=r;return;}
  if(b.count<MAX_RAW_CONTACTS){b.items[b.count++]=r;return;}
  int replace=-1;float shallow=-1e9f;for(uint8_t i=0;i<b.count;i++)if(b.items[i].speculative&&b.items[i].separation>shallow){shallow=b.items[i].separation;replace=i;}
  if(replace>=0&&(!r.speculative||r.separation<shallow)){b.items[replace]=r;return;} if(!r.speculative){b.overflowActual=true;c.failure.fault=FAULT_CAPACITY;}
}
struct ProbeWorld { Vec2 center;float radius;uint8_t body,probe; };
static bool pointNearEdgeAabb(Vec2 p,float r,const TerrainEdge&e){return p.x+r>=e.aabb.lo.x&&p.x-r<=e.aabb.hi.x&&p.y+r>=e.aabb.lo.y&&p.y-r<=e.aabb.hi.y;}
static void queryProbeFaces(Context&c,const ProbeWorld&pw,float margin){
  for(uint8_t ci=0;ci<CHUNK_COUNT;ci++){TerrainChunk&ch=c.terrain.chunks[ci];for(uint8_t i=0;i<ch.edgeCount;i++){TerrainEdge&e=ch.edges[i];if(!pointNearEdgeAabb(pw.center,pw.radius+margin,e))continue;
    float u=dot(sub(pw.center,e.a),e.e);if(u<0||u>e.length)continue;Vec2 q=add(e.a,mul(e.e,u));float d=dot(sub(pw.center,q),e.n);if(d<-.0001f)continue;float sep=d-pw.radius;if(sep>margin)continue;
    Vec2 mid=mul(add(q,pw.center),.5f);if(isSolidAt(c.terrain,mid)&&d>.002f)continue;
    RawContact r;r.feature={ch.absoluteIndex,i,0};r.body=pw.body;r.probe=pw.probe;r.normal=e.n;r.point=sub(pw.center,mul(e.n,pw.radius));r.separation=sep;r.speculative=sep>CONTACT_SLOP;appendRawContact(c,c.raw,r);
  }}
}
static void queryProbeVertices(Context&c,const ProbeWorld&pw,float margin){
  for(uint8_t ci=0;ci<CHUNK_COUNT;ci++){TerrainChunk&ch=c.terrain.chunks[ci];for(uint8_t i=0;i+1<ch.edgeCount;i++){TerrainEdge&a=ch.edges[i],&b=ch.edges[i+1];if(length(sub(a.b,b.a))>.0001f)continue;if(cross(a.e,b.e)>=-1e-5f)continue;Vec2 d=sub(pw.center,a.b);if(dot(d,a.e)<-1e-5f||dot(d,b.e)>1e-5f)continue;float L=length(d);float sep=L-pw.radius;if(sep>margin)continue;Vec2 n=safeNormalize(d,a.n);RawContact r;r.feature={ch.absoluteIndex,i,1};r.body=pw.body;r.probe=pw.probe;r.normal=n;r.point=sub(pw.center,mul(n,pw.radius));r.separation=sep;r.speculative=sep>CONTACT_SLOP;appendRawContact(c,c.raw,r);}}
}
static bool queryInsideProbe(Context&c,const ProbeWorld&pw){
  if(!isSolidAt(c.terrain,pw.center))return false;FeatureKey key;Vec2 q,n;float d;if(!nearestExposedBoundary(c.terrain,pw.center,key,q,n,d))return false;Vec2 out=sub(q,pw.center);n=d>1e-7f?mul(out,1.0f/d):n;
  RawContact r;r.feature=key;r.feature.kind=2;r.body=pw.body;r.probe=pw.probe;r.normal=n;r.point=sub(pw.center,mul(n,pw.radius));r.separation=-(d+pw.radius);r.speculative=false;appendRawContact(c,c.raw,r);if(d>.15f)c.failure.insideBadCount++;return true;
}
struct SweepHit{float t;Vec2 normal;FeatureKey feature;};
static bool sweepCircleAgainstEdge(Vec2 c0,Vec2 c1,float r,const TerrainEdge&e,FeatureKey key,SweepHit&hit){
  Vec2 v=sub(c1,c0);float denom=dot(v,e.n);if(denom>=-1e-8f)return false;float target=r+CONTACT_SLOP;float d0=dot(sub(c0,e.a),e.n);float t=(target-d0)/denom;if(t<0||t>1)return false;Vec2 c=add(c0,mul(v,t));float u=dot(sub(c,e.a),e.e);if(u<0||u>e.length)return false;hit.t=t;hit.normal=e.n;hit.feature=key;return true;
}
static const TerrainEdge* findEdge(const TerrainState&t,const FeatureKey&k){const TerrainChunk*c=findChunk(t,k.chunk);if(!c||k.index>=c->edgeCount)return nullptr;return &c->edges[k.index];}
static float freshSeparation(Context&c,uint8_t probeIndex,const FeatureKey&key,Vec2&n,Vec2&point){
  const CollisionProbe&p=c.probes[probeIndex];RigidBody&b=c.bodies[p.body];Vec2 center=toWorld(b,p.local);const TerrainEdge*e=findEdge(c.terrain,key);if(!e)return 1e6f;
  if(key.kind==1){Vec2 vertex=e->b;Vec2 d=sub(center,vertex);float L=length(d);n=safeNormalize(d,e->n);point=sub(center,mul(n,p.radius));return L-p.radius;}
  if(key.kind==2&&isSolidAt(c.terrain,center)){FeatureKey kk;Vec2 q;float d;if(nearestExposedBoundary(c.terrain,center,kk,q,n,d)){Vec2 out=sub(q,center);n=d>1e-7f?mul(out,1.0f/d):n;point=sub(center,mul(n,p.radius));return -(d+p.radius);}}
  float u=clampf(dot(sub(center,e->a),e->e),0,e->length);Vec2 q=add(e->a,mul(e->e,u));n=e->n;float d=dot(sub(center,q),n);point=sub(center,mul(n,p.radius));return d-p.radius;
}

static void prepareContact(Context&c,Contact&ct,float h){
  RigidBody&b=c.bodies[ct.body];Vec2 r=sub(ct.point,b.pose.p);ct.tangent=v2(-ct.normal.y,ct.normal.x);float rn=cross(r,ct.normal),rt=cross(r,ct.tangent);
  float kn=b.invMass+b.invI*rn*rn,kt=b.invMass+b.invI*rt*rt;ct.normalMass=kn>1e-9f?1.0f/kn:0;ct.tangentMass=kt>1e-9f?1.0f/kt:0;ct.localPoint=toLocal(b,ct.point);
  ct.preSolveVn=-dot(pointVelocity(b,ct.point),ct.normal);ct.actual=ct.separation<=CONTACT_SLOP;ct.speculative=!ct.actual; (void)h;
}
static void matchContactCache(ContactSet&cur,const ContactSet&prev){
  for(uint8_t i=0;i<cur.count;i++){Contact&n=cur.items[i];n.lambdaN=n.lambdaT=0;for(uint8_t j=0;j<prev.count;j++){const Contact&o=prev.items[j];if(n.body!=o.body||n.probe!=o.probe||!sameFeature(n.feature,o.feature))continue;if(dot(n.normal,o.normal)<CACHE_NORMAL_DOT)continue;if(length(sub(n.localPoint,o.localPoint))>CACHE_LOCAL_DISTANCE)continue;n.lambdaN=o.lambdaN*WARM_SCALE;n.lambdaT=o.lambdaT*WARM_SCALE;if(n.speculative)n.lambdaT=0;break;}}
}
static void addFinalContact(Context&c,const RawContact&r,float h){
  if(c.contacts.count>=MAX_CONTACTS){c.failure.fault=FAULT_CAPACITY;return;}Contact&ct=c.contacts.items[c.contacts.count++];ct.feature=r.feature;ct.body=r.body;ct.probe=r.probe;ct.normal=r.normal;ct.point=r.point;ct.separation=r.separation;ct.lambdaN=ct.lambdaT=0;prepareContact(c,ct,h);
}
static void reduceBodyManifold(Context&c,uint8_t body,float h){
  // Deep actual contacts first; then contacts with meaningfully different normals
  // or a wider tangent support span. This preserves corner normals and two-point feet.
  bool used[MAX_RAW_CONTACTS];memset(used,0,sizeof(used));uint8_t selected=0;
  while(selected<MAX_CONTACTS_PER_BODY){int best=-1;float score=-1e9f;for(uint8_t i=0;i<c.raw.count;i++){if(used[i])continue;const RawContact&r=c.raw.items[i];if(r.body!=body)continue;float s=(r.speculative?0.0f:1000.0f)-r.separation*100.0f;
      for(uint8_t j=0;j<c.contacts.count;j++){const Contact&k=c.contacts.items[j];if(k.body!=body)continue;float nd=dot(r.normal,k.normal);if(nd>.995f){Vec2 t=v2(-r.normal.y,r.normal.x);float span=fabsf(dot(sub(r.point,k.point),t));s+=span*25.0f-100.0f;}else s+=15.0f*(1.0f-nd);}
      if(s>score){score=s;best=i;}}
    if(best<0)break;used[best]=true;addFinalContact(c,c.raw.items[best],h);selected++;if(c.contacts.count>=MAX_CONTACTS)break;
  }
  uint8_t bodyRaw=0;for(uint8_t i=0;i<c.raw.count;i++)if(c.raw.items[i].body==body)bodyRaw++;if(bodyRaw>selected)c.profile.contactReductionCount++;
}
static void buildContacts(Context&c,float h){
  c.contacts.count=0;refreshAll(c);
  for(uint8_t body=0;body<BODY_COUNT;body++){
    c.raw.count=0;c.raw.overflowActual=false;RigidBody&b=c.bodies[body];float margin=(6.0f+12.0f*maxProbeRadiusFromCom(c,b))*h+.006f;
    for(uint8_t k=0;k<b.probeCount;k++){
      uint8_t pi=b.probeStart+k;const CollisionProbe&p=c.probes[pi];Vec2 center=toWorld(b,p.local);ProbeWorld pw={center,p.radius,body,pi};
      if(!queryInsideProbe(c,pw)){queryProbeFaces(c,pw,margin);queryProbeVertices(c,pw,margin);}
      Vec2 c1=add(center,mul(pointVelocity(b,center),h));
      for(uint8_t ci=0;ci<CHUNK_COUNT;ci++){TerrainChunk&ch=c.terrain.chunks[ci];for(uint8_t ei=0;ei<ch.edgeCount;ei++){TerrainEdge&e=ch.edges[ei];if(!pointNearEdgeAabb(center,p.radius+margin,e))continue;SweepHit sh;FeatureKey fk={ch.absoluteIndex,ei,0};if(sweepCircleAgainstEdge(center,c1,p.radius,e,fk,sh)){float d=dot(sub(center,e.a),sh.normal)-p.radius;RawContact r={sh.feature,body,pi,sh.normal,sub(center,mul(sh.normal,p.radius)),d,true};appendRawContact(c,c.raw,r);}}}
    }
    reduceBodyManifold(c,body,h);
  }
  matchContactCache(c.contacts,c.previousContacts);if(c.contacts.count>c.profile.maxContacts)c.profile.maxContacts=c.contacts.count;
}
static void preserveContactCache(Context&c){c.previousContacts=c.contacts;}

// -----------------------------------------------------------------------------
// Sequential impulse solver
// -----------------------------------------------------------------------------
static void prepareJoint(Context&c,Joint&j,float h){
  RigidBody&a=c.bodies[j.a];RigidBody&b=c.bodies[j.b];Vec2 rA=rotate(j.localA,a.s,a.c),rB=rotate(j.localB,b.s,b.c);float m=a.invMass+b.invMass;
  Mat22 K={m+a.invI*rA.y*rA.y+b.invI*rB.y*rB.y,-a.invI*rA.x*rA.y-b.invI*rB.x*rB.y,m+a.invI*rA.x*rA.x+b.invI*rB.x*rB.x};if(!inverse(K,j.anchorKInv))j.anchorKInv={0,0,0};
  if(j.motorEnabled&&j.maxTorque>0){float Krot=a.invI+b.invI;if(Krot>1e-9f){float mm=1.0f/Krot,w=2*PI_F*j.motorFreq,k=mm*w*w,cc=2*j.motorZeta*mm*w;j.motorGamma=1.0f/(h*(cc+h*k));j.motorBias=(jointAngle(c,j)-j.commandAngle)*h*k*j.motorGamma;j.motorMass=1.0f/(Krot+j.motorGamma);}else{j.motorGamma=j.motorBias=j.motorMass=0;}}
}
static void updateMotorCommands(Context&c,float h){
  Joint* knees[2]={&c.joints[L_KNEE],&c.joints[R_KNEE]};for(uint8_t i=0;i<2;i++){Joint&j=*knees[i];float target=c.input.committed.kneeHeld[i]?KNEE_HELD:KNEE_RELEASED;float delta=clampf(target-j.commandAngle,-KNEE_SLEW*h,KNEE_SLEW*h);if((target-j.commandAngle)*delta<0)j.lambdaMotor=0;j.commandAngle+=delta;j.targetAngle=target;}
  c.joints[L_ANKLE].commandAngle=0;c.joints[R_ANKLE].commandAngle=0;
}
static void applyExternalDynamics(Context&c,float h){
  for(uint8_t i=0;i<BODY_COUNT;i++){RigidBody&b=c.bodies[i];b.velocity.y-=GRAVITY*h;b.velocity=mul(b.velocity,1.0f/(1.0f+LINEAR_DAMPING*h));b.angularVelocity/=1.0f+ANGULAR_DAMPING*h;}
  if(c.actuationEnabled){
    Joint* hips[2]={&c.joints[L_HIP],&c.joints[R_HIP]};for(uint8_t i=0;i<2;i++){Joint&j=*hips[i];float J=HIP_TORQUE*(float)c.input.committed.hip[i]*h;applyAngularImpulse(c,j,J);float K=c.bodies[j.a].invI+c.bodies[j.b].invI;float qd=jointSpeed(c,j);float jd=-qd*(HIP_DAMPING*h)/(1.0f+HIP_DAMPING*h*K);applyAngularImpulse(c,j,jd);}
    if(c.lastSupportAny){RigidBody&t=c.bodies[TORSO];float a=wrapPi(t.pose.angle),aa=fabsf(a),fade=clampf((40*DEG-aa)/(20*DEG),0,1);float tau=fade*clampf(-TORSO_K*a-TORSO_D*t.angularVelocity,-TORSO_CAP,TORSO_CAP);t.angularVelocity+=h*t.invI*tau;}
  }else{
    Joint* hips[2]={&c.joints[L_HIP],&c.joints[R_HIP]};for(uint8_t i=0;i<2;i++){Joint&j=*hips[i];float K=c.bodies[j.a].invI+c.bodies[j.b].invI;float qd=jointSpeed(c,j);float jd=-qd*(HIP_DAMPING*h)/(1.0f+HIP_DAMPING*h*K);applyAngularImpulse(c,j,jd);}
  }
}
static void clampEmergencyVelocities(Context&c){for(uint8_t i=0;i<BODY_COUNT;i++){RigidBody&b=c.bodies[i];float L=length(b.velocity);if(L>MAX_COM_SPEED){b.velocity=mul(b.velocity,MAX_COM_SPEED/L);c.profile.velocityClamps++;}if(fabsf(b.angularVelocity)>MAX_ANGULAR_SPEED){b.angularVelocity=clampf(b.angularVelocity,-MAX_ANGULAR_SPEED,MAX_ANGULAR_SPEED);c.profile.velocityClamps++;}}}
static void warmStartJoints(Context&c){
  for(uint8_t i=0;i<JOINT_COUNT;i++){Joint&j=c.joints[i];RigidBody&a=c.bodies[j.a];RigidBody&b=c.bodies[j.b];j.lambdaAnchor=mul(j.lambdaAnchor,WARM_SCALE);Vec2 rA=rotate(j.localA,a.s,a.c),rB=rotate(j.localB,b.s,b.c);a.velocity=sub(a.velocity,mul(j.lambdaAnchor,a.invMass));a.angularVelocity-=a.invI*cross(rA,j.lambdaAnchor);b.velocity=add(b.velocity,mul(j.lambdaAnchor,b.invMass));b.angularVelocity+=b.invI*cross(rB,j.lambdaAnchor);
    float cap=j.maxTorque*SUBSTEP_H;j.lambdaMotor=clampf(j.lambdaMotor*WARM_SCALE,-cap,cap);if(c.actuationEnabled||i==L_ANKLE||i==R_ANKLE)applyAngularImpulse(c,j,j.lambdaMotor);else j.lambdaMotor=0;j.lambdaLower*=WARM_SCALE;j.lambdaUpper*=WARM_SCALE;applyAngularImpulse(c,j,j.lambdaLower-j.lambdaUpper);
  }
}
static void warmStartContacts(Context&c){for(uint8_t i=0;i<c.contacts.count;i++){Contact&ct=c.contacts.items[i];if(ct.speculative)ct.lambdaT=0;float lim=(ct.body==L_FOOT||ct.body==R_FOOT?FOOT_MU:BODY_MU)*ct.lambdaN;ct.lambdaT=clampf(ct.lambdaT,-lim,lim);applyBodyImpulse(c.bodies[ct.body],add(mul(ct.normal,ct.lambdaN),mul(ct.tangent,ct.lambdaT)),ct.point);}}
static void solveAnchorVelocity(Context&c,Joint&j){RigidBody&a=c.bodies[j.a];RigidBody&b=c.bodies[j.b];Vec2 rA=rotate(j.localA,a.s,a.c),rB=rotate(j.localB,b.s,b.c);Vec2 va=add(a.velocity,mul(perp(rA),a.angularVelocity)),vb=add(b.velocity,mul(perp(rB),b.angularVelocity));Vec2 dp=mul(mulMat(j.anchorKInv,sub(vb,va)),-1);j.lambdaAnchor=add(j.lambdaAnchor,dp);a.velocity=sub(a.velocity,mul(dp,a.invMass));a.angularVelocity-=a.invI*cross(rA,dp);b.velocity=add(b.velocity,mul(dp,b.invMass));b.angularVelocity+=b.invI*cross(rB,dp);}
static void solveMotorVelocity(Context&c,Joint&j,float h){if(!j.motorEnabled||j.maxTorque<=0)return;bool allowed=c.actuationEnabled||(j.maxTorque<=ANKLE_TORQUE+.001f);if(!allowed){j.lambdaMotor=0;return;}float qd=jointSpeed(c,j);float d=-j.motorMass*(qd+j.motorBias+j.motorGamma*j.lambdaMotor);float cap=j.maxTorque*h;float nl=clampf(j.lambdaMotor+d,-cap,cap);applyAngularImpulse(c,j,nl-j.lambdaMotor);j.lambdaMotor=nl;}
static void solveAngularLimitsVelocity(Context&c,Joint&j,float h){float K=c.bodies[j.a].invI+c.bodies[j.b].invI;if(K<1e-9f)return;float q=jointAngle(c,j),qd=jointSpeed(c,j);
  {float C=q-j.qMin;if(C<.15f||j.lambdaLower>0){float target=-fmaxf(C,0.0f)/h;float d=-(qd-target)/K;float nl=fmaxf(0,j.lambdaLower+d);applyAngularImpulse(c,j,nl-j.lambdaLower);j.lambdaLower=nl;}else j.lambdaLower=0;}
  {float C=j.qMax-q;if(C<.15f||j.lambdaUpper>0){float target=-fmaxf(C,0.0f)/h;float d=-((-qd)-target)/K;float nl=fmaxf(0,j.lambdaUpper+d);applyAngularImpulse(c,j,-(nl-j.lambdaUpper));j.lambdaUpper=nl;}else j.lambdaUpper=0;}
}
static void solveContactNormal(Context&c,Contact&ct,float h){RigidBody&b=c.bodies[ct.body];Vec2 r=sub(ct.point,b.pose.p);float vn=dot(add(b.velocity,mul(perp(r),b.angularVelocity)),ct.normal);float target=-fmaxf(ct.separation-CONTACT_SLOP,0.0f)/h;float d=-(vn-target)*ct.normalMass;float nl=fmaxf(0,ct.lambdaN+d);applyBodyImpulse(b,mul(ct.normal,nl-ct.lambdaN),ct.point);ct.lambdaN=nl;}
static void solveContactFriction(Context&c,Contact&ct){if(ct.speculative){ct.lambdaT=0;return;}RigidBody&b=c.bodies[ct.body];Vec2 r=sub(ct.point,b.pose.p);float vt=dot(add(b.velocity,mul(perp(r),b.angularVelocity)),ct.tangent);float d=-vt*ct.tangentMass;float mu=(ct.body==L_FOOT||ct.body==R_FOOT)?FOOT_MU:BODY_MU;float lim=mu*ct.lambdaN;float nl=clampf(ct.lambdaT+d,-lim,lim);applyBodyImpulse(b,mul(ct.tangent,nl-ct.lambdaT),ct.point);ct.lambdaT=nl;}
static void integrateBodies(Context&c,float h){for(uint8_t i=0;i<BODY_COUNT;i++){RigidBody&b=c.bodies[i];b.pose.p=add(b.pose.p,mul(b.velocity,h));b.pose.angle+=b.angularVelocity*h;}refreshAll(c);}
static void solveAnchorPosition(Context&c,Joint&j){RigidBody&a=c.bodies[j.a];RigidBody&b=c.bodies[j.b];Vec2 rA=rotateAngle(j.localA,a.pose.angle),rB=rotateAngle(j.localB,b.pose.angle);Vec2 C=sub(add(b.pose.p,rB),add(a.pose.p,rA));float L=length(C);if(L<=JOINT_SLOP)return;Vec2 corr=mul(C,POSITION_FRACTION*(L-JOINT_SLOP)/L);float cl=length(corr);if(cl>MAX_ANCHOR_CORRECTION)corr=mul(corr,MAX_ANCHOR_CORRECTION/cl);float m=a.invMass+b.invMass;Mat22 K={m+a.invI*rA.y*rA.y+b.invI*rB.y*rB.y,-a.invI*rA.x*rA.y-b.invI*rB.x*rB.y,m+a.invI*rA.x*rA.x+b.invI*rB.x*rB.x},invK; if(!inverse(K,invK))return;Vec2 P=mul(mulMat(invK,corr),-1);a.pose.p=sub(a.pose.p,mul(P,a.invMass));a.pose.angle-=a.invI*cross(rA,P);b.pose.p=add(b.pose.p,mul(P,b.invMass));b.pose.angle+=b.invI*cross(rB,P);}
static void solveAngularLimitPosition(Context&c,Joint&j){float q=jointAngle(c,j),err=0,sgn=0;if(q<j.qMin-ANGULAR_SLOP){err=(j.qMin-q)-ANGULAR_SLOP;sgn=1;}else if(q>j.qMax+ANGULAR_SLOP){err=(q-j.qMax)-ANGULAR_SLOP;sgn=-1;}else return;err=fminf(MAX_ANGULAR_CORRECTION,POSITION_FRACTION*err);float K=c.bodies[j.a].invI+c.bodies[j.b].invI;if(K<1e-9f)return;float P=err/K*sgn;c.bodies[j.a].pose.angle-=j.sign*c.bodies[j.a].invI*P;c.bodies[j.b].pose.angle+=j.sign*c.bodies[j.b].invI*P;}
static void solveContactPosition(Context&c,const Contact&old){Vec2 n,p;float sep=freshSeparation(c,old.probe,old.feature,n,p);float depth=fmaxf(-sep-CONTACT_SLOP,0.0f);if(depth<=0)return;RigidBody&b=c.bodies[old.body];Vec2 r=sub(p,b.pose.p);float k=b.invMass+b.invI*cross(r,n)*cross(r,n);if(k<1e-9f)return;float correction=fminf(POSITION_FRACTION*depth,MAX_CONTACT_CORRECTION),P=correction/k;b.pose.p=add(b.pose.p,mul(n,b.invMass*P));b.pose.angle+=b.invI*cross(r,n)*P;}

static float probeTerrainSeparation(Context&c,uint8_t probeIndex){
  const CollisionProbe&p=c.probes[probeIndex];const RigidBody&b=c.bodies[p.body];Vec2 center=toWorld(b,p.local);if(isSolidAt(c.terrain,center)){FeatureKey k;Vec2 q,n;float d;if(nearestExposedBoundary(c.terrain,center,k,q,n,d))return -(d+p.radius);return -p.radius;}
  float best=1e9f;
  for(uint8_t ci=0;ci<CHUNK_COUNT;ci++){TerrainChunk&ch=c.terrain.chunks[ci];for(uint8_t ei=0;ei<ch.edgeCount;ei++){TerrainEdge&e=ch.edges[ei];float u=clampf(dot(sub(center,e.a),e.e),0,e.length);Vec2 q=add(e.a,mul(e.e,u));float d=length(sub(center,q))-p.radius;if(d<best)best=d;}}
  return best;
}
static TouchSummary classifyFinalTouches(Context&c){
  TouchSummary t;memset(&t,0,sizeof(t));
  for(uint8_t i=0;i<c.contacts.count;i++){Contact&ct=c.contacts.items[i];if(!ct.actual||ct.separation>.004f||ct.normal.y<=.25f||ct.lambdaN<=.005f)continue;if(ct.body==L_FOOT){t.footSupport[0]=true;t.footPoint[0]=ct.point;t.footImpact[0]=fmaxf(t.footImpact[0],ct.preSolveVn);}if(ct.body==R_FOOT){t.footSupport[1]=true;t.footPoint[1]=ct.point;t.footImpact[1]=fmaxf(t.footImpact[1],ct.preSolveVn);}}
  for(uint8_t i=0;i<PROBE_COUNT;i++){const CollisionProbe&p=c.probes[i];if(p.tag!=TAG_HEAD&&p.tag!=TAG_UPPER_TORSO)continue;float sep=probeTerrainSeparation(c,i);if(p.tag==TAG_HEAD){if(sep<=.004f)t.headTouch=true;else if(c.failure.headTimer>0&&sep<=.008f)t.headTouch=true;}else{if(sep<=.004f)t.upperTouch=true;else if(c.failure.upperTimer>0&&sep<=.008f)t.upperTouch=true;}}
  return t;
}
static int64_t absolutePelvisMm(const Context&c){Vec2 p=pelvisPosition(c);return (int64_t)c.terrain.originChunk*5000LL+(int64_t)lroundf(p.x*1000.0f);}
static void updateScore(Context&c){int64_t mm=absolutePelvisMm(c);if(mm<0)mm=0;if(mm>c.score.furthestMm)c.score.furthestMm=mm;if(c.score.furthestMm>sessionBestMm)sessionBestMm=c.score.furthestMm;}
static void beginFailure(Context&c,FailureReason r);
static void updateFailureTimers(Context&c,float h,const TouchSummary&t){
  if(c.phase!=Phase::PLAYING&&c.phase!=Phase::FALLEN)return;
  if(c.phase==Phase::PLAYING){
    if(t.headTouch)c.failure.headTimer+=h;else c.failure.headTimer=0;
    if(t.upperTouch)c.failure.upperTimer+=h;else c.failure.upperTimer=fmaxf(0,c.failure.upperTimer-2*h);
    if(c.failure.headTimer>=HEAD_FAIL_TIME){beginFailure(c,FAIL_HEAD);return;}
    if(c.failure.upperTimer>=UPPER_FAIL_TIME){beginFailure(c,FAIL_UPPER);return;}
    if(pelvisPosition(c).y<PIT_Y){beginFailure(c,FAIL_PIT);return;}
  }
}
static bool checkNumericalHealth(Context&c){
  float maxAnchor=0,maxLimit=0,maxPen=0;
  for(uint8_t i=0;i<BODY_COUNT;i++){RigidBody&b=c.bodies[i];if(!finitev(b.pose.p)||!finitef(b.pose.angle)||!finitev(b.velocity)||!finitef(b.angularVelocity)){c.failure.fault=FAULT_NONFINITE;return false;}}
  for(uint8_t i=0;i<JOINT_COUNT;i++){Joint&j=c.joints[i];Vec2 a=toWorld(c.bodies[j.a],j.localA),b=toWorld(c.bodies[j.b],j.localB);maxAnchor=fmaxf(maxAnchor,length(sub(a,b)));float q=jointAngle(c,j);if(q<j.qMin)maxLimit=fmaxf(maxLimit,j.qMin-q);if(q>j.qMax)maxLimit=fmaxf(maxLimit,q-j.qMax);}
  for(uint8_t i=0;i<c.contacts.count;i++)if(c.contacts.items[i].separation<0)maxPen=fmaxf(maxPen,-c.contacts.items[i].separation);
  c.failure.anchorBadCount=maxAnchor>.10f?(uint8_t)(c.failure.anchorBadCount+1):0;c.failure.limitBadCount=maxLimit>20*DEG?(uint8_t)(c.failure.limitBadCount+1):0;c.failure.insideBadCount=maxPen>.15f?(uint8_t)(c.failure.insideBadCount+1):0;
  if(c.failure.anchorBadCount>=20){c.failure.fault=FAULT_ANCHOR;return false;}if(c.failure.limitBadCount>=20){c.failure.fault=FAULT_LIMIT;return false;}if(c.failure.insideBadCount>=4){c.failure.fault=FAULT_PENETRATION;return false;}
  for(uint8_t i=0;i<BODY_COUNT;i++)c.failure.lastFinite[i]=c.bodies[i].pose;return true;
}
static void handleNumericalFault(Context&c,FaultCode f){
  c.failure.fault=f;for(uint8_t i=0;i<BODY_COUNT;i++){c.bodies[i].pose=c.failure.lastFinite[i];c.bodies[i].previousPose=c.bodies[i].pose;c.bodies[i].velocity=v2(0,0);c.bodies[i].angularVelocity=0;}
  c.failure.reason=FAIL_NUMERIC;c.failure.finalScoreMm=c.score.furthestMm;c.phase=Phase::GAME_OVER;c.actuationEnabled=false;c.timing.acceptedTimelineUs=c.timing.nextTick*LOGICAL_TICK_US;c.renderer.frameActive=false;c.renderer.forceFrame=true;c.profile.numericFaults++;stopAudio();refreshAll(c);
}

static void queueSound(Context&c,const SoundEvent&e){
#if ODD_STRIDE_ENABLE_SFX
  if(c.audio.active&&e.priority>c.audio.current.priority){setBuzzer(0,0);setBuzzer(1,0);c.audio.active=false;}
  if(c.audio.count<MAX_SOUND_EVENTS){c.audio.queue[c.audio.count++]=e;return;}
  int drop=-1;uint8_t low=255;for(uint8_t i=0;i<c.audio.count;i++){if(c.audio.queue[i].priority<=low){low=c.audio.queue[i].priority;drop=i;}}if(drop>=0&&e.priority>low)c.audio.queue[drop]=e;
#else
  (void)c;(void)e;
#endif
}
static void queueTone(Context&c,uint16_t l,uint16_t r,uint16_t ms,uint8_t pri,uint32_t start){SoundEvent e={{l,r},ms,pri,start};queueSound(c,e);}
static void tickAudio(Context&c,uint32_t now){
#if ODD_STRIDE_ENABLE_SFX
  if(c.audio.active&&(int32_t)(now-c.audio.deadlineUs)>=0){setBuzzer(0,0);setBuzzer(1,0);c.audio.active=false;}
  if(c.audio.active)return;int best=-1;uint8_t pri=0;for(uint8_t i=0;i<c.audio.count;i++){if((int32_t)(now-c.audio.queue[i].startUs)<0)continue;if(best<0||c.audio.queue[i].priority>pri){best=i;pri=c.audio.queue[i].priority;}}
  if(best>=0){SoundEvent e=c.audio.queue[best];for(uint8_t i=best+1;i<c.audio.count;i++)c.audio.queue[i-1]=c.audio.queue[i];c.audio.count--;c.audio.current=e;c.audio.active=true;c.audio.deadlineUs=now+(uint32_t)e.durationMs*1000u;setBuzzer(0,e.hz[0]);setBuzzer(1,e.hz[1]);}
#else
  (void)c;(void)now;
#endif
}
static void stopAudio(){setBuzzer(0,0);setBuzzer(1,0);if(context){context->audio.count=0;context->audio.active=false;}}
static void updateContactEvents(Context&c,float h,const TouchSummary&t){
  uint32_t now=readClockUs();for(uint8_t i=0;i<2;i++){FootState&f=c.feet[i];f.previousSupport=f.support;f.support=t.footSupport[i];f.contactPoint=t.footPoint[i];f.impactSpeed=t.footImpact[i];if(!f.support)f.airborneTime+=h;
    if(f.support&&!f.previousSupport&&f.airborneTime>=.050f&&f.impactSpeed>=.35f&&(int32_t)(now-f.cooldownUntil)>=0){queueTone(c,i==0?220:0,i==1?277:0,18,1,now);f.cooldownUntil=now+120000u;}if(f.support)f.airborneTime=0;}
  float hard=0;for(uint8_t i=0;i<c.contacts.count;i++)if(c.contacts.items[i].actual)hard=fmaxf(hard,c.contacts.items[i].preSolveVn);if(hard>=1.2f&&(int32_t)(now-c.audio.hardCooldownUntil)>=0){queueTone(c,110,110,35,2,now);c.audio.hardCooldownUntil=now+180000u;}
}

static void finishFailure(Context&c){
  c.phase=Phase::GAME_OVER;c.phaseEnteredUs=readClockUs();c.actuationEnabled=false;c.input.retryReleaseSeen=false;c.timing.acceptedTimelineUs=c.timing.nextTick*LOGICAL_TICK_US;c.renderer.frameActive=false;c.renderer.forceFrame=true;
  c.newBest=c.failure.reason!=FAIL_NUMERIC&&c.failure.finalScoreMm>c.score.bestAtStartMm;uint32_t now=readClockUs();if(c.newBest){queueTone(c,523,523,55,3,now);queueTone(c,659,659,75,3,now+65000u);}else if(c.failure.reason!=FAIL_NUMERIC){queueTone(c,180,180,70,3,now);queueTone(c,120,120,90,3,now+80000u);}
}
static void beginFailure(Context&c,FailureReason r){
  if(c.phase!=Phase::PLAYING)return;updateScore(c);c.failure.finalScoreMm=c.score.furthestMm;c.failure.reason=r;c.failure.settle=0;c.phase=Phase::FALLEN;c.phaseEnteredUs=readClockUs();c.actuationEnabled=false;
  for(uint8_t i=0;i<JOINT_COUNT;i++){c.joints[i].lambdaMotor=0;}c.renderer.frameActive=false;c.renderer.forceFrame=true;
}

static void updateCamera(Context&c,float dt){
  Vec2 pelvis=pelvisPosition(c);float forward=fmaxf(c.camera.targetX,pelvis.x);float target=forward;float sx=96+PIXELS_PER_METER*(pelvis.x-c.camera.x);float tau=.10f;if(sx<36){target=pelvis.x-(48-96)/PIXELS_PER_METER;tau=.18f;}c.camera.targetX=target;float a=dt/(tau+dt);c.camera.prevX=c.camera.x;c.camera.x+=(target-c.camera.x)*a;
  float sum=0;uint8_t n=0;float y;float xs[3]={pelvis.x-.3f,pelvis.x+.3f,pelvis.x+.6f};for(uint8_t i=0;i<3;i++)if(surfaceHeightAt(c.terrain,xs[i],y)){sum+=y;n++;}if(n)c.camera.targetY=c.camera.lastSolidY=sum/n;else c.camera.targetY=c.camera.lastSolidY;c.camera.prevGroundY=c.camera.groundY;float ay=dt/(.35f+dt);c.camera.groundY+=(c.camera.targetY-c.camera.groundY)*ay;
}
static void rebaseAngles(Context&c){float a=c.bodies[TORSO].pose.angle;if(fabsf(a)<=8*PI_F)return;float k=floorf((a+PI_F)/(2*PI_F));float d=k*2*PI_F;for(uint8_t i=0;i<BODY_COUNT;i++){c.bodies[i].pose.angle-=d;c.bodies[i].previousPose.angle-=d;}}

static bool simulateSubstep(Context&c,float h){
  bool beganFallen=c.phase==Phase::FALLEN;refreshAll(c);ensureTerrainWindow(c);applyExternalDynamics(c,h);if(c.actuationEnabled)updateMotorCommands(c,h);else{c.joints[L_KNEE].lambdaMotor=c.joints[R_KNEE].lambdaMotor=c.joints[L_ANKLE].lambdaMotor=c.joints[R_ANKLE].lambdaMotor=0;}
  for(uint8_t i=0;i<JOINT_COUNT;i++)prepareJoint(c,c.joints[i],h);clampEmergencyVelocities(c);buildContacts(c,h);if(c.failure.fault==FAULT_CAPACITY){handleNumericalFault(c,FAULT_CAPACITY);return false;}warmStartJoints(c);warmStartContacts(c);
  for(uint8_t it=0;it<VELOCITY_ITERS;it++){
    if((it&1)==0){for(uint8_t i=0;i<JOINT_COUNT;i++)solveAnchorVelocity(c,c.joints[i]);for(uint8_t i=0;i<JOINT_COUNT;i++)solveMotorVelocity(c,c.joints[i],h);for(uint8_t i=0;i<JOINT_COUNT;i++)solveAngularLimitsVelocity(c,c.joints[i],h);for(uint8_t i=0;i<c.contacts.count;i++)solveContactNormal(c,c.contacts.items[i],h);for(uint8_t i=0;i<c.contacts.count;i++)solveContactFriction(c,c.contacts.items[i]);}
    else{for(int i=JOINT_COUNT-1;i>=0;i--)solveAnchorVelocity(c,c.joints[i]);for(int i=JOINT_COUNT-1;i>=0;i--)solveMotorVelocity(c,c.joints[i],h);for(int i=JOINT_COUNT-1;i>=0;i--)solveAngularLimitsVelocity(c,c.joints[i],h);for(int i=c.contacts.count-1;i>=0;i--)solveContactNormal(c,c.contacts.items[i],h);for(int i=c.contacts.count-1;i>=0;i--)solveContactFriction(c,c.contacts.items[i]);}
  }
  clampEmergencyVelocities(c);integrateBodies(c,h);
  for(uint8_t p=0;p<POSITION_ITERS;p++){for(uint8_t i=0;i<JOINT_COUNT;i++)solveAnchorPosition(c,c.joints[i]);for(uint8_t i=0;i<JOINT_COUNT;i++)solveAngularLimitPosition(c,c.joints[i]);refreshAll(c);for(uint8_t i=0;i<c.contacts.count;i++)solveContactPosition(c,c.contacts.items[i]);refreshAll(c);}
  if(!checkNumericalHealth(c)){handleNumericalFault(c,c.failure.fault);return false;}TouchSummary touches=classifyFinalTouches(c);preserveContactCache(c);updateContactEvents(c,h,touches);c.lastSupportAny=touches.footSupport[0]||touches.footSupport[1];updateFailureTimers(c,h,touches);
  if(beganFallen&&c.phase==Phase::FALLEN){c.failure.settle+=h;if(c.failure.settle>=FALL_SETTLE_TIME)finishFailure(c);}return c.phase!=Phase::GAME_OVER||c.failure.reason!=FAIL_NUMERIC;
}
static void simulateTick(Context&c){
  uint32_t t0=micros();for(uint8_t i=0;i<BODY_COUNT;i++)c.bodies[i].previousPose=c.bodies[i].pose;c.camera.prevX=c.camera.x;c.camera.prevGroundY=c.camera.groundY;
  for(uint8_t s=0;s<2;s++){if(c.phase!=Phase::PLAYING&&c.phase!=Phase::FALLEN)break;if(!simulateSubstep(c,SUBSTEP_H))break;}
  if(c.phase==Phase::PLAYING)updateScore(c);if(c.phase==Phase::PLAYING||c.phase==Phase::FALLEN){ensureTerrainWindow(c);rebaseWorldIfNeeded(c);updateCamera(c,.01f);rebaseAngles(c);}c.profile.ticks++;uint32_t d=micros()-t0;if(d>c.profile.maxTickUs)c.profile.maxTickUs=d;
}
static uint8_t advanceSimulation(Context&c,uint32_t elapsedUs,ControlState observed){
  if(c.phase!=Phase::PLAYING&&c.phase!=Phase::FALLEN)return 0;

  // Bound exceptional real-world stalls first, then convert that wall time into
  // deliberately slower simulation time. This keeps the 100 Hz logical physics
  // and 5 ms substeps unchanged while making the entire game easier to control.
  uint32_t boundedWallUs=elapsedUs;
  if(boundedWallUs>100000u){
    c.timing.droppedWallUs+=boundedWallUs-80000u;
    boundedWallUs=80000u;
  }
  uint32_t accepted=(uint32_t)(((uint64_t)boundedWallUs*TIME_SCALE_NUM)/TIME_SCALE_DEN);
  c.timing.acceptedTimelineUs+=accepted;

  uint64_t dueUs=c.timing.acceptedTimelineUs-c.timing.nextTick*LOGICAL_TICK_US;
  if(dueUs>80000u){
    c.timing.droppedWallUs+=(uint32_t)(dueUs-80000u);
    c.timing.acceptedTimelineUs=c.timing.nextTick*LOGICAL_TICK_US+80000u;
    dueUs=80000u;
  }
  if(dueUs>c.timing.maxBacklogUs)c.timing.maxBacklogUs=(uint32_t)dueUs;

  if(c.phase==Phase::PLAYING && !sameControl(observed,c.input.lastQueued)){
    uint64_t eff=(c.timing.acceptedTimelineUs+(LOGICAL_TICK_US-1ULL))/LOGICAL_TICK_US;
    enqueueControl(c,observed,eff);
  }
  uint8_t ran=0;
  while(c.timing.acceptedTimelineUs>=(c.timing.nextTick+1)*LOGICAL_TICK_US&&ran<8){
    commitControlsForTick(c,c.timing.nextTick);
    simulateTick(c);
    c.timing.nextTick++;
    ran++;
    if(c.phase!=Phase::PLAYING&&c.phase!=Phase::FALLEN){
      c.timing.acceptedTimelineUs=c.timing.nextTick*LOGICAL_TICK_US;
      break;
    }
  }
  return ran;
}

// -----------------------------------------------------------------------------
// Render snapshots and retained 4-bpp tile compositor
// -----------------------------------------------------------------------------
static ScreenPoint projectWorld(Vec2 w,float camX,float camY){ScreenPoint p={clampi16((int32_t)lroundf(96+PIXELS_PER_METER*(w.x-camX))),clampi16((int32_t)lroundf(258-PIXELS_PER_METER*(w.y-camY)))};return p;}
static Pose interpolatePose(const RigidBody&b,float a){Pose p;p.p=add(b.previousPose.p,mul(sub(b.pose.p,b.previousPose.p),a));p.angle=b.previousPose.angle+(b.pose.angle-b.previousPose.angle)*a;return p;}
static void shapeBounds(ScreenShape&s){s.minX=s.maxX=s.p[0].x;s.minY=s.maxY=s.p[0].y;for(uint8_t i=1;i<4;i++){s.minX=min(s.minX,s.p[i].x);s.maxX=max(s.maxX,s.p[i].x);s.minY=min(s.minY,s.p[i].y);s.maxY=max(s.maxY,s.p[i].y);}s.minX-=s.radius;s.maxX+=s.radius;s.minY-=s.radius;s.maxY+=s.radius;}
static bool addQuad(RenderSnapshot&sn,const Pose&pose,float halfW,float halfLen,uint8_t fill,uint8_t outline,uint8_t order,float camX,float camY){
  if(sn.shapeCount>=MAX_SCREEN_SHAPES)return false;ScreenShape&s=sn.shapes[sn.shapeCount++];s.type=SHAPE_QUAD;s.fill=fill;s.outline=outline;s.radius=0;s.order=order;Vec2 l[4]={v2(-halfW,-halfLen),v2(halfW,-halfLen),v2(halfW,halfLen),v2(-halfW,halfLen)};for(uint8_t i=0;i<4;i++)s.p[i]=projectWorld(add(pose.p,rotateAngle(l[i],pose.angle)),camX,camY);shapeBounds(s);return true;
}
static bool addFootShape(RenderSnapshot&sn,const Pose&pose,uint8_t fill,uint8_t outline,uint8_t order,float camX,float camY){
  if(sn.shapeCount>=MAX_SCREEN_SHAPES)return false;ScreenShape&s=sn.shapes[sn.shapeCount++];s.type=SHAPE_FOOT;s.fill=fill;s.outline=outline;s.radius=(int16_t)lroundf(.05f*PIXELS_PER_METER);s.order=order;Vec2 ends[2]={v2(-.10f,0),v2(.10f,0)};s.p[0]=projectWorld(add(pose.p,rotateAngle(ends[0],pose.angle)),camX,camY);s.p[1]=projectWorld(add(pose.p,rotateAngle(ends[1],pose.angle)),camX,camY);s.p[2]=s.p[0];s.p[3]=s.p[1];shapeBounds(s);return true;
}
static bool addCircleShape(RenderSnapshot&sn,Vec2 world,float radius,uint8_t fill,uint8_t outline,uint8_t order,float camX,float camY){if(sn.shapeCount>=MAX_SCREEN_SHAPES)return false;ScreenShape&s=sn.shapes[sn.shapeCount++];s.type=SHAPE_CIRCLE;s.fill=fill;s.outline=outline;s.radius=(int16_t)lroundf(radius*PIXELS_PER_METER);s.order=order;s.p[0]=projectWorld(world,camX,camY);s.p[1]=s.p[2]=s.p[3]=s.p[0];shapeBounds(s);return true;}
static bool addDiamond(RenderSnapshot&sn,Vec2 world,uint8_t fill,uint8_t order,float camX,float camY){if(sn.shapeCount>=MAX_SCREEN_SHAPES)return false;ScreenShape&s=sn.shapes[sn.shapeCount++];s.type=SHAPE_DIAMOND;s.fill=fill;s.outline=1;s.radius=0;s.order=order;ScreenPoint p=projectWorld(world,camX,camY);s.p[0]={p.x,(int16_t)(p.y-3)};s.p[1]={(int16_t)(p.x+3),p.y};s.p[2]={p.x,(int16_t)(p.y+3)};s.p[3]={(int16_t)(p.x-3),p.y};shapeBounds(s);return true;}
static void buildCharacterShapes(Context&c,RenderSnapshot&sn,float alpha){
  Pose p[BODY_COUNT];for(uint8_t i=0;i<BODY_COUNT;i++)p[i]=interpolatePose(c.bodies[i],alpha);float cx=sn.cameraX,cy=sn.cameraY;
  // Far/right leg.
  addQuad(sn,p[R_THIGH],.050f,.215f,3,1,10,cx,cy);addQuad(sn,p[R_SHIN],.038f,.210f,9,1,11,cx,cy);addFootShape(sn,p[R_FOOT],3,1,12,cx,cy);
  // Torso: slightly narrower than collision envelope.
  addQuad(sn,p[TORSO],.115f,.235f,10,1,20,cx,cy);Vec2 pelvis=add(p[TORSO].p,rotateAngle(v2(0,-.26f),p[TORSO].angle));addDiamond(sn,pelvis,4,21,cx,cy);
  // Near/left leg.
  addQuad(sn,p[L_THIGH],.050f,.215f,2,1,30,cx,cy);addQuad(sn,p[L_SHIN],.038f,.210f,8,1,31,cx,cy);addFootShape(sn,p[L_FOOT],2,1,32,cx,cy);
  // Joint markers.
  addDiamond(sn,add(p[L_THIGH].p,rotateAngle(v2(0,-.215f),p[L_THIGH].angle)),4,40,cx,cy);addDiamond(sn,add(p[R_THIGH].p,rotateAngle(v2(0,-.215f),p[R_THIGH].angle)),4,40,cx,cy);
  addDiamond(sn,add(p[L_SHIN].p,rotateAngle(v2(0,-.210f),p[L_SHIN].angle)),4,40,cx,cy);addDiamond(sn,add(p[R_SHIN].p,rotateAngle(v2(0,-.210f),p[R_SHIN].angle)),4,40,cx,cy);
  Vec2 head=add(p[TORSO].p,rotateAngle(v2(0,.40f),p[TORSO].angle));addCircleShape(sn,head,.11f,11,1,50,cx,cy);
}
static void formatDistance(int64_t mm,char*dst,size_t cap){if(!cap)return;if(mm<0)mm=0;if(mm<9999900LL){int64_t tenths=mm/100;snprintf(dst,cap,"%lld.%lldm",(long long)(tenths/10),(long long)(tenths%10));}else{int64_t tenthKm=mm/100000;snprintf(dst,cap,"%lld.%lldk",(long long)(tenthKm/10),(long long)(tenthKm%10));}}
static void buildTerrainSnapshot(Context&c,RenderSnapshot&sn){
  for(int x=0;x<240;x++){float wx=sn.cameraX+((float)x-96.0f)/PIXELS_PER_METER,y;if(surfaceHeightAt(c.terrain,wx,y)){sn.terrainGap[x]=0;sn.terrainTop[x]=clampi16((int32_t)lroundf(258-PIXELS_PER_METER*(y-sn.cameraY)));}else{sn.terrainGap[x]=1;sn.terrainTop[x]=296;}}
  sn.terrainEdgeCount=0;for(uint8_t ci=0;ci<CHUNK_COUNT&&sn.terrainEdgeCount<MAX_VISIBLE_EDGES;ci++){TerrainChunk&ch=c.terrain.chunks[ci];for(uint8_t ei=0;ei<ch.edgeCount&&sn.terrainEdgeCount<MAX_VISIBLE_EDGES;ei++){TerrainEdge&e=ch.edges[ei];ScreenPoint a=projectWorld(e.a,sn.cameraX,sn.cameraY),b=projectWorld(e.b,sn.cameraX,sn.cameraY);if((a.x<-8&&b.x<-8)||(a.x>248&&b.x>248)||(a.y<24&&b.y<24)||(a.y>320&&b.y>320))continue;sn.terrainEdges[sn.terrainEdgeCount++]={a,b};}}
}
static void beginRenderSnapshot(Context&c,uint32_t now){
  RendererState&r=c.renderer;RenderSnapshot&sn=r.snapshot;memset(&sn,0,sizeof(sn));sn.phase=c.phase;sn.reason=c.failure.reason;float alpha=1.0f;if(c.phase==Phase::PLAYING||c.phase==Phase::FALLEN){uint64_t base=c.timing.nextTick*LOGICAL_TICK_US;uint64_t rem=c.timing.acceptedTimelineUs>=base?c.timing.acceptedTimelineUs-base:0;alpha=clampf((float)rem/(float)LOGICAL_TICK_US,0,1);}
  sn.cameraX=c.camera.prevX+(c.camera.x-c.camera.prevX)*alpha;sn.cameraY=c.camera.prevGroundY+(c.camera.groundY-c.camera.prevGroundY)*alpha;sn.controls=c.input.committed;sn.support[0]=c.feet[0].support;sn.support[1]=c.feet[1].support;sn.newBest=c.newBest;formatDistance(c.phase==Phase::GAME_OVER?c.failure.finalScoreMm:c.score.furthestMm,sn.distanceText,sizeof(sn.distanceText));formatDistance(sessionBestMm,sn.bestText,sizeof(sn.bestText));
  if(c.phase!=Phase::INTRO)buildCharacterShapes(c,sn,alpha);buildTerrainSnapshot(c,sn);
  if(c.phase==Phase::READY){if(!c.input.readyCentered)snprintf(sn.centerText,sizeof(sn.centerText),"CENTER BOTH SWITCHES");else snprintf(sn.centerText,sizeof(sn.centerText),"READY - MOVE A SWITCH");}
  if(c.phase==Phase::GAME_OVER){if(c.failure.reason==FAIL_NUMERIC)snprintf(sn.resultText,sizeof(sn.resultText),"SIMULATION FAULT");else if(c.failure.reason==FAIL_PIT)snprintf(sn.resultText,sizeof(sn.resultText),"MISSED THE GROUND");else snprintf(sn.resultText,sizeof(sn.resultText),"FALLEN");}
  r.frameActive=true;r.forceFrame=false;r.nextTile=0;r.frameStartUs=now;r.changedTiles=0;r.bytesTransferred=0;
}
static bool shouldBeginFrame(Context&c,uint32_t now){RendererState&r=c.renderer;if(r.frameActive)return false;return r.forceFrame||(int32_t)(now-r.nextFrameUs)>=0;}
static bool shapeIntersectsTile(const ScreenShape&s,int16_t ox,int16_t oy){return !(s.maxX<ox||s.minX>ox+15||s.maxY<oy||s.minY>oy+15);}
static void drawBackground(TileCanvas&cv,const RenderSnapshot&sn){(void)sn;int16_t ox=cv.originX(),oy=cv.originY();if(ox<=208&&ox+15>=154&&oy<=109&&oy+15>=55){cv.fillCircle(181,82,27,5);}if(oy<180){cv.fillTriangle(181,82,232,46,236,58,5);cv.fillTriangle(181,82,222,126,211,132,5);cv.fillTriangle(181,82,145,41,151,34,5);}if(oy<220&&oy+15>150){cv.fillRect(18,184,34,36,6);cv.fillRect(58,169,25,51,6);cv.fillRect(192,176,30,44,6);}}
static void drawTerrain(TileCanvas&cv,const RenderSnapshot&sn){int16_t ox=cv.originX(),oy=cv.originY();for(int16_t x=ox;x<ox+16&&x<240;x++){if(x<0||sn.terrainGap[x])continue;int16_t top=max((int16_t)32,sn.terrainTop[x]);int16_t y0=max(top,oy),y1=min((int16_t)295,(int16_t)(oy+15));if(y0<=y1)cv.drawFastVLine(x,y0,y1-y0+1,1);}for(uint8_t i=0;i<sn.terrainEdgeCount;i++){VisibleEdge e=sn.terrainEdges[i];cv.drawLine(e.a.x,e.a.y,e.b.x,e.b.y,12);}
  // Screen-space poster baseline detail.
  if(oy<=295&&oy+15>=292)cv.drawFastHLine(0,295,240,15);
}
static void drawOneShape(TileCanvas&cv,const ScreenShape&s){if(!shapeIntersectsTile(s,cv.originX(),cv.originY()))return;switch(s.type){case SHAPE_QUAD:cv.fillTriangle(s.p[0].x,s.p[0].y,s.p[1].x,s.p[1].y,s.p[2].x,s.p[2].y,s.fill);cv.fillTriangle(s.p[0].x,s.p[0].y,s.p[2].x,s.p[2].y,s.p[3].x,s.p[3].y,s.fill);for(uint8_t i=0;i<4;i++)cv.drawLine(s.p[i].x,s.p[i].y,s.p[(i+1)&3].x,s.p[(i+1)&3].y,s.outline);break;case SHAPE_CIRCLE:cv.fillCircle(s.p[0].x,s.p[0].y,s.radius,s.fill);cv.drawCircle(s.p[0].x,s.p[0].y,s.radius,s.outline);break;case SHAPE_DIAMOND:cv.fillTriangle(s.p[0].x,s.p[0].y,s.p[1].x,s.p[1].y,s.p[2].x,s.p[2].y,s.fill);cv.fillTriangle(s.p[0].x,s.p[0].y,s.p[2].x,s.p[2].y,s.p[3].x,s.p[3].y,s.fill);break;case SHAPE_FOOT:{cv.drawLine(s.p[0].x,s.p[0].y,s.p[1].x,s.p[1].y,s.fill);cv.fillCircle(s.p[0].x,s.p[0].y,s.radius,s.fill);cv.fillCircle(s.p[1].x,s.p[1].y,s.radius,s.fill);cv.drawCircle(s.p[0].x,s.p[0].y,s.radius,s.outline);cv.drawCircle(s.p[1].x,s.p[1].y,s.radius,s.outline);}break;}}
static void drawCharacter(TileCanvas&cv,const RenderSnapshot&sn){for(uint8_t i=0;i<sn.shapeCount;i++)drawOneShape(cv,sn.shapes[i]);if(sn.support[0]||sn.support[1]){cv.drawFastHLine(78,288,12,4);}}
static void drawHud(TileCanvas&cv,const RenderSnapshot&sn){cv.fillRect(0,0,240,32,10);cv.setTextWrap(false);cv.setTextColor(7);cv.setTextSize(1);cv.setCursor(8,4);cv.print("DIST");cv.setCursor(132,4);cv.print("BEST");cv.setTextSize(2);cv.setCursor(8,14);cv.print(sn.distanceText);cv.setCursor(132,14);cv.print(sn.bestText);}
static void drawControls(TileCanvas&cv,const RenderSnapshot&sn){cv.fillRect(0,296,240,24,10);cv.setTextSize(1);cv.setTextColor(2);cv.setCursor(8,301);cv.print("L");cv.setTextColor(3);cv.setCursor(126,301);cv.print("R");cv.setTextColor(7);cv.setCursor(22,301);cv.print(sn.controls.hip[0]>0?"^":(sn.controls.hip[0]<0?"v":"-"));cv.setCursor(140,301);cv.print(sn.controls.hip[1]>0?"^":(sn.controls.hip[1]<0?"v":"-"));cv.setCursor(35,301);cv.print(sn.controls.kneeHeld[0]?"KNEE BEND":"KNEE EXT");cv.setCursor(153,301);cv.print(sn.controls.kneeHeld[1]?"BEND":"EXT");}
static void centerText(TileCanvas&cv,const char*s,int16_t y,uint8_t size,uint8_t color){int16_t x1,y1;uint16_t w,h;cv.setTextSize(size);cv.setTextColor(color);cv.getTextBounds(s,0,y,&x1,&y1,&w,&h);cv.setCursor((240-(int16_t)w)/2,y);cv.print(s);}
static void drawIntro(TileCanvas&cv){cv.fillRect(0,32,240,264,0);centerText(cv,"ODD STRIDE",40,3,1);cv.fillRect(44,103,34,86,2);cv.fillRect(162,103,34,86,3);cv.fillCircle(61,103,12,4);cv.fillCircle(179,103,12,4);cv.setTextSize(1);cv.setTextColor(1);cv.setCursor(20,208);cv.print("SWITCH UP: HIP FORWARD");cv.setCursor(20,222);cv.print("CENTER: COAST");cv.setCursor(20,236);cv.print("DOWN: HIP BACK");cv.setCursor(20,250);cv.print("HOLD BUTTON: BEND KNEE");centerText(cv,"TAP EITHER BUTTON",274,1,1);MenuFooter::drawIndexed(cv,1,0);}
static void drawPhaseOverlay(TileCanvas&cv,const RenderSnapshot&sn){if(sn.phase==Phase::INTRO){drawIntro(cv);return;}if(sn.phase==Phase::READY){cv.fillRect(24,64,192,43,10);cv.drawRect(24,64,192,43,4);centerText(cv,sn.centerText,76,1,7);if(!strcmp(sn.centerText,"CENTER BOTH SWITCHES")){centerText(cv,"RELEASE BUTTONS",90,1,7);}}else if(sn.phase==Phase::GAME_OVER){cv.fillRect(18,52,204,102,10);cv.drawRect(18,52,204,102,sn.newBest?13:4);centerText(cv,sn.resultText,62,2,7);cv.setTextSize(1);cv.setTextColor(7);cv.setCursor(38,94);cv.print("DIST ");cv.print(sn.distanceText);cv.setCursor(38,108);cv.print("BEST ");cv.print(sn.bestText);if(sn.newBest)centerText(cv,"NEW BEST",126,2,13);centerText(cv,"TAP EITHER BUTTON: RETRY",279,1,1);MenuFooter::drawIndexed(cv,1,0);}}
static void drawDebugOverlay(TileCanvas&cv,const RenderSnapshot&sn){(void)cv;(void)sn;}
static void composeTile(Context&c,uint16_t tileIndex){RendererState&r=c.renderer;int16_t tx=(tileIndex%TILES_X)*16,ty=(tileIndex/TILES_X)*16;memset(r.candidate,0,PACKED_TILE_BYTES);r.canvas.bind(r.candidate,tx,ty);drawBackground(r.canvas,r.snapshot);drawTerrain(r.canvas,r.snapshot);drawCharacter(r.canvas,r.snapshot);drawHud(r.canvas,r.snapshot);drawControls(r.canvas,r.snapshot);drawPhaseOverlay(r.canvas,r.snapshot);if(ODD_STRIDE_DEBUG)drawDebugOverlay(r.canvas,r.snapshot);}
static bool tileValid(const RendererState&r,uint16_t i){return (r.valid[i>>3]&(1u<<(i&7)))!=0;}static void markTileValid(RendererState&r,uint16_t i){r.valid[i>>3]|=(uint8_t)(1u<<(i&7));}
static bool commitTileIfChanged(Context&c,uint16_t tileIndex){RendererState&r=c.renderer;uint32_t off=(uint32_t)tileIndex*PACKED_TILE_BYTES;if(tileValid(r,tileIndex)&&memcmp(r.retained+off,r.candidate,PACKED_TILE_BYTES)==0)return false;for(uint16_t i=0;i<256;i++){uint8_t b=r.candidate[i>>1];uint8_t pi=(i&1)?(b&0x0F):(b>>4);r.rgb[i]=PALETTE[pi];}int16_t x=(tileIndex%TILES_X)*16,y=(tileIndex/TILES_X)*16;blitTile(x,y,r.rgb);memcpy(r.retained+off,r.candidate,PACKED_TILE_BYTES);markTileValid(r,tileIndex);r.changedTiles++;r.bytesTransferred+=512;return true;}
static void finishRenderFrame(Context&c,uint32_t now){RendererState&r=c.renderer;uint32_t dur=now-r.frameStartUs;r.frameActive=false;r.nextFrameUs=now+r.frameIntervalUs;r.evalFrames++;if(dur>40000)r.slow40++;if(dur>55000)r.slow55++;if(dur<(uint32_t)(r.frameIntervalUs*.8f))r.fastStreak++;else r.fastStreak=0;if(r.evalFrames>=30){if(r.slow55>10)r.frameIntervalUs=66667;else if(r.slow40>10&&r.frameIntervalUs<50000)r.frameIntervalUs=50000;r.evalFrames=r.slow40=r.slow55=0;}if(r.fastStreak>=120){if(r.frameIntervalUs>=66667)r.frameIntervalUs=50000;else if(r.frameIntervalUs>=50000)r.frameIntervalUs=33333;r.fastStreak=0;}}
static void cancelRenderFrame(Context&c){c.renderer.frameActive=false;c.renderer.forceFrame=true;}
static void renderSlice(Context&c,uint32_t budgetUs){RendererState&r=c.renderer;if(!r.frameActive)return;uint32_t start=micros();uint8_t transfers=0;while(r.nextTile<TILE_COUNT){composeTile(c,r.nextTile);if(commitTileIfChanged(c,r.nextTile))transfers++;r.nextTile++;if((uint32_t)(micros()-start)>=budgetUs||transfers>=MAX_TRANSFER_TILES_PER_SLICE)break;}if(r.nextTile>=TILE_COUNT)finishRenderFrame(c,micros());}

// -----------------------------------------------------------------------------
// Game state machine and public lifecycle
// -----------------------------------------------------------------------------
static void enterReady(Context&c){resetRun(c);c.phase=Phase::READY;c.phaseEnteredUs=readClockUs();c.input.readyCentered=false;c.input.centeredSince=0;c.input.tapActive=false;c.renderer.forceFrame=true;}
static void beginRun(Context&c,ControlState starting){uint32_t now=readClockUs();c.phase=Phase::PLAYING;c.phaseEnteredUs=now;c.actuationEnabled=true;c.input.committed=starting;c.input.lastQueued=starting;c.input.queueCount=0;c.score.bestAtStartMm=sessionBestMm;resetTiming(c,now);c.renderer.frameActive=false;c.renderer.forceFrame=true;queueTone(c,440,440,25,2,now);}
static void updateNonPlayingPhase(Context&c,uint32_t now){
  if(c.phase==Phase::INTRO){if(updateUiTap(c.input,now)){enterReady(c);}return;}
  if(c.phase==Phase::READY){
    const bool released=!c.input.btn[0].stable&&!c.input.btn[1].stable;
    const bool validLeft=!c.input.sw[0].error&&c.input.sw[0].stable!=SWITCH_ERROR;
    const bool validRight=!c.input.sw[1].error&&c.input.sw[1].stable!=SWITCH_ERROR;

    // Once the neutral gate has armed, a fresh valid switch deflection is the
    // START gesture.  Check it before demanding that the switches are still
    // centered; otherwise the very movement meant to start the run would
    // immediately disarm READY and bounce back to the centering prompt.
    if(c.input.readyCentered){
      if(!validLeft||!validRight){
        c.input.readyCentered=false;
        c.input.centeredSince=0;
        c.renderer.frameActive=false;
        c.renderer.forceFrame=true;
        return;
      }

      ControlState s=normalizeControls(c.input);
      if(released&&(s.hip[0]!=0||s.hip[1]!=0)){
        beginRun(c,s);
        return;
      }

      // Buttons alone never start the run.  Stay armed while the switches
      // remain centered so the player can release a button and then move.
      return;
    }

    const bool centers=validLeft&&validRight&&
      c.input.sw[0].stable==SWITCH_CENTER&&
      c.input.sw[1].stable==SWITCH_CENTER;

    if(!centers||!released){
      c.input.centeredSince=0;
      return;
    }

    if(!c.input.centeredSince)c.input.centeredSince=now;
    if((uint32_t)(now-c.input.centeredSince)>=READY_CENTER_US){
      c.input.readyCentered=true;
      c.renderer.frameActive=false;
      c.renderer.forceFrame=true;
    }
    return;
  }
  if(c.phase==Phase::GAME_OVER){
    if(!c.input.btn[0].stable&&!c.input.btn[1].stable)c.input.retryReleaseSeen=true;
    bool tap=updateUiTap(c.input,now);if(c.input.retryReleaseSeen&&tap)enterReady(c);return;
  }
}
static void emitProfileIfDue(Context&c,uint32_t now){
#if ODD_STRIDE_PROFILE
  static uint32_t last=0;if((uint32_t)(now-last)>=1000000u){last=now;Serial.print("ODD tick=");Serial.print(c.profile.ticks);Serial.print(" maxTickUs=");Serial.print(c.profile.maxTickUs);Serial.print(" contacts=");Serial.print(c.profile.maxContacts);Serial.print(" droppedUs=");Serial.print(c.timing.droppedWallUs);Serial.print(" clamps=");Serial.print(c.profile.velocityClamps);Serial.print(" frameUs=");Serial.println(c.renderer.frameIntervalUs);c.profile.ticks=0;c.profile.maxTickUs=0;c.profile.maxContacts=0;}
#else
  (void)c;(void)now;
#endif
}

void enter(){
  stopAudio();if(context){delete context;context=nullptr;}allocationFailed=false;context=new(std::nothrow) Context();if(!context){allocationFailed=true;drawResourceError();return;}Context&c=*context;
  memset(c.renderer.valid,0,sizeof(c.renderer.valid));memset(c.renderer.retained,0,sizeof(c.renderer.retained));c.renderer.frameActive=false;c.renderer.forceFrame=true;c.renderer.nextTile=0;c.renderer.frameIntervalUs=INITIAL_FRAME_US;c.renderer.evalFrames=c.renderer.slow40=c.renderer.slow55=c.renderer.fastStreak=0;
  memset(&c.audio,0,sizeof(c.audio));memset(&c.profile,0,sizeof(c.profile));display.setRotation(0);display.setTextWrap(false);display.setFont(nullptr);
  GameInput initial={digitalRead(BUTTON_2_PIN)==LOW,digitalRead(BUTTON_1_PIN)==LOW,false,false};uint32_t now=readClockUs();initializeInput(c.input,initial,now);resetRun(c);c.phase=Phase::INTRO;c.phaseEnteredUs=now;c.renderer.forceFrame=true;c.renderer.nextFrameUs=now;
}

void update(const GameInput&in){
  uint32_t now=readClockUs();if(!context){return;}Context&c=*context;uint32_t elapsed=now-c.timing.lastRawUs;c.timing.lastRawUs=now;
  updateSwitchFilter(c.input.sw[0],readRawSwitch(LEFT_UP_PIN,LEFT_DOWN_PIN),now);updateSwitchFilter(c.input.sw[1],readRawSwitch(RIGHT_UP_PIN,RIGHT_DOWN_PIN),now);updateButtonFilter(c.input.btn[0],in.leftButton,now);updateButtonFilter(c.input.btn[1],in.rightButton,now);
  Phase before=c.phase;if(c.phase==Phase::INTRO||c.phase==Phase::READY||c.phase==Phase::GAME_OVER)updateNonPlayingPhase(c,now);if(before!=c.phase&&c.phase==Phase::PLAYING)elapsed=0;
  uint8_t catchup=0;if(c.phase==Phase::PLAYING||c.phase==Phase::FALLEN){ControlState observed=normalizeControls(c.input);catchup=advanceSimulation(c,elapsed,observed);}else{c.timing.acceptedTimelineUs=c.timing.nextTick*LOGICAL_TICK_US;}
  tickAudio(c,now);if(shouldBeginFrame(c,now))beginRenderSnapshot(c,now);if(catchup<4)renderSlice(c,RENDER_SLICE_US);emitProfileIfDue(c,now);
}

void leave(){stopAudio();if(context){context->renderer.frameActive=false;delete context;context=nullptr;}allocationFailed=false;}
bool allowMenuExit(){if(!context)return true;Phase p=context->phase;return p==Phase::INTRO||p==Phase::READY||p==Phase::GAME_OVER||p==Phase::RESOURCE_ERROR;}

} // namespace OddStride
