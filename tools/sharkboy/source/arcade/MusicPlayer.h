#pragma once
#include <Arduino.h>
#include <math.h>
#include <ctype.h>
#include "ArcadeSongs.h"

namespace Music {

// ============================================================
// ESP32 TWO-BUZZER ABC MUSIC PLAYER
//
// Passive buzzer 1:
//   + -> GPIO 22
//   - -> GND
//
// Passive buzzer 2:
//   + -> GPIO 21
//   - -> GND
//
// RH / Treble -> GPIO 22
// LH / Bass   -> GPIO 21
//
// The selectable ABC songs are in ArcadeSongs.h.
// ============================================================


// ============================================================
// HARDWARE
// ============================================================

#define BUZZER_RH_PIN 22
#define BUZZER_LH_PIN 21

// Original ESP32 has channels 0-7 in one LEDC group
// and 8-15 in another.
//
// Using channels 0 and 8 keeps the two buzzers on separate
// timer groups, allowing truly independent frequencies.

#define BUZZER_RH_CHANNEL 0
#define BUZZER_LH_CHANNEL 8

// ledcWriteTone() changes the pin to 10-bit resolution on ESP32 Arduino.
// Duty values written afterward must use that same 10-bit range.
#define BUZZER_RESOLUTION 10


// ============================================================
// MUSIC SETTINGS
// ============================================================

const bool LOOP_SONG = true;
bool enabled = true;
bool manualSongOverride = false;
bool gameMusicOwnsBuzzers = false;
bool playbackAllowed = false;
bool gameEffectsAllowed() { return enabled && !gameMusicOwnsBuzzers; }
uint8_t volume = 50;
uint32_t currentRhHz = 0, currentLhHz = 0;
uint32_t dutyForVolume(uint8_t percent) {
  const uint32_t level = percent > 100 ? 100 : percent;
  return (511u * level * level + 5000u) / 10000u;
}
void applyVolume(uint8_t pin) {
  uint32_t hz = pin == BUZZER_RH_PIN ? currentRhHz : currentLhHz;
  // ledcWriteTone() sets a 10-bit PWM timer and a 511/1023 half-duty tone.
  // A curved duty ramp makes the lower volume steps noticeably quieter.
  const uint32_t duty = hz && enabled ? dutyForVolume(volume) : 0;
  ledcWrite(pin, duty);
}


// Percentage of each note that actually produces sound.
//
// 100 = fully connected notes
// 90-95 = more clearly separated piezo notes
const int GATE_PERCENT = 92;

// Pitch shifting in semitones.
//
// If the bass sounds weak/clicky:
// change LH_OCTAVE_SHIFT from 0 to 12.
const int RH_OCTAVE_SHIFT = 0;
const int LH_OCTAVE_SHIFT = 0;


// ============================================================
// DATA TYPES
//
// IMPORTANT:
// These must remain ABOVE all functions in an Arduino .ino.
// ============================================================

struct NoteEvent {
  int16_t midi;           // MIDI note number. -1 = rest
  uint32_t durationMs;    // Total duration
  bool fullGate;          // Used for tied notes
};


struct VoicePlayer {
  NoteEvent *events;

  int count;
  int index;

  uint8_t pin;

  uint32_t eventEnd;
  uint32_t gateOff;

  bool gateSilenced;
  bool finished;
};


// ============================================================
// EVENT STORAGE
// ============================================================

// The largest bundled song currently uses 100 events in one voice. Keep room
// for longer arrangements without reserving unused DRAM for every game.
const int MAX_EVENTS = 160;

NoteEvent rhEvents[MAX_EVENTS];
NoteEvent lhEvents[MAX_EVENTS];

int rhEventCount = 0;
int lhEventCount = 0;


// ============================================================
// VOICE PLAYERS
// ============================================================

VoicePlayer rhPlayer;
VoicePlayer lhPlayer;


// ============================================================
// ABC GLOBAL SETTINGS
// ============================================================

float tempoBPM = 120.0;

int defaultLengthNum = 1;
int defaultLengthDen = 8;

// C D E F G A B
int keyAccidental[7] = {
  0, 0, 0, 0, 0, 0, 0
};


// ============================================================
// LOOP CONTROL
// ============================================================

bool waitingToRestart = false;
uint32_t restartTime = 0;
uint8_t selectedSong = 0;
const SongDef &currentSong() { return SONGS[selectedSong]; }


// ============================================================
// UTILITY
// ============================================================

bool timeReached(uint32_t now, uint32_t target) {
  return (int32_t)(now - target) >= 0;
}


int letterIndex(char c) {

  c = toupper((unsigned char)c);

  switch (c) {

    case 'C':
      return 0;

    case 'D':
      return 1;

    case 'E':
      return 2;

    case 'F':
      return 3;

    case 'G':
      return 4;

    case 'A':
      return 5;

    case 'B':
      return 6;
  }

  return -1;
}


// ============================================================
// KEY SIGNATURE
// ============================================================

void clearKeySignature() {

  for (int i = 0; i < 7; i++) {
    keyAccidental[i] = 0;
  }
}


void applyFifths(int fifths) {

  clearKeySignature();

  // Letter indexes:
  //
  // C = 0
  // D = 1
  // E = 2
  // F = 3
  // G = 4
  // A = 5
  // B = 6

  const int sharpOrder[7] = {
    3, // F
    0, // C
    4, // G
    1, // D
    5, // A
    2, // E
    6  // B
  };

  const int flatOrder[7] = {
    6, // B
    2, // E
    5, // A
    1, // D
    4, // G
    0, // C
    3  // F
  };


  if (fifths > 0) {

    for (int i = 0; i < fifths && i < 7; i++) {

      keyAccidental[sharpOrder[i]] = 1;
    }

  } else if (fifths < 0) {

    for (int i = 0; i < -fifths && i < 7; i++) {

      keyAccidental[flatOrder[i]] = -1;
    }
  }
}


void setKeySignature(String key) {

  key.trim();

  if (key.length() == 0) {

    clearKeySignature();
    return;
  }


  char rootLetter = toupper((unsigned char)key[0]);

  String root = "";
  root += rootLetter;

  int pos = 1;


  // Sharp / flat root

  if (pos < key.length()) {

    if (key[pos] == '#') {

      root += "#";
      pos++;

    } else if (key[pos] == 'b') {

      root += "b";
      pos++;
    }
  }


  String mode = key.substring(pos);

  mode.trim();
  mode.toLowerCase();


  bool minor = false;

  if (
    mode.startsWith("m") &&
    !mode.startsWith("mix")
  ) {
    minor = true;
  }


  int fifths = 0;
  bool found = false;


  // Major keys
  const char *majorKeys[] = {
    "Cb",
    "Gb",
    "Db",
    "Ab",
    "Eb",
    "Bb",
    "F",
    "C",
    "G",
    "D",
    "A",
    "E",
    "B",
    "F#",
    "C#"
  };


  const int majorFifths[] = {
    -7,
    -6,
    -5,
    -4,
    -3,
    -2,
    -1,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7
  };


  // Minor keys
  const char *minorKeys[] = {
    "Ab",
    "Eb",
    "Bb",
    "F",
    "C",
    "G",
    "D",
    "A",
    "E",
    "B",
    "F#",
    "C#",
    "G#",
    "D#",
    "A#"
  };


  const int minorFifths[] = {
    -7,
    -6,
    -5,
    -4,
    -3,
    -2,
    -1,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7
  };


  if (minor) {

    for (int i = 0; i < 15; i++) {

      if (root == minorKeys[i]) {

        fifths = minorFifths[i];
        found = true;

        break;
      }
    }

  } else {

    for (int i = 0; i < 15; i++) {

      if (root == majorKeys[i]) {

        fifths = majorFifths[i];
        found = true;

        break;
      }
    }
  }


  if (!found) {

    Serial.print("Unknown key signature: ");
    Serial.println(key);

    clearKeySignature();

    return;
  }


  applyFifths(fifths);
}


// ============================================================
// ABC HEADER PARSING
// ============================================================

void parseDefaultLength(String value) {

  value.trim();

  int slash = value.indexOf('/');

  if (slash < 0) {
    return;
  }


  int numerator =
    value.substring(0, slash).toInt();

  int denominator =
    value.substring(slash + 1).toInt();


  if (
    numerator > 0 &&
    denominator > 0
  ) {

    defaultLengthNum = numerator;
    defaultLengthDen = denominator;
  }
}


void parseTempo(String value) {

  value.trim();

  // Supports:
  //
  // Q:1/4=76
  //
  // and
  //
  // Q:76

  int equals =
    value.lastIndexOf('=');


  if (equals >= 0) {

    float newTempo =
      value.substring(equals + 1).toFloat();


    if (newTempo > 0) {
      tempoBPM = newTempo;
    }

  } else {

    float newTempo =
      value.toFloat();


    if (newTempo > 0) {
      tempoBPM = newTempo;
    }
  }
}


// ============================================================
// NOTE LENGTH
// ============================================================

float parseLengthMultiplier(
  const String &text,
  int &i
) {

  float numerator = 1.0;
  float denominator = 1.0;

  bool hasNumerator = false;

  int value = 0;


  // Numeric multiplier
  //
  // C2
  // C4
  // C16

  while (
    i < text.length() &&
    isdigit((unsigned char)text[i])
  ) {

    hasNumerator = true;

    value =
      value * 10 +
      (text[i] - '0');

    i++;
  }


  if (hasNumerator) {
    numerator = value;
  }


  // Fraction
  //
  // C/2
  // C/
  // C//
  // C3/2

  if (
    i < text.length() &&
    text[i] == '/'
  ) {

    i++;


    if (
      i < text.length() &&
      isdigit((unsigned char)text[i])
    ) {

      int div = 0;


      while (
        i < text.length() &&
        isdigit((unsigned char)text[i])
      ) {

        div =
          div * 10 +
          (text[i] - '0');

        i++;
      }


      if (div > 0) {
        denominator = div;
      }

    } else {

      denominator = 2;


      while (
        i < text.length() &&
        text[i] == '/'
      ) {

        denominator *= 2;

        i++;
      }
    }
  }


  return numerator / denominator;
}


// ============================================================
// MIDI -> FREQUENCY
// ============================================================

float midiToFrequency(int midi) {

  return
    440.0 *
    pow(
      2.0,
      (midi - 69) / 12.0
    );
}


// ============================================================
// PARSE ONE ABC VOICE
// ============================================================

int parseVoice(
  const String &body,
  NoteEvent *events,
  int maximumEvents,
  int octaveShift
) {

  int eventCount = 0;


  // Explicit accidentals for current measure.
  //
  // 100 means:
  // no explicit accidental for this letter yet.

  int measureAccidental[7];

  for (int n = 0; n < 7; n++) {
    measureAccidental[n] = 100;
  }


  float pendingRhythmFactor = 1.0;

  int i = 0;


  while (i < body.length()) {

    char c = body[i];


    // --------------------------------------------------------
    // WHITESPACE
    // --------------------------------------------------------

    if (isspace((unsigned char)c)) {

      i++;
      continue;
    }


    // --------------------------------------------------------
    // COMMENT
    // --------------------------------------------------------

    if (c == '%') {

      while (
        i < body.length() &&
        body[i] != '\n'
      ) {
        i++;
      }

      continue;
    }


    // --------------------------------------------------------
    // QUOTED CHORD LABEL
    //
    // Example:
    // "Dm"
    // --------------------------------------------------------

    if (c == '"') {

      i++;


      while (
        i < body.length() &&
        body[i] != '"'
      ) {
        i++;
      }


      if (i < body.length()) {
        i++;
      }

      continue;
    }


    // --------------------------------------------------------
    // GRACE NOTES
    //
    // Currently ignored.
    // --------------------------------------------------------

    if (c == '{') {

      while (
        i < body.length() &&
        body[i] != '}'
      ) {
        i++;
      }


      if (i < body.length()) {
        i++;
      }

      continue;
    }


    // --------------------------------------------------------
    // BARLINE
    //
    // Accidentals reset at new measure.
    // --------------------------------------------------------

    if (c == '|') {

      for (int n = 0; n < 7; n++) {
        measureAccidental[n] = 100;
      }

      i++;
      continue;
    }


    // Ignore repeat / ending syntax characters.

    if (
      c == ':' ||
      c == ']'
    ) {

      i++;
      continue;
    }


    // --------------------------------------------------------
    // SLURS / TUPLET MARKERS
    //
    // Parentheses currently ignored.
    // --------------------------------------------------------

    if (
      c == '(' ||
      c == ')'
    ) {

      i++;


      while (
        i < body.length() &&
        isdigit((unsigned char)body[i])
      ) {
        i++;
      }

      continue;
    }


    // --------------------------------------------------------
    // REST
    // --------------------------------------------------------

    if (
      c == 'z' ||
      c == 'x'
    ) {

      i++;


      float length =
        parseLengthMultiplier(body, i);


      float rhythmFactor =
        pendingRhythmFactor;

      pendingRhythmFactor = 1.0;


      // Broken rhythm after rest.

      int look = i;


      while (
        look < body.length() &&
        body[look] == ' '
      ) {
        look++;
      }


      if (
        look < body.length() &&
        (
          body[look] == '>' ||
          body[look] == '<'
        )
      ) {

        char direction =
          body[look];


        int count = 0;


        while (
          look < body.length() &&
          body[look] == direction
        ) {

          count++;
          look++;
        }


        float shortFactor =
          1.0 / pow(2.0, count);

        float longFactor =
          2.0 - shortFactor;


        if (direction == '>') {

          rhythmFactor *=
            longFactor;

          pendingRhythmFactor =
            shortFactor;

        } else {

          rhythmFactor *=
            shortFactor;

          pendingRhythmFactor =
            longFactor;
        }


        i = look;
      }


      float defaultQuarterNotes =
        4.0 *
        (
          (float)defaultLengthNum /
          (float)defaultLengthDen
        );


      float quarterNotes =
        defaultQuarterNotes *
        length *
        rhythmFactor;


      uint32_t duration =
        (uint32_t)round(
          quarterNotes *
          (60000.0 / tempoBPM)
        );


      if (duration < 1) {
        duration = 1;
      }


      if (eventCount < maximumEvents) {

        events[eventCount].midi =
          -1;

        events[eventCount].durationMs =
          duration;

        events[eventCount].fullGate =
          false;

        eventCount++;

      } else {

        Serial.println(
          "WARNING: Event buffer full."
        );

        break;
      }


      continue;
    }


    // --------------------------------------------------------
    // ACCIDENTAL
    // --------------------------------------------------------

    bool explicitAccidental = false;

    int accidental = 0;


    if (
      c == '^' ||
      c == '_' ||
      c == '='
    ) {

      explicitAccidental = true;


      if (c == '=') {

        accidental = 0;

        i++;

      } else {

        char type = c;

        accidental = 0;


        while (
          i < body.length() &&
          body[i] == type
        ) {

          if (type == '^') {
            accidental++;
          } else {
            accidental--;
          }


          i++;
        }
      }


      if (i >= body.length()) {
        break;
      }


      c = body[i];
    }


    // --------------------------------------------------------
    // IS THIS A NOTE?
    // --------------------------------------------------------

    bool validNote =
      (
        (c >= 'A' && c <= 'G') ||
        (c >= 'a' && c <= 'g')
      );


    if (!validNote) {

      i++;
      continue;
    }


    bool lowercase =
      (c >= 'a' && c <= 'g');


    int noteIndex =
      letterIndex(c);


    static const int naturalSemitone[7] = {
      0,   // C
      2,   // D
      4,   // E
      5,   // F
      7,   // G
      9,   // A
      11   // B
    };


    // ABC:
    //
    // C = middle C = MIDI 60
    // c = octave above middle C = MIDI 72

    int midi =
      60 +
      naturalSemitone[noteIndex];


    if (lowercase) {
      midi += 12;
    }


    i++;


    // --------------------------------------------------------
    // OCTAVE MARKERS
    //
    // C,   one octave down
    // C,,  two octaves down
    //
    // c'   one octave up
    // c''  two octaves up
    // --------------------------------------------------------

    while (i < body.length()) {

      if (body[i] == '\'') {

        midi += 12;
        i++;

      } else if (body[i] == ',') {

        midi -= 12;
        i++;

      } else {

        break;
      }
    }


    // --------------------------------------------------------
    // APPLY ACCIDENTAL
    // --------------------------------------------------------

    if (explicitAccidental) {

      midi += accidental;

      measureAccidental[noteIndex] =
        accidental;

    } else {

      if (
        measureAccidental[noteIndex] != 100
      ) {

        midi +=
          measureAccidental[noteIndex];

      } else {

        midi +=
          keyAccidental[noteIndex];
      }
    }


    // Optional global shift.
    midi += octaveShift;


    // --------------------------------------------------------
    // NOTE LENGTH
    // --------------------------------------------------------

    float length =
      parseLengthMultiplier(body, i);


    float rhythmFactor =
      pendingRhythmFactor;


    pendingRhythmFactor = 1.0;


    // --------------------------------------------------------
    // BROKEN RHYTHM
    //
    // A>B
    // A<B
    // A>>B
    // --------------------------------------------------------

    int look = i;


    while (
      look < body.length() &&
      body[look] == ' '
    ) {
      look++;
    }


    if (
      look < body.length() &&
      (
        body[look] == '>' ||
        body[look] == '<'
      )
    ) {

      char direction =
        body[look];


      int count = 0;


      while (
        look < body.length() &&
        body[look] == direction
      ) {

        count++;
        look++;
      }


      float shortFactor =
        1.0 / pow(2.0, count);


      float longFactor =
        2.0 - shortFactor;


      if (direction == '>') {

        rhythmFactor *=
          longFactor;

        pendingRhythmFactor =
          shortFactor;

      } else {

        rhythmFactor *=
          shortFactor;

        pendingRhythmFactor =
          longFactor;
      }


      i = look;
    }


    // --------------------------------------------------------
    // TIE
    // --------------------------------------------------------

    bool tied = false;


    if (
      i < body.length() &&
      body[i] == '-'
    ) {

      tied = true;
      i++;
    }


    // --------------------------------------------------------
    // LENGTH -> MILLISECONDS
    // --------------------------------------------------------

    float defaultQuarterNotes =
      4.0 *
      (
        (float)defaultLengthNum /
        (float)defaultLengthDen
      );


    float quarterNotes =
      defaultQuarterNotes *
      length *
      rhythmFactor;


    uint32_t duration =
      (uint32_t)round(
        quarterNotes *
        (60000.0 / tempoBPM)
      );


    if (duration < 1) {
      duration = 1;
    }


    // --------------------------------------------------------
    // ADD EVENT
    // --------------------------------------------------------

    if (eventCount < maximumEvents) {

      events[eventCount].midi =
        midi;

      events[eventCount].durationMs =
        duration;

      events[eventCount].fullGate =
        tied;

      eventCount++;

    } else {

      Serial.println(
        "WARNING: Voice event buffer full."
      );

      break;
    }
  }


  return eventCount;
}


// ============================================================
// PARSE COMPLETE ABC DOCUMENT
// ============================================================

void parseABC(const char *abc) {

  tempoBPM = 120.0;
  defaultLengthNum = 1;
  defaultLengthDen = 8;
  clearKeySignature();

  String source = String(abc);

  String rhBody = "";
  String lhBody = "";

  String currentVoice = "";

  int position = 0;


  while (position < source.length()) {

    int newline =
      source.indexOf('\n', position);


    if (newline < 0) {
      newline = source.length();
    }


    String line =
      source.substring(
        position,
        newline
      );


    position =
      newline + 1;


    String trimmed = line;

    trimmed.trim();


    if (trimmed.length() == 0) {
      continue;
    }


    // --------------------------------------------------------
    // GLOBAL HEADERS
    // --------------------------------------------------------

    if (trimmed.startsWith("L:")) {

      parseDefaultLength(
        trimmed.substring(2)
      );

      continue;
    }


    if (trimmed.startsWith("Q:")) {

      parseTempo(
        trimmed.substring(2)
      );

      continue;
    }


    if (trimmed.startsWith("K:")) {

      setKeySignature(
        trimmed.substring(2)
      );

      continue;
    }


    // --------------------------------------------------------
    // METADATA
    // --------------------------------------------------------

    if (
      trimmed.startsWith("X:") ||
      trimmed.startsWith("T:") ||
      trimmed.startsWith("C:") ||
      trimmed.startsWith("M:") ||
      trimmed.startsWith("V:") ||
      trimmed.startsWith("%%")
    ) {

      continue;
    }


    // --------------------------------------------------------
    // VOICE SELECTOR
    //
    // [V:RH]
    // [V:LH]
    // --------------------------------------------------------

    if (trimmed.startsWith("[V:")) {

      int close =
        trimmed.indexOf(']');


      if (close > 3) {

        currentVoice =
          trimmed.substring(
            3,
            close
          );


        currentVoice.trim();


        // Also support:
        //
        // [V:RH] C D E F

        String remainder =
          trimmed.substring(close + 1);


        remainder.trim();


        if (remainder.length() > 0) {

          if (currentVoice == "RH") {

            rhBody += remainder;
            rhBody += '\n';

          } else if (currentVoice == "LH") {

            lhBody += remainder;
            lhBody += '\n';
          }
        }
      }


      continue;
    }


    // --------------------------------------------------------
    // MUSIC BODY
    // --------------------------------------------------------

    if (currentVoice == "RH") {

      rhBody += line;
      rhBody += '\n';

    } else if (currentVoice == "LH") {

      lhBody += line;
      lhBody += '\n';
    }
  }


  // ----------------------------------------------------------
  // CONVERT BOTH VOICES TO EVENTS
  // ----------------------------------------------------------

  rhEventCount =
    parseVoice(
      rhBody,
      rhEvents,
      MAX_EVENTS,
      RH_OCTAVE_SHIFT
    );


  lhEventCount =
    parseVoice(
      lhBody,
      lhEvents,
      MAX_EVENTS,
      LH_OCTAVE_SHIFT
    );


  // ----------------------------------------------------------
  // DEBUG
  // ----------------------------------------------------------

  Serial.println();
  Serial.println("==============================");
  Serial.println("ABC SONG LOADED");
  Serial.println("==============================");


  Serial.print("Tempo: ");
  Serial.print(tempoBPM);
  Serial.println(" BPM");


  Serial.print("Default length: ");
  Serial.print(defaultLengthNum);
  Serial.print("/");
  Serial.println(defaultLengthDen);


  Serial.print("RH events: ");
  Serial.println(rhEventCount);


  Serial.print("LH events: ");
  Serial.println(lhEventCount);


  Serial.println("==============================");
  Serial.println();
}


// ============================================================
// BUZZER OUTPUT
// ============================================================

void silenceBuzzer(uint8_t pin) {

  ledcWrite(pin, 0);
  if (pin == BUZZER_RH_PIN) currentRhHz = 0;
  else currentLhHz = 0;
}


void playFrequency(
  uint8_t pin,
  int midi
) {

  if (midi < 0) {

    silenceBuzzer(pin);

    return;
  }


  float frequencyFloat =
    midiToFrequency(midi);


  uint32_t frequency =
    (uint32_t)round(
      frequencyFloat
    );


  if (pin == BUZZER_RH_PIN) currentRhHz = frequency;
  else currentLhHz = frequency;
  ledcWriteTone(pin, frequency);
  applyVolume(pin);
}


// ============================================================
// VOICE EVENT START
// ============================================================

void startCurrentEvent(
  VoicePlayer &voice,
  uint32_t eventStart
) {

  if (voice.index >= voice.count) {

    voice.finished = true;

    silenceBuzzer(
      voice.pin
    );

    return;
  }


  NoteEvent &event =
    voice.events[voice.index];


  voice.eventEnd =
    eventStart +
    event.durationMs;


  if (event.fullGate) {

    voice.gateOff =
      voice.eventEnd;

  } else {

    voice.gateOff =
      eventStart +
      (
        (uint64_t)event.durationMs *
        GATE_PERCENT /
        100
      );
  }


  voice.gateSilenced = false;


  playFrequency(
    voice.pin,
    event.midi
  );
}


// ============================================================
// START A VOICE
// ============================================================

void startVoice(
  VoicePlayer &voice,
  uint32_t now
) {

  voice.index = 0;

  voice.finished = false;

  voice.gateSilenced = false;


  if (voice.count <= 0) {

    voice.finished = true;

    silenceBuzzer(
      voice.pin
    );

    return;
  }


  startCurrentEvent(
    voice,
    now
  );
}


// ============================================================
// UPDATE A VOICE
// ============================================================

void updateVoice(
  VoicePlayer &voice,
  uint32_t now
) {

  if (voice.finished) {
    return;
  }


  // ----------------------------------------------------------
  // RELEASE CURRENT NOTE
  // ----------------------------------------------------------

  if (
    !voice.gateSilenced &&
    timeReached(
      now,
      voice.gateOff
    )
  ) {

    silenceBuzzer(
      voice.pin
    );


    voice.gateSilenced = true;
  }


  // ----------------------------------------------------------
  // ADVANCE TO NEXT NOTE
  // ----------------------------------------------------------

  while (
    !voice.finished &&
    timeReached(
      now,
      voice.eventEnd
    )
  ) {

    uint32_t nextStart =
      voice.eventEnd;


    voice.index++;


    if (voice.index >= voice.count) {

      voice.finished = true;


      silenceBuzzer(
        voice.pin
      );


      return;
    }


    startCurrentEvent(
      voice,
      nextStart
    );
  }
}


// ============================================================
// MUSIC CONTROLS
// ============================================================

void startMusic() {

  uint32_t now =
    millis();


  waitingToRestart = false;


  startVoice(
    rhPlayer,
    now
  );


  startVoice(
    lhPlayer,
    now
  );
}


void stopMusic() {

  rhPlayer.finished = true;

  lhPlayer.finished = true;


  waitingToRestart = false;


  silenceBuzzer(
    BUZZER_RH_PIN
  );


  silenceBuzzer(
    BUZZER_LH_PIN
  );
}


// ============================================================
// MUSIC UPDATE
//
// Call this repeatedly from loop().
// Does NOT use delay().
// ============================================================

void updateMusic() {

  uint32_t now =
    millis();


  updateVoice(
    rhPlayer,
    now
  );


  updateVoice(
    lhPlayer,
    now
  );


  // ----------------------------------------------------------
  // END OF SONG
  // ----------------------------------------------------------

  if (
    rhPlayer.finished &&
    lhPlayer.finished
  ) {

    if (!LOOP_SONG) {
      return;
    }


    // One second pause before looping.

    if (!waitingToRestart) {

      waitingToRestart = true;

      restartTime =
        now + 1000;

    } else if (
      timeReached(
        now,
        restartTime
      )
    ) {

      startMusic();
    }
  }
}


// ============================================================
// SETUP
// ============================================================

void enter() {

  Serial.begin(115200);
  enabled = true;
  manualSongOverride = false;
  gameMusicOwnsBuzzers = false;
  playbackAllowed = false;
  selectedSong = SONG_NOCTURNE;
  volume = 50;

  delay(300);


  Serial.println();
  Serial.println("==============================");
  Serial.println("ESP32 ABC MUSIC PLAYER");
  Serial.println("==============================");


  // ----------------------------------------------------------
  // SET UP RH BUZZER
  //
  // Current ESP32 Arduino API:
  //
  // ledcAttachChannel(
  //   pin,
  //   initial frequency,
  //   resolution,
  //   channel
  // )
  // ----------------------------------------------------------

  bool rhOK =
    ledcAttachChannel(
      BUZZER_RH_PIN,
      440,
      BUZZER_RESOLUTION,
      BUZZER_RH_CHANNEL
    );


  // Start LH at a DIFFERENT frequency as an additional
  // safeguard against timer sharing.

  bool lhOK =
    ledcAttachChannel(
      BUZZER_LH_PIN,
      441,
      BUZZER_RESOLUTION,
      BUZZER_LH_CHANNEL
    );


  if (!rhOK) {

    Serial.println(
      "ERROR: Could not attach RH buzzer."
    );
  }


  if (!lhOK) {

    Serial.println(
      "ERROR: Could not attach LH buzzer."
    );
  }


  silenceBuzzer(
    BUZZER_RH_PIN
  );


  silenceBuzzer(
    BUZZER_LH_PIN
  );


  // ----------------------------------------------------------
  // PARSE ABC
  // ----------------------------------------------------------

  parseABC(
    currentSong().abc
  );


  // ----------------------------------------------------------
  // CONFIGURE RH PLAYER
  // ----------------------------------------------------------

  rhPlayer.events =
    rhEvents;

  rhPlayer.count =
    rhEventCount;

  rhPlayer.index =
    0;

  rhPlayer.pin =
    BUZZER_RH_PIN;

  rhPlayer.eventEnd =
    0;

  rhPlayer.gateOff =
    0;

  rhPlayer.gateSilenced =
    true;

  rhPlayer.finished =
    true;


  // ----------------------------------------------------------
  // CONFIGURE LH PLAYER
  // ----------------------------------------------------------

  lhPlayer.events =
    lhEvents;

  lhPlayer.count =
    lhEventCount;

  lhPlayer.index =
    0;

  lhPlayer.pin =
    BUZZER_LH_PIN;

  lhPlayer.eventEnd =
    0;

  lhPlayer.gateOff =
    0;

  lhPlayer.gateSilenced =
    true;

  lhPlayer.finished =
    true;


  // ----------------------------------------------------------
  // START
  // ----------------------------------------------------------

  stopMusic();
}

void selectSong(int index, bool userChosen = true) {
  const int count = SONG_COUNT;
  index = (index % count + count) % count;
  if (userChosen) manualSongOverride = true;
  if (index == selectedSong) return;
  stopMusic();
  selectedSong = static_cast<uint8_t>(index);
  parseABC(currentSong().abc);
  rhPlayer.count = rhEventCount;
  lhPlayer.count = lhEventCount;
  if (enabled && playbackAllowed) startMusic();
}


// ============================================================
// LOOP
// ============================================================

void tick() {

  updateMusic();

  // No delay().
  //
  // Eventually your TFT game can run here at the
  // same time as the music:
  //
  // updateInputs();
  // updateGame();
  // drawScreen();
}
void setEnabled(bool value) {
  if (enabled == value) return;
  enabled = value;
  if (enabled && playbackAllowed) startMusic();
  else stopMusic();
}
void setVolume(uint8_t value) { volume = value; applyVolume(BUZZER_RH_PIN); applyVolume(BUZZER_LH_PIN); }

}
