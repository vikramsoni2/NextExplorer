# User Workflows

These are the day-to-day actions your team will take in nextExplorer. Every workflow assumes you’re authenticated and have access to the volumes you mounted under `/mnt`.

## Navigating volumes
1. Click a volume in the sidebar to list its contents in the main area.
2. Use breadcrumbs to back out of nested folders, or click the breadcrumb anchor to jump to any ancestor.
3. Switch between grid/list views with the toolbar toggles; list view shows sortable columns for Name, Size, Kind, and Date Modified.

## File & folder operations
- **Create a folder/file:** Use the `Create` menu, context menu (right-click background → New Folder/File), or press the `+` toolbar button.
- **Rename/move:** Right-click an item and choose Rename; to move, drag it to another folder or use the context menu Cut → Paste.
- **Delete:** The context menu’s Delete option (or toolbar action) prompts for confirmation and supports multi-select deletions.
- **Clipboard shortcuts:** ⌘/Ctrl+C/X/V work just like desktop file managers and respect Access Control rules (read-only folders can’t be written).

## Uploads & downloads
- **Drag-and-drop:** Drop files/folders onto the main pane to upload; the floating footer upload panel shows per-file and total progress.
- **Create menu upload:** Select Upload files/folders from the Create menu if you prefer a dialog.
- **Download:** Select one or more items and hit the Download button; multiple items or folders produce a ZIP archive.
- **Transfer control:** Pause, resume, or cancel uploads directly from the footer panel.

## Search
- Click the search icon in the toolbar, type a query, and press Enter.
- Search covers filenames and file contents thanks to ripgrep; disable deep search with `SEARCH_DEEP=false` if you want faster scans.
- Large files respect `SEARCH_MAX_FILESIZE`; if ripgrep isn’t available, the app falls back to a built-in indexer that still searches filenames.

## Previews & editing
- **Preview:** Click images/videos/PDFs to open them inside the app (previews are cached in `/cache`).
- **Editor:** Double-click text/code files to open the inline editor with syntax highlighting, line numbers, and Save/Cancel actions. The editor supports 50+ file types by default including common text formats (txt, md, log), data files (json, yaml, xml, csv), programming languages (js, ts, py, java, go, rust, etc.), config files (ini, env, properties), shell scripts (sh, bash, ps1), and web formats (html, css, scss, vue). Add support for custom file types (e.g., `.toml`, `.proto`, `.graphql`) at runtime using the `EDITOR_EXTENSIONS` environment variable—no rebuild needed, changes apply on container restart.
- **ONLYOFFICE:** When configured, office documents (DOCX, XLSX, PPTX, ODT, ODS, ODP) launch in the embedded ONLYOFFICE editor; nextExplorer signs requests with `ONLYOFFICE_SECRET` and calls `/api/onlyoffice/config`, `/api/onlyoffice/file`, and `/api/onlyoffice/callback` to orchestrate editing.

## Favorites & quick access
- Highlight a folder and click the star toolbar icon (or use the context menu) to pin it as a Favorite.
- Favorites appear above Volumes in the sidebar for instant navigation; you can customize icons to reflect project types.

## Access control & admin actions
- **Access Control rules:** Settings → Access Control defines per-folder policies (`rw`, `ro`, `hidden`). The first matched rule applies.
- **Hidden folders:** Use `hidden` to hide sensitive folders from listings; they remain accessible via direct paths if you know them.
- **Admin users:** Settings → Admin lets you add local users, reset passwords, and grant the admin role. Demoting an admin via UI is disabled to avoid lockouts.
- **Sign-out:** Use the user menu in the sidebar to log out or manage user-specific settings.
