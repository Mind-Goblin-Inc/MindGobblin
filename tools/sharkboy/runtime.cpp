#include <SDL.h>
#include <emscripten.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>

namespace Web {
double epoch = 0, pausedAt = 0, pausedTotal = 0;
bool paused = false, muted = false, ready = false;
unsigned input = 0;
int command = 0, browse = 0, cartridge = -1;
int clickX = -1, clickY = -1;
SDL_Window *window = nullptr;
SDL_Renderer *renderer = nullptr;
SDL_Texture *texture = nullptr;
SDL_AudioDeviceID audio = 0;
double lastPresented = -100;
unsigned sleepGeneration = 0;
void present();
}

double sharkboyNow() {
  return (Web::paused ? Web::pausedAt : emscripten_get_now()) - Web::epoch - Web::pausedTotal;
}
void sharkboyDelay(unsigned long ms) {
  const double until = sharkboyNow() + ms;
  do {
    Web::present();
    ++Web::sleepGeneration;
    emscripten_sleep(Web::paused ? 16 : std::max(1, std::min(16, int(std::ceil(until - sharkboyNow())))));
  } while (Web::paused || sharkboyNow() < until);
}

#include <SimGame.h>

namespace Web {
double phases[2]{};
int sampleRate = 48000;
void renderAudio(void *, Uint8 *stream, int length) {
  auto *samples = reinterpret_cast<float *>(stream);
  constexpr uint8_t pins[] = {BUZZER_1_PIN, BUZZER_2_PIN};
  for (int i = 0; i < length / int(sizeof(float)); ++i) {
    float mixed = 0;
    for (int voice = 0; voice < 2; ++voice) {
      const auto &pin = ArduinoSim::tonePins[pins[voice]];
      const auto hz = pin.frequency.load(std::memory_order_relaxed);
      const auto duty = pin.duty.load(std::memory_order_relaxed);
      if (!hz || !duty) continue;
      const double width = double(duty) / 1023.0;
      mixed += float(0.16 * (phases[voice] < width ? 1.0 - width : -width));
      phases[voice] += double(hz) / sampleRate;
      phases[voice] -= std::floor(phases[voice]);
    }
    samples[i] = paused || muted ? 0 : mixed;
  }
}
void present() {
  if (!texture) return;
  const double now = emscripten_get_now();
  if (now - lastPresented < 16) return;
  lastPresented = now;
  SDL_UpdateTexture(texture, nullptr, display.pixels(), 240 * int(sizeof(uint16_t)));
  SDL_RenderClear(renderer);
  SDL_RenderCopy(renderer, texture, nullptr, nullptr);
  SDL_RenderPresent(renderer);
}
void applyInput() {
  constexpr uint8_t pins[] = {LEFT_UP_PIN, LEFT_DOWN_PIN, RIGHT_UP_PIN,
                            RIGHT_DOWN_PIN, BUTTON_2_PIN, BUTTON_1_PIN};
  for (unsigned i = 0; i < 6; ++i) simSetPinLow(pins[i], !paused && (input & (1u << i)));
}
void volume(int delta) {
  Music::setVolume(uint8_t(constrain(int(Music::volume) + delta, 0, 100)));
  if (currentScreen == SCREEN_SETTINGS) drawSettings();
  if (currentScreen == SCREEN_MUSIC) drawMusicScreen();
}
void wheel(int steps) {
  if (currentScreen == SCREEN_MENU) requestMenuMove(steps);
  else if (currentScreen == SCREEN_SETTINGS) volume(-steps * 5);
  else if (currentScreen == SCREEN_MUSIC) {
    Music::selectSong(int(Music::selectedSong) + steps);
    drawMusicScreen();
  }
}
void click(int x, int y) {
  if (x < 0 || x >= 240 || y < 0 || y >= 320) return;
  if (currentScreen == SCREEN_MENU) {
    if (y >= 280 && x < 24) requestMenuMove(-1);
    else if (y >= 280 && x >= 210) requestMenuMove(1);
    else requestMenuLaunch();
  } else if (currentScreen == SCREEN_MUSIC) {
    if (y >= 65 && y < 145) { musicRow = 0; Music::selectSong(int(Music::selectedSong) + (x < 120 ? -1 : 1)); }
    else if (y >= 150 && y < 195) { musicRow = 1; Music::setEnabled(!Music::enabled); }
    else if (y >= 195 && y < 245) { musicRow = 2; volume(x < 120 ? -5 : 5); }
    else if (y >= 260) { enterMenu(); return; }
    drawMusicScreen();
  } else if (currentScreen == SCREEN_SETTINGS) {
    if (y >= 65 && y < 115) { settingsRow = 0; Music::setEnabled(!Music::enabled); }
    else if (y >= 115 && y < 175) { settingsRow = 1; volume(x < 120 ? -5 : 5); }
    else if (y >= 250) { enterMenu(); return; }
    drawSettings();
  }
}
void commands() {
  const int action = command;
  command = 0;
  if (action) {
    input = 0; applyInput(); updateInputs();
    // The toolbar is an explicit user request, independent of the exit chord.
    enterMenu();
    if (action == 2 && cartridge >= 0 && cartridge < menuCount()) {
      selectedMenuItem = cartridge;
      enterMenu();
      requestMenuLaunch();
    }
  }
  if (browse) { const int steps = browse; browse = 0; wheel(steps); }
  if (clickX >= 0) { int x = clickX, y = clickY; clickX = clickY = -1; click(x, y); }
}
}

extern "C" {
EM_JS(void, resumeAudioContext, (), {
  const context = Module['SDL2'] && Module['SDL2'].audioContext;
  if (context) context.resume().catch(() => {});
});
EMSCRIPTEN_KEEPALIVE void web_resume_audio() { resumeAudioContext(); }
EMSCRIPTEN_KEEPALIVE void web_input(unsigned bits) { Web::input = bits & 63u; }
EMSCRIPTEN_KEEPALIVE void web_pause(int value) {
  const bool pause = value != 0;
  if (pause == Web::paused) return;
  if (pause) { Web::pausedAt = emscripten_get_now(); Web::input = 0; }
  else Web::pausedTotal += emscripten_get_now() - Web::pausedAt;
  Web::paused = pause;
  Web::applyInput();
}
EMSCRIPTEN_KEEPALIVE void web_mute(int value) { Web::muted = value != 0; }
EMSCRIPTEN_KEEPALIVE void web_command(int action) {
  Web::cartridge = currentScreen == SCREEN_GAME ? selectedMenuItem : -1;
  Web::command = action == 2 && Web::cartridge >= 0 ? 2 : 1;
}
EMSCRIPTEN_KEEPALIVE void web_cartridge(int item) {
  if (item >= 0 && item < menuCount()) { Web::cartridge = item; Web::command = 2; }
}
EMSCRIPTEN_KEEPALIVE void web_browse(int steps) { Web::browse = std::max(-16, std::min(16, Web::browse + steps)); }
EMSCRIPTEN_KEEPALIVE void web_click(int x, int y) { Web::clickX = x; Web::clickY = y; }
EMSCRIPTEN_KEEPALIVE int web_ready() { return Web::ready; }
EMSCRIPTEN_KEEPALIVE int web_screen() { return currentScreen; }
EMSCRIPTEN_KEEPALIVE int web_selected() { return selectedMenuItem; }
EMSCRIPTEN_KEEPALIVE int web_count() { return menuCount(); }
EMSCRIPTEN_KEEPALIVE int web_audio() { return Web::audio != 0; }
EMSCRIPTEN_KEEPALIVE int web_input_state() {
  constexpr uint8_t pins[] = {LEFT_UP_PIN, LEFT_DOWN_PIN, RIGHT_UP_PIN,
                            RIGHT_DOWN_PIN, BUTTON_2_PIN, BUTTON_1_PIN};
  int bits = 0;
  for (int i = 0; i < 6; ++i) if (digitalRead(pins[i]) == LOW) bits |= 1 << i;
  return bits;
}
EMSCRIPTEN_KEEPALIVE double web_time() { return sharkboyNow(); }
EMSCRIPTEN_KEEPALIVE const char *web_title(int item) {
  if (item < 0 || item >= menuCount()) return "";
  if (item < gameCount()) return gameAt(item)->title;
  constexpr const char *tools[] = {"MUSIC PLAYER", "SETTINGS", "HARDWARE TEST"};
  return tools[item - gameCount()];
}
EMSCRIPTEN_KEEPALIVE int web_tone(int voice) {
  return ArduinoSim::tonePins[voice == 0 ? BUZZER_1_PIN : BUZZER_2_PIN].frequency.load();
}
}

int main() {
  Web::epoch = emscripten_get_now();
  SDL_SetHint(SDL_HINT_RENDER_SCALE_QUALITY, "0");
  SDL_SetHint(SDL_HINT_EMSCRIPTEN_KEYBOARD_ELEMENT, "#game");
  if (SDL_Init(SDL_INIT_VIDEO) != 0) return 1;
  Web::window = SDL_CreateWindow("SharkBoy Emulator", 0, 0, 240, 320, SDL_WINDOW_SHOWN);
  Web::renderer = SDL_CreateRenderer(Web::window, -1, SDL_RENDERER_ACCELERATED);
  if (!Web::renderer) Web::renderer = SDL_CreateRenderer(Web::window, -1, SDL_RENDERER_SOFTWARE);
  if (!Web::renderer) { std::fprintf(stderr, "Display unavailable: %s\n", SDL_GetError()); return 2; }
  Web::texture = SDL_CreateTexture(Web::renderer, SDL_PIXELFORMAT_RGB565, SDL_TEXTUREACCESS_STREAMING, 240, 320);
  if (!Web::texture) return 3;
  SDL_RenderSetLogicalSize(Web::renderer, 240, 320);
  SDL_AudioSpec wanted{}, obtained{};
  wanted.freq = 48000; wanted.format = AUDIO_F32SYS; wanted.channels = 1;
  wanted.samples = 512; wanted.callback = Web::renderAudio;
  if (SDL_InitSubSystem(SDL_INIT_AUDIO) == 0)
    Web::audio = SDL_OpenAudioDevice(nullptr, 0, &wanted, &obtained, 0);
  if (Web::audio) { Web::sampleRate = obtained.freq; SDL_PauseAudioDevice(Web::audio, 0); }
  Web::applyInput();
  SimGame::enter();
  Web::ready = true;
  double lastPresent = 0;
  while (true) {
    if (Web::paused) { emscripten_sleep(16); continue; }
    SDL_Event event;
    while (SDL_PollEvent(&event)) {}
    Web::commands();
    Web::applyInput();
    const unsigned generation = Web::sleepGeneration;
    SimGame::update({});
    const double now = sharkboyNow();
    if (now - lastPresent >= 16) { Web::present(); lastPresent = now; }
    // The sketch's delay already yields. Avoid a second timer per update;
    // browser timer clamping would halve the rate of menu strip composition.
    if (Web::sleepGeneration == generation) emscripten_sleep(1);
  }
}
