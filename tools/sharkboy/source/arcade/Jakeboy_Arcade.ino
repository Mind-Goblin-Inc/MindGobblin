/*
  JAKEBOY ARCADE: HOW TO ADD A GAME

  Add a new .ino tab in this folder (for example Game_MyGame.ino).
  Include GameAPI.h. Put your game state and functions in a unique namespace.
  Provide exactly these two functions:
    void MyGame::enter();                 // reset state and draw initial screen
    void MyGame::update(const GameInput&); // advance game each launcher loop
  At file scope register the game exactly once:
    REGISTER_GAME(30, "MY GAME", MyGame::enter, MyGame::update);

  Every registered game appears automatically. To force particular games to
  the top in a specific order, add their exact REGISTER_GAME title strings to
  PINNED_GAME_ORDER below. Games not listed there still appear automatically
  after the pinned games, sorted by their normal numeric order value.
  No launcher edit is required just to add a new game.

  Details: GameInput contains leftButton/rightButton held and leftPressed/
  rightPressed edges. Keep update() non-blocking. Use millis() for timing.
  The launcher owns GPIO, menu selection, and screen transitions. Your game
  may draw to its own Adafruit_ST7789 display or use its own helper code.
  The launcher calls enter() anew on every launch. Both buttons held together
  for 2 seconds return to the menu. GPIO assignments are in Hardware.h.
  Existing large games put gameplay in their .h file and register from a
  matching Game_*.ino tab to avoid Arduino's automatic prototype generation.
  A simple game may live entirely in its Game_*.ino tab. See GAME_TEMPLATE.txt.
  Capacity is MAX_GAMES (32) in GameAPI.h.
  Music/Settings/Hardware Test are built-in menu entries after the games.
*/
#include <Arduino.h>
#include <string.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include "Hardware.h"
#include "GameAPI.h"
#include "GameRenderMemory.h"
#include "MusicPlayer.h"
#if defined(ARDUINO_ARCH_ESP32)
#include <esp_system.h>
#else
#include <random>
#endif

alignas(8) uint8_t GameRenderMemory::bytes[GameRenderMemory::CAPACITY];

// Registration happens during startup. The fixed array avoids allocation.
//
// Optional pinned menu order:
//   - Put exact game TITLE strings here to force them to the top.
//   - They appear in exactly this order when those games are installed.
//   - A title listed here but not installed is simply ignored.
//   - Every registered game NOT listed here still appears automatically after
//     the pinned games, using its normal REGISTER_GAME order value.
//
// Edit only this list when you care about a game's exact menu position.
const char* const PINNED_GAME_ORDER[] = {
  "ALPINE SLALOM",
  "PONG",
  "FISHING",
  "DEEP HOOK",
  "HORIZON BURN",
  "TANK",
  "SPACE EVADERS",
  "ICE COLD BEER",
  "DEEP VECTOR",
  "METEOR SWEEP"
};

constexpr uint8_t PINNED_GAME_COUNT =
  sizeof(PINNED_GAME_ORDER) / sizeof(PINNED_GAME_ORDER[0]);

int pinnedGameRank(const char* title) {
  if (!title) return -1;

  for (uint8_t i = 0; i < PINNED_GAME_COUNT; ++i) {
    if (strcmp(title, PINNED_GAME_ORDER[i]) == 0) {
      return i;
    }
  }

  return -1;
}

bool gameComesBefore(const GameModule &a, const GameModule &b) {
  const int rankA = pinnedGameRank(a.title);
  const int rankB = pinnedGameRank(b.title);

  // If both games are pinned, the hard-coded list decides their order.
  if (rankA >= 0 && rankB >= 0) {
    return rankA < rankB;
  }

  // Pinned games always come before unpinned games.
  if (rankA >= 0) return true;
  if (rankB >= 0) return false;

  // Neither game is pinned: preserve the existing numeric ordering behavior.
  return a.order < b.order;
}

GameModule registeredGames[MAX_GAMES];
uint8_t registeredGameCount = 0;

bool registerGame(const GameModule &game) {
  if (registeredGameCount >= MAX_GAMES || !game.title || !game.enter || !game.update)
    return false;

  uint8_t slot = registeredGameCount++;

  while (slot > 0 && gameComesBefore(game, registeredGames[slot - 1])) {
    registeredGames[slot] = registeredGames[slot - 1];
    --slot;
  }

  registeredGames[slot] = game;
  return true;
}
uint8_t gameCount() { return registeredGameCount; }
const GameModule *gameAt(uint8_t index) {
  return index < registeredGameCount ? &registeredGames[index] : nullptr;
}
uint8_t gameAudioVolume() { return Music::volume; }

// ============================================================
// DISPLAY
// ============================================================


Adafruit_ST7789 display =
  Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);


// ============================================================
// 3-POSITION SWITCHES
// ============================================================

// LEFT SWITCH

// RIGHT SWITCH


// ============================================================
// BUTTONS
// ============================================================

// Physical RIGHT button
// Button 1

// Physical LEFT button
// Button 2


// ============================================================
// BUZZERS
// ============================================================


#define BUZZER_1_FREQ 440
#define BUZZER_2_FREQ 660


// ============================================================
// SCREEN / APPLICATION STATES
// ============================================================

enum AppScreen {
  SCREEN_BOOT,
  SCREEN_MENU,
  SCREEN_GAME,
  SCREEN_MUSIC,
  SCREEN_SETTINGS,
  SCREEN_TEST
};

AppScreen currentScreen = SCREEN_BOOT;


// ============================================================
// MENU
// ============================================================

// New games appear before these built-in tools.
constexpr int BUILTIN_MENU_ITEMS = 3; // music, settings, hardware test
int menuCount() { return gameCount() + BUILTIN_MENU_ITEMS; }
const char *menuLabel(int index) {
  if (index < gameCount()) return gameAt(index)->title;
  switch (index - gameCount()) {
    case 0: return "MUSIC PLAYER";
    case 1: return "SETTINGS";
    default: return "HARDWARE TEST";
  }
}
const GameModule *activeGame = nullptr;
int selectedMenuItem = 0;


// ============================================================
// INPUT STATE
// ============================================================

SwitchState leftSwitch = SWITCH_CENTER;
SwitchState rightSwitch = SWITCH_CENTER;

SwitchState previousLeftSwitch = SWITCH_CENTER;
SwitchState previousRightSwitch = SWITCH_CENTER;

bool leftButton = false;
bool rightButton = false;

bool previousLeftButton = false;
bool previousRightButton = false;


// ============================================================
// TIMING
// ============================================================

unsigned long lastInputTime = 0;

const unsigned long INPUT_DEBOUNCE = 120;


// ============================================================
// COLORS
// ============================================================



// ============================================================
// READ SWITCH
// ============================================================

SwitchState readSwitch(int upPin, int downPin) {

  bool up =
    digitalRead(upPin) == LOW;

  bool down =
    digitalRead(downPin) == LOW;

  if (up && !down) {
    return SWITCH_UP;
  }

  if (!up && down) {
    return SWITCH_DOWN;
  }

  if (!up && !down) {
    return SWITCH_CENTER;
  }

  return SWITCH_ERROR;
}


// ============================================================
// SWITCH NAME
// ============================================================

const char* switchName(SwitchState state) {

  switch (state) {

    case SWITCH_UP:
      return "UP";

    case SWITCH_CENTER:
      return "CENTER";

    case SWITCH_DOWN:
      return "DOWN";

    default:
      return "ERROR";
  }
}


// ============================================================
// INPUT UPDATE
// ============================================================

void updateInputs() {

  previousLeftSwitch = leftSwitch;
  previousRightSwitch = rightSwitch;

  previousLeftButton = leftButton;
  previousRightButton = rightButton;

  leftSwitch =
    readSwitch(
      LEFT_UP_PIN,
      LEFT_DOWN_PIN
    );

  rightSwitch =
    readSwitch(
      RIGHT_UP_PIN,
      RIGHT_DOWN_PIN
    );

  leftButton =
    digitalRead(BUTTON_2_PIN) == LOW;

  rightButton =
    digitalRead(BUTTON_1_PIN) == LOW;
}


// ============================================================
// BUTTON EDGE DETECTION
// ============================================================

bool leftButtonPressed() {

  return
    leftButton &&
    !previousLeftButton;
}


bool rightButtonPressed() {

  return
    rightButton &&
    !previousRightButton;
}


// ============================================================
// SWITCH EDGE DETECTION
// ============================================================

bool leftSwitchMovedUp() {

  return
    leftSwitch == SWITCH_UP &&
    previousLeftSwitch != SWITCH_UP;
}


bool leftSwitchMovedDown() {

  return
    leftSwitch == SWITCH_DOWN &&
    previousLeftSwitch != SWITCH_DOWN;
}

bool rightSwitchMovedUp() {
  return rightSwitch == SWITCH_UP && previousRightSwitch != SWITCH_UP;
}

bool rightSwitchMovedDown() {
  return rightSwitch == SWITCH_DOWN && previousRightSwitch != SWITCH_DOWN;
}


// ============================================================
// BUZZER HELPERS
// ============================================================

void beepRight() {

  ledcWriteTone(
    BUZZER_1_PIN,
    700
  );

  delay(25);

  ledcWriteTone(
    BUZZER_1_PIN,
    0
  );
}


void beepLeft() {

  ledcWriteTone(
    BUZZER_2_PIN,
    500
  );

  delay(25);

  ledcWriteTone(
    BUZZER_2_PIN,
    0
  );
}


// ============================================================
// HEADER
// ============================================================

void drawHeader(const char* title) {

  display.fillScreen(ST77XX_BLACK);

  display.setTextSize(2);
  display.setTextColor(ST77XX_WHITE);

  display.setCursor(12, 12);
  display.println(title);

  display.drawFastHLine(
    0,
    42,
    240,
    ST77XX_WHITE
  );
}


// ============================================================
// BOOT SCREEN
// ============================================================

void drawBootScreen() {

  display.fillScreen(ST77XX_BLACK);

  display.setTextColor(ST77XX_CYAN);
  display.setTextSize(3);

  display.setCursor(38, 90);
  display.println("SharkBoy");

  display.setTextColor(ST77XX_WHITE);
  display.setTextSize(2);

  display.setCursor(38, 135);
  display.println("By Jake :)");

  display.drawRect(
    30,
    190,
    180,
    20,
    ST77XX_WHITE
  );

  // fake loading animation without clearing screen

  for (int i = 0; i <= 172; i += 4) {

    display.fillRect(
      34,
      194,
      i,
      12,
      ST77XX_GREEN
    );

    delay(10);
  }

  delay(400);
}


// ============================================================
// MENU DRAWING
// ============================================================

#include "LauncherMenu.h"

void drawMainMenu() { LauncherMenu::enter(); }

// ============================================================
// MENU UPDATE
// ============================================================

void drawTestScreenStatic() {

  drawHeader(
    "HARDWARE TEST"
  );


  display.setTextSize(2);
  display.setTextColor(
    ST77XX_WHITE
  );


  display.setCursor(
    10,
    60
  );

  display.print(
    "L SW:"
  );


  display.setCursor(
    10,
    95
  );

  display.print(
    "R SW:"
  );


  display.drawFastHLine(
    0,
    128,
    240,
    ST77XX_WHITE
  );


  display.setCursor(
    10,
    145
  );

  display.print(
    "LEFT BTN:"
  );


  display.setCursor(
    10,
    180
  );

  display.print(
    "RIGHT BTN:"
  );


  display.drawFastHLine(
    0,
    215,
    240,
    ST77XX_WHITE
  );


  display.setTextSize(1);
  display.setTextColor(
    ST77XX_WHITE
  );

  display.setCursor(
    10,
    240
  );

  display.println(
    "LEFT BUTTON = BTN 2 / GPIO 27"
  );


  display.setCursor(
    10,
    255
  );

  display.println(
    "RIGHT BUTTON = BTN 1 / GPIO 14"
  );


  display.setCursor(
    10,
    285
  );

  display.println(
    "LEFT BTN + RIGHT DOWN = EXIT"
  );


  // Force first update

  previousLeftSwitch =
    SWITCH_ERROR;

  previousRightSwitch =
    SWITCH_ERROR;

  previousLeftButton =
    !leftButton;

  previousRightButton =
    !rightButton;
}


// ============================================================
// DRAW SWITCH VALUE
// ============================================================

void drawSwitchValue(
  int y,
  SwitchState state
) {

  display.fillRect(
    95,
    y,
    140,
    22,
    ST77XX_BLACK
  );

  display.setCursor(
    95,
    y
  );

  display.setTextSize(2);


  switch (state) {

    case SWITCH_UP:

      display.setTextColor(
        ST77XX_GREEN
      );

      break;


    case SWITCH_CENTER:

      display.setTextColor(
        ST77XX_YELLOW
      );

      break;


    case SWITCH_DOWN:

      display.setTextColor(
        ST77XX_CYAN
      );

      break;


    default:

      display.setTextColor(
        ST77XX_RED
      );

      break;
  }


  display.print(
    switchName(state)
  );
}


// ============================================================
// DRAW BUTTON VALUE
// ============================================================

void drawButtonValue(
  int y,
  bool pressed
) {

  display.fillRect(
    145,
    y,
    90,
    22,
    ST77XX_BLACK
  );

  display.setCursor(
    145,
    y
  );

  display.setTextSize(2);


  if (pressed) {

    display.setTextColor(
      ST77XX_GREEN
    );

    display.print(
      "DOWN"
    );

  } else {

    display.setTextColor(
      ST77XX_RED
    );

    display.print(
      "UP"
    );
  }
}


// ============================================================
// UPDATE TEST SCREEN
// ============================================================

void updateTestScreen() {

  // Switch values only redraw when changed

  if (
    leftSwitch !=
    previousLeftSwitch
  ) {

    drawSwitchValue(
      60,
      leftSwitch
    );
  }


  if (
    rightSwitch !=
    previousRightSwitch
  ) {

    drawSwitchValue(
      95,
      rightSwitch
    );
  }


  // Buttons only redraw when changed

  if (
    leftButton !=
    previousLeftButton
  ) {

    drawButtonValue(
      145,
      leftButton
    );
  }


  if (
    rightButton !=
    previousRightButton
  ) {

    drawButtonValue(
      180,
      rightButton
    );
  }


  // Buzzers while buttons are held

  if (leftButton) {

    ledcWriteTone(
      BUZZER_2_PIN,
      BUZZER_2_FREQ
    );

  } else {

    ledcWriteTone(
      BUZZER_2_PIN,
      0
    );
  }


  if (rightButton) {

    ledcWriteTone(
      BUZZER_1_PIN,
      BUZZER_1_FREQ
    );

  } else {

    ledcWriteTone(
      BUZZER_1_PIN,
      0
    );
  }


  // Hold LEFT button + move RIGHT switch DOWN
  // to exit test screen.
  //
  // This avoids instantly leaving the test screen
  // when you're trying to test the left button.

  if (
    leftButton &&
    rightSwitch == SWITCH_DOWN
  ) {

    ledcWriteTone(
      BUZZER_1_PIN,
      0
    );

    ledcWriteTone(
      BUZZER_2_PIN,
      0
    );

    delay(150);

    currentScreen =
      SCREEN_MENU;
  }
}


// ============================================================
// SETUP
// ============================================================



// On the main menu, either switch navigates and the right button selects.
// In Settings, the left button returns to the menu and the right button edits.
// In games, hold both buttons for 2 seconds to return; individual button taps
// remain available to the game. The same gesture works in the music screen.
uint32_t exitChordStarted = 0;
int settingsRow = 0;
int musicRow = 0;
int shownTestLeft = -1, shownTestRight = -1;
void drawMusicScreen() {
  drawHeader("MUSIC PLAYER");
  display.setTextSize(1);
  display.setTextColor(musicRow == 0 ? ST77XX_YELLOW : ST77XX_WHITE);
  display.setCursor(12, 72); display.print("SONG ");
  display.print(Music::selectedSong + 1); display.print("/"); display.print(Music::SONG_COUNT);
  display.setTextSize(2);
  display.setCursor(12, 91); display.print(Music::currentSong().title);
  display.setTextSize(1);
  display.setCursor(12, 119); display.print(Music::currentSong().style);
  display.setTextSize(2);
  display.setTextColor(musicRow == 1 ? ST77XX_YELLOW : ST77XX_WHITE);
  display.setCursor(15, 165); display.print("Playback: ");
  display.print(Music::enabled ? "ON" : "OFF");
  display.setTextColor(musicRow == 2 ? ST77XX_YELLOW : ST77XX_WHITE);
  display.setCursor(15, 205); display.print("Volume: ");
  display.print(Music::volume); display.print("%");
  display.setTextSize(1); display.setTextColor(ST77XX_WHITE);
  display.setCursor(12, 266); display.print("LEFT SWITCH: select row");
  display.setCursor(12, 281); display.print("RIGHT SWITCH: song / volume");
  display.setCursor(12, 296); display.print("LEFT BUTTON: menu");
}
void drawSettings() {
  drawHeader("SETTINGS");
  display.setTextSize(2);
  display.setCursor(12, 80);
  display.setTextColor(settingsRow == 0 ? ST77XX_YELLOW : ST77XX_WHITE);
  display.print("MUSIC: "); display.print(Music::enabled ? "ON " : "OFF");
  display.setCursor(12, 130);
  display.setTextColor(settingsRow == 1 ? ST77XX_YELLOW : ST77XX_WHITE);
  display.print("VOLUME: "); display.print(Music::volume); display.print("%   ");
  display.setTextSize(1); display.setTextColor(ST77XX_WHITE);
  display.setCursor(12, 215); display.print("LEFT SWITCH: choose setting");
  display.setCursor(12, 232); display.print("RIGHT SWITCH: change value");
  display.setCursor(12, 249); display.print("RIGHT BUTTON: toggle / volume +");
  display.setCursor(12, 266); display.print("LEFT BUTTON: back to menu");
}
int songForGame(const char *title) {
  if (strcmp(title, "ICE COLD BEER") == 0) return Music::SONG_HARBOR_WALTZ;
  if (strcmp(title, "FISHING") == 0) return Music::SONG_MIDNIGHT_TRAIN;
  if (strcmp(title, "DEEP VECTOR") == 0) return Music::SONG_CAVE_ECHO;
  if (strcmp(title, "TANK") == 0) return Music::SONG_IRON_MARCH;
  if (strcmp(title, "SPACE EVADERS") == 0) return Music::SONG_NEON_SPRINT;
  if (strcmp(title, "PONG") == 0) return Music::SONG_PIXEL_PARADE;
  if (strcmp(title, "DEEP HOOK") == 0) return Music::SONG_SUNSET_BOSSA;
  if (strcmp(title, "ODD STRIDE") == 0) return Music::SONG_DUST_ROAD;
  if (strcmp(title, "METEOR SWEEP") == 0) return Music::SONG_CLOUDSTEP;
  if (strcmp(title, "SKYHOOK") == 0 ||
      strcmp(title, "SCRAP CLAW") == 0) return Music::SONG_NOCTURNE;
  return -1;
}
void enterMenu() {
  const GameModule *leavingGame = (currentScreen == SCREEN_GAME) ? activeGame : nullptr;
  if (leavingGame && leavingGame->leave) leavingGame->leave();
  Music::playbackAllowed = false;
  Music::stopMusic();
  Music::gameMusicOwnsBuzzers = false;
  activeGame = nullptr;
  currentScreen = SCREEN_MENU;
  exitChordStarted = 0;
  drawMainMenu();
}
void launch(int item) {
  if (item < 0 || item >= menuCount()) return;
  LauncherMenu::cancel();
  if (item < gameCount()) {
    activeGame = gameAt(item);
    currentScreen = SCREEN_GAME;
    exitChordStarted = 0;
    const int gameSong = songForGame(activeGame->title);
    Music::gameMusicOwnsBuzzers = Music::enabled &&
      (Music::manualSongOverride || gameSong >= 0);
    Music::playbackAllowed = false;
    Music::stopMusic();
    if (Music::enabled && !Music::manualSongOverride && gameSong >= 0)
      Music::selectSong(gameSong, false);
    activeGame->enter();
    Music::playbackAllowed = Music::gameMusicOwnsBuzzers;
    if (Music::playbackAllowed) Music::startMusic();
    return;
  }
  switch (item - gameCount()) {
    case 0:
      currentScreen = SCREEN_MUSIC;
      Music::manualSongOverride = true;
      Music::playbackAllowed = true;
      if (Music::enabled) Music::startMusic();
      musicRow = 0; drawMusicScreen();
      break;
    case 1:
      currentScreen = SCREEN_SETTINGS;
      Music::playbackAllowed = false;
      Music::stopMusic();
      drawSettings(); break;
    case 2:
      Music::playbackAllowed = false;
      Music::stopMusic();
      currentScreen = SCREEN_TEST;
      drawTestScreenStatic();
      drawSwitchValue(60, leftSwitch);
      drawSwitchValue(95, rightSwitch);
      drawButtonValue(145, leftButton);
      drawButtonValue(180, rightButton);
      break;
  }
}
void updateMainMenu() { LauncherMenu::update(); }
uint32_t makeMenuSessionSeed() {
#if defined(ARDUINO_ARCH_ESP32)
  return esp_random();
#else
  return std::random_device{}();
#endif
}
void setup() {
  Serial.begin(115200);
  pinMode(LEFT_UP_PIN, INPUT_PULLUP); pinMode(LEFT_DOWN_PIN, INPUT_PULLUP);
  pinMode(RIGHT_UP_PIN, INPUT_PULLUP); pinMode(RIGHT_DOWN_PIN, INPUT_PULLUP);
  pinMode(BUTTON_1_PIN, INPUT_PULLUP); pinMode(BUTTON_2_PIN, INPUT_PULLUP);
  SPI.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  display.init(240,320); display.setRotation(0); display.setTextWrap(false);
  Music::enter();
  leftSwitch = readSwitch(LEFT_UP_PIN, LEFT_DOWN_PIN);
  rightSwitch = readSwitch(RIGHT_UP_PIN, RIGHT_DOWN_PIN);
  previousLeftSwitch = leftSwitch; previousRightSwitch = rightSwitch;
  leftButton = digitalRead(BUTTON_2_PIN) == LOW;
  rightButton = digitalRead(BUTTON_1_PIN) == LOW;
  previousLeftButton = leftButton; previousRightButton = rightButton;
  MenuCartridge::beginSession(makeMenuSessionSeed());
  drawBootScreen(); enterMenu();
}
void loop() {
  updateInputs();
  if (Music::enabled && Music::playbackAllowed) Music::tick();
  if (currentScreen == SCREEN_MENU) updateMainMenu();
  else if (currentScreen == SCREEN_SETTINGS) {
    int old = settingsRow;
    if (leftSwitchMovedUp()) settingsRow = 0;
    if (leftSwitchMovedDown()) settingsRow = 1;
    bool changed = old != settingsRow;
    if (settingsRow == 0 && (rightButtonPressed() || rightSwitch != previousRightSwitch && rightSwitch != SWITCH_CENTER)) {
      Music::setEnabled(!Music::enabled); changed = true;
    } else if (settingsRow == 1) {
      int delta = 0;
      if (rightSwitch == SWITCH_UP && previousRightSwitch != SWITCH_UP) delta = 5;
      if (rightSwitch == SWITCH_DOWN && previousRightSwitch != SWITCH_DOWN) delta = -5;
      if (rightButtonPressed()) delta = 5;
      if (delta) { Music::setVolume(constrain((int)Music::volume + delta, 0, 100)); changed = true; }
    }
    if (changed) drawSettings();
    if (leftButtonPressed()) enterMenu();
  } else if (currentScreen == SCREEN_TEST) {
    updateTestScreen();
    if (currentScreen == SCREEN_MENU) enterMenu();
  } else {
    // Both buttons held prevents a quick accidental exit while playing.
    if (leftButton && rightButton) {
      if (!exitChordStarted) exitChordStarted = millis();
      if (millis() - exitChordStarted >= 2000) {
        const bool exitAllowed = !activeGame || !activeGame->allowMenuExit || activeGame->allowMenuExit();
        if (exitAllowed) { enterMenu(); return; }
      }
    } else exitChordStarted = 0;
    if (currentScreen == SCREEN_GAME && activeGame) {
      const GameInput input = {leftButton, rightButton,
                               leftButtonPressed(), rightButtonPressed()};
      activeGame->update(input);
    }
    if (currentScreen == SCREEN_MUSIC) {
      int oldRow = musicRow;
      if (leftSwitchMovedUp()) musicRow = (musicRow + 2) % 3;
      if (leftSwitchMovedDown()) musicRow = (musicRow + 1) % 3;
      bool changed = oldRow != musicRow;
      const bool valueUp = rightSwitchMovedUp();
      const bool valueDown = rightSwitchMovedDown();
      if (rightButtonPressed()) {
        if (musicRow == 0) Music::selectSong(Music::selectedSong + 1);
        else if (musicRow == 1) Music::setEnabled(!Music::enabled);
        else Music::setVolume(constrain((int)Music::volume + 5, 0, 100));
        changed = true;
      }
      if (valueUp || valueDown) {
        if (musicRow == 0) Music::selectSong((int)Music::selectedSong + (valueUp ? -1 : 1));
        else if (musicRow == 1) Music::setEnabled(valueUp);
        else Music::setVolume(constrain((int)Music::volume + (valueUp ? 5 : -5), 0, 100));
        changed = true;
      }
      if (changed) drawMusicScreen();
      if (leftButtonPressed()) enterMenu();
    }
  }
  delay(2);
}
