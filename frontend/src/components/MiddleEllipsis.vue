<script setup>
import { computed } from 'vue';

const props = defineProps({
  text: {
    type: String,
    required: true,
    default: ''
  },
  endChars: {
    type: Number,
    default: 10
  }
});

const startText = computed(() => {
  if (props.text.length <= props.endChars) {
    return props.text;
  }
  return props.text.slice(0, -props.endChars);
});

const endText = computed(() => {
  if (props.text.length <= props.endChars) {
    return '';
  }
  return props.text.slice(-props.endChars);
});
</script>

<template>
  <span class="flex w-full min-w-0 pr-4 overflow-hidden max-w-full">
    <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
      {{ startText }}
    </span>
    <span
      v-if="endText"
      class="shrink-0 whitespace-nowrap"
    >
      {{ endText }}
    </span>
  </span>
</template>
