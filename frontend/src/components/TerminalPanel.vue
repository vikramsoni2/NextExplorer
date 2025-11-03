<template>

  <div 
  ref="dragline" 
  class="cursor-ns-resize w-full h-[4px] -ml-[2px] bg-nextgray-400 dark:bg-neutral-700 z-100"></div>
  <div 
  ref="resizable"
  class="overflow-hidden"
  :style="{height: `${terminalHeight}px`}">
    <div ref="terminaldiv"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import {useDraggable } from '@vueuse/core'
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import { apiBase } from '@/api';

// import { useSettingsStore } from '@/stores/settings';

// const settings = useSettingsStore()


const terminalHeight = ref(2);
const terminaldiv = ref(null);
let term;
let socket;
let fitAddon;

const sendInput = (data) => {
  socket.send(data);
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

const buildTerminalUrl = () => {
  const base = `${apiBase}/terminal`;
  const withScheme = toWebSocketScheme(base);
  return withScheme;
};

const connectToBackend = () => {
  socket = new WebSocket(buildTerminalUrl());
  socket.onmessage = event => {
    term.write(event.data);
  };
};

onMounted(() => {
  term = new Terminal();
  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminaldiv.value);
  fitAddon.fit();


  term.onData(data => {
    sendInput(data);
  });

  connectToBackend();
});

onBeforeUnmount(() => {
  if (socket) {
    socket.close();
  }
});







const dragline = ref(null)
const resizable = ref(null)

useDraggable(dragline, {
  axis: 'y',
  preventDefault: true,
  onMove: (event, { movementY }) => {
    terminalHeight.value -= movementY;
    terminalHeight.value = Math.max(2, Math.min(400, terminalHeight.value));

    const xtermScreen = document.querySelector('.xterm-screen');
    if (xtermScreen) {
      xtermScreen.style.height = `${terminalHeight.value}px !important`;
    }
    else {
      console.log('xterm-screen not found');
    }
  },
});


</script>

<style>

.xterm-screen {
  height: 400px !important;
}

</style>
