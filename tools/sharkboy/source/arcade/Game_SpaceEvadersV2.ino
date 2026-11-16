#include "MenuPosters/SpaceEvaders.h"
#include "GameAPI.h"
#include "Hardware.h"
#include "SpaceEvadersV2.h"

// Drop-in Jakeboy Arcade registration. Change 70 only if that order is already used.
REGISTER_GAME_ART(70, "SPACE EVADERS", SpaceEvadersV2::enter, SpaceEvadersV2::update, &MenuPosters::SpaceEvaders::presentation);
