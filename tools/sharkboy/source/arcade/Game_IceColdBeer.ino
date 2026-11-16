#include "MenuPosters/IceColdBeer.h"
// Ice Cold Beer game tab. Change only IceColdBeer.h to edit its gameplay.
#include "IceColdBeer.h"
namespace IceColdBeer {
void update(const GameInput &) { tick(); }
}
REGISTER_GAME_ART(20, "ICE COLD BEER", IceColdBeer::enter, IceColdBeer::update, &MenuPosters::IceColdBeer::presentation);
