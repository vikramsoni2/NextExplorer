# explorer

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

const defaultDialogOptions = {
multiple: false,
accept: '\*',
};

export function useFileDialog() {
const inputRef = ref(null);
const files = ref([]);

onMounted(() => {
const input = document.createElement("input");
input.type = "file";
input.className = "hidden";
document.body.appendChild(input);
inputRef.value = input;
});

onBeforeUnmount(() => {
inputRef.value?.remove();
});

function openFileDialog(opts) {
return new Promise((resolve) => {
if (!inputRef.value) {
return;
}
files.value = [];

      const options = { ...defaultDialogOptions, ...opts };
      inputRef.value.accept = options.accept;
      inputRef.value.multiple = options.multiple;

      inputRef.value.onchange = (e) => {
        files.value = Array.from(e.target.files);
        resolve();
      };

      inputRef.value.click();
    });

}

return {
openFileDialog,
files,
};
}

const defaultDialogOptions = {
multiple: true, // Now accepts multiple files
accept: '_', // You can specify accepted file types (e.g., 'image/_', '.pdf', etc.)
};

export function useFileDialog() {
const inputRef = ref(null);
const files = ref([]);
const filePaths = ref([]); // New array to store file paths

onMounted(() => {
const input = document.createElement("input");
input.type = "file";
input.className = "hidden";
document.body.appendChild(input);
inputRef.value = input;
});

onBeforeUnmount(() => {
inputRef.value?.remove();
});

function openFileDialog(opts) {
return new Promise((resolve) => {
if (!inputRef.value) {
return;
}
files.value = [];
filePaths.value = []; // Initialize file paths array

      const options = { ...defaultDialogOptions, ...opts };
      inputRef.value.accept = options.accept;
      inputRef.value.multiple = options.multiple;

      inputRef.value.onchange = (e) => {
        files.value = Array.from(e.target.files);
        filePaths.value = files.value.map((file) => file.webkitRelativePath); // Store file paths
        resolve();
      };

      inputRef.value.click();
    });

}

return {
openFileDialog,
files,
filePaths, // Expose the file paths
};
}
