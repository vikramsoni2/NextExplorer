<template>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" aria-label="PDF file icon">
  <!-- Page fill -->
  <path fill="#fff" d="M6.5 29h19c.275 0 .5-.225.5-.5V9h-4.5c-.827 0-1.5-.673-1.5-1.5V3H6.5c-.275 0-.5.225-.5.5v25c0 .275.225.5.5.5z M25.293 8 21 3.707V7.5c0 .275.225.5.5.5h3.793z"/>
  <!-- Page outline & fold -->
  <path opacity=".67" fill="#605E5C" fill-rule="evenodd" clip-rule="evenodd" d="m26.56 7.854-5.414-5.415A1.51 1.51 0 0 0 20.086 2H6.5C5.673 2 5 2.673 5 3.5v25c0 .827.673 1.5 1.5 1.5h19c.827 0 1.5-.673 1.5-1.5V8.914c0-.4-.156-.777-.44-1.06zM21 3.707 25.293 8H21.5a.501.501 0 0 1-.5-.5V3.707zM6.5 29h19c.275 0 .5-.225.5-.5V9h-4.5c-.827 0-1.5-.673-1.5-1.5V3H6.5c-.275 0-.5.225-.5.5v25c0 .276.224.5.5.5z"/>
  <!-- Content lines (kept faint so the banner stands out) -->
  <path fill="#C8C6C4" fill-rule="evenodd" clip-rule="evenodd" d="M23.5 14.5h-15a.5.5 0 0 1 0-1h15a.5.5 0 0 1 0 1zm0 2h-15a.5.5 0 0 1 0-1h15a.5.5 0 0 1 0 1zm-15 2h15a.5.5 0 0 0 0-1h-15a.5.5 0 0 0 0 1zm15 2h-15a.5.5 0 0 1 0-1h15a.5.5 0 0 1 0 1z"/>
  <!-- Bold PDF banner -->
  <rect x="5.5" y="19.25" width="21" height="7" rx="1.25" fill="#E81123"/>
  <!-- Large, legible "PDF" with subtle stroke for contrast -->
  <text
    x="16" y="22.75"
    font-family="Segoe UI, Roboto, Arial, Helvetica, sans-serif"
    font-size="6" font-weight="800"
    text-anchor="middle" dominant-baseline="middle"
    fill="#FFFFFF"
    stroke="#000000" stroke-opacity=".25" stroke-width=".4"
    paint-order="stroke fill">
    PDF
  </text>
</svg>
</template>
