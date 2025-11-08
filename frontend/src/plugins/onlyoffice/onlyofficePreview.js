const DEFAULT_EXTS = [
  'docx', 'doc', 'odt', 'rtf', 'txt',
  'xlsx', 'xls', 'ods', 'csv',
  'pptx', 'ppt', 'odp',
];

export const onlyofficePreviewPlugin = (extensions) => ({
  id: 'onlyoffice-editor',
  label: 'ONLYOFFICE',
  priority: 50,
  // Render with minimal chrome in the overlay host
  minimalHeader: true,
  match: (ctx) => {
    const ext = String(ctx.extension || '').toLowerCase();
    const list = Array.isArray(extensions) && extensions.length > 0 ? extensions : DEFAULT_EXTS;
    return list.includes(ext);
  },
  component: () => import('./OnlyOfficePreview.vue'),
  actions: (ctx) => [
    {
      id: 'download',
      label: 'Download',
      run: () => ctx.api.download(ctx.filePath),
    },
  ],
});
