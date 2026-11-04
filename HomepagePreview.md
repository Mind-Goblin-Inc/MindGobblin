**Mind Goblin homepage — local preview**

Branch: `feature/homepage-directory`. This is a local homepage redesign; it has not been pushed or deployed.

From the repository root, run:

```sh
npm run home:preview
```

Open <http://127.0.0.1:8765>. Stop the preview with Ctrl+C. To use another port:

```sh
python3 tools/preview_home.py --port 8766
```

The preview requires Python 3 and uses only its standard library. It binds to the local machine. It does not contact production or require Docker, .NET startup, API keys, or a database.

**What to try**

- Browse all 32 projects, organized into Games, Simulations, Tools & oddities, and In progress. Tiles show names and emojis with useful control notes; descriptive and promotional copy has been removed.
- Open About from the footer for clickable game-credit tiles: Wordle by John; Tetris, Tong’s Patty, and both Pong games by Tong; Bears 2048 by Keira. Game emojis are shown consistently in the catalogue, Featured section, and credits.
- Use the category links and search. Try `pong`, `goblin`, or a name with no match, then clear the search.
- Resize the browser to a phone width. The header, catalogue, and account controls should wrap cleanly.
- The palette uses rich olive backgrounds, cream text, and warm gold/green accents drawn from the artwork. The side artwork retains its full original color. At desktop widths of 1,280 px and up, alternating bee and mushroom-house banners frame the page in aligned rows on both sides. On smaller screens, the homepage keeps those illustrations within the content so they cannot overlap game links. Entries, buttons, artwork frames, and dialogs have square corners.
- Open Log in, choose Create account, and create a temporary demo account with a made-up password. Claim the daily 25 Clinkbits, log out, and log in again.
- Use Tab, Shift+Tab, and Escape in the account dialog.

Demo accounts and balances exist only in this preview process. They are separate from live accounts and disappear when the server stops. A notice in the account dialog identifies the demo. The shipped frontend continues using the existing production API routes; the Python preview is a separate development tool.

**Scope and existing limitations**

The original game URLs, source artwork, and backend are preserved. Most standalone games can run from the preview. Unity files are served with their required Brotli encoding and content types. Tetris has a temporary local leaderboard so it can start normally; scores disappear when the preview stops. Multiplayer, persistent scores, shared canvases, Spotify authorization, external stats, and other game-specific server features need the actual application backend; the preview does not simulate those services.

Game pages retain their existing layouts and controls. A responsive homepage does not add touch controls to desktop games. Dagon still opens a page titled Echo Rift; local Pong is labeled to reflect its two-player keyboard controls. Goblin Casino includes a note about unfinished tables, and the existing development projects remain in In progress.

**Validation**

- All 32 original catalogue destinations preserved and returning HTTP 200 locally.
- Both Unity games’ loader, data, framework, and WebAssembly files available; compressed responses include `Content-Encoding: br`.
- Chromium checks at widths 320, 375, 390, 639, 640, 768, 959, 960, 1,024, and 1,440 px: no horizontal page overflow. Signed-in checks include a long username.
- Search, empty results, clear, dialog focus wrapping, Escape/focus restoration, account creation, invalid login, valid login, logout, balance, daily claim, and repeat-claim prevention checked against temporary demo APIs.
- All catalogue links usable with JavaScript disabled. Account API failure leaves browsing and search usable.
- Automated accessibility scans of the homepage and open account dialog report no violations in Chromium. This is a useful check, not a replacement for real-device or assistive-technology testing.
- The four optimized WebP illustrations total 141,004 bytes; the original multi-megabyte artwork remains intact. A small favicon avoids downloading the original 1.7 MB icon.
- Homepage JavaScript syntax, preview Python syntax, and Git whitespace checks pass.
- WebKit checks in a mobile touch context cover portrait/landscape layouts, search, dialog focus and Escape, registration, claim, and logout. Chromium also fits at 200% CSS zoom.

The implementation introduces no frontend package dependencies. Browser-check tools were installed outside this repository. Real iPhone/Android hardware testing has not been performed.
