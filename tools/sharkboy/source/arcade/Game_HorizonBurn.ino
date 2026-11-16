#include "MenuPosters/HorizonBurn.h"
#include "HorizonBurn.h"

#if defined(GAME_API_LIFECYCLE_VERSION) && GAME_API_LIFECYCLE_VERSION >= 1
REGISTER_GAME_EX_ART(70, "HORIZON BURN",
    HorizonBurn::enter, HorizonBurn::update,
    HorizonBurn::leave, HorizonBurn::allowMenuExit, true, &MenuPosters::HorizonBurn::presentation);
#else
REGISTER_GAME_ART(70, "HORIZON BURN", HorizonBurn::enter, HorizonBurn::update, &MenuPosters::HorizonBurn::presentation);
#endif
