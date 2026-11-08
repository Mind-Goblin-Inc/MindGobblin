# HelioEngine local preview

The port is committed locally in the engine as
`385171f634bed571c67dad79fb0ce5f15d4d78c3`. The website preview is prepared on
`feature/helioengine-preview`; the engine source has not been pushed. No
production deployment was performed. Public release still requires validation
and separate production authorization.

The imported bundle is built from the working tree based on that engine
commit, including the HelioEngine branding and the user's retained engine
edits. Its manifest records `engine_dirty: true` and the exact source/file
hashes. It does not claim to be a clean release build. Build instructions and
checks live in the engine's README and docs/browser-release.md.

The current bundle also includes the Safari shader compatibility fix: UI cells
and pixel sprites compile separate resource declarations rather than overlapping
bindings in the glyph compositor module. The menu and Corn Maze render in actual
Safari 18.1 on this Mac, with keyboard movement verified. Startup now awaits
graphics validation and keeps reported errors visible. Full Safari gameplay/audio
coverage remains unverified.

The website stores the self-contained bundle, features HelioEngine, and gives
it a dedicated Game Engine category, with 13 games / 1 engine / 33 total
projects. The previous Featured selections remain. It adds scoped
CSP/permissions headers and explicit
JavaScript/WebAssembly MIME mappings. No game backend or upload endpoint is
added. Database__Path permits a separate temporary database for local .NET
checks while preserving historical production database selection by default.

Verified locally:

- Native engine: 272 tests passed, two existing tests ignored; formatting and
  native launcher build pass.
- Browser release build succeeds with locked Rust dependencies and pinned
  wasm-bindgen 0.2.127 / Rust 1.98.0.
- All checked-in authored maps/assets load through the shared validators.
- The local .NET host serves every manifest file with matching checksums,
  correct MIME types, and scoped game policy. The homepage does not inherit it.
- Seven manifest checks pass, including corrupted/missing/extra files,
  traversal, symlinks, and rejection of an unapproved preview for production.
- Browser platform checks pass: unsupported devices, audio failure/muted play/
  retry, fullscreen/Escape, device loss, and homepage search/navigation.

Hardware used: Apple M4 Pro with 16 GPU cores, macOS 15.1 (24B2082), desktop
Chromium 156.0.0.0, Apple Metal 3 adapter, not a fallback adapter. Browser
audio checks establish activation and graph state. Human headphone listening
and prolonged gameplay remain required for public release.

An earlier preview Docker image built successfully. Container runtime and the
final image check remain blocked: Docker Desktop logged storage I/O errors
and its local API stopped responding after the host disk filled. Temporary
build files from this task were cleared; existing Docker data was not reset
or pruned. The website CI now includes a clean local-only Docker build/run
check using an ephemeral /data mount. No image was pushed.

Use tools/verify_heliobound.py and tools/check_heliobound_http.py before a
future selected release import. Restore the entire previous bundle and its
manifest together for rollback. Do not change this preview into an approved
release until the remaining acceptance work and production authorization are
complete.

## Hardware measurements — 2026-11-08

The full desktop browser suite passed: ten direct modes with mouse-look and
movement assertions, return/restart, and all 36 Freeplay combinations twice.
Real tab hiding suspended simulation/audio, held controls cleared, fullscreen
entered/exited, resizing worked, and repeated Start rejected a second loop.

Device: Apple M4 Pro (16 GPU cores), macOS 15.1, desktop Chromium 156.0.0.0,
non-fallback Apple Metal 3 adapter. New-profile loopback load time: **0.10 s**.
The seven runtime files total 2.55 MiB, excluding the manifest. These are
localhost measurements, not Internet download estimates.

| Mode | Mean CPU preparation/submission (ms) | Redraw interval p50 / p95 (ms) | Peak WASM reservation (MiB) |
| --- | ---: | ---: | ---: |
| Corn Maze | 1.65 | 8.3 / 9.1 | 244.4 |
| Planet Flight | 3.25 | 8.3 / 8.7 | 180.4 |
| City Walk | 7.80 | 8.3 / 8.8 | 180.4 |
| Doomlike Arena | 5.00 | 8.3 / 8.9 | 180.4 |
| Starhusk Bar | 1.85 | 8.3 / 9.3 | 180.4 |
| Voxel Sandbox | 1.76 | 8.3 / 9.2 | 180.4 |
| Zombies | 27.43 | 27.4 / 28.5 | 180.4 |
| Liminal | 1.78 | 8.3 / 9.2 | 180.4 |
| Drone Gate Runner | 2.60 | 8.3 / 8.9 | 180.4 |
| Echolocation | 5.63 | 8.3 / 9.1 | 180.4 |

These redraw callback intervals are not GPU timestamps or displayed FPS.
Reserved WASM memory accumulates across the sequential session and is not
exclusive per-mode memory or total process RSS. Detailed timings for all 36
Freeplay map/playstyle pairs, cache sizes, restart camera positions, and test
results are recorded in the engine’s docs/browser-validation.json.

The browser profile exposed repeated navigation clearance tests in Zombies.
Walkability is now memoized within each immutable navigation rebuild, retaining
the same BFS ordering, diagonal guards, and collision rules. Each rebuild starts
with a fresh cache, so doors and world changes cannot retain stale clearance.
Measured Zombies p95 fell from 309.3 ms to 28.5 ms. Native navigation, collision,
combat, and Echolocation regressions pass. A parallel-test temporary-directory
name collision observed during verification was also fixed with a process ID
and atomic sequence in addition to the timestamp.
