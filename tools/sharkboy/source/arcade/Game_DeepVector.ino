#include "MenuPosters/DeepVector.h"
// Deep Vector game tab. Change only DeepVector.h to edit its gameplay.
#include "DeepVector.h"
namespace DeepVector {
void update(const GameInput &input) { tick(input.leftButton || input.rightButton); }
}
REGISTER_GAME_ART(10, "DEEP VECTOR", DeepVector::enter, DeepVector::update, &MenuPosters::DeepVector::presentation);
