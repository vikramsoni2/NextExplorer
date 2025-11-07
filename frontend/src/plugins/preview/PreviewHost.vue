<template>
  <teleport to="body">
    <component
      v-if="isStandalone && resolvedComponent && context"
      :is="resolvedComponent"
      :context="context"
      :item="context.item"
      :api="context.api"
      :preview-url="context.previewUrl"
    />
    <transition v-else name="preview-fade">
      <div
        v-if="isOpen && context"
        class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70"
        @click.self="handleClose"
      >
        <div class="relative flex h-screen w-screen flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-zinc-900">
          <header
            v-if="!isMinimal"
            class="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2 shadow-sm dark:border-neutral-700 dark:bg-zinc-800"
          >
            <div class="min-w-0">
              <p class="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{{ plugin?.label || 'Preview' }}</p>
              <h2 class="truncate text-base font-semibold text-neutral-900 dark:text-white">{{ context.item?.name || '—' }}</h2>
            </div>
            <div class="ml-auto flex items-center gap-2">
              <button
                v-for="action in availableActions"
                :key="action.id"
                type="button"
                class="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium transition"
                :class="action.variant === 'primary'
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

          <main class="flex-1 overflow-hidden bg-neutral-50 dark:bg-zinc-950/40">
            <!-- Minimal floating close button -->
            <button
              v-if="isMinimal"
              type="button"
              class="absolute right-12 top-0 z-[2100] rounded-md bg-black/50 p-1 text-white shadow transition hover:bg-black/70"
              @click="handleClose"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
            <component
              :is="resolvedComponent"
              v-if="resolvedComponent"
              :context="context"
              :item="context.item"
              :api="context.api"
              :preview-url="context.previewUrl"
              class="h-full"
            />
            <div v-else class="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
              Loading preview…
            </div>
          </main>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { XMarkIcon, ArrowDownTrayIcon, PencilSquareIcon, ArrowTopRightOnSquareIcon } from '@heroicons/vue/24/outline';
import { usePreviewManager } from '@/plugins/preview/manager';

const manager = usePreviewManager();

const isOpen = computed(() => manager.isOpen);
const context = computed(() => manager.currentContext);
const plugin = computed(() => manager.currentPlugin);
const isStandalone = computed(() => Boolean(plugin.value?.standalone));
const isMinimal = computed(() => Boolean(plugin.value?.minimalHeader));
const availableActions = computed(() => {
  if (!plugin.value || !context.value || isStandalone.value) return [];
  if (isMinimal.value) return [];
  const actions = plugin.value.actions?.(context.value);
  return Array.isArray(actions) ? actions : [];
});

const resolvedComponent = shallowRef(null);

const loadComponent = async (nextPlugin) => {
  resolvedComponent.value = null;
  if (!nextPlugin) return;
  try {
    const componentFactory = nextPlugin.component;
    const result = typeof componentFactory === 'function' ? await componentFactory() : componentFactory;
    if (!result) return;
    resolvedComponent.value = result.default || result;
  } catch (error) {
    console.error(`Failed to load preview component for ${nextPlugin.id}`, error);
  }
};

watch(plugin, (nextPlugin) => {
  loadComponent(nextPlugin);
}, { immediate: true });

const handleClose = () => {
  if (isStandalone.value) {
    return;
  }
  manager.close();
};

const runAction = (action) => {
  if (!action || !context.value) return;
  try {
    action.run?.(context.value);
  } catch (error) {
    console.error(`Preview action failed: ${action.id}`, error);
  }
};

// Map common action IDs to icons for a more expressive toolbar
const getActionIcon = (id) => {
  switch (id) {
    case 'download':
      return ArrowDownTrayIcon;
    case 'edit':
    case 'open-editor':
      return PencilSquareIcon;
    case 'open':
      return ArrowTopRightOnSquareIcon;
    default:
      return null;
  }
};

const handleKeydown = (event) => {
  if (event.key === 'Escape' && manager.isOpen) {
    event.preventDefault();
    handleClose();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
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
