# MIND GOBLIN

Welcome! This README continas two common workflows:

- **Contributing (new to Git):** clone → branch → commit → push → open a PR
- **Running locally:** install prerequisites → build Docker image → run container

---

## Contributing (Git basics)

### 1) Clone the repo (HTTPS)

```bash
git clone <HTTPS_REPO_URL>
cd <REPO_FOLDER>
````

> If Git prompts for credentials or cloning fails, you may need to set up a Personal Access Token (PAT) or a credential manager.
> If that happens, ask GPT for help configuring Git credentials for your OS.

### 2) Create a branch

```bash
git checkout -b <branchname>
```

### 3) Make changes, commit, and push

```bash
# ...make changes...
git add .
git commit
git push --set-upstream origin <branchname>
```

### 4) Open a Pull Request

Open a Pull Request from your branch to merge your changes.

---

## Quick test (HTML only, no Docker)

If you’re **only working on the HTML** and just want to preview it, you can usually open it directly in a browser:

1. In your file explorer, find the HTML file (for example: `index.html`)
2. Double-click it to open in your default browser
   *(or right-click → “Open With” → choose Chrome/Safari/Firefox)*

Tips:

* If the page loads assets (images/scripts/styles), keep the same folder structure when you move files around.
* Some browser security rules can block certain features when opening a file directly. If something seems “blocked,” run a simple local server instead:

  * **VS Code:** install “Live Server” extension → right-click HTML → **Open with Live Server**
  * **Python (if installed):**

    ```bash
    python3 -m http.server 8000
    ```

    Then open `http://localhost:8000` in your browser.

---

## Run locally (Docker)

### Prerequisites

You’ll need:

* **Docker**
* *(Optional)* **.NET SDK** (only if you want to run/debug outside Docker)

If you don’t have these installed yet, ask GPT:

* how to install **Docker** on your OS
* how to install **dotnet** on your OS (optional)

### Build the image

```bash
docker build -t jake-server .
```

### Run the container

```bash
docker run --rm -p 8080:8080 jake-server
```

---

## Notes

* The server listens on port **8080** in the container and is mapped to **localhost:8080** on your machine.
* Keep branches focused (one feature/fix per branch) to make PRs easier to review.
* Login permits 10 attempts per minute per client IP, then returns HTTP 429 with a retry message and a `Retry-After` header. Limits are held in memory per app instance and reset on restart.
* Production session cookies require HTTPS. Development permits HTTP and marks cookies secure when using HTTPS.
* The deployment workflow and scripts trust the Docker bridge gateway for the host reverse proxy. For other proxy setups, configure each exact address with `ReverseProxy__KnownProxies__0` (and `__1`, etc.). The proxy must overwrite forwarded headers supplied by visitors. Without trusted forwarding, clients behind the proxy share its login limit.

## Shared home navigation

Game and tool pages use the 44 px home strip from `wwwroot/css/site-home.css`
and `wwwroot/js/site-home.js`. The strip reserves space above the page instead
of covering its controls. The homepage, credits, and HelioEngine use their
existing headers with the same goblin symbol.

For a new standalone page, add `data-site-home` to `<html>` and include the
shared stylesheet and script at the end of `<head>` (without `defer`). Use
`var(--site-page-height)` for CSS viewport heights and
`window.MindGoblinHome.viewportHeight` for full-window canvas calculations.
Fixed controls need a top offset of `var(--site-home-height)` as well.

## HelioEngine local browser preview

The reviewed browser bundle is stored in `wwwroot/heliobound/`. It requires a
desktop keyboard/mouse and WebGPU over HTTPS or localhost. It is a **preview**;
that label records game maturity and does not block website deployment.

Validate the imported artifact:

```sh
python3 tools/verify_heliobound.py
python3 -m unittest discover -s tools -p 'test_heliobound*.py'
```

For a local .NET preview with a separate temporary database:

```sh
Database__Path=/tmp/mindgoblin-preview.db dotnet run --project JakeServer.csproj --no-launch-profile
```

Open `http://localhost:8080/heliobound/`. `Database__Path` is optional; production
retains its historical `/data` database selection when it is absent. For a
static preview, serve `wwwroot` on localhost using `python3 -m http.server`.

Build a selected engine checkout using its documented `python3 scripts/build-web.py`
command, inspect its manifest and acceptance record, then import deliberately:

```sh
python3 tools/import_heliobound.py /path/to/engine/dist/heliobound --replace
python3 tools/check_heliobound_http.py http://localhost:8080
```

Review the complete bundle and manifest in the same website change. Roll back
by restoring the entire prior `wwwroot/heliobound/` directory and manifest
together. The normal website deployment workflow uses `context: .` and verifies
the bundle's inventory and checksums. Preview/release and dirty-source fields
record provenance; both are accepted. There is no separate HelioEngine workflow.
Pushing or merging to `main` uses the existing website build and deployment flow.
See [HelioEngine validation](HelioboundPreview.md) for measured coverage.
