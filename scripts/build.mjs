import {mkdir,copyFile,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=new URL('../dist/',import.meta.url);
await mkdir(out,{recursive:true});
for(const name of ['index.html','style.css','app.js'])await copyFile(new URL('../'+name,import.meta.url),new URL(name,out));
await cp(new URL('../public/',import.meta.url),new URL('public/',out),{recursive:true});
console.log('Built static app: dist/ (HTML, CSS, JavaScript and local assets)');
