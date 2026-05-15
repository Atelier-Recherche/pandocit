<div align="center">

<table>
<tr>
<td><img src="readme-media/logo_pandocite.jpg" alt="PandoCit" width="140" /></td>
<td align="left">
<h1 style="margin:0">PandoCit</h1>
<p style="margin:0.25em 0 0"><strong>Citas Pandoc en Obsidian</strong><br/>panel lateral · bibliografía WASM · integración Zotero</p>
</td>
</tr>
</table>

<a href="https://atelier.atechnologie.fr/" title="l'Atelier – asociación de fabricación de libros y herramientas de investigación"><img src="readme-media/logoasso.jpg" alt="l'Atelier" width="200" /></a>  
<sub>Desarrollado por <a href="https://atelier.atechnologie.fr/">l'Atelier</a> — fabricación de libros y herramientas de investigación (EHESS)</sub>

<p>
🇫🇷 <a href="README.md">Français</a> ·
🇬🇧 <a href="README.en.md">English</a> ·
🇩🇪 <a href="README.de.md">Deutsch</a> ·
🇪🇸 <a href="README.es.md"><b>Español</b></a>
</p>

<p>
<a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/🌐_l'Atelier-atelier.atechnologie.fr-2d5016?style=for-the-badge" alt="Sitio l'Atelier" /></a>
<a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/📦_Repositorio-GitHub-181717?style=for-the-badge&logo=github" alt="Repositorio GitHub" /></a>
<a href="https://obsidian.md/plugins?search=BRAT#"><img src="https://img.shields.io/badge/⬇️_Instalar-BRAT-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white" alt="Instalar vía BRAT" /></a>
</p>

</div>

---

## 📸 Vista previa

| Lista de referencias | Biblioteca Zotero |
| :---: | :---: |
| <img src="readme-media/screen1.jpg" alt="Panel de referencias formateadas" width="400" /> | <img src="readme-media/screen2.jpg" alt="Panel biblioteca Zotero" width="400" /> |

---

## 📖 Acerca de

Muestra en el panel lateral una lista de referencias formateada para cada clave de cita Pandoc (`[@clave]`) presente en la nota activa.

## ⬇️ Instalación vía BRAT (1 clic)

1. 🔌 Instalar **BRAT**: [Obsidian — BRAT](https://obsidian.md/plugins?search=BRAT#)
2. ➕ Añadir este repositorio con *« Add Beta plugin »*:  
   `https://github.com/Atelier-Recherche/pandocit`

> 💡 Nuestros plugins pueden estar pendientes de validación en el catálogo de Obsidian; BRAT permite probarlos de inmediato. Véase también 🌐 [l'Atelier](https://atelier.atechnologie.fr/).

## ⚙️ Funcionamiento

- 🦀 El plugin utiliza **Pandoc 3.9 WebAssembly** (`pandoc.wasm`) para convertir archivos de bibliografía (BibTeX, etc.) a CSL JSON. **No hace falta instalar Pandoc en el sistema.**
- 📱 Compatible con **Obsidian de escritorio** (Windows, macOS, Linux) **y móvil** (Android, iOS): el mismo plugin en ordenador, teléfono y tableta.

## 🔧 Configuración

1. **📚 Bibliografía**  
   Ruta al archivo de bibliografía (compatible con Pandoc: `.bib`, `.json` CSL, etc.).  
   - 🖥️ En **escritorio**: selector de archivos o ruta absoluta / relativa al cofre.  
   - 📱 En **móvil**: ruta **relativa al cofre** (p. ej. `refs/bibliografia.bib`). El cuadro «abrir archivo» solo está en escritorio.

2. **🎨 Estilo de cita (CSL)** *(opcional)*  
   Lista integrada o archivo `.csl` (ruta o URL), eventualmente sobrescrito por el frontmatter (`bibliography`, `csl`, `lang`, etc.).

3. **📋 Panel de referencias**  
   Paleta de comandos: **« PandoCit : Show reference list »** (etiqueta según el idioma de Obsidian).

4. **🌐 Idioma del plugin** *(opcional)*  
   En los ajustes del plugin: idioma de las etiquetas (ajustes, editor de fichas, panel lateral dedicado).

## 📚 Zotero (opcional)

### 🔗 Better BibTeX / flujo local

La integración con **Better BibTeX** y la red local conviene sobre todo en **Obsidian de escritorio**. En móvil, preferir un archivo de bibliografía en el cofre.

### ☁️ Zotero Web API

Una vez activada en los ajustes:

- 🔑 **Clave API** y biblioteca **personal** o de **grupo** (ID numérico).
- 👥 **Fusión de bibliotecas de grupo**: IDs de grupo + **Cargar grupos** o **nombres de visualización personalizados** (una línea por ID + etiqueta).
- 🔄 **Sincronización** bidireccional (modelo API Zotero).
- 📤 **Exportación BibTeX** opcional a un `.bib` en el cofre (Pandoc, LaTeX, Typst).

Los datos se almacenan en JSON en la carpeta del plugin; **no se requiere Node local de Zotero** — uso sin conexión del cofre tras la sincronización.

### 🌳 Panel « Biblioteca Zotero »

Comando: **« Open Zotero library panel »** / **« Abrir panel biblioteca Zotero »**.

Vista **en árbol** (colecciones, elementos sin clasificar, adjuntos sueltos, papelera). Filtro, edición de fichas (notas HTML Zotero), adjuntos **PDF / archivos** en la fila.

- **▸ Subárbol plegado por defecto**: icono chevron en la franja de adjuntos para mostrar / ocultar hijos.
- **🏷️ Insignias de tipo** (libro, artículo…) según el **idioma de interfaz del plugin**.

Comando **« Sync Zotero library (Web API) »** para actualizar tras la primera sincronización.

## 💻 Desarrollo y compilación

Requisitos: [Node.js](https://nodejs.org/) y [Yarn](https://yarnpkg.com/).

```bash
yarn install
yarn build
```

Genera `main.js` en la raíz. Para probar en un cofre Obsidian, copiar en `.obsidian/plugins/<nombre-del-plugin>/`:

- `main.js`
- `manifest.json`
- `styles.css` (si existe)
- `pandoc.wasm` (obligatorio para bibliografías no JSON)

## ⚠️ Limitaciones conocidas (WASM)

Pandoc WASM se ejecuta en un entorno aislado: sin acceso de red arbitrario ni comandos del sistema. Este plugin solo usa la conversión bibliografía → CSL JSON.

## 🔗 Recursos

| | |
| --- | --- |
| 🌐 **l'Atelier** | [atelier.atechnologie.fr](https://atelier.atechnologie.fr/) |
| 📦 **Repositorio** | [github.com/Atelier-Recherche/pandocit](https://github.com/Atelier-Recherche/pandocit) |
| 📄 **Pandoc** | [pandoc.org](https://pandoc.org/) — [Releases / pandoc.wasm 3.9](https://github.com/jgm/pandoc/releases) |
| 🎓 **CSL** | [citationstyles.org](https://citationstyles.org/) |

---

<div align="center">

<sub><a href="README.md">🇫🇷 Français</a> · <a href="README.en.md">🇬🇧 English</a> · <a href="README.de.md">🇩🇪 Deutsch</a> · 🇪🇸 Español</sub>

</div>
