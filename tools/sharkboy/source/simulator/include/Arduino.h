#pragma once

#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <random>
#include <thread>
#include <iostream>
#include <cstring>
#include <cstddef>
#include <cstdio>
#include <cctype>
#include <string>
#include <type_traits>

#ifndef F
#define F(value) (value)
#endif

using byte = uint8_t;
using boolean = bool;

// Common Arduino math constants/helpers used by sketches.
#ifndef PI
#define PI 3.1415926535897932384626433832795
#endif
#ifndef HALF_PI
#define HALF_PI 1.5707963267948966192313216916398
#endif
#ifndef TWO_PI
#define TWO_PI 6.283185307179586476925286766559
#endif
#ifndef DEG_TO_RAD
#define DEG_TO_RAD 0.017453292519943295769236907684886
#endif
#ifndef RAD_TO_DEG
#define RAD_TO_DEG 57.295779513082320876798154814105
#endif


// Arduino String methods used by game headers (including ABC music parsing).
class String : public std::string {
public:
  using std::string::string;
  String(const std::string &value) : std::string(value) {}

  void trim() {
    const size_type first = find_first_not_of(" \t\r\n\f\v");
    if (first == npos) { clear(); return; }
    const size_type last = find_last_not_of(" \t\r\n\f\v");
    *this = substr(first, last - first + 1);
  }
  void toLowerCase() {
    for (char &c : *this) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  }
  bool startsWith(const char *prefix) const { return compare(0, std::strlen(prefix), prefix) == 0; }
  String substring(unsigned int from) const { return substr(std::min<size_type>(from, size())); }
  String substring(unsigned int from, unsigned int to) const {
    const size_type begin = std::min<size_type>(from, size());
    return substr(begin, to > begin ? to - begin : 0);
  }
  int indexOf(char value, unsigned int from = 0) const {
    const size_type pos = find(value, from);
    return pos == npos ? -1 : static_cast<int>(pos);
  }
  int lastIndexOf(char value) const {
    const size_type pos = rfind(value);
    return pos == npos ? -1 : static_cast<int>(pos);
  }
  long toInt() const { return std::strtol(c_str(), nullptr, 10); }
  float toFloat() const { return std::strtof(c_str(), nullptr); }
};

constexpr int LOW = 0;
constexpr int HIGH = 1;
constexpr int INPUT = 0;
constexpr int OUTPUT = 1;
constexpr int INPUT_PULLUP = 2;

namespace ArduinoSim {
inline std::array<bool, 64> pinLow{};
inline const auto bootTime = std::chrono::steady_clock::now();
inline std::mt19937 rng{0x4A414B45u};
struct TonePin {
  std::atomic<uint32_t> frequency{0};
  std::atomic<uint32_t> duty{0};
};
inline std::array<TonePin, 64> tonePins{};
}

inline unsigned long millis() {
  const auto d = std::chrono::steady_clock::now() - ArduinoSim::bootTime;
  return static_cast<unsigned long>(
      std::chrono::duration_cast<std::chrono::milliseconds>(d).count());
}

inline unsigned long micros() {
  const auto d = std::chrono::steady_clock::now() - ArduinoSim::bootTime;
  return static_cast<unsigned long>(
      std::chrono::duration_cast<std::chrono::microseconds>(d).count());
}

inline void delay(unsigned long ms) {
  std::this_thread::sleep_for(std::chrono::milliseconds(ms));
}

inline void pinMode(uint8_t, uint8_t) {}
inline void digitalWrite(uint8_t pin, uint8_t value) {
  if (pin < ArduinoSim::pinLow.size()) ArduinoSim::pinLow[pin] = (value == LOW);
}
inline int digitalRead(uint8_t pin) {
  if (pin >= ArduinoSim::pinLow.size()) return HIGH;
  return ArduinoSim::pinLow[pin] ? LOW : HIGH;
}
inline void simSetPinLow(uint8_t pin, bool low) {
  if (pin < ArduinoSim::pinLow.size()) ArduinoSim::pinLow[pin] = low;
}

inline void randomSeed(uint32_t seed) { ArduinoSim::rng.seed(seed); }
inline long random(long howbig) {
  if (howbig <= 0) return 0;
  std::uniform_int_distribution<long> d(0, howbig - 1);
  return d(ArduinoSim::rng);
}
inline long random(long howsmall, long howbig) {
  if (howsmall >= howbig) return howsmall;
  std::uniform_int_distribution<long> d(howsmall, howbig - 1);
  return d(ArduinoSim::rng);
}

inline double ledcWriteTone(uint8_t pin, double frequency) {
  if (pin >= ArduinoSim::tonePins.size()) return 0;
  auto &tone = ArduinoSim::tonePins[pin];
  if (frequency <= 0) {
    tone.duty.store(0, std::memory_order_relaxed);
    tone.frequency.store(0, std::memory_order_relaxed);
    return 0;
  }
  tone.frequency.store(static_cast<uint32_t>(frequency), std::memory_order_relaxed);
  tone.duty.store(511, std::memory_order_relaxed);
  return frequency;
}
inline bool ledcAttachChannel(uint8_t, uint32_t, uint8_t, uint8_t) { return true; }
inline bool ledcWrite(uint8_t pin, uint32_t duty) {
  if (pin >= ArduinoSim::tonePins.size()) return false;
  ArduinoSim::tonePins[pin].duty.store(std::min(duty, 1023u), std::memory_order_relaxed);
  return true;
}

// Minimal Arduino Serial compatibility. Output goes to the simulator terminal.
class SimSerialClass {
public:
  void begin(unsigned long) {}
  template <typename T> size_t print(const T &v) { std::cout << v; return 1; }
  size_t print(const char *v) { if (!v) return 0; std::cout << v; return std::strlen(v); }
  template <typename T> size_t println(const T &v) { std::cout << v << std::endl; return 1; }
  size_t println() { std::cout << std::endl; return 1; }
  template <typename... Args> int printf(const char *format, Args... args) {
    return std::printf(format, args...);
  }
};
inline SimSerialClass Serial;

template <typename T> constexpr T min(T a, T b) { return a < b ? a : b; }
template <typename T> constexpr T max(T a, T b) { return a > b ? a : b; }

template <typename T, typename L, typename H>
constexpr std::common_type_t<T, L, H> constrain(T value, L low, H high) {
  using R = std::common_type_t<T, L, H>;
  const R v = static_cast<R>(value);
  const R lo = static_cast<R>(low);
  const R hi = static_cast<R>(high);
  return v < lo ? lo : (v > hi ? hi : v);
}

template <typename T> constexpr T sq(T value) { return value * value; }
template <typename T> constexpr double radians(T deg) { return static_cast<double>(deg) * DEG_TO_RAD; }
template <typename T> constexpr double degrees(T rad) { return static_cast<double>(rad) * RAD_TO_DEG; }

using std::abs;
