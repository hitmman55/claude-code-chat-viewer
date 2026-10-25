<p align="center">
  <a href="https://hitmman55.github.io/claude-code-chat-viewer/">
    <img src="https://img.shields.io/badge/▶-PRUÉBALO%20ONLINE-2ea043?style=for-the-badge" alt="Pruébalo online" />
  </a>
</p>
<p align="center"><i>Solo haz clic — sin instalación, sin compilación, sin registro.</i></p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <b>Español</b> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.zh-CN.md">中文</a> ·
  <a href="README.ar.md">العربية</a>
</p>

# Claude Code Chat Viewer

Lee el historial de tus conversaciones con Claude Code en el navegador. Claude Code guarda cada sesión como un archivo JSONL en `~/.claude/projects/`; ábrelo aquí y se convierte en una lista legible —tus mensajes, las respuestas de Claude, el razonamiento (thinking), las llamadas a herramientas y sus resultados, los informes de los subagentes— con filtros y un modo lectura. Un solo archivo HTML, sin servidor, sin instalación, funciona sin conexión; nada sale de tu equipo. Compatible con el formato de transcripción hasta Claude Code 2.1.310.

<p align="center">
  <img src="https://img.shields.io/badge/license-Unlicense-blue" alt="Licencia: Unlicense" />
  <img src="https://img.shields.io/badge/runtime%20deps-0-brightgreen" alt="Cero dependencias en runtime" />
  <img src="https://img.shields.io/badge/offline-first-success" alt="Funciona offline" />
  <img src="https://img.shields.io/badge/i18n-6%20languages-informational" alt="6 idiomas de interfaz" />
</p>

<p align="center">
  <img src="screenshot.png" alt="Captura de pantalla" width="900" />
</p>

## Por qué

Claude Code guarda cada sesión en `~/.claude/projects/<project>/<session-uuid>.jsonl` — una línea por registro (mensaje del usuario, respuesta del modelo, thinking, tool_use, tool_result, attachment, etc.). El archivo sin procesar es ilegible; comandos integrados como `/resume` y `/export` reabren una conversación o la vuelcan tal cual, pero no permiten examinar una transcripción antigua con sus llamadas a herramientas y sus registros de servicio.

Este visor convierte ese `.jsonl` en un feed legible con colores por rol, bloques de servicio plegables (thinking / tools / results) y filtros.

## Qué muestra

- **user** (azul) — mensajes reales del usuario
- **assistant** (verde) — respuestas de texto de Claude
- **thinking** (morado) — razonamiento extendido, plegado por defecto
- **tool_use** (ámbar) — llamadas a herramientas con vista previa de argumentos
- **tool_result** (cian / rojo para errores) — respuestas de herramientas
- **meta / task-note** (amarillo) — inyecciones del sistema y `<task-notification>` de subagentes
- **pregunta → respuesta** — una llamada a `AskUserQuestion` y la respuesta de la persona en una sola tarjeta
- **informe del subagente** (`↩ report`) — el informe final de un subagente, con el nombre de su tarea; cuando termina un subagente en segundo plano se ven tokens · tiempo · llamadas a herramientas
- **hooks** — ejecuciones y errores de hooks (filtro propio, desactivado por defecto)
- **compactación** — un separador que indica cuántos tokens se liberaron; el resumen de la compactación aparece plegado
- **imágenes** — capturas y páginas de PDF guardadas en la transcripción; se muestran al desplegar su bloque
- **system / attachment / ui-state** — registros de servicio (ocultos por defecto); los valores que la CLI reescribe en cada turno (título de la sesión, modo de permisos) solo se muestran cuando cambian

Cada bloque es una fila independiente con una barra coloreada a la izquierda. Sin burbujas de mensajería: esto es un log, no un chat.

## Cómo abrirlo

Elige el método que prefieras:

**A. Descargar un solo archivo** — lo más fácil. Toma el HTML autónomo del [último release](https://github.com/hitmman55/claude-code-chat-viewer/releases/latest) y haz doble clic. Un archivo, funciona offline para siempre.

**B. Clonar el repo** — si quieres modificarlo. Necesitas `index.html` y la carpeta `lib/`.

**C. Usarlo en línea** — abre <https://hitmman55.github.io/claude-code-chat-viewer/>. Nada que descargar.

Una vez abierto, pulsa el selector de archivo (o arrastra uno, o usa el botón «Probar con ejemplo») y elige una transcripción `.jsonl`.

Las transcripciones de Claude Code están en:

```
~/.claude/projects/<project-slug>/<session-uuid>.jsonl
```

donde `<project-slug>` es tu directorio de trabajo con cada carácter que no sea una letra o un dígito reemplazado por `-`. Ejemplo: `/home/user/my_proj` → `-home-user-my-proj`.

## Características

### Cómo cargar un archivo

- **Selector de archivo** — pulsa «Elegir archivo» y selecciona un `.jsonl`.
- **Arrastrar y soltar** — suelta un archivo en cualquier parte de la página. Un borde punteado indica la zona. Las carpetas y arrastres que no sean archivos se rechazan con un mensaje.
- **Probar con ejemplo** — en el estado inicial (al usar en línea) aparece un botón que carga un `demo.jsonl` incorporado con los principales tipos de bloque.

### Comodidad de lectura

- **Modo lectura** — botón en la cabecera que deja solo lo que dijeron las personas y Claude: tus mensajes (incluido `/compact` con sus argumentos), las respuestas de texto de Claude, las tarjetas pregunta → respuesta, los informes de los subagentes y los separadores de compactación. Sin thinking, sin llamadas a herramientas, sin registros de servicio. Ideal para leer por encima o compartir una vista limpia.
- **Copiar por mensaje** — botón `📋` en la cabecera de cada entrada. Copia el texto al portapapeles con confirmación `✓` durante 1.2 s. Usa `navigator.clipboard.writeText` con fallback a `document.execCommand` para contextos `file://`.
- **Estadísticas honestas** — los mensajes de la persona y las respuestas del modelo se cuentan con las mismas reglas que la lista (la salida de herramientas, las etiquetas que envuelven los comandos y las notificaciones no son mensajes tuyos); los duplicados tras `--resume` se fusionan; el historial de peticiones a la API se omite (CLI 2.1.300+). `? N tipos de registro nuevos` señala tipos que esta versión aún no conoce: la lista aparece al pasar el ratón, y esos registros se muestran igualmente, en JSON.
- **Nombres amigables para herramientas** — las herramientas conocidas reciben iconos (p. ej. `📖 Read file`, `🖥️ Shell`, `📝 Edit file`). Herramientas desconocidas / MCP → `🔧 {raw_name}`.
- **Tema automático** — el visor sigue el `prefers-color-scheme` del sistema por defecto. Pulsa el botón sol/luna para fijar una elección; la elección fijada persiste entre sesiones.
- **Seis idiomas de interfaz** — English, Русский, Español, Français, 中文, العربية. El árabe cambia a RTL. Selector en la cabecera, preferencia guardada.

### Rendimiento y seguridad

- **Parseo en streaming** — `.jsonl` se lee vía `file.stream()` + `TextDecoderStream`, no se carga como una sola cadena.
- **Virtualización nativa** — `content-visibility: auto` en cada registro: el navegador omite layout y paint para entradas fuera de pantalla. Escala a miles de registros.
- **Renderizado por lotes** — 500 registros por lote, botón «Mostrar más» para el resto.
- **Filtros** — seis casillas (thinking / tools / results / system / hooks / ui-state), alternan categorías vía una sola clase CSS en el contenedor (sin volver a renderizar nada).
- **Renderizado seguro frente a XSS** — cada bloque de texto se escapa _antes_ de pasar por el parser de markdown. Ningún HTML en bruto de la transcripción llega nunca al DOM, así que no hace falta un sanitizador de DOM en tiempo de ejecución. Las imágenes Markdown se neutralizan (texto inerte, nunca se descargan). Los enlaces se limitan a `http(s)` con `rel="noopener noreferrer nofollow"`.
- **Límites de tamaño** — bloques de prosa truncados a 20 000 caracteres, bloques de servicio a 5 000. El botón `📋` copia lo que se muestra, dentro de estos límites, así que un clic nunca envía megabytes de texto; el texto completo solo se obtiene cuando se pide, mediante `⤢`.
- **⤢ Abrir completo** — una entrada recortada para mostrarse tiene un botón `⤢`: el texto completo se abre en un panel sobre la lista (texto / markdown / JSON original del registro), con «Copiar todo» y «Guardar archivo». La altura de la lista no cambia.
- **Fallback para `.json`** — si el archivo no es JSONL sino un array/objeto JSON plano, se interpreta como lista de registros.

## Requisitos del navegador

- Chrome / Edge 85+
- Firefox 105+
- Safari 15.4+

`content-visibility: auto` (Firefox 125+, Safari 18+) solo acelera el desplazamiento en archivos grandes; sin él todo funciona, solo que más lento.

## Dependencias

Una sola, empaquetada localmente en `lib/`:

- [marked](https://github.com/markedjs/marked) — markdown → HTML (~35 KB)

Sin CDN, sin red, sin Subresource Integrity. Clona y ejecuta.

## Qué hay de personal en una transcripción

Una transcripción guarda mucho más que la conversación. Antes de compartir un archivo `.jsonl` —o una captura del visor—, ten en cuenta lo que contiene:

- todos los mensajes, bloques de thinking y salidas de herramientas, incluido el contenido de archivos y la salida de comandos, que pueden contener claves, tokens o contraseñas;
- rutas absolutas, tu nombre de usuario, el directorio de trabajo y la rama de git, repetidos en cada registro;
- el correo de tu cuenta, el prompt de sistema completo y el texto de tus archivos `CLAUDE.md`: estos registros están ocultos por defecto (filtros system / ui-state), su resumen de una línea solo muestra recuentos y, al abrir uno, se ve su contenido;
- imágenes: capturas y páginas de archivos PDF leídos durante la sesión;
- el historial completo de peticiones a la API (líneas `api-request*`, CLI 2.1.300+; hasta la mitad del archivo): el visor lo omite, pero está en el archivo.

Las salidas demasiado grandes no están en la transcripción: Claude Code las guarda en `<session>/tool-results/` junto al archivo, y el visor solo muestra una vista previa de ~2 KB y la ruta.

## Privacidad

Todo funciona localmente en tu navegador. El visor en sí **no realiza peticiones de red automáticas** — sin CDN, sin analítica, sin fuentes remotas. Las imágenes Markdown incrustadas en las transcripciones se neutralizan: se muestran como texto inerte con la URL visible, pero nunca se descargan. Los enlaces externos (sólo `http(s)`) se abren en una nueva pestaña sólo al hacer clic, con `rel="noopener noreferrer nofollow"`. Tus transcripciones se quedan en tu máquina. Las imágenes guardadas dentro de la transcripción (base64) se dibujan desde el propio archivo, también sin ninguna petición de red.

## Limitaciones conocidas

- Archivos mayores de ~100 MB necesitan carga indexada por line-offsets con renderizado por ventanas (no implementado).
- No se puede exportar una sesión completa (el objetivo es visualizar, no convertir); una sola entrada puede guardarse con `⤢` → «Guardar archivo».
- Sin resaltado de sintaxis en bloques de código (decisión consciente para minimizar dependencias).
- Un mensaje que editaste y volviste a enviar aparece dos veces: las ramas de la conversación aún no se dibujan como árbol.
- Las etiquetas de los registros de servicio muestran el nombre en bruto del tipo (p. ej. `hook_success`), sin traducir: así los tipos nuevos no necesitan traducción.

## Desarrollo

Todo el código vive en un único archivo HTML. Edítalo directamente — estilos en `<style>`, lógica en `<script>`, traducciones en el objeto `I18N` al principio del script.

Comprobar la sintaxis y ejecutar las pruebas sin navegador (no hay nada que instalar):

```bash
node scripts/check-syntax.mjs  # syntax of the inline script
node --test test/*.test.mjs    # unit tests
```

Las partes sin DOM —la clasificación de registros y las tablas de reglas que deciden cómo se muestra cada tipo de registro— están en las secciones `triage` y `rules` del script, cada una entre `// ===== <name> =====` y `// ===== end <name> =====`; las pruebas las extraen de `index.html` y las ejecutan en Node. Para dar soporte a un tipo de registro nuevo suele bastar con una entrada en una tabla de reglas.

## Licencia

[Unlicense](LICENSE) — dominio público. Úsalo como quieras, no se requiere atribución.
