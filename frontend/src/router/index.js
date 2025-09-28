import { createRouter, createWebHistory } from 'vue-router'
import FolderView from '@/views/FolderView.vue'
import EditorView from '@/views/EditorView.vue'
import BrowserLayput from '@/layouts/BrowserLayput.vue'
import EditorLayout from '@/layouts/EditorLayout.vue'
import AboutView from '@/views/AboutView.vue'
import AuthSetupView from '@/views/AuthSetupView.vue'
import AuthLoginView from '@/views/AuthLoginView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/browse/'
    },
    {
      path: '/browse',
      component: BrowserLayput,
      meta: { requiresAuth: true },
      children: [
        {
          path: "/",
          component: FolderView,
        },

        {
          path: ":path(.*)",
          component: FolderView,
        },
      ],

    },
    {
      path: '/editor',
      component: EditorLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: ":path(.*)",
          component: EditorView,
        },
      ],

    },
    {
      path: '/about',
      component: AboutView
    },
    {
      path: '/auth/setup',
      name: 'auth-setup',
      component: AuthSetupView,
      meta: { authScreen: true },
    },
    {
      path: '/auth/login',
      name: 'auth-login',
      component: AuthLoginView,
      meta: { authScreen: true },
    },
  ]
})

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.hasStatus && !auth.isLoading) {
    await auth.initialize();
  } else if (auth.isLoading) {
    await auth.initialize();
  }

  const isAuthRoute = Boolean(to.meta?.authScreen);
  const targetRedirect = (fallback) => {
    const candidate = typeof to.fullPath === 'string' ? to.fullPath : fallback;
    if (!candidate || candidate.startsWith('/auth/')) {
      return fallback;
    }
    return candidate;
  };

  if (auth.requiresSetup) {
    if (!isAuthRoute || to.name !== 'auth-setup') {
      const redirect = targetRedirect('/browse/');
      return {
        name: 'auth-setup',
        ...(redirect ? { query: { redirect } } : {}),
      };
    }
  } else if (!auth.isAuthenticated) {
    if (!isAuthRoute) {
      const redirect = targetRedirect('/browse/');
      return {
        name: 'auth-login',
        ...(redirect ? { query: { redirect } } : {}),
      };
    }
  }

  if (to.name === 'auth-setup' && !auth.requiresSetup) {
    const redirect = typeof to.query?.redirect === 'string' ? to.query.redirect : '/browse/';
    if (auth.isAuthenticated) {
      return { path: redirect };
    }
    return { name: 'auth-login', ...(redirect ? { query: { redirect } } : {}) };
  }

  if (to.name === 'auth-login' && auth.isAuthenticated) {
    const redirect = typeof to.query?.redirect === 'string' ? to.query.redirect : '/browse/';
    return { path: redirect };
  }

  return true;
});

export default router
