#pragma once
#include <Arduino.h>

inline uint32_t esp_random() { return ArduinoSim::rng(); }

struct SimESPClass {
  uint32_t getFreeHeap() const { return 1024 * 1024; }
};
inline SimESPClass ESP;
