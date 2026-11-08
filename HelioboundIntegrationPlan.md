# Heliobound on Mind Goblin

Investigation: 2026-11-08. Target: play directly in a desktop browser.
This is an implementation plan; a playable browser build has not been produced
or deployed, and the homepage has not been changed.

Heliobound can reuse its Rust engine and renderer through WebAssembly. It needs
a browser launcher and platform adaptations before Mind Goblin can host it as a
playable game. The existing .NET/Docker host can serve the resulting static
files without running the game on the VPS.

## Verified build result

Source: `../heliobound`, remote `JFerrigan/HelioEngine`, HEAD `6904eb1`.
The local source contains uncommitted changes; these checks used that working
copy. A release must pin the committed version containing the browser port.
No HelioBound source files were changed during this investigation.

Installed `wasm32-unknown-unknown` with rustup and ran:

```sh
cargo check --locked --offline \
  --manifest-path ../heliobound/Cargo.toml \
  --target-dir /private/tmp/mindgoblin-heliobound-check \
  --target wasm32-unknown-unknown \
  -p heliobound-core -p heliobound-gfx
```

Result: passed. These are compile checks, not browser execution tests.

Then ran the application check, allowing missing dependencies to download:

```sh
cargo check --locked \
  --manifest-path ../heliobound/Cargo.toml \
  --target-dir /private/tmp/mindgoblin-heliobound-check \
  --target wasm32-unknown-unknown -p heliobound-cli
```

The GPU and audio crates passed compilation. The application failed with
`E0599` at `crates/heliobound-cli/src/main.rs:346`: `PixelsBuilder::build()`
is unavailable on WebAssembly. Its browser API is `build_async().await`.
Compilation of the dependencies does not establish that their desktop startup
paths work in a browser.

## Changes in HelioBound

| Area | Current code | Required browser behavior |
| --- | --- | --- |
| Startup | `main.rs:322` creates a native window and initializes rendering synchronously. | Attach winit to a page canvas, initialize rendering asynchronously, and run the browser event loop. Prefer winit's `spawn_app` when adapting the application handler. |
| GPU | `SurfaceRenderer::new` blocks with pollster; `new_async` already exists. | Add an async `GpuPresentation` constructor using `SurfaceRenderer::new_async`. Initialize the CPU/pixels fallback asynchronously when needed; avoid making a fallback failure prevent a working GPU backend from starting. |
| Time and seeds | `std::time::Instant` drives frames; `SystemTime` provides the Drone Gate nonce. | Use browser-compatible time, such as `web-time`, and a browser-provided nonce. Keep seeded gameplay deterministic. |
| Maps | Core catalogs and the application use `fs::read_dir`, `read_to_string`, and filesystem metadata. | Expose validated parsers that accept a filename and JSON bytes/string. Feed them embedded assets or files fetched from a fixed manifest. Preserve filename/ID checks, limits, and per-file errors. |
| Asset viewer | A separate asset loader in `main.rs` also scans the filesystem. | Route this through the same browser asset bundle; changing only the core catalog would leave viewer assets missing. |
| Audio | Rodio enables `playback` but not its `wasm-bindgen` backend; initialization happens before user input. | Enable the browser backend for the wasm target, then initialize/resume audio after a Start click. Test actual music, stereo cues, and sound effects; allow explicit muted play where appropriate. |
| Editor saves | `confirm_save` writes and renames files on disk. | Either omit the editor from the first browser release or implement browser-local save/export. Never report an unavailable filesystem save as successful. |
| Input | Desktop mouse capture, keyboard controls, and fixed initial dimensions. | Request pointer lock/fullscreen from a user gesture, handle Escape and lock loss, clear held input on blur, and resize the canvas correctly. |

Missing maps are a startup blocker: `AppState::new` requires authored maps and
`required_compiled_map` panics if they are absent. A successful wasm compile
alone will not reach the menu with the existing filesystem loaders.

There are currently nine JSON map/asset files, about 652 KiB on disk. Embedding
this authored content at build time is a reasonable first implementation; keep
the existing validators shared with native loading. Generate the embedded
manifest deterministically so later content files are included automatically.

Keep one source of gameplay truth. Make the app state, controls, and frame
construction reusable by the native and browser launchers. The current
19,105-line CLI mixes gameplay and native startup, so extract shared code
incrementally rather than copying it into a separate JavaScript game.

Start with WebGPU. The GPU terrain and UI shaders use storage buffers, so
enabling wgpu's WebGL feature alone does not establish a working fallback.
Test the pixels/CPU path separately if broader browser compatibility is needed.
Show a clear unsupported-device message when neither path works.

## Browser build and artifact contract

Add a browser entry point in the engine repository and a reproducible release
script. The output should be a self-contained directory that can be served
under `/heliobound/`, containing an HTML launcher, external JavaScript/CSS,
the wasm-bindgen module, and its `.wasm` file. All runtime URLs must work under
that prefix. Include external map/asset files only if they are not embedded.

Use `cargo build --release --locked --target wasm32-unknown-unknown` for the
browser entry point, followed by `wasm-bindgen --target web` or a pinned Trunk
build. These release steps are proposed; the application must first be ported.
Pin the wasm-bindgen CLI to the version resolved in the engine's lockfile
(currently `0.2.127`) when using it directly.

Publish a release manifest with the source commit and file checksums. Keep
native source, Cargo caches, desktop executables, and credentials out of the
static web artifact. A single wasm artifact serves both VPS CPU architectures.

## Mind Goblin integration

1. Import the verified browser artifact into `wwwroot/heliobound/`.
2. Serve `.wasm` as `application/wasm` and modules as JavaScript. Existing
   `Program.cs` code already supplies correct headers for `.wasm.br` and
   `.js.br` if the release chooses explicit Brotli URLs. Verify these responses
   through both the local preview and the real .NET/reverse-proxy stack.
3. Add a normal `Heliobound` game link under Action & exploration in
   `wwwroot/index.html` after the playable artifact passes the launch checks.
   Keep names/emojis consistent with other entries. Update the initial static
   counts from 13 to 14 games and 32 to 33 total projects; homepage search
   already calculates counts from `data-project` links at runtime.
4. Keep the launcher in the game's directory with a link back to Mind Goblin,
   visible loading/error states, a Start button, fullscreen control, and
   keyboard/mouse instructions. Treat mobile controls as separate work.

## CI and deployment

Build a pinned engine revision in CI, validate the browser artifact, then
include it in Mind Goblin's normal Docker build. The local `../heliobound`
directory will not exist in a clean GitHub runner or inside Docker. Check out
the engine explicitly or download a verified release artifact. If its repo is
private, use narrowly scoped read access for that checkout.

If CI generates/downloads files into `wwwroot` before `docker/build-push-action`,
set `with: context: .`. The current workflow uses the action's default Git
context, which ignores working-directory changes from earlier steps. Otherwise
the built image can silently omit the new game.

Keep the engine checkout and build caches outside the Docker context. Add a
`.dockerignore` as needed for source-control metadata, local data, and build
tools, while retaining the intended web artifact. Run the wasm build once,
before the existing amd64/arm64 image build. Fail the pipeline if expected
artifact files or checksums are missing.

## Public-site boundaries

- Serve trusted release files over HTTPS; WebGPU requires a secure context.
- Run game simulation locally in the browser. The first release needs no
  game-specific backend, account access, server execution, or upload endpoint.
- Keep map edits on the player's device. Reuse existing map/asset validation
  and resource limits for any later local-file import.
- Apply any new CSP/permissions headers to the game path and test the generated
  wasm loader. Keep scripts and assets same-origin, allow wasm compilation
  explicitly where CSP requires it, and render errors as text.
- Begin without shared-memory threads. Do not add site-wide COOP/COEP headers
  as a speculative fix; revisit scoped isolation only if the chosen audio or
  worker implementation requires it.

## Release acceptance

- Native checks remain green; wasm builds in a clean CI environment.
- The menu and at least one gameplay mode work in a real browser; test every
  mode exposed in the published menu before claiming it is supported.
- Authored maps and assets load, movement/collision work, and a fresh run resets
  correctly. Include sound-dependent Echolocation checks if that mode ships.
- Audio starts after user input; pointer lock, Escape, blur/refocus, fullscreen,
  resize, and restart work without stuck keys or duplicate frame loops.
- Test WebGPU initialization and device-loss handling, plus the intended
  fallback or unsupported-device message. Record browser/OS/device coverage.
- Measure release-build load time, frame time, and memory in the browser,
  including map creation; do not infer browser performance from native tests.
- The actual Docker image contains the game and serves its prefixed URLs with
  correct MIME/encoding headers. Homepage navigation/search finds the new game.

## References

- [Rust's wasm target limitations](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html)
- [wgpu 29 browser backends](https://docs.rs/wgpu/29.0.4/wgpu/)
- [winit browser event-loop support](https://docs.rs/winit/latest/wasm32-unknown-unknown/winit/platform/web/trait.EventLoopExtWebSys.html)
- [Rodio browser feature](https://docs.rs/crate/rodio/0.22.2/source/Cargo.toml.orig)
- [Docker build action Git context](https://github.com/docker/build-push-action#git-context)
