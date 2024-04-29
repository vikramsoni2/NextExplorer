import { useRouter, useRoute } from 'vue-router';

export function useNavigation() {
    
  const router = useRouter()
  const route = useRoute()

  const openItem = (item)=>{
      if(item.kind==='directory'){
          const new_path = route.params.path ? `${route.params.path}/${item.name}` : item.name;
          router.push({ name: 'browse', params: {path: new_path} });
      }


  }

  const openBreadcrumb = (path)=>{
    router.push({ name: 'browse', params: {path: path} });
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

  return {
    openItem,
    openBreadcrumb
  }
}