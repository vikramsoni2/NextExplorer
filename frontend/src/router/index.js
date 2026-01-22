import { createRouter, createWebHistory } from 'vue-router';
import FolderView from '@/views/FolderView.vue';
import HomeView from '@/views/HomeView.vue';
import EditorView from '@/views/EditorView.vue';
import BrowserLayout from '@/layouts/BrowserLayout.vue';
import EditorLayout from '@/layouts/EditorLayout.vue';
import SearchResultsView from '@/views/SearchResultsView.vue';
import SettingsView from '@/views/settings/SettingsView.vue';
import SettingsBranding from '@/views/settings/SettingsBranding.vue';
import SettingsFilesThumbnails from '@/views/settings/SettingsFilesThumbnails.vue';
import SettingsAccessControl from '@/views/settings/SettingsAccessControl.vue';
import SettingsComingSoon from '@/views/settings/SettingsComingSoon.vue';
import AdminUsers from '@/views/settings/AdminUsers.vue';
import SettingsPassword from '@/views/settings/SettingsPassword.vue';
import SettingsAbout from '@/views/settings/SettingsAbout.vue';
import AboutView from '@/views/AboutView.vue';
import AuthSetupView from '@/views/AuthSetupView.vue';
import AuthLoginView from '@/views/AuthLoginView.vue';
import ShareLoginView from '@/views/ShareLoginView.vue';
import SharedWithMeView from '@/views/SharedWithMeView.vue';
import SharedByMeView from '@/views/SharedByMeView.vue';
import { useAuthStore } from '@/stores/auth';
import { useFeaturesStore } from '@/stores/features';
import { getVolumes } from '@/api';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/browse/',
    },
    {
      path: '/settings',
      component: BrowserLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          component: SettingsView,
           children: [
             { path: '', redirect: '/settings/about' },
             {
               path: 'branding',
               component: SettingsBranding,
               meta: { requiresAdmin: true },
             },
             {
               path: 'files-thumbnails',
               component: SettingsFilesThumbnails,
               meta: { requiresAdmin: true },
             },
            { path: 'account-password', component: SettingsPassword },
            {
              path: 'access-control',
              component: SettingsAccessControl,
              meta: { requiresAdmin: true },
            },
            // Admin-only placeholder routes
            {
              path: 'admin-overview',
              component: SettingsComingSoon,
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin-users',
              component: AdminUsers,
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin-mounts',
              component: SettingsComingSoon,
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin-audit',
              component: SettingsComingSoon,
              meta: { requiresAdmin: true },
            },
            // Scaffolded routes
            { path: 'general', component: SettingsComingSoon },
            { path: 'appearance', component: SettingsComingSoon },
            { path: 'uploads-downloads', component: SettingsComingSoon },
            { path: 'performance', component: SettingsComingSoon },
            { path: 'logging', component: SettingsComingSoon },
            { path: 'integrations', component: SettingsComingSoon },
            { path: 'advanced', component: SettingsComingSoon },
            { path: 'about', component: SettingsAbout },
          ],
        },
      ],
    },
    {
      path: '/browse',
      component: BrowserLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'HomeView',
          component: HomeView,
        },
        {
          path: ':path(.+)',
          name: 'FolderView',
          component: FolderView,
          meta: { allowGuest: true }, // Allow guest access for share paths
        },
      ],
    },
    {
      path: '/shares',
      component: BrowserLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: 'shared-with-me',
          name: 'SharedWithMe',
          component: SharedWithMeView,
        },
        {
          path: 'shared-by-me',
          name: 'SharedByMe',
          component: SharedByMeView,
        },
      ],
    },
    {
      path: '/search',
      component: BrowserLayout,
      meta: { requiresAuth: true },
      children: [{ path: '', component: SearchResultsView }],
    },
    {
      path: '/editor',
      component: EditorLayout,
      meta: { requiresAuth: true, allowGuest: true },
      children: [
        {
          path: ':path(.*)',
          component: EditorView,
        },
      ],
    },
    {
      path: '/about',
      component: AboutView,
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
    {
      path: '/share/:token',
      name: 'ShareLogin',
      component: ShareLoginView,
      meta: { public: true }, // Public route, doesn't require auth
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // Allow public routes (like share links) without auth
  const isPublicRoute = Boolean(to.meta?.public);
  if (isPublicRoute) {
    return true;
  }

  // Allow guest access for share paths (check if path starts with share/)
  const isGuestRoute = Boolean(to.meta?.allowGuest);
  const pathParam = typeof to.params?.path === 'string' ? to.params.path : '';
  const isSharePath = pathParam.startsWith('share/');

  if (isGuestRoute && isSharePath) {
    // Check for guest session OR authenticated user
    const guestSessionId = sessionStorage.getItem('guestSessionId');

    // Initialize auth if needed to check authentication status
    if (!auth.hasStatus && !auth.isLoading) {
      await auth.initialize();
    } else if (auth.isLoading) {
      await auth.initialize();
    }

    // Allow if user is authenticated OR has guest session
    if (auth.isAuthenticated || guestSessionId) {
      return true;
    }

    // No guest session and not authenticated - redirect to share login
    const shareToken = pathParam.split('/')[1];
    if (shareToken) {
      return { name: 'ShareLogin', params: { token: shareToken } };
    }
  }

  // Initialize auth store
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

  // Optional UX: when configured, skip the home dashboard and
  // jump straight into the only available volume (single-volume setups).
  if (to.name === 'HomeView') {
    const featuresStore = useFeaturesStore();
    try {
      await featuresStore.ensureLoaded();
    } catch (_) {
      // Ignore feature loading errors; fall back to normal home view.
    }

    if (featuresStore.skipHome) {
      try {
        const volumes = await getVolumes();
        if (Array.isArray(volumes)) {
          const first = volumes[0];
          if (first && first.path) {
            return { name: 'FolderView', params: { path: first.path } };
          }
        }
      } catch (_) {
        // Ignore volume loading errors; fall through to home view.
      }
    }
  }

  // Enforce admin-only routes if flagged
  const requiresAdmin = Boolean(to.meta && to.meta.requiresAdmin);
  if (requiresAdmin) {
    const isAdmin =
      Array.isArray(auth.currentUser?.roles) && auth.currentUser.roles.includes('admin');
    if (!isAdmin) {
      // send to a non-admin settings landing
      return { path: '/settings/about' };
    }
  }

  return true;
});

export default router;
