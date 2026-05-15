<div align="center">

<table>
<tr>
<td><img src="readme-media/logo_pandocite.jpg" alt="PandoCit" width="140" /></td>
<td align="left">
<h1 style="margin:0">PandoCit</h1>
<p style="margin:0.25em 0 0"><strong>Pandoc citations in Obsidian</strong><br/>sidebar panel · WASM bibliography · Zotero integration</p>
</td>
</tr>
</table>

<a href="https://atelier.atechnologie.fr/" title="l'Atelier – book-making and research-tools association"><img src="readme-media/logoasso.jpg" alt="l'Atelier" width="200" /></a>  
<sub>Developed by <a href="https://atelier.atechnologie.fr/">l'Atelier</a> — book-making and research tools (EHESS)</sub>

<p>
🇫🇷 <a href="README.md">Français</a> ·
🇬🇧 <a href="README.en.md"><b>English</b></a> ·
🇩🇪 <a href="README.de.md">Deutsch</a> ·
🇪🇸 <a href="README.es.md">Español</a>
</p>

<p>
<a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/🌐_l'Atelier-atelier.atechnologie.fr-2d5016?style=for-the-badge" alt="l'Atelier website" /></a>
<a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/📦_Repository-GitHub-181717?style=for-the-badge&logo=github" alt="GitHub repository" /></a>
<a href="https://obsidian.md/plugins?search=BRAT#"><img src="https://img.shields.io/badge/⬇️_Install-BRAT-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white" alt="Install via BRAT" /></a>
</p>

</div>

---

## 📸 Preview

| Reference list | Zotero library |
| :---: | :---: |
| <img src="readme-media/screen1.jpg" alt="Formatted reference sidebar" width="400" /> | <img src="readme-media/screen2.jpg" alt="Zotero library panel" width="400" /> |

---

## 📖 About

Shows a formatted reference list in the sidebar for each Pandoc citation key (`[@key]`) in the active note.

## ⬇️ Install via BRAT (one click)

1. 🔌 Install **BRAT**: [Obsidian — BRAT](https://obsidian.md/plugins?search=BRAT#)
2. ➕ Add this repo with *“Add Beta plugin”*:  
   `https://github.com/Atelier-Recherche/pandocit`

> 💡 Our plugins may still be pending Obsidian community review; BRAT lets you try them now. See also 🌐 [l'Atelier](https://atelier.atechnologie.fr/).

## ⚙️ How it works

- 🦀 Uses **Pandoc 3.9 WebAssembly** (`pandoc.wasm`) to convert bibliography files (BibTeX, etc.) to CSL JSON. **No system Pandoc install required.**
- 📱 Works on **Obsidian desktop** (Windows, macOS, Linux) **and mobile** (Android, iOS).

## 🔧 Configuration

1. **📚 Bibliography**  
   Path to your bibliography file (Pandoc-compatible: `.bib`, CSL `.json`, etc.).  
   - 🖥️ **Desktop**: file picker or absolute / vault-relative path.  
   - 📱 **Mobile**: **vault-relative** path only (e.g. `refs/library.bib`). File dialog is desktop-only.

2. **🎨 Citation style (CSL)** *(optional)*  
   Built-in list or `.csl` file (path or URL); overridable via note frontmatter (`bibliography`, `csl`, `lang`, etc.).

3. **📋 Reference panel**  
   Command palette: **“PandoCit : Show reference list”** (label depends on Obsidian UI language).

4. **🌐 Plugin language** *(optional)*  
   Plugin settings: UI language for labels (settings, item editor, dedicated sidebar).

## 📚 Zotero (optional)

### 🔗 Better BibTeX / local feed

**Better BibTeX** and local network sync work best on **desktop**. On mobile, prefer a bibliography file in the vault.

### ☁️ Zotero Web API

When enabled in settings:

- 🔑 **API key** and **personal** or **group** library (numeric ID).
- 👥 **Merge group libraries**: group IDs + **Load groups** or **custom display names** (one line per ID + label).
- 🔄 **Bidirectional sync** (Zotero API model).
- 📤 Optional **BibTeX export** to a vault `.bib` (for Pandoc, LaTeX, Typst).

Data is stored as JSON in the plugin folder; **no local Zotero Node install** — offline vault use after sync.

### 🌳 “Zotero library” panel

Command: **“Open Zotero library panel”**.

**Tree view** (collections, unfiled items, standalone attachments, trash). Filter, edit items (including Zotero HTML notes), **PDF / file** attachments on each row.

- **▸ Collapsed subtrees by default**: chevron in the attachment strip to expand / collapse children.
- **🏷️ Type badges** (book, journal article…) follow the **plugin UI language** when supported.

Use **“Sync Zotero library (Web API)”** to refresh after the first sync.

## 💻 Development and build

Requires [Node.js](https://nodejs.org/) and [Yarn](https://yarnpkg.com/).

```bash
yarn install
yarn build
```

Produces `main.js` at the project root. To test in a vault, copy into `.obsidian/plugins/<plugin-name>/`:

- `main.js`
- `manifest.json`
- `styles.css` (if present)
- `pandoc.wasm` (required for non-JSON bibliographies)

## ⚠️ Known limitations (WASM)

Pandoc WASM runs in a sandbox: no arbitrary network or shell commands. This plugin only uses bibliography → CSL JSON conversion.

## 🔗 Resources

| | |
| --- | --- |
| 🌐 **l'Atelier** | [atelier.atechnologie.fr](https://atelier.atechnologie.fr/) |
| 📦 **Repository** | [github.com/Atelier-Recherche/pandocit](https://github.com/Atelier-Recherche/pandocit) |
| 📄 **Pandoc** | [pandoc.org](https://pandoc.org/) — [Releases / pandoc.wasm 3.9](https://github.com/jgm/pandoc/releases) |
| 🎓 **CSL** | [citationstyles.org](https://citationstyles.org/) |

---

<div align="center">

<sub><a href="README.md">🇫🇷 Français</a> · 🇬🇧 English · <a href="README.de.md">🇩🇪 Deutsch</a> · <a href="README.es.md">🇪🇸 Español</a></sub>

</div>
