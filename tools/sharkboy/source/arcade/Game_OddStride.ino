#include "MenuPosters/OddStride.h"
#include "GameAPI.h"
#include "OddStride.h"

REGISTER_GAME_EX_ART(230, "ODD STRIDE",
                 OddStride::enter, OddStride::update,
                 OddStride::leave, OddStride::allowMenuExit, true, &MenuPosters::OddStride::presentation);
