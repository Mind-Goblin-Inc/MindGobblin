# Jakeboy Arcade website investigation

Investigated 2026-11-13. The sections below preserve the initial investigation
and proposed integration. The browser player has since been implemented at
`/SharkBoyEmulator/`; see [implementation and validation](SharkBoyEmulator.md)
for the current workflow.

## What exists

| Location | Role |
| --- | --- |
| `/Users/jakeferrigan/Documents/Arduino/Jakeboy_Arcade` | ESP32 firmware, game implementations, cartridge menu, artwork, and music. |
| `/Users/jakeferrigan/Documents/JakeboySimulator` | C++17 desktop runner, SDL2 display/audio/input, and Arduino/Adafruit compatibility headers. |
| `/Users/jakeferrigan/Documents/JakeProject` | Mind Goblin: ASP.NET Core 9 server, static pages under `wwwroot`, Docker/VPS deployment. |

The simulator compiles the actual arcade sketch and its `.ino` tabs against
compatibility headers. It runs game logic directly; it is not an ESP32 CPU
emulator. Its simulated ST7789 display stores a 240×320 RGB565 framebuffer
(150 KiB), which SDL presents in a resizable window, initially at 2× scale.
Two synthesized buzzer voices provide music and effects.

The arcade contains 13 registered games: Alpine Slalom, Deep Hook, Deep Vector,
Fishing, Horizon Burn, Ice Cold Beer, Meteor Sweep, Odd Stride, Pong, Scrap
Claw, Skyhook, Space Evaders, and Tank. Settings, Music Player, and Hardware
Test add three tool entries. The current launcher uses animated cartridges;
the simulator README still describes some of this as a poster browser.
Artwork and music arrangements are defined in the source headers.

The website already serves a WebAssembly game at `/heliobound/`. Its existing
artifact import, manifest validation, route-specific security policy, and
shared home navigation provide useful patterns for Jakeboy.

## Run it now

The required tools are already available on this Mac: Apple clang++, Python 3,
and SDL2 (`sdl2-config` reports `2.32.74`). On another Mac, the documented SDL
installation is `brew install sdl2`.

Start the complete arcade:

```sh
cd /Users/jakeferrigan/Documents/JakeboySimulator
./run.command /Users/jakeferrigan/Documents/Arduino/Jakeboy_Arcade
```

Start an individual game:

```sh
./run.command /Users/jakeferrigan/Documents/Arduino/Jakeboy_Arcade/ScrapClaw.h
```

With no argument, `./run.command` selects the simulator's bundled Pong demo,
which is a separate file from the arcade's Pong implementation.

| Key | Control |
| --- | --- |
| W / S | Left switch up / down; release for center. |
| Up / Down arrows | Right switch up / down; release for center. |
| A / D, or Left / Right arrows | Left / right action buttons. |
| R | Run arcade setup or the current game's entry function again. |
| Escape | Quit the desktop runner. |

Either switch browses the launcher; the right action button inserts and opens
the selected cartridge. The mouse wheel browses, and clicking a cartridge
opens it. Hold both action buttons for two seconds to return from a game,
subject to that game's exit hook.

`run.command` regenerates `include/SimGame.h`, removes the previous native
executable, rebuilds, and launches it. This regeneration is important: the
Makefile alone does not track every external game header as a dependency.

## Checks performed

Builds ran in a temporary simulator copy, using the arcade's current working
files. The original simulator and firmware files were not changed.

- Full arcade: generated the adapter for all 15 `.ino` files and compiled
  `src/main.cpp` with clang++, C++17, optimization, and installed SDL2. Passed
  with compiler warnings.
- Native startup: ran that executable for four seconds with SDL dummy video
  and audio drivers. It initialized and remained running until the harness
  timeout. This does not establish visual correctness or audible sound.
- Existing `browser_verify.cpp`: passed registration, fallback artwork,
  navigation wrapping/conflicts, delayed launch, and return lifecycle checks.
- Existing `input_verify.cpp`: passed input gates, debounce, repeat,
  conflicts, launch locking, and elapsed-time arithmetic checks.
- Existing `tools_verify.cpp`: passed tool dispatch, selection restoration,
  hardware-test exit, and menu-silence checks.
- Bundled Pong and external Scrap Claw: generated their individual-game
  adapters, compiled the existing headless harness, and ran it successfully.
  That small harness checks startup, not complete gameplay.
- Existing `make test` with the full-arcade adapter: failed because
  `src/headless_test.cpp` defines `display` and `gameAudioVolume()` again after
  the sketch already defines them. The normal SDL runner handles this with
  `SIM_ARCADE` guards; the headless harness does not. This is a separate test
  harness issue, not a failure to build the arcade runner.

Website HEAD was `ce19411`; arcade HEAD was `36a9fbe` with substantial existing
tracked and untracked cartridge-menu work. The simulator directory has no
local `.git` directory. A release needs to capture the actual simulator and
arcade sources, including the current uncommitted work, rather than relying
on these commit IDs alone. Emscripten (`emcc`/`em++`) was not on PATH; no SDK
was installed during this investigation.

## Recommended browser approach

Create one **SharkBoy Emulator** page at `/SharkBoyEmulator/`, preserving the
complete Jakeboy Arcade cartridge collection. The user selected this website
path; preserve its capitalization. Build the C++ game code and compatibility layer into
WebAssembly with Emscripten, initially retaining SDL2. Emscripten supplies an
SDL2 port through `--use-port=sdl2`.
[Emscripten build documentation](https://emscripten.org/docs/compiling/Building-Projects.html)

SDL's browser 2D renderer uses WebGL, so this approach does not require
HelioEngine's WebGPU renderer. Keeping the existing software drawing layer
also preserves the source of the game's pixels. This is an architectural
recommendation, not a successful browser compatibility test.
[SDL browser rendering documentation](https://wiki.libsdl.org/SDL2/README-emscripten)

The main work is at the platform boundary:

1. **Scheduling and time.** Replace the blocking `while (running)` desktop
   loop with browser callbacks. Give persistent loop state an appropriate
   lifetime. Port the shim's `delay()`, currently implemented with
   `std::this_thread::sleep_for`, and handle boot animation and other pauses.
   Asyncify with `emscripten_sleep()` is a possible initial compatibility
   approach; nonblocking timed states are another option. Simply removing
   delays changes behavior. Browser execution must regularly return control.
   [Main loop documentation](https://emscripten.org/docs/porting/emscripten-runtime-environment.html),
   [Asyncify documentation](https://emscripten.org/docs/porting/asyncify.html)
2. **Update frequency.** Separate presentation from update work. The menu
   renders at most four eight-row strips per update, so one update per 60 Hz
   display frame would take nine callbacks to compose a complete 280-row
   scene. Measure and budget enough bounded work to preserve animation and
   music responsiveness. Check physics and rhythm timing as well.
3. **Audio.** Reuse the buzzer synthesis initially. Start/resume playback from
   a visible Play button, supply mute/volume controls, and verify music and
   effects in a real browser. Browsers restrict sound before user interaction.
   [SDL browser audio documentation](https://wiki.libsdl.org/SDL2/README-emscripten)
4. **Controls and lifecycle.** Retain keyboard and menu mouse controls, focus
   input on the game, prevent arrow-key page scrolling while playing, and
   clear held input on focus loss. Pause/mute hidden tabs and handle elapsed
   time on return. Provide a reliable restart and menu-return control.
   Desktop `R` only calls setup/entry again; it does not recreate all globals.
5. **Touch.** Add two switch controls and two action buttons using simultaneous
   pointer input if phone play is part of the first release. Keyboard/mouse
   support alone does not make the games usable on a phone.
6. **Portable build.** Generate `SimGame.h` from explicit source locations in
   the build directory, rather than shipping its current Mac-specific absolute
   includes. Pin the compiler and both source inputs, and record artifact
   checksums. Measure web download size and memory after producing the build.

Start without pthreads. Threaded Emscripten builds require COOP/COEP hosting
headers; this proposed single-threaded version should not require site-wide
isolation changes. Validate the actual audio/rendering build before settling
its hosting requirements.
[SDL threading documentation](https://wiki.libsdl.org/SDL2/README-emscripten)

## Website integration

Build a self-contained release directory outside the website repository, then
import its HTML, JavaScript, CSS, `.wasm`, and manifest into
`wwwroot/SharkBoyEmulator/`. The existing .NET static middleware already maps `.wasm`
to `application/wasm` and JavaScript to `application/javascript`. Verify the
actual prefixed URLs, loader, and content types through .NET and the proxy.

Add one homepage entry under Arcade with `data-project`, and use the existing
44 px home strip from `site-home.css` and `site-home.js`. Preserve the native
screen's 3:4 aspect ratio when resizing. Update homepage fallback counts from
33 to 34 total projects and 13 to 14 games; update the matching assertions in
`tools/check_heliobound_http.py` and any related fixtures.

For the public site, simulation can run entirely on the visitor's device.
The initial integration needs only static files. Keep the loader and assets
on the same origin, add a policy scoped to `/SharkBoyEmulator/`, and verify it against
the chosen Emscripten output. Use external scripts/styles so the page can
follow the existing restricted script policy. Publish the reviewed browser
artifact, excluding native binaries, source trees, and local configuration.

Follow the existing HelioEngine artifact pattern: import a complete version
with provenance/checksums, validate it in CI, and include it in the normal
Docker deployment. The workflow already uses `context: .`. Neither sibling
source directory will exist in a clean CI checkout unless explicitly supplied.

The next implementation step should be a local browser prototype that boots
the current cartridge menu and opens a game, then verifies input, rendering
cadence, and sound. Test every exposed game and tool before publishing the
full collection, with particular attention to Horizon Burn's rhythm timing,
blur/resume, simultaneous controls, restart, and mobile input if included.
