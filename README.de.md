<div align="center">

<table>
<tr>
<td><img src="readme-media/logo_pandocite.jpg" alt="PandoCit" width="140" /></td>
<td align="left">
<h1 style="margin:0">PandoCit</h1>
<p style="margin:0.25em 0 0"><strong>Pandoc-Zitate in Obsidian</strong><br/>Seitenleiste · WASM-Bibliographie · Zotero-Integration</p>
</td>
</tr>
</table>

<a href="https://atelier.atechnologie.fr/" title="l'Atelier – Verein für Buchherstellung und Forschungswerkzeuge"><img src="readme-media/logoasso.jpg" alt="l'Atelier" width="200" /></a>  
<sub>Entwickelt von <a href="https://atelier.atechnologie.fr/">l'Atelier</a> — Buchherstellung und Forschungswerkzeuge (EHESS)</sub>

<p>
🇫🇷 <a href="README.md">Français</a> ·
🇬🇧 <a href="README.en.md">English</a> ·
🇩🇪 <a href="README.de.md"><b>Deutsch</b></a> ·
🇪🇸 <a href="README.es.md">Español</a>
</p>

<p>
<a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/🌐_l'Atelier-atelier.atechnologie.fr-2d5016?style=for-the-badge" alt="Website l'Atelier" /></a>
<a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/📦_Repository-GitHub-181717?style=for-the-badge&logo=github" alt="GitHub-Repository" /></a>
<a href="https://obsidian.md/plugins?search=BRAT#"><img src="https://img.shields.io/badge/⬇️_Installieren-BRAT-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white" alt="Installation über BRAT" /></a>
</p>

</div>

---

## 📸 Vorschau

| Referenzliste | Zotero-Bibliothek |
| :---: | :---: |
| <img src="readme-media/screen1.jpg" alt="Formatierte Referenzen in der Seitenleiste" width="400" /> | <img src="readme-media/screen2.jpg" alt="Zotero-Bibliothekspanel" width="400" /> |

---

## 📖 Überblick

Zeigt in der Seitenleiste eine formatierte Referenzliste für jeden Pandoc-Zitierschlüssel (`[@schlüssel]`) in der aktiven Notiz.

## ⬇️ Installation über BRAT (1 Klick)

1. 🔌 **BRAT** installieren: [Obsidian — BRAT](https://obsidian.md/plugins?search=BRAT#)
2. ➕ Dieses Repository mit *„Add Beta plugin“* hinzufügen:  
   `https://github.com/Atelier-Recherche/pandocit`

> 💡 Unsere Plugins können noch auf die Validierung im Obsidian-Katalog warten; mit BRAT können Sie sie sofort testen. Siehe auch 🌐 [l'Atelier](https://atelier.atechnologie.fr/).

## ⚙️ Funktionsweise

- 🦀 Das Plugin nutzt **Pandoc 3.9 WebAssembly** (`pandoc.wasm`), um Bibliographie-Dateien (BibTeX usw.) in CSL JSON zu konvertieren. **Keine systemweite Pandoc-Installation nötig.**
- 📱 Kompatibel mit **Obsidian Desktop** (Windows, macOS, Linux) **und Mobil** (Android, iOS): dasselbe Plugin auf Computer, Smartphone und Tablet.

## 🔧 Konfiguration

1. **📚 Bibliographie**  
   Pfad zur Bibliographie-Datei (Pandoc-kompatibel: `.bib`, CSL-`.json` usw.).  
   - 🖥️ **Desktop**: Dateiauswahl oder absoluter / vault-relativer Pfad.  
   - 📱 **Mobil**: nur **vault-relativer** Pfad (z. B. `refs/bibliographie.bib`). Der Dateidialog ist nur auf dem Desktop verfügbar.

2. **🎨 Zitierstil (CSL)** *(optional)*  
   Integrierte Liste oder `.csl`-Datei (Pfad oder URL), ggf. per Frontmatter überschreibbar (`bibliography`, `csl`, `lang` usw.).

3. **📋 Referenzpanel**  
   Befehlspalette: **„PandoCit : Show reference list“** (Bezeichnung je nach Obsidian-Oberflächensprache).

4. **🌐 Plugin-Sprache** *(optional)*  
   In den Plugin-Einstellungen: Sprache der Beschriftungen (Einstellungen, Eintragseditor, eigene Seitenleiste).

## 📚 Zotero (optional)

### 🔗 Better BibTeX / lokaler Feed

Die Integration mit **Better BibTeX** und dem lokalen Netzwerk eignet sich vor allem für **Obsidian Desktop**. Auf Mobilgeräten lieber eine Bibliographie-Datei im Vault.

### ☁️ Zotero Web API

Nach Aktivierung in den Einstellungen:

- 🔑 **API-Schlüssel** und **persönliche** oder **Gruppen**-Bibliothek (numerische ID).
- 👥 **Gruppenbibliotheken zusammenführen**: Gruppen-IDs + **Gruppen laden** oder **eigene Anzeigenamen** (eine Zeile pro ID + Bezeichnung).
- 🔄 **Bidirektionale Synchronisation** (Zotero-API-Modell).
- 📤 Optionaler **BibTeX-Export** in eine `.bib`-Datei im Vault (für Pandoc, LaTeX, Typst).

Die Daten werden als JSON im Plugin-Ordner gespeichert; **keine lokale Zotero-Node-Installation** — Offline-Nutzung des Vaults nach der Synchronisation möglich.

### 🌳 Panel „Zotero-Bibliothek“

Befehl: **„Open Zotero library panel“** / **„Zotero-Bibliothekspanel öffnen“**.

**Baumansicht** (Sammlungen, nicht eingeordnete Einträge, einzelne Anhänge, Papierkorb). Filter, Bearbeitung der Einträge (inkl. Zotero-HTML-Notizen), **PDF-/Datei**-Anhänge in der Zeile.

- **▸ Unterbaum standardmäßig eingeklappt**: Chevron in der Anhangsleiste zum Ein- und Ausklappen der Kinder.
- **🏷️ Typ-Badges** (Buch, Zeitschriftenartikel …) folgen der **Plugin-Oberflächensprache**, sofern unterstützt.

Befehl **„Sync Zotero library (Web API)“** zum Aktualisieren nach der ersten Synchronisation.

## 💻 Entwicklung und Build

Voraussetzungen: [Node.js](https://nodejs.org/) und [Yarn](https://yarnpkg.com/).

```bash
yarn install
yarn build
```

Erzeugt `main.js` im Projektroot. Zum Testen im Vault nach `.obsidian/plugins/<plugin-name>/` kopieren:

- `main.js`
- `manifest.json`
- `styles.css` (falls vorhanden)
- `pandoc.wasm` (erforderlich für Nicht-JSON-Bibliographien)

## ⚠️ Bekannte Einschränkungen (WASM)

Pandoc WASM läuft in einer Sandbox: kein beliebiger Netzwerkzugriff, keine Systembefehle. Dieses Plugin nutzt nur die Konvertierung Bibliographie → CSL JSON.

## 🔗 Ressourcen

| | |
| --- | --- |
| 🌐 **l'Atelier** | [atelier.atechnologie.fr](https://atelier.atechnologie.fr/) |
| 📦 **Repository** | [github.com/Atelier-Recherche/pandocit](https://github.com/Atelier-Recherche/pandocit) |
| 📄 **Pandoc** | [pandoc.org](https://pandoc.org/) — [Releases / pandoc.wasm 3.9](https://github.com/jgm/pandoc/releases) |
| 🎓 **CSL** | [citationstyles.org](https://citationstyles.org/) |

---

<div align="center">

<sub><a href="README.md">🇫🇷 Français</a> · <a href="README.en.md">🇬🇧 English</a> · 🇩🇪 Deutsch · <a href="README.es.md">🇪🇸 Español</a></sub>

</div>
