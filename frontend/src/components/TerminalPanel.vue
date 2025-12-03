<template>
  <teleport to="body">
    <!-- Backdrop -->
    <transition name="tp-fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-1450 bg-black/30"
        @click="close"
      />
    </transition>

    <!-- Panel -->
    <div
      class="fixed inset-y-0 right-0 z-1500 w-full sm:w-[600px] md:w-[700px] lg:w-[800px] transform transition-transform duration-200 ease-out"
      :class="isOpen ? 'translate-x-0' : 'translate-x-full'"
    >
      <aside ref="panelRef" class="flex h-full flex-col border-l dark:bg-zinc-950 shadow-2xl dark:border-white/10">
        <header class="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 class="text-lg font-semibold text-white">{{ $t('titles.terminal') }}</h2>
          <button
            @click="close"
            class="rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            :aria-label="$t('common.close')"
          >
            <XMarkIcon class="w-5 h-5" />
          </button>
        </header>
        <div class="flex-1 overflow-hidden p-4">
          <div ref="terminaldiv" class="h-full"></div>
        </div>
      </aside>
    </div>
  </teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { XMarkIcon } from '@heroicons/vue/24/outline';

import { apiBase, createTerminalSession } from '@/api';
import { useTerminalStore } from '@/stores/terminal';
import { onClickOutside } from '@vueuse/core';

const terminalStore = useTerminalStore();
const { isOpen } = storeToRefs(terminalStore);
const { close } = terminalStore;

const terminaldiv = ref(null);
const panelRef = ref(null);
let term;
let socket;
let fitAddon;

const sendInput = (data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(data);
  }
};

const toWebSocketScheme = (url) => {
  if (url.startsWith('https://')) {
    return `wss://${url.slice(8)}`;
  }

  if (url.startsWith('http://')) {
    return `ws://${url.slice(7)}`;
  }

  return url;
};

const buildTerminalUrl = (token) => {
  const base = `${apiBase}/api/terminal`;
  const withScheme = toWebSocketScheme(base);
  const url = `${withScheme}?token=${encodeURIComponent(token)}`;
  console.log('Terminal WebSocket URL - apiBase:', apiBase);
  console.log('Terminal WebSocket URL - base:', base);
  console.log('Terminal WebSocket URL - final:', url);
  return url;
};

const connectToBackend = async () => {
  try {
    const session = await createTerminalSession();
    const token = session?.token;
    if (!token) {
      console.error('Failed to obtain terminal session token');
      return;
    }

    const url = buildTerminalUrl(token);
    console.log('Attempting to connect to terminal WebSocket:', url);
    socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('Terminal WebSocket connection opened');
    };

    socket.onmessage = event => {
      console.log('Received data from terminal:', event.data.length, 'bytes');
      term.write(event.data);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
    };
  } catch (error) {
    console.error('Failed to connect to terminal:', error);
  }
};

const initTerminal = () => {
  if (!terminaldiv.value || term) return;

  term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#09090b',
      foreground: '#e4e4e7',
      cursor: '#22d3ee',
      cursorAccent: '#09090b',
      selectionBackground: 'rgba(255, 255, 255, 0.2)',
      selectionForeground: '#ffffff',

      // Normal colors
      black: '#27272a',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#facc15',
      blue: '#60a5fa',
      magenta: '#c084fc',
      cyan: '#22d3ee',
      white: '#e4e4e7',

      // Bright colors
      brightBlack: '#71717a',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fde047',
      brightBlue: '#93c5fd',
      brightMagenta: '#d8b4fe',
      brightCyan: '#67e8f9',
      brightWhite: '#fafafa',
    }
  });
  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminaldiv.value);

  setTimeout(() => {
    fitAddon.fit();
  }, 100);

  term.onData(data => {
    sendInput(data);
  });

  connectToBackend();
};

watch(isOpen, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      initTerminal();
      if (fitAddon) {
        fitAddon.fit();
      }
    }, 250);
  }
});

onMounted(() => {
  if (isOpen.value) {
    initTerminal();
  }
});

onBeforeUnmount(() => {
  if (socket) {
    socket.close();
  }
  if (term) {
    term.dispose();
  }
});

onClickOutside(panelRef, () => {
  if (isOpen.value) {
    close();
  }
});
</script>

<style>
.tp-fade-enter-active,
.tp-fade-leave-active {
  transition: opacity 0.2s ease;
}

.tp-fade-enter-from,
.tp-fade-leave-to {
  opacity: 0;
}
</style>
