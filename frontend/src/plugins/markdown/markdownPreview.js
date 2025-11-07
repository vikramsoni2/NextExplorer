const EXTENSIONS = new Set(['md', 'markdown']);

export const markdownPreviewPlugin = () => ({
  id: 'markdown-preview',
  label: 'Markdown Preview',
  priority: 30,
  match: (ctx) => {
    if (!ctx) return false;
    return EXTENSIONS.has(ctx.extension);
  },
  component: () => import('./MarkdownPreview.vue'),
  actions: (ctx) => {
    const path = ctx.filePath;
    return [
      {
        id: 'edit',
        label: 'Open in Editor',
        run: () => {
          if (path) {
            ctx.api.openEditor(path);
          }
        },
      },
      {
        id: 'download',
        label: 'Download',
        run: () => {
          if (path) {
            ctx.api.download(path);
          }
        },
      },
    ];
  },
});
