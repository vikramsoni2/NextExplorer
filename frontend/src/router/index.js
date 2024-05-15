import { createRouter, createWebHistory } from 'vue-router'
import FolderView from '@/views/FolderView.vue'
import EditorView from '@/views/EditorView.vue'
import BrowserLayput from '@/layouts/BrowserLayput.vue'
import EditorLayout from '@/layouts/EditorLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/browse'
    },
    {
      path: '/browse',
      component: BrowserLayput,
      children: [
        {
          path: ":path(.*)",
          component: FolderView,
        },
      ],

    },
    {
      path: '/editor',
      component: EditorLayout,
      children: [
        {
          path: ":path(.*)",
          component: EditorView,
        },
      ],

    },
  ]
})

export default router
