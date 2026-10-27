'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('adaptador Lambda funciona com o SDK instalado sem chamadas externas',async()=>{
 const sdk=require('@netlify/blobs');let requests=0,adapterError='';
 const mockFetch=async()=>{requests++;return new Response(null,{status:404});};
 const module={exports:{}};
 const source=fs.readFileSync(path.join(__dirname,'../netlify/functions/api.js'),'utf8');
 const req=name=>{
   if(name==='../../lib/cloud-api')return {createHandler:options=>require('../lib/cloud-api').createHandler({...options,getStore:async event=>{try{return await options.getStore(event);}catch(e){adapterError=e.message;throw e;}}})};
   if(name==='@netlify/blobs')return {...sdk,getStore:options=>sdk.getStore({...options,fetch:mockFetch})};
   if(name==='./shopee_api')return {};
   return require(path.join(__dirname,'../netlify/functions',name));
 };
 vm.runInNewContext(source,{require:req,module,exports:module.exports});
 const r=await module.exports.handler({httpMethod:'GET',path:'/api/settings',headers:{host:'deploy-preview-1--shopeetreasures-vip.netlify.app','x-nf-deploy-id':'fixture-deploy','x-nf-site-id':'fixture-site'},blobs:Buffer.from(JSON.stringify({url:'https://storage.invalid',token:'fixture-only'})).toString('base64')});
 assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).storage_available,undefined,adapterError);assert.equal(requests,1);
});
