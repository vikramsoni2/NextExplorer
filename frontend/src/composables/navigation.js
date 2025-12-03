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
        router.push({ path: `/browse/${item.name}` });
      })();
      return;
    }
    if (item.kind === 'personal') {
      withViewTransition(() => {
        router.push({ path: '/browse/personal' });
      })();
      return;
    }
    if(item.kind==='directory'){
      const newPath = route.params.path ? `${route.params.path}/${item.name}` : item.name;
      withViewTransition(() => {
        router.push({ path: `/browse/${newPath}` });
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
      withViewTransition(() => {
        router.push({ path: `/editor/${fileToEdit}` });
      })();
      return;
    }
  };
  

  const openBreadcrumb = withViewTransition((path)=>{
    if (path === 'share') {
      router.push({ name: 'SharedWithMe' });
      return;
    }
    router.push({ path: `/browse/${path}` });
  });

  const goNext = withViewTransition(()=>router.go(1));

  const goPrev = withViewTransition(()=>router.go(-1));

  const goUp = withViewTransition(() => {
    const path = decodeURIComponent(router.currentRoute.value.path);
    const segments = path.split('/').slice(2);
    // console.log(segments);
    if (segments.length > 0) {
      segments.pop();
      router.push({ path: `/browse/${segments.join('/')}` });
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
