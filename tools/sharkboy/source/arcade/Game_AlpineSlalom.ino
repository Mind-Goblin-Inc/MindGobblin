#include "MenuPosters/AlpineSlalom.h"
// Jakeboy Arcade registration bridge for Alpine Slalom.
#include "AlpineSlalom.h"

#if defined(GAME_API_LIFECYCLE_VERSION) && GAME_API_LIFECYCLE_VERSION >= 1
REGISTER_GAME_EX_ART(
  80,
  "ALPINE SLALOM",
  AlpineSlalom::enter,
  AlpineSlalom::update,
  AlpineSlalom::leave,
  AlpineSlalom::allowMenuExit,
  true, &MenuPosters::AlpineSlalom::presentation);
#else
REGISTER_GAME_ART(
  80,
  "ALPINE SLALOM",
  AlpineSlalom::enter,
  AlpineSlalom::update, &MenuPosters::AlpineSlalom::presentation);
#endif
