
async function browse(path){
    const response = await fetch(`http://localhost:3000/api/browse/${path}`);
    return response.json();
}

async function getVolumes(){
    const response = await fetch(`http://localhost:3000/api/volumes`);
    return response.json();
}

async function copyItem(items, path){
    const response = await fetch(`http://localhost:3000/api/copy/${item.path}/${path}`);
    return response.json();
}

async function moveItem(items, path){
    //use HTTP POST method to send the item and path to the server
}   

async function deleteItem(item){
    //use HTTP DELETE method to send the item to the server
}



export {
    browse, 
    getVolumes,
    copyItem,
    moveItem,
    deleteItem
}





// async function fetchData(url, method, payload, signal = undefined) {
//     let response;
//     if (method === 'POST') {
//         response = await fetch(url, {
//             method: "POST",
//             headers: { 
//                 "Content-Type": "application/json",
//                 // "Authorization": `Bearer ${auth.getAccessToken()}`
//             },
//             body: JSON.stringify(payload),
//             signal:signal
//         });
//     } else {
//         response = await fetch(`${url}?query_message="${payload.query_message}"`, {signal});
//     }
//     return response;
// }