export const pdfPreviewPlugin = () => ({
  id: 'pdf-preview',
  label: 'PDF Preview',
  priority: 25,

  match: (context) => {
    return context.extension === 'pdf';
  },

  component: () => import('./PdfPreview.vue'),

  actions: (context) => [
    {
      id: 'download',
      label: 'Download',
      run: () => context.api.download(),
    },
  ],
});
