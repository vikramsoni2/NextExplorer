export const markdownPreviewPlugin = () => ({
  id: 'markdown-preview',
  label: 'Markdown Preview',
  priority: 30,
  
  match: (context) => {
    return ['md', 'markdown'].includes(context.extension);
  },
  
  component: () => import('./MarkdownPreview.vue'),
  
  actions: (context) => [
    {
      id: 'edit',
      label: 'Open in Editor',
      run: () => context.api.openEditor(),
    },
    {
      id: 'download',
      label: 'Download',
      run: () => context.api.download(),
    },
  ],
});