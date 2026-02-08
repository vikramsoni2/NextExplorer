import { ref, onMounted, onBeforeUnmount } from 'vue';
import Uppy from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';
import { useUppyStore } from '@/stores/uppyStore';
import { useFileStore } from '@/stores/fileStore';
import { apiBase, normalizePath } from '@/api';
import { isDisallowedUpload } from '@/utils/uploads';
import DropTarget from '@uppy/drop-target';
import { nanoid } from 'nanoid';
import { useNotificationsStore } from '@/stores/notifications';

export function useFileUploader() {
  // Filtering is centralized in utils/uploads
  const uppyStore = useUppyStore();
  const fileStore = useFileStore();
  const notificationsStore = useNotificationsStore();
  const inputRef = ref(null);
  const files = ref([]);

  // Ensure a single Uppy instance app-wide
  let uppy = uppyStore.uppy;
  const createdHere = ref(false);

  if (!uppy) {
    uppy = new Uppy({
      debug: Boolean(import.meta.env?.DEV),
      autoProceed: true,
      store: uppyStore,
      // Allow re-uploading the "same" file (same name/size/mtime) by making IDs unique when needed.
      // This avoids silent no-op adds when a user uploads a duplicate to intentionally trigger server-side renaming.
      onBeforeFileAdded: (file, files) => {
        if (isDisallowedUpload(file?.name)) return false;

        if (!Object.hasOwn(files, file.id)) return true;

        let uniqueId = `${file.id}-${nanoid(6)}`;
        while (Object.hasOwn(files, uniqueId)) {
          uniqueId = `${file.id}-${nanoid(6)}`;
        }
        return { ...file, id: uniqueId };
      },
    });

    uppy.use(XHRUpload, {
      endpoint: `${apiBase}/api/upload`,
      formData: true,
      fieldName: 'filedata',
      bundle: false,
      allowedMetaFields: null,
      withCredentials: true,
      // Default is 30s which is too short for many real-world uploads.
      timeout: 30 * 60 * 1000,
    });

    const uploadTargets = new Set();
    let resetTimer = null;

    const clearScheduledReset = () => {
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
    };

    const notifyUploadError = (heading, details) => {
      notificationsStore.addNotification({
        type: 'error',
        heading: heading || 'Upload failed',
        body: details || '',
      });
    };

    // Cookies carry auth; no token headers
    uppy.on('file-added', (file) => {
      clearScheduledReset();

      // Ensure server always receives a usable relativePath, even for drag-and-drop
      const inferredRelativePath =
        file?.meta?.relativePath ||
        file?.data?.webkitRelativePath ||
        file?.name ||
        (file?.data && file?.data.name) ||
        '';

      // Some rare DnD sources may miss name; prefer data.name if present
      if (!file?.name && file?.data?.name && typeof uppy.setFileName === 'function') {
        try {
          uppy.setFileName(file.id, file.data.name);
        } catch (_) {
          /* noop */
        }
      }

      uppy.setFileMeta(file.id, {
        uploadTo: normalizePath(fileStore.currentPath || ''),
        relativePath: inferredRelativePath,
      });
    });

    uppy.on('upload-success', (file) => {
      const target = typeof file?.meta?.uploadTo === 'string' ? normalizePath(file.meta.uploadTo) : '';
      uploadTargets.add(target);
    });

    uppy.on('upload-error', (file, error, response) => {
      const name = file?.name || 'file';
      const message =
        (response && response.body && (response.body.error || response.body.message)) ||
        error?.message ||
        'Upload failed';
      notifyUploadError(`Upload failed: ${name}`, String(message || ''));

      try {
        if (file?.id) uppy.removeFile(file.id);
      } catch (_) {
        /* noop */
      }
    });

    uppy.on('restriction-failed', (file, error) => {
      const name = file?.name || 'file';
      const message = error?.message || 'File could not be added.';
      notifyUploadError(`Upload skipped: ${name}`, String(message || ''));
    });

    uppy.on('complete', () => {
      const current = normalizePath(fileStore.currentPath || '');
      if (uploadTargets.has(current)) {
        fileStore.fetchPathItems(current).catch(() => {});
      }
      uploadTargets.clear();

      // Clear Uppy state once the queue is done so the progress panel doesn't get stuck
      // and users can re-upload the same file/folder again.
      clearScheduledReset();
      resetTimer = setTimeout(() => {
        try {
          // If a new upload started since completion, don't wipe the new queue.
          const currentUploads = uppy.getState?.()?.currentUploads || {};
          if (Object.keys(currentUploads).length === 0) {
            uppy.reset?.();
          }
        } catch (_) {
          /* noop */
        }
      }, 750);
    });

    uppyStore.uppy = uppy;
    createdHere.value = true;
  }

  function uppyFile(file) {
    return {
      name: file.name,
      type: file.type,
      data: file,
    };
  }

  function setDialogAttributes(options) {
    inputRef.value.accept = options.accept;
    inputRef.value.multiple = options.multiple;
    inputRef.value.webkitdirectory = !!options.directory;
    inputRef.value.directory = !!options.directory;
    inputRef.value.mozdirectory = !!options.directory;
  }

  function openDialog(opts) {
    const defaultDialogOptions = {
      multiple: true,
      accept: '*',
    };

    return new Promise((resolve) => {
      if (!inputRef.value) return;

      files.value = [];
      const options = { ...defaultDialogOptions, ...opts };

      setDialogAttributes(options);

      inputRef.value.onchange = (e) => {
        const selectedFiles = Array.from(e.target.files || []).filter(
          (file) => !isDisallowedUpload(file.name)
        );

        files.value = selectedFiles.map((file) => uppyFile(file));
        files.value.forEach((file) => {
          try {
            uppy.addFile(file);
          } catch (err) {
            // Common case: duplicates or restrictions, which would otherwise look like a no-op.
            notificationsStore.addNotification({
              type: 'error',
              heading: 'Upload skipped',
              body: err?.message ? String(err.message) : 'Could not add file to upload queue.',
            });
          }
        });

        // Reset the input so the same file can be selected again if needed
        e.target.value = '';
        resolve();
      };

      inputRef.value.click();
    });
  }

  // function process() {

  //   if (Array.isArray(files.value)) {
  //     // Handle the case where it's directly an array
  //     files.value.forEach(file => uppy.addFile(file));

  //   } else if (typeof files.value === 'object') {
  //     // Handle the case where it's an object of arrays
  //     Object.keys(files.value).forEach(key => {
  //       if (Array.isArray(files.value[key])) {
  //         console.log(`Processing list at key: ${key}`);
  //         files.value[key].forEach(file => uppy.addFile(file));
  //       } else {
  //         console.warn(`Expected an array at key: ${key}, but found:`, files.value[key]);
  //       }
  //     });
  //   } else {
  //     console.error('Unexpected data type for files.value:', files.value);
  //   }

  //   uppy.upload().then(result => {
  //     console.log(' uploads:', result);
  //     console.log('Successful uploads:', result.successful);
  //     console.log('Failed uploads:', result.failed);
  //   }).catch(error => {
  //     console.error('Upload error:', error);
  //   });

  // }

  onMounted(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.className = 'hidden';
    document.body.appendChild(input);
    inputRef.value = input;
  });

  onBeforeUnmount(() => {
    inputRef.value?.remove();
    // Only close the singleton if we created it here
    if (createdHere.value) {
      uppy.close?.();
      if (uppyStore.uppy === uppy) {
        uppyStore.uppy = null;
      }
    }
  });

  return {
    files,
    openDialog,
  };
}

// function onDrop(droppedFiles) {
//   // each droppedFile to files array
//   files.value.push(...droppedFiles)
//   console.log(droppedFiles)
// }

// const { isOverDropZone } = useDropZone(dropzoneRef, {
//   onDrop,
// })

// console.log(options)

// Attach/detach Uppy DropTarget plugin to a given element ref
export function useUppyDropTarget(targetRef) {
  const uppyStore = useUppyStore();

  onMounted(() => {
    const el = targetRef && 'value' in targetRef ? targetRef.value : null;
    const uppy = uppyStore.uppy;
    if (el && uppy) {
      try {
        const existing = uppy.getPlugin && uppy.getPlugin('DropTarget');
        if (existing) uppy.removePlugin(existing);
        uppy.use(DropTarget, { target: el });
      } catch (_) {
        // ignore if plugin cannot be mounted
      }
    }
  });

  onBeforeUnmount(() => {
    const uppy = uppyStore.uppy;
    if (uppy) {
      const plugin = uppy.getPlugin && uppy.getPlugin('DropTarget');
      if (plugin) uppy.removePlugin(plugin);
    }
  });
}
