import { ref, onMounted, onBeforeUnmount } from "vue";
import Uppy, { debugLogger } from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';
import { useUppyStore } from '@/stores/uppyStore';
import {useNavStore} from '@/stores/navStore';

export function useFileUploader({...options}) {

  const disallowedFiles = ['.DS_Store', 'thumbs.db'];
  const uppyStore = useUppyStore();
  const navStore = useNavStore();
  const inputRef = ref(null);
  const files = ref([]);

  const uppy = new Uppy({
    debug: true,
    autoProceed: true,
    // logger: debugLogger,
    store: uppyStore,
  });


  uppy.use(XHRUpload, {
    endpoint: 'http://localhost:3000/api/upload', // your server endpoint
    formData: true,
    fieldName: 'filedata',
    bundle: false,
    allowedMetaFields: null
  });

  uppy.on('file-added', (file) => {
    uppy.setFileMeta(file.id, {
      uploadTo: navStore.currentPath
    });
  });


  function uppyFile(file){
    return {
      name: file.name,
      type: file.type,
      data: file,
      meta: {
        relativePath: file.webkitRelativePath || file.name,
      }
    }
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

      // TODO: files array should be in uppyFile format
      files.value = [];
      const options = { ...defaultDialogOptions, ...opts };
      
      setDialogAttributes(options);

      inputRef.value.onchange = (e) => {
        
        files.value = Array.from(e.target.files).filter(
          file => !disallowedFiles.includes(file.name)
        );
        files.value.forEach(file => uppy.addFile(uppyFile(file)));
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
    const input = document.createElement("input");
    input.type = "file";
    input.className = "hidden";
    document.body.appendChild(input);
    inputRef.value = input;
  });

  onBeforeUnmount(() => {
    inputRef.value?.remove();
    uppy.close();
  });

  uppyStore.uppy = uppy;

  return {
    files,
    openDialog
  }

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