<script setup>
import HeaderLogo from '@/components/HeaderLogo.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';
import { useAppSettings } from '@/stores/appSettings';

const appSettings = useAppSettings();

const props = defineProps({
  version: { type: String, required: true },
  isLoading: { type: Boolean, default: false },
});
</script>

<template>
  <div class="min-h-screen bg-neutral-900 text-neutral-100">
    <div v-if="props.isLoading" class="flex min-h-screen items-center justify-center px-4 py-12">
      <div class="flex flex-col items-center gap-3">
        <div
          class="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-accent"
        ></div>
        <p class="text-lg font-medium tracking-wide text-neutral-100/80">
          {{ t('auth.preparing') }}
        </p>
      </div>
    </div>

    <div v-else class="relative isolate min-h-screen overflow-hidden bg-neutral-900">
      <div
        aria-hidden="true"
        class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          style="
            clip-path: polygon(
              74.1% 44.1%,
              100% 61.6%,
              97.5% 26.9%,
              85.5% 0.1%,
              80.7% 2%,
              72.5% 32.5%,
              60.2% 62.4%,
              52.4% 68.1%,
              47.5% 58.3%,
              45.2% 34.5%,
              27.5% 76.7%,
              0.1% 64.9%,
              17.9% 100%,
              27.6% 76.8%,
              76.1% 97.7%,
              74.1% 44.1%
            );
          "
          class="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-zinc-200/40 via-zinc-500/40 to-zinc-800/70 opacity-40 sm:left-[calc(50%-30rem)] sm:w-288.75"
        ></div>
      </div>

      <div
        aria-hidden="true"
        class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
      >
        <div
          style="
            clip-path: polygon(
              74.1% 44.1%,
              100% 61.6%,
              97.5% 26.9%,
              85.5% 0.1%,
              80.7% 2%,
              72.5% 32.5%,
              60.2% 62.4%,
              52.4% 68.1%,
              47.5% 58.3%,
              45.2% 34.5%,
              27.5% 76.7%,
              0.1% 64.9%,
              17.9% 100%,
              27.6% 76.8%,
              76.1% 97.7%,
              74.1% 44.1%
            );
          "
          class="relative left-[calc(50%+3rem)] aspect-1155/678 w-144.5 -translate-x-1/2 bg-linear-to-tr from-zinc-200/30 via-zinc-500/30 to-zinc-800/60 opacity-35 sm:left-[calc(50%+36rem)] sm:w-288.75"
        ></div>
      </div>

      <div
        aria-hidden="true"
        class="pointer-events-none absolute right-5 top-0 -z-10 h-40 w-40 transform-gpu blur-3xl"
      >
        <div
          class="h-full w-full rounded-full bg-[radial-gradient(circle_at_center,rgba(244,244,245,0.3),transparent_60%)]"
        ></div>
      </div>

      <div class="flex min-h-screen flex-col">
         <header class="flex items-center justify-between px-6 py-6 sm:px-12">
           <h1 class="mb-0 text-2xl font-bold tracking-tight text-white">
             <HeaderLogo :appname="appSettings.state.branding.appName" :logoUrl="appSettings.state.branding.appLogoUrl" />
           </h1>
           <LanguageSelector />
         </header>

        <main class="flex flex-1 items-center justify-center px-6 sm:px-12">
          <div class="relative z-10 w-full max-w-md">
            <div
              class="relative w-full rounded-2xl border border-white/15 bg-neutral-800/40 px-6 py-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:px-8 sm:py-8"
            >
              <div class="mb-6">
                <slot name="heading" />
                <slot name="subtitle" />
              </div>

              <slot name="announcement" />

              <slot />
            </div>
          </div>
        </main>

         <footer class="flex items-center justify-between px-6 py-4 sm:px-12 text-xs text-white/80">
           <div class="flex items-center gap-2">
             <div>© {{ new Date().getFullYear() }} {{ appSettings.state.branding.appName }}</div>
             <span class="text-white">v{{ props.version }}</span>
           </div>

          <div class="flex items-center gap-4 text-white/70">
            <a
              href="https://explorer.nxz.ai"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs font-medium text-white/80 underline-offset-4 hover:text-white hover:underline"
            >
              Help &amp; docs
            </a>
            <a
              v-if="appSettings.state.branding.showPoweredBy"
              href="https://explorer.nxz.ai"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs font-medium text-white/80 underline-offset-4 hover:text-white hover:underline"
            >
              Powered by nextExplorer
            </a>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>
