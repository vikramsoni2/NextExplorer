<script setup>
import { computed } from 'vue';

const props = defineProps({
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  zoom: { type: Number, default: 13 },
  height: { type: Number, default: 200 },
  provider: { type: String, default: 'google' }, // 'google' | 'osm'
});

// Google Maps embed (no API key needed for simple embed)
const googleSrc = computed(() => `https://www.google.com/maps?q=${props.lat},${props.lon}&z=${props.zoom}&output=embed`);

// OpenStreetMap embed (no external libs)
const osmSrc = computed(() => {
  const dLat = 0.01;
  const dLon = 0.01;
  const bbox = [props.lon - dLon, props.lat - dLat, props.lon + dLon, props.lat + dLat].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${props.lat},${props.lon}`;
});

const src = computed(() => (props.provider === 'osm' ? osmSrc.value : googleSrc.value));
const frameStyle = computed(() => ({ height: `${props.height}px` }));
</script>

<template>
  <div class="w-full overflow-hidden rounded-lg ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
    <iframe
      :src="src"
      class="w-full"
      style="border:0;"
      :style="frameStyle"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      allowfullscreen
    ></iframe>
    <div class="mt-1 px-1 text-xs text-neutral-500 dark:text-neutral-400">
      Lat {{ lat.toFixed(5) }}, Lon {{ lon.toFixed(5) }}
    </div>
  </div>
</template>

<style scoped>
/* iframe naturally fills provided height */
</style>

