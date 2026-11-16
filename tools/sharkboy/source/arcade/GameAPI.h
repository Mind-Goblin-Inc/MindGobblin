#pragma once

#include <Arduino.h>
#include <Adafruit_ST7789.h>
struct MenuPresentation;

// -----------------------------------------------------------------------------
// Shared Display
// -----------------------------------------------------------------------------
// The launcher owns the one TFT object used by all games.
// Games must reuse this instead of creating another Adafruit_ST7789 instance
// for the same physical display.
extern Adafruit_ST7789 display;


// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------
// Snapshot passed to each game's update() function once per launcher loop.
struct GameInput {
  bool leftButton;      // GPIO 27 (button 2)
  bool rightButton;     // GPIO 14 (button 1)

  bool leftPressed;     // true only on a new press this update
  bool rightPressed;    // true only on a new press this update
};


// -----------------------------------------------------------------------------
// Game Module
// -----------------------------------------------------------------------------
struct GameModule {
  uint8_t order;                     // menu order; lower numbers first
  const char *title;                 // ideally <= 15 chars at text size 2

  void (*enter)();                   // called whenever selected; reset/draw game
  void (*update)(const GameInput &); // called each launcher loop

  // Optional extended lifecycle hooks.
  void (*leave)();                   // nullptr for legacy games
  bool (*allowMenuExit)();           // nullptr => legacy exit chord allowed

  // true if this game directly owns/controls the buzzers while active.
  bool ownsBuzzers;
  const MenuPresentation *menuPresentation; // nullptr selects generic artwork
};


// -----------------------------------------------------------------------------
// API / Registry Configuration
// -----------------------------------------------------------------------------

// Lets games conditionally compile against the extended lifecycle API.
#define GAME_API_LIFECYCLE_VERSION 1
#define GAME_API_MENU_VERSION 1

// Maximum number of registered games.
constexpr uint8_t MAX_GAMES = 32;


// -----------------------------------------------------------------------------
// Registry API
// -----------------------------------------------------------------------------

bool registerGame(const GameModule &game);

uint8_t gameCount();

const GameModule *gameAt(uint8_t index);


// -----------------------------------------------------------------------------
// Shared Audio
// -----------------------------------------------------------------------------
// Returns the launcher's current game-SFX volume.
// Implemented by the launcher using Music::volume.
uint8_t gameAudioVolume();


// -----------------------------------------------------------------------------
// Registration Helpers
// -----------------------------------------------------------------------------

#define GAME_REGISTRY_JOIN_INNER(a, b) a##b
#define GAME_REGISTRY_JOIN(a, b) GAME_REGISTRY_JOIN_INNER(a, b)


// -----------------------------------------------------------------------------
// Legacy / Normal Registration
// -----------------------------------------------------------------------------
// Each game file should normally contain exactly one REGISTER_GAME statement.
//
// Existing games do NOT need to be modified.
//
// leave             = nullptr
// allowMenuExit     = nullptr
// ownsBuzzers       = false
//
// Example:
//
// REGISTER_GAME(10, "Pong", Pong::enter, Pong::update);
//
#define REGISTER_GAME(ORDER, TITLE, ENTER, UPDATE)                         \
  static const bool GAME_REGISTRY_JOIN(registeredGame_, __COUNTER__) =    \
    registerGame({                                                         \
      ORDER,                                                               \
      TITLE,                                                               \
      ENTER,                                                               \
      UPDATE,                                                              \
      nullptr,                                                             \
      nullptr,                                                             \
      false,                                                               \
      nullptr                                                              \
    })


// -----------------------------------------------------------------------------
// Extended Registration
// -----------------------------------------------------------------------------
// Use this when a game needs:
//   - cleanup when leaving
//   - control over whether the launcher can exit
//   - direct ownership of the buzzers
//
// Example:
//
// REGISTER_GAME_EX(
//   20,
//   "Deep Hook",
//   DeepHook::enter,
//   DeepHook::update,
//   DeepHook::leave,
//   DeepHook::allowMenuExit,
//   true
// );
//
#define REGISTER_GAME_EX(ORDER, TITLE, ENTER, UPDATE, LEAVE, EXIT_OK, AUDIO) \
  static const bool GAME_REGISTRY_JOIN(registeredGame_, __COUNTER__) =       \
    registerGame({                                                            \
      ORDER,                                                                  \
      TITLE,                                                                  \
      ENTER,                                                                  \
      UPDATE,                                                                 \
      LEAVE,                                                                  \
      EXIT_OK,                                                                \
      AUDIO,                                                                  \
      nullptr                                                                 \
    })

#define REGISTER_GAME_ART(ORDER, TITLE, ENTER, UPDATE, ART)                 \
  static const bool GAME_REGISTRY_JOIN(registeredGame_, __COUNTER__) =     \
    registerGame({ORDER, TITLE, ENTER, UPDATE, nullptr, nullptr, false, ART})

#define REGISTER_GAME_EX_ART(ORDER, TITLE, ENTER, UPDATE, LEAVE, EXIT_OK, AUDIO, ART) \
  static const bool GAME_REGISTRY_JOIN(registeredGame_, __COUNTER__) =     \
    registerGame({ORDER, TITLE, ENTER, UPDATE, LEAVE, EXIT_OK, AUDIO, ART})
