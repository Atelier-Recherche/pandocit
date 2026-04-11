# Pandoc Reference List (Obsidian)

Affiche dans le panneau latéral une liste de références formatée pour chaque clé de citation Pandoc (`[@clef]`) présente dans la note active.

## Fonctionnement

- Le plugin utilise **Pandoc 3.9 en WebAssembly** (`pandoc.wasm`) pour convertir les fichiers de bibliographie (BibTeX, etc.) en CSL JSON. **Aucune installation de Pandoc sur le système n’est nécessaire.**
- Compatible **Obsidian bureau (Windows, macOS, Linux) et mobile (Android, iOS)** : le même plugin peut être installé sur desktop et sur téléphone ou tablette.

## Configuration

1. **Bibliographie**  
   Indiquez le chemin vers votre fichier de bibliographie (compatible Pandoc : `.bib`, `.json` CSL, etc.).  
   - Sur **bureau**, vous pouvez utiliser le bouton de sélection de fichier ou saisir un chemin absolu ou relatif au coffre.  
   - Sur **mobile**, saisissez un **chemin relatif au coffre** (par ex. `refs/bibliographie.bib`). La boîte de dialogue « ouvrir un fichier » n’est disponible que sur bureau.

2. **Style de citation (CSL)** *(optionnel)*  
   Choisissez un style dans la liste ou indiquez un fichier `.csl` (chemin ou URL), éventuellement surchargé par le frontmatter de la note (`bibliography`, `csl`, `lang`, etc.).

3. **Afficher le panneau**  
   Palette de commandes : **« Pandoc Reference List : Show reference list »** (ou équivalent selon la langue de l’interface) pour ouvrir l’onglet des références dans la barre latérale.

## Zotero (optionnel)

L’intégration **Better BibTeX / Zotero** (pull depuis Zotero) repose sur le réseau local et les API Node : elle est prévue pour **Obsidian bureau** uniquement. Sur mobile, utilisez une bibliographie fichier dans le coffre.

## Développement et build

Prérequis : [Node.js](https://nodejs.org/) et [Yarn](https://yarnpkg.com/).

```bash
yarn install
yarn build
```

Le script produit `main.js` à la racine du projet. Pour tester le plugin dans un coffre Obsidian, copiez au minimum dans le dossier du plugin (souvent `.obsidian/plugins/<nom-du-plugin>/`) :

- `main.js`
- `manifest.json`
- `styles.css` (s’il est présent)
- `pandoc.wasm` (obligatoire pour la conversion des bibliographies non-JSON)

## Limitations connues (WASM)

La version WebAssembly de Pandoc fonctionne dans un bac à sable : pas d’accès réseau arbitraire ni d’exécution de commandes système depuis Pandoc. Pour ce plugin, seule la conversion bibliographie → CSL JSON est utilisée, ce qui convient à l’usage prévu.

## Ressources

- [Pandoc](https://pandoc.org/) — [Releases (dont pandoc.wasm / 3.9)](https://github.com/jgm/pandoc/releases)
- [Citation Style Language (CSL)](https://citationstyles.org/)

![Capture d’écran de la liste de références](https://raw.githubusercontent.com/mgmeyers/obsidian-pandoc-reference-list/main/Screen%20Shot.png)
