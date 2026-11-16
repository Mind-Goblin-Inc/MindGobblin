#include "MenuPosters/DeepHook.h"
#include "GameAPI.h"
#include "Hardware.h"
#include "DeepHook.h"

// Drop-in registration tab. 95 is intentionally separated from the common
// low-number game orders; change only if your sketch already uses 95.
REGISTER_GAME_ART(95, "DEEP HOOK", DeepHook::enter, DeepHook::update, &MenuPosters::DeepHook::presentation);
