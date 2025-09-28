# Plugin Architecture

This folder contains the modular preview system introduced for nextExplorer.  It enables the core app and third-parties to add new viewers without touching the browser or editor screens.

## Directory Map

- `preview/` – shared infrastructure (Pinia manager + host component + TypeScript-style typedefs).
- `core/` – built-in plugins shipped with the app (lightbox image preview, HTML5 video preview, etc.).
- `markdown/` – example markdown preview plugin using the same public API.
- `index.js` – installer that registers built-in plugins and optional extras during app bootstrap.

## Control Flow Overview

1. `useNavigation().openItem()` asks the preview manager to resolve a plugin before falling back to the editor.
2. `usePreviewManager` iterates through registered plugins (sorted by priority) and calls each `match(ctx)` with a computed context.
3. The first plugin that returns `true` receives control.  Its component is lazy-loaded and rendered by `PreviewHost.vue`.
4. Plugins can trigger editor navigation, downloads, or close the overlay through the limited API exposed on the context.

## Plugin Interface

The expected shape lives in `preview/types.js`.  Key fields:

```js
/** @typedef {Object} PreviewPlugin */
{
  id: string;             // unique key used for registration
  label: string;          // shown in the overlay header when rendered inside the host
  priority?: number;      // higher number wins when multiple plugins match
  standalone?: boolean;   // set true if the plugin renders its own modal/UX (e.g. lightbox)
  match(ctx): boolean;    // inspect ctx.extension / ctx.item to decide whether to activate
  component(): Component; // sync or async component loader
  actions?(ctx): Action[]; // optional toolbar buttons for non-standalone plugins
  onOpen?(ctx): void;     // optional hook invoked after selection but before render
  onClose?(ctx): void;    // optional hook invoked when preview closes
}
```

### Preview Context

`usePreviewManager` builds a context per item:

- `item` – shallow copy of the file entry (name, path, kind, etc.).
- `extension` – normalized lowercase extension resolved from `item.kind` or filename.
- `filePath` – normalized relative path for API calls.
- `previewUrl` – signed `/api/preview` URL (useful for streaming images/videos).
- `api` – limited surface exposed to plugins:
  - `getPreviewUrl(path)`
  - `fetchFileContent(path)`
  - `openEditor(path)`
  - `closePreview()`
  - `download(path)`

### Actions

Plugins rendered inside `PreviewHost` can provide toolbar actions via `actions(ctx)`.  Each action includes an `id`, `label`, optional `variant` (`"primary"` | `"default"`), and a `run(ctx)` handler.

Set `standalone: true` to suppress the default overlay and render the component directly (used by the lightbox image preview).  Standalone plugins should call `ctx.api.closePreview()` when they are done.

## Built-in Plugins

- `core/imagePreview` – wraps `vue-easy-lightbox` for common image formats.
- `core/videoPreview` – HTML5 video player with download action.
- `pdf/pdfPreview` – iframe-based PDF renderer with a download control.
- `markdown/markdownPreview` – renders Markdown using `marked` + `DOMPurify`, exposes “Open in Editor” + “Download”.

Registering happens in `installPreviewPlugins(pinia, additional)` inside `src/main.js`.

## Creating a Plugin

1. **Create a directory** under `src/plugins/` (e.g. `src/plugins/pdf`).
2. **Add a Vue component** that accepts the props `context`, `api`, and optional `previewUrl`.
3. **Export a factory** returning the plugin object:

```js
// src/plugins/pdf/pdfPreview.js
export const pdfPreviewPlugin = () => ({
  id: 'pdf-preview',
  label: 'PDF Preview',
  priority: 25,
  match: (ctx) => ctx.extension === 'pdf',
  component: () => import('./PdfPreview.vue'),
  actions: (ctx) => [{
    id: 'download',
    label: 'Download',
    run: () => ctx.api.download(ctx.filePath),
  }],
});
```

4. **Register the plugin**:
   - For built-ins, add the factory to `installPreviewPlugins`.
   - For external packages, export an `install(app, { registerPreview })` or call `installPreviewPlugins(pinia, [pdfPreviewPlugin()])` from an entry point.

5. **Handle cleanup** (detach listeners, stop media playback) in the component’s lifecycle hooks.

## Debugging Tips

- Use `usePreviewManager().getPlugins()` in a dev console to inspect registration order.
- The manager logs to `console.error` when a plugin throws inside `match`, `onOpen`, or `onClose` to aid troubleshooting without breaking the preview flow.
- When working on standalone overlays, make sure `standalone: true` is set and the component calls `ctx.api.closePreview()` so the manager state resets.

## Extension Ideas

- Register multiple plugins for the same extension with different priorities (e.g. RAW preview > generic image plugin).
- Implement editor-style plugins (e.g. WYSIWYG Markdown editor) by combining preview + action buttons that call `openEditor` with a route to a custom view.
- Persist preview state in route query parameters to support deep linking — the manager API already exposes `filePath` to make this straightforward.

Add to this document whenever you introduce new plugin categories or lifecycle hooks so contributors can stay aligned.
