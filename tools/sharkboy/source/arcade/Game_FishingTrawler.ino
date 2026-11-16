#include "MenuPosters/Fishing.h"
#include "FishingTrawler.h"

REGISTER_GAME_ART(70, "FISHING", FishingTrawler::enter, FishingTrawler::update, &MenuPosters::Fishing::presentation);
