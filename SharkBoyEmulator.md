# SharkBoy Emulator

The website player is at **`/SharkBoyEmulator/`**, with that capitalization.
It runs the complete Jakeboy Arcade collection locally in the visitor's
browser: 13 games, cartridge artwork and animation, Music Player, Settings,
and Hardware Test. It uses WebAssembly, SDL2/WebGL, and Web Audio. It needs
no game server, account, WebGPU, shared-memory threads, or external assets.

The homepage lists each game under **SharkBoy · ESP32 arcade**. These links
open the player and automatically launch that cartridge, for example
`/SharkBoyEmulator/?game=deep-vector`. Game names in links are stable even
if the native cartridge order changes. Unknown game names fall back to the
normal **Play arcade** screen. Browsers may require the first game control
press to enable sound after an automatic launch.

## Local preview

From the website repository:

```sh
Database__Path=/tmp/sharkboy-preview.db \
PLACE_DATA_PATH=/tmp/sharkboy-place-board.bin \
dotnet run --project JakeServer.csproj --no-launch-profile
```

Open `http://localhost:8080/SharkBoyEmulator/` and click **Play arcade**.
These environment variables keep preview database and Place data separate
from production data. The local server binds to port 8080.

W/S and Up/Down operate the two three-position switches. A/D or Left/Right
are the action buttons. The mouse wheel browses cartridges; clicking inserts
one. The screen has touch controls with independent simultaneous presses.
The toolbar supplies pause/resume, menu, restart, mute, and fullscreen.
Volume and music selection remain available through the arcade's tools.

Focus loss releases held controls. Window blur or a hidden tab pauses the
game and silences output; Resume is explicit. Paused wall time is excluded
from the game clock. Restart leaves and re-enters the selected game using
its native lifecycle. Page reload resets the whole arcade session.

## Source and build

`tools/sharkboy/source/` captures the original Arduino headers, sketch tabs,
posters, and simulator compatibility headers. The source manifest records
every imported file's SHA-256, the Arduino commit, and its dirty state.
The imported Arduino files are unchanged. A small `compat/Arduino.h` wrapper
replaces only the native clock/sleep functions for the browser.

The website's browser runner is `tools/sharkboy/runtime.cpp`; its player UI
is in `tools/sharkboy/page/`. Native source folders elsewhere on the machine
are not needed to rebuild this snapshot. Do not edit the captured game files
as a separate game implementation; refresh them deliberately from the
Arduino project when bringing in game changes.

Install and activate **Emscripten 4.0.23** using emsdk, then:

```sh
source /path/to/emsdk/emsdk_env.sh
python3 tools/build_sharkboy.py
```

The script checks the pinned compiler and imported sources, builds in a
temporary directory with SDL2 and Asyncify, validates the artifact, and
replaces the complete managed `wwwroot/SharkBoyEmulator/` bundle. It rejects
unexpected files in the output directory. `--output /absolute/path` builds
elsewhere; `--emxx /absolute/path/to/em++` selects the compiler explicitly.

To refresh the snapshot from the original projects:

```sh
python3 tools/capture_sharkboy_sources.py \
  --arcade /path/to/Arduino/Jakeboy_Arcade \
  --simulator /path/to/JakeboySimulator
python3 tools/build_sharkboy.py
```

Review the source snapshot and complete web bundle together. The browser
manifest fingerprints build inputs and output files. A dirty Arduino source
is recorded accurately; it is not silently presented as a clean commit.

## Validation

```sh
python3 tools/verify_sharkboy.py
python3 -m unittest discover -s tools -p 'test_sharkboy*.py'
python3 tools/check_sharkboy_http.py http://localhost:8080
```

The verifier rejects unlisted files, symlinks, byte changes, and stale build
inputs. HTTP checks verify served bytes, MIME types, the canonical route,
homepage counts/link, and the route-specific policy.

For browser checks, install Playwright separately with its Chromium and
WebKit browsers, then run:

```sh
node tools/check_sharkboy_browser.mjs http://localhost:8080
```

If Playwright is outside the repository, set `PLAYWRIGHT_MODULE` to its
absolute `index.mjs` path. `SHARKBOY_ARTIFACTS` chooses the screenshot folder;
the default is `/tmp/sharkboy-browser-results`.

The browser harness exercises launch/input/restart/return for all 13 games,
the three tools, nonzero audio output, mute, pause/resume and clock freezing,
input alias release, focus loss, fullscreen, simultaneous real touch input,
and narrow layouts. Homepage link checks launch each of the 13 games in
desktop Chromium, mobile Chromium, and WebKit, and cover search, counts,
bookmarked links, reloads, and invalid game names.
It also runs a Pong/music smoke check in WebKit, checks
the retry message after a failed download, and starts a muted game when Web
Audio is unavailable. Set `SHARKBOY_CHECKS` to a comma-separated subset of
`links,desktop,mobile,webkit,fallbacks` to repeat only a selected group. These
are browser smoke and lifecycle checks, not exhaustive tests of every game
mode or physical ESP32 performance.

## Packaging and deployment

Include the reviewed web artifact in the same website change. CI checks its
inventory, checksums, and agreement with the checked-in source snapshot
before the existing Docker build. The Docker context and .NET publish omit
the native build sources. Normal website deployment includes the player;
there is no new hosting service or separate deployment flow.

The .NET host serves `.wasm` and JavaScript with explicit MIME types. Its
security policy is scoped to this player and HelioEngine, permits same-origin
scripts and WebAssembly compilation, and does not add site-wide isolation
headers. The launcher and player assets are external files.

ASP.NET publish also generates `.br`/`.gz` derivatives of static files. The
strict source-bundle verifier is intended for the reviewed source artifact;
use HTTP checks and compare the original file checksums when checking a
published directory containing those framework-generated derivatives.

Roll back by restoring the whole `wwwroot/SharkBoyEmulator/` directory and
its matching source snapshot/build inputs together. Do not mix loader,
WebAssembly, or manifest files from different builds.

## Validation record · 2026-11-15

- Emscripten 4.0.23 built the complete arcade; the WebAssembly payload is
  2,185,153 bytes. All 61 imported source files match the original projects.
- Chromium passed launch, input, restart, and menu return for all 13 games;
  tool dispatch, generated audio samples, mute, pause clock freezing, resume,
  focus/alias release, and fullscreen checks passed.
- Mobile Chromium passed simultaneous real touch and independent release,
  with no horizontal overflow at 390 px or 320 px widths.
- WebKit passed startup, Pong, menu return, music sample generation, and
  pause/resume. Failed-download messaging and muted play without Web Audio
  also passed in Chromium.
- All six bundle integrity tests, three existing native menu/input/tool
  harnesses, and ten HelioEngine regression tests passed. HTTP checks passed
  for both games through the actual .NET host.
- .NET Release publish succeeded. The five published player files match
  the reviewed checksums, and native sources are excluded. Docker container
  execution and production deployment were not performed in this session.

Browser coverage uses automated Chromium and WebKit on this Mac, including
an emulated mobile viewport; it does not establish testing on physical phones
or exhaustive gameplay coverage of every mode.
