import { useRouter, useRoute } from 'vue-router';
import { withViewTransition } from '@/utils';
import { isEditableExtension } from '@/config/editor';
import { usePreviewManager } from '@/plugins/preview/manager';


export function useNavigation() {
    
  const router = useRouter()
  const route = useRoute()
  const previewManager = usePreviewManager();


  const openItem = (item)=>{
    if (!item) return;

    const extensionFromKind = typeof item.kind === 'string' ? item.kind.toLowerCase() : '';
    const extensionFromName = typeof item.name === 'string' && item.name.includes('.')
      ? item.name.split('.').pop().toLowerCase()
      : '';

    if(item.kind==='volume'){
      withViewTransition(() => {
        router.push({ name: 'FolderView', params: { path: item.name } });
      })();
      return;
    }
    if (item.kind === 'personal') {
      withViewTransition(() => {
        router.push({ name: 'FolderView', params: { path: 'personal' } });
      })();
      return;
    }
    if(item.kind==='directory'){
      const newPath = route.params.path ? `${route.params.path}/${item.name}` : item.name;
      withViewTransition(() => {
        router.push({ name: 'FolderView', params: { path: newPath } });
      })();
      return;
    }

    // Files: try preview first (no view transition – avoids double animations)
    if (previewManager.open(item)) {
      return;
    }

    if(isEditableExtension(extensionFromKind) || isEditableExtension(extensionFromName)){
      const basePath = item.path ? `${item.path}/${item.name}` : item.name;
      const fileToEdit = basePath.replace(/^\/+/, '');
      // Encode each segment for editor path
      const encodedPath = fileToEdit.split('/').map(encodeURIComponent).join('/');
      withViewTransition(() => {
        router.push({ path: `/editor/${encodedPath}` });
      })();
      return;
    }
  };
  

  const openBreadcrumb = withViewTransition((path)=>{
    if (path === 'share') {
      router.push({ name: 'SharedWithMe' });
      return;
    }
    router.push({ name: 'FolderView', params: { path } });
  });

  const goNext = withViewTransition(()=>router.go(1));

  const goPrev = withViewTransition(()=>router.go(-1));

  const goUp = withViewTransition(() => {
    const currentPath = route.params.path || '';
    const segments = currentPath.split('/').filter(Boolean);
    if (segments.length > 0) {
      segments.pop();
      const newPath = segments.join('/');
      if (newPath) {
        router.push({ name: 'FolderView', params: { path: newPath } });
      } else {
        router.push({ name: 'HomeView' });
      }
    }
  });


  return {
    openItem,
    openBreadcrumb,
    goNext,
    goPrev,
    goUp
  }
}




// const goForward = ()=>{
  //   router.go(1);
  // }

  // const goBackward = ()=>{
  //   router.go(-1);
  // }

  // const goUpward = ()=>{
  //   const path = route.params.path.split('/');
  //   path.pop();
  //   const new_path = path.join('/');
  //   router.push({ name: 'browse', params: {path: new_path} });
  // }

  // const canGoForward = ()=>{

  //   //check in router object if the route can go forward.
  //   return router.currentRoute.value.meta.canGoForward;
    

  // }
