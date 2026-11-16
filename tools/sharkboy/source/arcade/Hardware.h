#pragma once
// ESP32 WROOM / ST7789 240x320 portrait pin map.
#define TFT_MOSI 23
#define TFT_SCLK 18
#define TFT_DC 17
#define TFT_CS 5
#define TFT_RST 16
#define LEFT_UP_PIN 33
#define LEFT_DOWN_PIN 32
#define RIGHT_UP_PIN 26
#define RIGHT_DOWN_PIN 25
#define BUTTON_1_PIN 14 // physical right button
#define BUTTON_2_PIN 27 // physical left button
#define BUZZER_1_PIN 22
#define BUZZER_2_PIN 21

// Defined in a header so Arduino's generated .ino prototypes can use this
// type even when it inserts them before the launcher function definitions.
enum SwitchState {
  SWITCH_UP,
  SWITCH_CENTER,
  SWITCH_DOWN,
  SWITCH_ERROR
};
