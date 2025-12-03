const DEFAULT_EXTS = [
  'docx', 'doc', 'odt', 'rtf',
  'xlsx', 'xls', 'ods', 'csv',
  'pptx', 'ppt', 'odp'
];

export const onlyofficePreviewPlugin = (extensions) => ({
  id: 'onlyoffice-editor',
  label: 'ONLYOFFICE',
  priority: 50,
  // Render with minimal chrome in the overlay host
  minimalHeader: true,

  match: (context) => {
    const ext = String(context.extension || '').toLowerCase();
    const list = Array.isArray(extensions) && extensions.length > 0 ? extensions : DEFAULT_EXTS;
    
    //console.log('ONLYOFFICE checking extension:', ext, list);
    return list.includes(ext);
  },

  component: () => import('./OnlyOfficePreview.vue'),

  actions: (context) => [
    {
      id: 'download',
      label: 'Download',
      run: () => context.api.download(),
    },
  ],
});





