import { useRouter, useRoute } from 'vue-router';
import { withViewTransition } from '@/utils';


export function useNavigation() {
    
  const router = useRouter()
  const route = useRoute()


  const openItem = withViewTransition((item)=>{
    if(item.kind==='volume'){
      router.push({ path: `/browse/${item.name}` });
    }
    if(item.kind==='directory'){
        const newPath = route.params.path ? `${route.params.path}/${item.name}` : item.name;
        router.push({ path: `/browse/${newPath}` });
    }
    if(item.kind==='json' || item.kind==='txt' || item.kind==='md' ){
      const fileToEdit = `${item.path}/${item.name}`;
      router.push({ path: `/editor/${fileToEdit}` });
    }
  });
  

  const openBreadcrumb = withViewTransition((path)=>{
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