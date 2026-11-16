#pragma once
#include <stdint.h>

// These buffers are used by one game at a time. Tank needs the largest
// frame/depth allocation; Skyhook and the other games reuse the same arena.
namespace GameRenderMemory {
constexpr unsigned FRAME_BYTES = 120u * 160u;
constexpr unsigned DEPTH_BYTES = 120u * 128u;
constexpr unsigned CAPACITY = FRAME_BYTES + DEPTH_BYTES;
alignas(8) extern uint8_t bytes[CAPACITY];
}
