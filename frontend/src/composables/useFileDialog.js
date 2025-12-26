import { ref, onMounted, onBeforeUnmount } from 'vue';

const defaultDialogOptions = {
  multiple: true,
  accept: '*',
  directory: true,
};

export function useFileDialog() {
  const inputRef = ref(null);
  const files = ref([]);

  onMounted(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.className = 'hidden';
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

      if (options.directory) {
        inputRef.value.webkitdirectory = !!options.directory;
        inputRef.value.directory = !!options.directory;
        inputRef.value.mozdirectory = !!options.directory;
      }

      inputRef.value.onchange = (e) => {
        if (options.directory) {
          // Process directory files
          const items = Array.from(e.target.files);
          const directories = {};
          items.forEach((file) => {
            const path = file.webkitRelativePath.split('/');
            const dir = path[0];
            if (!directories[dir]) {
              directories[dir] = [];
            }
            directories[dir].push(file);
          });
          files.value = directories;
        } else {
          // Process individual files
          files.value = Array.from(e.target.files);
        }
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
