#pragma once
#include <Adafruit_GFX.h>
#include "MenuPresentation.h"

// One 240x8 RGB565 destination strip. Poster callbacks retain 240x280 source coordinates.
class MenuCanvas : public Adafruit_GFX {
  MenuRect storage_={0,0,0,0}, source_={0,0,0,0}, label_={0,0,0,0};
  uint16_t *pixels_=nullptr;
  bool mapped_=false;
  static int32_t maximum(int32_t a,int32_t b){return a>b?a:b;}
  static int32_t minimum(int32_t a,int32_t b){return a<b?a:b;}
  static int32_t ceilDiv(int32_t a,int32_t b){return (a+b-1)/b;}
  void destinationFill(int32_t x0,int32_t y0,int32_t x1,int32_t y1,uint16_t color){
    if(!pixels_)return;
    x0=maximum(x0,storage_.x);y0=maximum(y0,storage_.y);
    x1=minimum(x1,(int32_t)storage_.x+storage_.w);y1=minimum(y1,(int32_t)storage_.y+storage_.h);
    if(x0>=x1||y0>=y1)return;
    for(int32_t y=y0;y<y1;++y){
      uint16_t *p=pixels_+(y-storage_.y)*storage_.w+(x0-storage_.x);
      for(int32_t x=x0;x<x1;++x)*p++=color;
    }
  }
  void sourceFill(int32_t x0,int32_t y0,int32_t x1,int32_t y1,uint16_t color){
    if(!pixels_)return;
    x0=maximum(x0,source_.x);y0=maximum(y0,source_.y);
    x1=minimum(x1,(int32_t)source_.x+source_.w);y1=minimum(y1,(int32_t)source_.y+source_.h);
    if(x0>=x1||y0>=y1)return;
    if(!mapped_){destinationFill(x0,y0,x1,y1,color);return;}
    destinationFill(label_.x+ceilDiv(x0*label_.w,240),
                    label_.y+ceilDiv(y0*label_.h,280),
                    label_.x+ceilDiv(x1*label_.w,240),
                    label_.y+ceilDiv(y1*label_.h,280),color);
  }
public:
  MenuCanvas():Adafruit_GFX(240,280){}
  MenuRect clip() const{return source_;}
  bool setClip(MenuRect r,uint16_t *pixels){
    mapped_=false;pixels_=nullptr;
    int32_t x0=maximum(0,r.x),y0=maximum(0,r.y);
    int32_t x1=minimum(240,(int32_t)r.x+r.w),y1=minimum(280,(int32_t)r.y+r.h);
    if(!pixels||x1<=x0||y1<=y0||(x1-x0)*(y1-y0)>1920){storage_=source_={0,0,0,0};return false;}
    storage_=source_={(int16_t)x0,(int16_t)y0,(int16_t)(x1-x0),(int16_t)(y1-y0)};
    pixels_=pixels;return true;
  }
  bool setMappedClip(MenuRect strip,uint16_t *pixels,MenuRect label){
    if(!setClip(strip,pixels)||label.w<=0||label.h<=0){pixels_=nullptr;return false;}
    label_=label;mapped_=true;
    int32_t x0=maximum(storage_.x,label.x),y0=maximum(storage_.y,label.y);
    int32_t x1=minimum((int32_t)storage_.x+storage_.w,(int32_t)label.x+label.w);
    int32_t y1=minimum((int32_t)storage_.y+storage_.h,(int32_t)label.y+label.h);
    if(x0>=x1||y0>=y1){pixels_=nullptr;source_={0,0,0,0};return false;}
    int32_t sx0=((x0-label.x)*240)/label.w,sy0=((y0-label.y)*280)/label.h;
    int32_t sx1=((x1-1-label.x)*240)/label.w+1,sy1=((y1-1-label.y)*280)/label.h+1;
    source_={(int16_t)sx0,(int16_t)sy0,(int16_t)(sx1-sx0),(int16_t)(sy1-sy0)};
    return true;
  }
  void resetDrawingStyle(){setFont(nullptr);setTextWrap(false);setTextSize(1);setTextColor(0xffff);setCursor(0,0);}
  // Override both GFX entry points: hardware drawFast* uses writeLine,
  // and fillRect loops columns instead of delegating to writeFillRect.
  // No override keyword: older simulator adapters declare these nonvirtual.
  void drawFastHLine(int16_t x,int16_t y,int16_t w,uint16_t color){writeFastHLine(x,y,w,color);}
  void drawFastVLine(int16_t x,int16_t y,int16_t h,uint16_t color){writeFastVLine(x,y,h,color);}
  void fillRect(int16_t x,int16_t y,int16_t w,int16_t h,uint16_t color){writeFillRect(x,y,w,h,color);}
  void fillScreen(uint16_t color){sourceFill(0,0,240,280,color);}
  void drawPixel(int16_t x,int16_t y,uint16_t color) override{sourceFill(x,y,(int32_t)x+1,(int32_t)y+1,color);}
  void writePixel(int16_t x,int16_t y,uint16_t color) override{drawPixel(x,y,color);}
  void writeFastHLine(int16_t x,int16_t y,int16_t w,uint16_t color) override{if(w>0)sourceFill(x,y,(int32_t)x+w,(int32_t)y+1,color);}
  void writeFastVLine(int16_t x,int16_t y,int16_t h,uint16_t color) override{if(h>0)sourceFill(x,y,(int32_t)x+1,(int32_t)y+h,color);}
  void writeFillRect(int16_t x,int16_t y,int16_t w,int16_t h,uint16_t color) override{if(w>0&&h>0)sourceFill(x,y,(int32_t)x+w,(int32_t)y+h,color);}
};
