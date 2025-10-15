<script setup>
const props = defineProps({
  label: { type: String, default: '' },
  bg: { type: String, default: '#6B7280' }, // gray-500
  fg: { type: String, default: '#FFFFFF' }, // white
});
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <!-- Page fill -->
    <path fill="#fff" d="M6.5 29h19c.275 0 .5-.225.5-.5V9h-4.5c-.827 0-1.5-.673-1.5-1.5V3H6.5c-.275 0-.5.225-.5.5v25c0 .275.225.5.5.5z M25.293 8 21 3.707V7.5c0 .275.225.5.5.5h3.793z"/>
    <!-- Page outline & fold -->
    <path opacity=".67" fill="#605E5C" fill-rule="evenodd" clip-rule="evenodd" d="m26.56 7.854-5.414-5.415A1.51 1.51 0 0 0 20.086 2H6.5C5.673 2 5 2.673 5 3.5v25c0 .827.673 1.5 1.5 1.5h19c.827 0 1.5-.673 1.5-1.5V8.914c0-.4-.156-.777-.44-1.06zM21 3.707 25.293 8H21.5a.501.501 0 0 1-.5-.5V3.707zM6.5 29h19c.275 0 .5-.225.5-.5V9h-4.5c-.827 0-1.5-.673-1.5-1.5V3H6.5c-.275 0-.5.225-.5.5v25c0 .276.224.5.5.5z"/>

    <!-- Light content lines -->
    <path fill="#C8C6C4" fill-rule="evenodd" clip-rule="evenodd" d="M23.5 12.5h-15a.5.5 0 0 1 0-1h15a.5.5 0 0 1 0 1zm0 2h-15a.5.5 0 0 1 0-1h15a.5.5 0 0 1 0 1zm-15 2h15a.5.5 0 0 0 0-1h-15a.5.5 0 0 0 0 1zm15 2h-15a.5.5 0 0 1 0-1h15a.5.5 0 0 1 0 1z"/>

    <!-- Bottom banner -->
    <rect x="5.5" y="19" width="21" height="8" rx="1.25" :fill="bg"/>
    <text
      x="16" y="23"
      font-family="Segoe UI, Roboto, Arial, Helvetica, sans-serif"
      font-size="6" font-weight="800"
      text-anchor="middle" dominant-baseline="middle"
      :fill="fg"
      stroke="#000000" stroke-opacity=".2" stroke-width=".35"
      paint-order="stroke fill"
    >{{ (props.label || '').toUpperCase() }}</text>
  </svg>
  
</template>

