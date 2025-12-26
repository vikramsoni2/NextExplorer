<template>
  <teleport to="body">
    <!-- Standalone plugins render directly -->
    <div v-if="isStandalone">
      <component v-if="component" :is="component" v-bind="activeItem" />
      <!-- Lightweight fallback while standalone plugin component loads -->
      <div
        v-else
        class="fixed inset-0 z-2000 flex items-center justify-center text-sm text-neutral-200"
      >
        <div
          class="flex items-center pr-4 bg-neutral-300 dark:bg-black bg-opacity-20 rounded-lg"
        >
          <LoadingIcon /> {{ $t('common.loading') }}
        </div>
      </div>
    </div>

    <!-- Regular plugins render in modal -->
    <transition v-else name="preview-fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-2000 flex items-center justify-center bg-black/70"
        @click.self="handleClose"
        @keydown.esc="handleClose"
      >
        <div
          class="relative flex h-screen w-screen flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-zinc-900"
        >
          <!-- Header (unless minimal) -->
          <header
            v-if="!isMinimal"
            class="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2 shadow-xs dark:border-neutral-700 dark:bg-zinc-800"
          >
            <div class="min-w-0">
              <p
                class="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
              >
                {{ activePlugin?.label || 'Preview' }}
              </p>
              <h2
                class="truncate text-base font-semibold text-neutral-900 dark:text-white"
              >
                {{ activeItem?.item?.name || '—' }}
              </h2>
            </div>

            <!-- Actions -->
            <div class="ml-auto flex items-center gap-2">
              <button
                v-for="action in actions"
                :key="action.id"
                type="button"
                class="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium transition"
                :class="
                  action.variant === 'primary'
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700'
                "
                @click="runAction(action)"
              >
                <component
                  v-if="getActionIcon(action.id)"
                  :is="getActionIcon(action.id)"
                  class="h-4 w-4"
                />
                <span>{{ action.label }}</span>
              </button>

              <button
                type="button"
                class="rounded-md p-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                @click="handleClose"
              >
                <XMarkIcon class="h-5 w-5" />
              </button>
            </div>
          </header>

          <!-- Content -->
          <main
            class="flex-1 overflow-hidden bg-neutral-50 dark:bg-zinc-950/40"
          >
            <!-- Minimal floating close button -->
            <button
              v-if="isMinimal"
              type="button"
              class="absolute right-12 top-0 z-2100 rounded-md bg-black/50 p-1 text-white shadow-sm transition hover:bg-black/70"
              @click="handleClose"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>

            <component
              v-if="component"
              :is="component"
              v-bind="activeItem"
              class="h-full"
            />
            <div
              v-else
              class="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400"
            >
              Loading preview…
            </div>
          </main>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed, shallowRef, watch } from 'vue';
import { storeToRefs } from 'pinia';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/vue/24/outline';
import { usePreviewManager } from '@/plugins/preview/manager';
import LoadingIcon from '@/icons/LoadingIcon.vue';

const manager = usePreviewManager();
const { isOpen, activeItem, activePlugin } = storeToRefs(manager);

// Derived state
const isStandalone = computed(() => activePlugin.value?.standalone ?? false);
const isMinimal = computed(() => activePlugin.value?.minimalHeader ?? false);

const actions = computed(() => {
  if (
    !activePlugin.value ||
    !activeItem.value ||
    isStandalone.value ||
    isMinimal.value
  ) {
    return [];
  }

  const pluginActions = activePlugin.value.actions?.(activeItem.value);
  return Array.isArray(pluginActions) ? pluginActions : [];
});

// Component loading
const component = shallowRef(null);

watch(
  activePlugin,
  async (plugin) => {
    component.value = null;
    if (!plugin) return;

    try {
      const factory = plugin.component;
      const result = typeof factory === 'function' ? await factory() : factory;
      component.value = result?.default || result;
    } catch (error) {
      console.error(`Failed to load plugin ${plugin.id}:`, error);
    }
  },
  { immediate: true },
);

// Handlers
const handleClose = () => {
  if (!isStandalone.value) {
    manager.close();
  }
};

const runAction = (action) => {
  if (!action?.run || !activeItem.value) return;

  try {
    action.run(activeItem.value);
  } catch (error) {
    console.error(`Action ${action.id} failed:`, error);
  }
};

// Action icons
const getActionIcon = (id) => {
  const icons = {
    download: ArrowDownTrayIcon,
    edit: PencilSquareIcon,
    'open-editor': PencilSquareIcon,
    open: ArrowTopRightOnSquareIcon,
  };
  return icons[id];
};
</script>

<style scoped>
.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.2s ease;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}
</style>
