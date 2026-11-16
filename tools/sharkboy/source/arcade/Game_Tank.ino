#include "MenuPosters/Tank.h"
#include "GameAPI.h"
#include "Hardware.h"
#include "TankGame.h"

REGISTER_GAME_ART(30, "TANK", tank::enter, tank::update, &MenuPosters::Tank::presentation);
