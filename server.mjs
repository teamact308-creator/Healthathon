import http from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed = {'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/workflow.mjs':'workflow.mjs'};
http.createServer(async(req,res)=>{const path=allowed[new URL(req.url,'http://localhost').pathname];if(!path){res.writeHead(404);return res.end('Not found');}try{const body=await readFile(new URL(path,import.meta.url));res.setHeader('Content-Type',path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript');res.end(body);}catch{res.writeHead(500);res.end('Unable to load demo');}}).listen(4173,'127.0.0.1',()=>console.log('WholeCare demo: http://localhost:4173'));
