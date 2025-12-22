# Project README

Welcome! This repository supports two common workflows:

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

```
