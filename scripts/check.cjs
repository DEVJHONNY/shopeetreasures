'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const dirs=['lib','netlify/functions','public','scripts','tests'];
const files=[...fs.readdirSync(root).filter(f=>/\.(c?js)$/.test(f)),...dirs.flatMap(d=>fs.readdirSync(path.join(root,d)).filter(f=>/\.(c?js)$/.test(f)).map(f=>d+'/'+f))];
for(const file of files){const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});if(r.status!==0){process.stderr.write(r.stderr);process.exit(1);}}
for(const file of ['index.html','admin.html','vip.html']){const source=fs.readFileSync(path.join(root,'public',file),'utf8');for(const m of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1],{filename:file});}
console.log(`Sintaxe válida: ${files.length} arquivos JavaScript e scripts das três páginas.`);
