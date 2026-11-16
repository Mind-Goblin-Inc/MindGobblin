#pragma once

// Import the captured Arduino shim verbatim, replacing only clock and sleep.
#define millis sharkboyNativeMillis
#define micros sharkboyNativeMicros
#define delay sharkboyNativeDelay
#include "../source/simulator/include/Arduino.h"
#undef millis
#undef micros
#undef delay

extern double sharkboyNow();
extern void sharkboyDelay(unsigned long ms);
inline unsigned long millis() { return static_cast<uint32_t>(sharkboyNow()); }
inline unsigned long micros() { return static_cast<uint32_t>(sharkboyNow() * 1000.0); }
inline void delay(unsigned long ms) { sharkboyDelay(ms); }
