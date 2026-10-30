import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const port=15173;
const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','inherit']});
try {
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>{if(code)reject(new Error('Server failed'));});});
 const base='http://127.0.0.1:'+port;
 for(const path of ['/','/home','/login','/routines','/settings','/home?refresh=1']){
  const response=await fetch(base+path);assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/text\/html/);assert.match(await response.text(),/id="app-screen"/);
 }
 for(const path of ['/app.js','/style.css','/public/assets/fb2ee.svg','/public/assets/font-0.ttf']){
  const response=await fetch(base+path);assert.equal(response.status,200,path);assert.ok((await response.arrayBuffer()).byteLength>0);
 }
 assert.equal((await fetch(base+'/public/assets/missing.svg')).status,404);
 const config=JSON.parse(await readFile('vercel.json','utf8'));assert.equal(config.outputDirectory,'dist');assert.equal(config.rewrites[0].destination,'/index.html');
 for(const file of ['dist/index.html','dist/app.js','dist/style.css','dist/public/assets/fb2ee.svg'])assert.ok((await stat(file)).size>0);
 const app=await readFile('app.js','utf8');assert.match(app,/const initialRoute = routeFromURL/);assert.match(app,/\/\#\//);
 console.log('PASS: direct routes, refresh fallback, assets, missing-asset 404, Vercel output and route restoration.');
} finally {child.kill();}
