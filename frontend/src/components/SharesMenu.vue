<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ChevronDownIcon, ShareIcon } from '@heroicons/vue/24/outline';

const { t } = useI18n();
const open = ref(true);
const route = useRoute();
const router = useRouter();

const isSharedWithMeActive = computed(() => route.name === 'SharedWithMe');
const isSharedByMeActive = computed(() => route.name === 'SharedByMe');

const handleOpenSharedWithMe = () => {
  router.push({ name: 'SharedWithMe' });
};

const handleOpenSharedByMe = () => {
  router.push({ name: 'SharedByMe' });
};
</script>

<template>
  <div>
    <h4
      class="group flex items-center justify-between py-2 pt-2 text-sm text-neutral-400 dark:text-neutral-500 font-medium"
    >
      {{ t('share.shares') }}
      <button
        @click="open = !open"
        class="hidden group-hover:block active:text-black dark:active:text-white text-neutral-500"
        type="button"
      >
        <ChevronDownIcon
          class="h-4 transition-transform duration-300 ease-in-out"
          :class="{ 'rotate-0': open, '-rotate-90': !open }"
        />
      </button>
    </h4>
    <div class="overflow-hidden">
      <transition
        enter-active-class="transition-all duration-500"
        leave-active-class="transition-all duration-500"
        enter-from-class="-mt-[100%]"
        enter-to-class="mt-0"
        leave-from-class="mt-0"
        leave-to-class="-mt-[100%]"
      >
        <div v-if="open" class="overflow-hidden">
          <div class="mb-3">
            <button
              type="button"
              @click="handleOpenSharedWithMe"
              class="cursor-pointer flex w-full items-center gap-3 rounded-lg text-sm truncate"
              :class="[
                isSharedWithMeActive
                  ? 'text-neutral-950 dark:text-white'
                  : 'text-neutral-950 dark:text-neutral-300/90'
              ]"
            >
              <ShareIcon class="h-5 shrink-0" />
              <span class="truncate">{{ t('share.sharedWithMe') }}</span>
            </button>
          </div>
          <div class="mb-3">
            <button
              type="button"
              @click="handleOpenSharedByMe"
              class="cursor-pointer flex w-full items-center gap-3 rounded-lg text-sm truncate"
              :class="[
                isSharedByMeActive
                  ? 'text-neutral-950 dark:text-white'
                  : 'text-neutral-950 dark:text-neutral-300/90'
              ]"
            >
              <ShareIcon class="h-5 shrink-0" />
              <span class="truncate">{{ t('share.sharedByMe') }}</span>
            </button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>
