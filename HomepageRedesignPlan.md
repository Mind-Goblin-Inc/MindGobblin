**Mind Goblin homepage redesign plan — November 3, 2026**

Status: design plan implemented locally on `feature/homepage-directory`. See `HomepagePreview.md` for the demo and validation. Production has not been deployed.

**1. Direction and scope**

Keep Mind Goblin recognizable as a personal collection of games and experiments. Preserve its dark background, green accent, goblin mascot, existing illustrations, casual language, and direct links. Improve the hierarchy, grouping, spacing, and behavior on small screens.

The result should feel like a carefully maintained personal website. The games and artwork should provide the personality. Use ordinary typography, compact navigation, and specific project names. Avoid promotional copy, a large promotional hero, animated backgrounds, excessive badges, oversized rounded tiles, and repeated emoji around every title.

This first pass covers the homepage and its account controls. It includes checking project links and describing control requirements accurately. Improving the homepage does not automatically make every linked game playable with touch. Game-specific control changes require a separate, itemized follow-up.

**2. Findings from the current source**

- `wwwroot/index.html` has no mobile viewport declaration. Its narrow-screen rules therefore cannot reliably deliver the intended phone layout.
- The catalogue has 32 distinct destinations. Five projects appear again under Weekly Highlights.
- Games, development status, tools, and simulations are mixed together. Goblin Graphics Lab is currently under Games; Orbital Simulation is under Things.
- Identically styled, centered tiles make long lists difficult to scan. Titles contain inconsistent decoration and naming.
- Login and currency controls are fixed to the upper-right viewport corner, so they do not reserve space in the layout. The balance also appears twice when signed in.
- The goblin, bee, mushroom-house, and Clinkbit PNGs total roughly 9 MB. Resizing them with CSS does not reduce their download sizes.
- Repeated side illustrations are rebuilt by JavaScript when the viewport changes. The decorative container is also written inside the document head instead of the body.
- The underlying site is already a static HTML/CSS/JavaScript homepage served by the existing .NET app. A new framework or build pipeline is unnecessary for this work.

**3. Page structure**

Use this order on desktop and mobile:

1. A compact header with the goblin identity, site name, account controls, and category navigation.
2. A short introduction using the existing voice: “A collection of games & things.”
3. A small Featured section with three deliberate picks.
4. A search field labeled “Find a game or project.”
5. Games, with four small subgroups.
6. Simulations.
7. Tools & oddities.
8. In progress.
9. A modest footer with the existing source link and a Back to top link.

The header navigation links to Games, Simulations, Tools & oddities, and In progress. These are ordinary page anchors, so visitors can browse immediately and browser Back continues to work. Every section is visible by default.

Use a content width of approximately 1,000–1,040 px. Keep the introduction compact enough that actual game links appear early on phone screens. Avoid a large empty first screen.

**4. Complete initial catalogue organization**

Each destination has one primary location. The Featured section is the only intentional repetition.

| Section | Subgroup | Projects |
| --- | --- | --- |
| Games | Arcade | Tong’s Tetris; Tong’s Patty; Pong — local; Asteroids; Click Timing Game; Snake; Goblin Casino |
| Games | Puzzles | Wordle; Minesweeper |
| Games | Action & exploration | Starhusk; Dagon; ConDestructor |
| Games | Multiplayer | Pong — online |
| Simulations | — | Goblin Simulation; Orbital Simulation; Conway’s Life |
| Tools & oddities | — | Goblin Graphics Lab; Euchre Tracker; The Location; Drums; Dog Pictures; Spotify Playlist Maker; Clash Royale Stats |
| In progress | — | Bears 2048; Artillery; Fractal; Goin’ Rogue; Pentathlon; Ghoul; Warmonger; Echoes of the Heartforge; Powell |

These are proposed presentation labels. Preserve all current destination URLs, including their capitalization and existing spellings. A clearer homepage label must not break a bookmark.

Before finalizing descriptions, open each project and check what it actually does. Specific naming questions already visible in the source:

- The Dagon link opens a page titled Echo Rift. Keep the current public link name initially and record the discrepancy for an explicit naming decision.
- The link called Singleplayer Pong opens a page titled Two-Player Pong. Use “Pong — local” until the intended mode has been checked.
- Goblin Casino contains text describing scaffolded gameplay. Verify readiness before treating it as a recommended game or describing it as fully playable.
- Keep the existing In progress projects in that section until their status has been verified. A visual redesign must not silently promote unfinished work.

Use Starhusk, Tong’s Tetris, and Goblin Simulation as the initial Featured selections, subject to the link and launch checks. Label the section “Featured,” since “Weekly Highlights” implies an update schedule that is not represented in the source.

**5. Project entries and browsing behavior**

Use compact, left-aligned entries with a subtle border or divider and approximately 6–8 px corners. The entire entry is a normal link. Avoid nested buttons inside it.

Each entry contains:

- A clear project title.
- One short, factual description, generally 6–12 words.
- A control note only when it helps the visitor choose: for example, “Touch controls,” “Keyboard needed,” or “Two players.”

Example copy: “Minesweeper — Clear the board without hitting a mine.” Keep distinctive names such as Tong’s Tetris. Use consistent spelling for descriptive labels without renaming files.

Use at most one restrained emoji for a subgroup if it improves recognition. The existing mascot and illustrations already carry the visual identity.

Search behavior:

- Match project titles and descriptions without regard to capitalization.
- Filter the existing HTML entries; do not fetch results or navigate away.
- Hide subgroup and section headings that have no matching entries.
- Hide Featured while searching so results do not repeat.
- Show a simple result count and an accessible clear control.
- If nothing matches, show “No projects match that search” and a Clear search action.
- Clearing the field restores the complete catalogue and normal section navigation.
- During a search, hide the category jump links whose targets are being filtered; restore them when the search is cleared.
- Render the catalogue as real HTML so all links remain usable if JavaScript fails. Reveal search only when its behavior has initialized.

Keep the catalogue in a stable editorial order. Favorites, recent history, sorting menus, and personalization are outside this first pass.

**6. Visual treatment and artwork**

Retain the existing near-black/navy background, off-white text, and mint-green accent. Use the accent primarily for links, focus indicators, and small details. Keep a slightly lighter surface for entries, quiet separators, and readable secondary text.

Use a system sans-serif font. Set body copy near 16 px, project titles near 17–18 px, and the main heading around 28–36 px depending on width. Prefer sentence case and ordinary letter spacing. Use an 8 px spacing scale, with roughly 12–16 px inside entries and 28–40 px between major sections.

Preserve these actual images:

- `springgoblin.png`: the main identity image, displayed in full without the current circular crop. Approximately 100–120 px on desktop and 64–80 px on phones.
- `bee.png` and `gnomesandtheirmushroomhome.png`: one intentional placement each, rather than repeated pictures down the viewport edges. On wide screens they can sit in a reserved margin beside the introduction and a later section. On phones they become small illustrations within section breaks, without taking over the first screen.
- `clinkbit.png`: a small, crisp currency icon beside the signed-in balance.

Preserve each illustration’s proportions. Do not stretch portrait art to fill an unrelated shape or place text over the detailed scenes. Decorative images receive empty alternative text; the mascot receives useful alternative text if the adjacent title does not already communicate its role.

Produce smaller web versions of the existing images while retaining the original files. Use appropriately sized WebP versions with a PNG fallback where needed. Set explicit dimensions to prevent layout shifts. Load secondary illustrations lazily and make sure optional artwork does not delay browsing. Aim for under 400 KB of total homepage image downloads on phones, then measure the actual result.

**7. Responsive layout**

| Available width | Layout |
| --- | --- |
| Below 640 px | One catalogue column, 16 px side padding, wrapped header navigation, account controls in normal flow, compact featured entries |
| 640–959 px | Two columns when entries fit comfortably, 24 px side padding, restrained artwork |
| 960 px and above | Centered content up to approximately 1,040 px, three catalogue columns, room for the existing illustrations |

The browser’s available space should determine wrapping. Avoid squeezing titles or controls merely to preserve a column count.

Add the mobile viewport declaration. Keep browser zoom available. Make interactive targets at least 44 px high as a design target, allow long names to wrap, and keep focused inputs at a readable size. The page must fit at 320 px width without horizontal scrolling.

Use regular vertical scrolling. Avoid horizontal carousels, swipe-only navigation, and a hamburger menu for four category links. The header scrolls with the page so it does not consume a large portion of a phone screen.

Mobile compatibility notes must follow a functional check. A touch event handler or a viewport declaration alone does not establish that a game is playable on a phone. Desktop-oriented games remain available with an honest control note.

**8. Account controls and accessibility**

Place account controls inside the header layout. When signed out, show Log in. When signed in, show the username, a single Clinkbit balance, the existing claim action, and a compact logout action. Let long usernames and large balances wrap without overlapping other content.

Keep the existing authentication and currency endpoints and rules. Move the login/register forms into one accessible dialog with the same form fields and operations. On phones it fits within the viewport; on desktop it is a compact centered dialog. Opening it moves focus inside, Escape closes it, and closing it restores focus to the trigger. Use clear inline feedback for authentication and claim errors. Loading or failed account requests must not block catalogue links.

Provide semantic header, navigation, main, section, and footer elements; one main heading; a Skip to games link; visible keyboard focus; correctly associated labels; sufficient text contrast; and readable disabled states. Announce search-result counts and form feedback without repeatedly interrupting screen-reader users. Respect reduced-motion preferences. Hover effects should be small color or border changes and must not move the layout.

**9. Proposed implementation files and approach**

- Update `wwwroot/index.html` for the structure, static catalogue, viewport setting, and account dialog.
- Add `wwwroot/css/home.css` for homepage-specific layout and styling.
- Add `wwwroot/js/home.js` for search, account interactions, and small progressive enhancements.
- Add appropriately sized derivatives under `wwwroot/img/home/`, keeping source artwork untouched.

Use plain HTML, CSS, and JavaScript, with homepage-specific selectors. Preserve all project paths and the existing backend behavior. Static project links must not depend on authentication, network API responses, or JavaScript initialization. Reuse the current login, registration, logout, and daily-claim requests, while separating their error handling from catalogue browsing.

**10. Implementation sequence after this plan**

1. Capture the current desktop and phone appearance, inventory all 32 destinations, and record any existing broken links or project-status questions.
2. Verify the proposed labels, descriptions, and control notes against the actual pages. Check the three Featured candidates launch.
3. Build the semantic structure and complete catalogue while preserving destination paths.
4. Apply the restrained visual styling and responsive layouts, then place and optimize the existing artwork.
5. Adapt account controls and add the progressive search behavior.
6. Check the homepage in desktop and phone browsers, correct issues, and prepare a local preview for review.
7. Deploy only when implementation is authorized and the reviewable result is ready. Check the public homepage, account UI, representative links, and HTTPS after deployment. Keep a rollback path to the previous homepage assets or deployment.

Existing unrelated local changes, currently including `.gitignore`, must be preserved.

**11. Acceptance criteria**

- All 32 current destinations remain accessible with the same URLs, and the main catalogue contains one entry per destination.
- The initial screen clearly identifies Mind Goblin and leads quickly to game links.
- The goblin, bee, and mushroom-house artwork remain recognizable and intentional.
- The complete catalogue works with JavaScript disabled. An account API failure does not prevent navigation.
- Search, clearing search, no-results feedback, category headings, and browser Back behave sensibly.
- There is no horizontal overflow or account overlap at widths of 320, 375, 390, 768, 1,024, and 1,440 px. Check portrait, landscape, 200% zoom, and long signed-in usernames.
- Login, registration, logout, balance display, daily claim, already-claimed feedback, and failed-request feedback retain their intended behavior.
- Keyboard users can reach all links, operate the account dialog, see focus, and return to the opening control. Touch users can select entries without relying on hover.
- Check Safari on iPhone and Chrome on Android when devices are available, plus desktop Safari and Chrome. State any browser or real-device coverage that could not be completed.
- Verify each catalogue URL returns the intended page. Inspect the Featured projects’ essential assets as well; a successful HTML response alone is insufficient for a Unity launch.
- Measure image downloads and inspect layout shifts and console errors. Add automated coverage only for meaningful interaction or regression risks; this does not require a new general test framework.

The review deliverable is a working local homepage preview with desktop and phone views, a short validation record, and an explicit list of any existing project-level issues outside the homepage scope.
