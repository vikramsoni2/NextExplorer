<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onClickOutside } from '@vueuse/core';
import { ChevronUpDownIcon } from '@heroicons/vue/24/outline';
import { supportedLocaleOptions } from '@/i18n';
import { EarthSharp } from '@vicons/ionicons5';

const { t, locale } = useI18n();

const languages = computed(() =>
  supportedLocaleOptions.map(({ code, labelKey }) => ({
    code,
    label: t(labelKey),
  })),
);

const currentLanguage = computed(() => {
  const list = languages.value;
  return (
    list.find((lang) => lang.code === locale.value) ||
    list[0] || { code: locale.value, label: locale.value.toUpperCase() }
  );
});

const languageMenuOpen = ref(false);
const languageSwitcherRef = ref(null);

const setLocale = (lang) => {
  try {
    localStorage.setItem('locale', lang);
  } catch (_) {}
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lang);
  }
  locale.value = lang;
};

onClickOutside(languageSwitcherRef, () => {
  languageMenuOpen.value = false;
});
</script>

<template>
  <div ref="languageSwitcherRef" class="relative inline-flex items-center">
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 hover:bg-white/10 focus:outline-hidden"
      :aria-label="t('i18n.language')"
      @click="languageMenuOpen = !languageMenuOpen"
    >
      <span class="flex items-center gap-2">
        <EarthSharp class="h-4" />
        <span class="hidden text-xs sm:inline">
          {{ currentLanguage.label }}
        </span>
      </span>
      <ChevronUpDownIcon class="h-4 w-4 text-white/60" />
    </button>

    <div
      v-if="languageMenuOpen"
      class="absolute right-0 top-full mt-2 z-20 max-w-44 rounded-lg border border-white/10 bg-neutral-900/95 py-1 text-xs shadow-lg backdrop-blur-sm"
    >
      <button
        v-for="lang in languages"
        :key="lang.code"
        type="button"
        class="flex w-full items-center justify-between gap-4 px-3 py-1.5 hover:bg-white/10"
        :class="{ 'font-semibold text-white': locale === lang.code }"
        @click="
          setLocale(lang.code);
          languageMenuOpen = false;
        "
      >
        <span>{{ lang.code.toUpperCase() }}</span>
        <span>{{ lang.label }} </span>
      </button>
    </div>
  </div>
</template>
