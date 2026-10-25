<p align="center">
  <a href="https://hitmman55.github.io/claude-code-chat-viewer/">
    <img src="https://img.shields.io/badge/▶-DÉMO%20EN%20LIGNE-2ea043?style=for-the-badge" alt="Démo en ligne" />
  </a>
</p>
<p align="center"><i>Un simple clic — aucune installation, aucun build, aucune inscription.</i></p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.es.md">Español</a> ·
  <b>Français</b> ·
  <a href="README.zh-CN.md">中文</a> ·
  <a href="README.ar.md">العربية</a>
</p>

# Claude Code Chat Viewer

Lisez l'historique de vos conversations Claude Code dans un navigateur. Claude Code enregistre chaque session dans un fichier JSONL sous `~/.claude/projects/` ; ouvrez-en un ici et il devient un fil lisible — vos messages, les réponses de Claude, la réflexion (thinking), les appels d'outils et leurs résultats, les rapports des sous-agents — avec des filtres et un mode lecture. Un seul fichier HTML, sans serveur, sans installation, qui fonctionne hors ligne ; rien ne quitte votre machine. Prend en charge le format des transcriptions jusqu'à Claude Code 2.1.310.

<p align="center">
  <img src="https://img.shields.io/badge/license-Unlicense-blue" alt="Licence : Unlicense" />
  <img src="https://img.shields.io/badge/runtime%20deps-0-brightgreen" alt="Zéro dépendance runtime" />
  <img src="https://img.shields.io/badge/offline-first-success" alt="Fonctionne hors ligne" />
  <img src="https://img.shields.io/badge/i18n-6%20languages-informational" alt="6 langues d'interface" />
</p>

<p align="center">
  <img src="screenshot.png" alt="Capture d'écran" width="900" />
</p>

## Pourquoi

Claude Code enregistre chaque session dans `~/.claude/projects/<project>/<session-uuid>.jsonl` — une ligne par enregistrement (message utilisateur, réponse du modèle, thinking, tool_use, tool_result, attachment, etc.). Le fichier brut est illisible ; les commandes intégrées comme `/resume` et `/export` rouvrent une conversation ou la recopient telle quelle, mais ne permettent pas d'examiner une ancienne transcription avec ses appels d'outils et ses enregistrements de service.

Cette visionneuse transforme un tel `.jsonl` en un flux lisible avec des rôles codés par couleur, des blocs de service repliables (thinking / tools / results) et des filtres.

## Ce qui la distingue

- **Rien à installer, rien à l'écoute.** Un seul fichier HTML : pas de serveur, pas de port ouvert, aucune requête réseau automatique.
- **Lit le format en profondeur.** Rapports de sous-agents, compactions, messages en file d'attente, appels d'outils refusés, images et enregistrements que Claude Code ajoute à chaque version — chacun est étiqueté pour ce qu'il est, et un type d'enregistrement encore inconnu est affiché et signalé, jamais écarté.
- **Honnête sur qui a dit quoi.** Les balises qui encadrent les commandes, la sortie des hooks et les notifications automatiques ne sont ni comptées ni affichées comme vos messages.
- **Pas seulement l'alphabet latin.** Six langues d'interface, RTL pour l'arabe ; le fil affiche toute langue telle qu'elle est écrite.

## Ce qui est affiché

- **user** (bleu) — messages réels de l'utilisateur
- **assistant** (vert) — réponses textuelles de Claude
- **thinking** (violet) — extended thinking, replié par défaut
- **tool_use** (ambre) — appels d'outils avec aperçu des arguments
- **tool_result** (cyan / rouge pour les erreurs) — réponses des outils
- **meta / task-note** (jaune) — injections système et `<task-notification>` des sous-agents
- **question → réponse** — un appel `AskUserQuestion` et la réponse de la personne dans une seule carte
- **rapport de sous-agent** (`↩ report`) — le rapport final d'un sous-agent, avec le nom de sa tâche ; quand un sous-agent en arrière-plan se termine, on voit : tokens · durée · appels d'outils
- **hooks** — exécutions et erreurs de hooks (filtre dédié, désactivé par défaut)
- **compaction** — un séparateur avec la baisse du nombre de tokens ; le résumé de compaction est replié
- **images** — captures d'écran et pages PDF stockées dans la transcription, affichées à l'ouverture de leur bloc
- **system / attachment / ui-state** — enregistrements de service (cachés par défaut) ; une valeur que la CLI réécrit à chaque tour (titre de la session, mode de permissions) n'est affichée que lorsqu'elle change

Chaque bloc est une ligne distincte avec une barre colorée à gauche. Pas de bulles de messagerie : c'est un log, pas un chat.

## Comment ouvrir

Choisissez ce qui vous convient :

**A. Télécharger un seul fichier** — le plus simple. Prenez le HTML autonome depuis la [dernière release](https://github.com/hitmman55/claude-code-chat-viewer/releases/latest), double-cliquez dessus. Un fichier, fonctionne hors ligne pour toujours.

**B. Cloner le dépôt** — si vous voulez modifier le code. Il vous faut `index.html` et le dossier `lib/`.

**C. En ligne** — ouvrez <https://hitmman55.github.io/claude-code-chat-viewer/>. Rien à télécharger.

Une fois ouvert, cliquez sur le sélecteur de fichier (ou déposez-en un, ou utilisez le bouton « Essayer avec l'exemple ») et choisissez une transcription `.jsonl`.

Les transcriptions de Claude Code se trouvent dans :

```
~/.claude/projects/<project-slug>/<session-uuid>.jsonl
```

où `<project-slug>` est votre répertoire de travail dont chaque caractère autre qu'une lettre ou un chiffre est remplacé par `-`. Exemple : `/home/user/my_proj` → `-home-user-my-proj`.

### Claude Code tourne sur un serveur

Souvent, Claude Code travaille sur une machine Linux distante pendant que vous lisez sur un Mac ou un portable Windows. Le navigateur ne peut pas atteindre le serveur tout seul — rapatriez les fichiers de l'une de ces deux façons :

- **Monter le serveur comme un lecteur** — des clients SFTP comme RaiDrive ou SSHFS-Win (Windows), Mountain Duck (Mac, Windows) ou `sshfs` (Mac, Linux). Ouvrez ensuite une transcription depuis ce lecteur comme depuis un dossier local.
- **Copier les transcriptions** — sur Mac ou Linux `rsync -a user@host:~/.claude/projects/ ~/claude-projects/` (relancez-le pour ne récupérer que ce qui a changé) ; sous Windows `scp -r user@host:~/.claude/projects/<project-slug> .` ou le panneau de fichiers de votre client SSH (Termius, WinSCP). Une copie se lit sans aucune connexion.

## Fonctionnalités

### Comment charger un fichier

- **Sélecteur de fichier** — cliquez sur « Choisir un fichier » et sélectionnez un `.jsonl`.
- **Glisser-déposer** — déposez un fichier n'importe où sur la page. Un contour pointillé signale la zone. Les dossiers et les éléments qui ne sont pas des fichiers sont rejetés proprement.
- **Essayer avec l'exemple** — dans l'état initial (utilisation en ligne), un bouton apparaît qui charge un `demo.jsonl` intégré montrant les principaux types de blocs.

### Confort de lecture

- **Mode lecture** — bouton dans l'en-tête qui ne garde que ce qu'ont dit les personnes et Claude : vos messages (y compris `/compact` avec ses arguments), les réponses textuelles de Claude, les cartes question → réponse, les rapports des sous-agents et les séparateurs de compaction. Pas de thinking, pas d'appels d'outils, pas d'enregistrements de service. Idéal pour parcourir rapidement ou partager une vue épurée.
- **Copier par message** — bouton `📋` dans l'en-tête de chaque entrée. Copie le texte dans le presse-papiers avec une confirmation `✓` pendant 1.2 s. Utilise `navigator.clipboard.writeText` avec un fallback `document.execCommand` pour les contextes `file://`.
- **Statistiques honnêtes** — les messages de la personne et les réponses du modèle sont comptés selon les mêmes règles que le fil (la sortie d'outils, les balises qui encadrent les commandes et les notifications ne sont pas vos messages) ; les doublons après `--resume` sont fusionnés ; les journaux de requêtes API sont ignorés (CLI 2.1.300+). Totaux de jetons de la transcription : `jetons ↑entrée ↓sortie`, chaque message API compté une seule fois (l'entrée inclut les lectures et écritures du cache ; les sous-agents ont leurs propres transcriptions). Les lignes illisibles sont comptées. `? N nouveaux types d'enregistrement` signale les types d'enregistrement et de blocs de contenu que cette version ne connaît pas encore : la liste s'affiche au survol, et ces enregistrements restent visibles en JSON.
- **Commande de reprise** — `📋 claude --resume`, à côté de la ligne de statistiques, copie `cd '<project dir>' && claude --resume <session id>`, prête à coller. Absente pour une transcription de sous-agent, ainsi que lorsque le chemin ou l'identifiant contient des caractères qu'un shell pourrait mal interpréter.
- **Diffs** — le résultat d'un `Edit` ou `Write` affiche la modification sous forme de diff coloré, tiré du correctif (patch) que Claude Code stocke avec le résultat, avec `+N −M` dans son en-tête.
- **Cartes de tâches** — `TaskCreate` / `TaskUpdate` se lisent comme `#7 → completed · sujet` ; le sujet est repris de la création de la tâche, où qu'elle se trouve dans le fichier.
- **Noms d'outils conviviaux** — les outils connus reçoivent des icônes (par ex. `📖 Read file`, `🖥️ Shell`, `📝 Edit file`). Outils inconnus / MCP → `🔧 {raw_name}`.
- **Thème automatique** — la visionneuse suit le `prefers-color-scheme` du système par défaut. Cliquez sur le bouton soleil/lune pour épingler un choix ; le choix épinglé persiste entre les sessions.
- **Six langues d'interface** — English, Русский, Español, Français, 中文, العربية. L'arabe bascule en RTL. Sélecteur dans l'en-tête, préférence sauvegardée. Changer de langue conserve votre position : les enregistrements déjà chargés, les blocs ouverts, l'entrée en haut de l'écran.

### Performance et sécurité

- **Analyse en streaming** — `.jsonl` est lu via `file.stream()` + `TextDecoderStream`, pas chargé comme une seule chaîne.
- **Virtualisation native** — `content-visibility: auto` sur chaque enregistrement : le navigateur ignore layout et paint pour les entrées hors écran. Tient la charge sur des milliers d'enregistrements.
- **Rendu par lots** — 500 enregistrements par lot, bouton « Afficher plus » pour le reste.
- **Filtres** — six cases à cocher (thinking / tools / results / system / hooks / ui-state), activent/désactivent les catégories via une seule classe CSS sur le conteneur (sans nouveau rendu).
- **Rendu sûr contre XSS** — chaque bloc de texte est échappé _avant_ le parseur markdown. Aucun HTML brut issu de la transcription n'atteint jamais le DOM, de sorte qu'aucun assainissement du DOM (sanitizer) n'est nécessaire à l'exécution. Les images Markdown sont neutralisées (texte inerte, jamais récupérées). Les liens sont limités à `http(s)` avec `rel="noopener noreferrer nofollow"`.
- **Plafonds de taille** — blocs de prose tronqués à 20 000 caractères, blocs de service à 5 000. Le bouton `📋` copie ce qui est affiché, dans ces limites, si bien qu'un clic n'envoie jamais de mégaoctets de texte ; le texte complet n'est accessible qu'à la demande, via `⤢`.
- **⤢ Ouvrir en entier** — une entrée tronquée à l'affichage a un bouton `⤢` : le texte complet s'ouvre dans un panneau au-dessus du fil (texte / markdown / JSON brut de l'enregistrement), avec « Tout copier » et « Enregistrer le fichier ». La hauteur du fil ne change pas.
- **Fallback pour `.json`** — si le fichier n'est pas du JSONL mais un tableau/objet JSON simple, il est parsé comme une liste d'enregistrements.

## Prérequis navigateur

- Chrome / Edge 85+
- Firefox 105+
- Safari 15.4+

`content-visibility: auto` (Firefox 125+, Safari 18+) ne fait qu'accélérer le défilement des gros fichiers ; sans lui, tout fonctionne, simplement plus lentement.

## Dépendances

Une seule, vendorée en local dans `lib/` :

- [marked](https://github.com/markedjs/marked) — markdown → HTML (~35 Ko)

Pas de CDN, pas de réseau, pas de Subresource Integrity. Clonez et lancez.

## Ce qu'une transcription contient de personnel

Une transcription renferme bien plus que la conversation. Avant de partager un fichier `.jsonl` — ou une capture de la visionneuse —, sachez ce qu'il contient :

- chaque message, bloc de thinking et sortie d'outil, y compris le contenu des fichiers et la sortie des commandes, qui peuvent contenir des clés, des tokens ou des mots de passe ;
- des chemins absolus, votre nom d'utilisateur, le répertoire de travail et la branche git, répétés dans chaque enregistrement ;
- l'adresse e-mail de votre compte, le prompt système complet et le texte de vos fichiers `CLAUDE.md` — ces enregistrements sont masqués par défaut (filtres system / ui-state), leur résumé d'une ligne n'affiche que des décomptes, et en ouvrir un montre son contenu ;
- des images : captures d'écran et pages de fichiers PDF lus pendant la session ;
- les journaux complets des requêtes API (lignes `api-request*`, CLI 2.1.300+ ; jusqu'à la moitié du fichier) — la visionneuse les ignore, mais ils sont dans le fichier.

Les sorties trop volumineuses ne sont pas dans la transcription : Claude Code les garde dans `<session>/tool-results/` à côté du fichier, et la visionneuse n'en montre qu'un aperçu d'environ 2 Ko avec le chemin.

## Vie privée

Tout fonctionne localement dans votre navigateur. La visionneuse elle-même **n'effectue aucune requête réseau automatique** — pas de CDN, pas d'analytics, pas de polices distantes. Les images Markdown incorporées dans les transcriptions sont neutralisées : affichées comme texte inerte avec l'URL visible, mais jamais récupérées. Les liens externes (uniquement `http(s)`) ne s'ouvrent dans un nouvel onglet que lorsque vous cliquez dessus, avec `rel="noopener noreferrer nofollow"`. Vos transcriptions restent sur votre machine. Les images stockées dans la transcription (base64) sont affichées à partir du fichier lui-même, toujours sans aucune requête réseau.

## Limitations connues

- Le fichier est lu en streaming, mais tous ses enregistrements restent en mémoire. Mesuré sous Chromium : 200 Mo (30 000 enregistrements) s'ouvrent en ~3 s et occupent ~170 Mo de mémoire ; les journaux de requêtes API, ignorés à la lecture, ne comptent pas. Les fichiers de plusieurs Go nécessitent un chargement indexé (non implémenté).
- Pas d'export d'une session entière (l'objectif est la visualisation, pas la conversion) ; une entrée isolée peut être enregistrée via `⤢` → « Enregistrer le fichier ».
- Pas de coloration syntaxique dans les blocs de code (choix assumé pour garder les dépendances minimales).
- Un message modifié puis renvoyé apparaît deux fois : les branches de la conversation ne sont pas encore dessinées en arbre.
- Les badges des enregistrements de service affichent le nom brut du type (par ex. `hook_success`), non traduit : ainsi, les nouveaux types n'ont besoin d'aucune traduction.

## Développement

Tout le code tient dans un seul fichier HTML. Modifiez-le directement — styles dans `<style>`, logique dans `<script>`, traductions dans l'objet `I18N` en tête du script.

Vérifier la syntaxe et lancer les tests sans navigateur (rien à installer) :

```bash
node scripts/check-syntax.mjs  # syntax of the inline script
node --test test/*.test.mjs    # unit tests
```

Les parties sans DOM — le tri des enregistrements et les tables de règles qui décident comment afficher chaque type d'enregistrement — se trouvent dans les sections `triage` et `rules` du script, chacune entre `// ===== <name> =====` et `// ===== end <name> =====` ; les tests les extraient de `index.html` et les exécutent sous Node. Prendre en charge un nouveau type d'enregistrement se résume en général à une entrée dans une table de règles.

## Licence

[Unlicense](LICENSE) — domaine public. Utilisez-la comme bon vous semble, aucune attribution requise.
