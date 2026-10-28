const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {normalizeOffer,formatOffer,affiliateUrl}=require('../lib/offers');
const {validateConfig,dueSlot,clockParts}=require('../lib/schedule');
const {createHandler}=require('../lib/cloud-api');
const {createClient}=require('../lib/shopee-client');
test('prévia não usa o armazenamento de produção quando falta contexto',()=>{
 const {storeName}=require('../lib/store-name');
 assert.match(storeName({headers:{host:'deploy-preview-12--shopeetreasures-vip.netlify.app'}},{}),/^shopeetreasures-preview-/);
 assert.match(storeName({headers:{}},{}),/^shopeetreasures-preview-/);
 assert.equal(storeName({headers:{host:'shopeetreasures-vip.netlify.app'}},{}),'shopeetreasures-v2');
});
const item={itemId:12345,productName:'Produto teste',priceMin:42,imageUrl:'https://example.invalid/image',offerLink:'https://s.shopee.com.br/example'};
function memoryStore(){const map=new Map();return {map,async get(k){return map.get(k)||null;},async setJSON(k,v,o={}){if(o.onlyIfNew&&map.has(k))return {modified:false};map.set(k,v);return {modified:true};},async *list({prefix}){yield {blobs:[...map.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};}};}
function harness(store=memoryStore()){
 const api={fetchTopOffers:async()=>[item],fetchProductById:async id=>String(id)===String(item.itemId)?item:null,generateAffiliateLink:async url=>url};
 const make=()=>createHandler({api,getStore:async()=>store,env:{ADMIN_PASSWORD:'test-only-password'}});
 const call=async(route,method='GET',body,auth=false,handler=make())=>{const r=await handler({path:route,httpMethod:method,headers:auth?{authorization:'Bearer test-only-password'}:{},body:body==null?undefined:JSON.stringify(body)});return {...r,data:r.body?JSON.parse(r.body):null};};
 return {store,make,call};
}
test('dados ausentes não viram nota, desconto ou preço anterior',()=>{const p=normalizeOffer(item);assert.equal(p.rating,null);assert.equal(p.discount_pct,null);assert.equal(p.price_original,null);const text=formatOffer(item);assert.ok(!text.includes('4.9'));assert.ok(!text.includes('40%'));assert.ok(!text.includes('referência'));assert.ok(text.includes('comissão'));});
test('links e números inválidos são recusados',()=>{assert.equal(affiliateUrl('https://shopee.com.br.evil.test/a'),null);assert.equal(affiliateUrl('javascript:alert(1)'),null);assert.equal(affiliateUrl('https://user:pass@shopee.com.br/a'),null);assert.equal(normalizeOffer({...item,priceDiscountRate:100,ratingStar:8}).discount_pct,null);assert.throws(()=>formatOffer({...item,priceMin:0}));});
test('programação valida entradas antes de gravar',()=>{assert.throws(()=>validateConfig({slots:['25:00']}));assert.throws(()=>validateConfig({slots:['12:00','12:00']}));assert.throws(()=>validateConfig({categories:['Inválida']}));assert.throws(()=>validateConfig({maxDaily:20}));});
test('horários de São Paulo, descanso, limite e reinício',()=>{
 const c=validateConfig({categories:['Casa & Cozinha']});
 assert.equal(clockParts(new Date('2026-10-28T02:30:00Z')).day,'2026-10-27');
 assert.equal(dueSlot(c,[],new Date('2026-10-27T05:00:00Z')),null);
 assert.equal(dueSlot(c,[],new Date('2026-10-27T15:05:00Z')).slot,'12:00');
 assert.equal(dueSlot(c,[],new Date('2026-10-27T15:16:00Z')),null);
 const attempts=[{day_key:'2026-10-27',slot:'12:00',kind:'automatic'},{day_key:'2026-10-27',slot:'19:00',kind:'automatic'}];
 assert.equal(dueSlot(c,attempts,new Date('2026-10-27T22:05:00Z')),null);
 assert.equal(dueSlot(c,attempts,new Date('2026-10-28T15:05:00Z')).slot,'12:00');
 assert.equal(dueSlot(validateConfig({}),[],new Date('2026-10-27T15:05:00Z')),null);
});
test('catálogo público não fabrica cliques; detalhe funciona sem lista prévia',async()=>{const h=harness();const list=await h.call('/api/products');assert.equal(list.data[0].clicks,null);const detail=await h.call('/api/products/12345');assert.equal(detail.statusCode,200);assert.equal(detail.data.title,item.productName);assert.equal((await h.call('/api/products/999')).statusCode,404);});
test('redirecionamento usa o link real e item ausente não inventa loja',async()=>{const h=harness();const r=await h.make()({path:'/api/r/12345',httpMethod:'GET'});assert.equal(r.headers.Location,item.offerLink);assert.equal((await h.call('/api/r/999')).statusCode,404);});
test('cliques persistem entre instâncias e a repetição do mesmo evento não duplica',async()=>{const h=harness(),body={event_id:'11111111-1111-4111-8111-111111111111',channel:'site'};assert.equal((await h.call('/api/click/12345','POST',body)).data.recorded,true);assert.equal((await h.call('/api/click/12345','POST',body)).data.recorded,false);const stats=await h.call('/api/admin/analytics','GET',null,true,h.make());assert.equal(stats.data.total,1);assert.equal(stats.data.by_product['12345'],1);assert.equal(stats.data.sales,null);});
test('falha de armazenamento não é anunciada como clique salvo',async()=>{const h=harness({get:async()=>null,setJSON:async()=>{throw Error('offline');}});assert.equal((await h.call('/api/click/12345','POST',{event_id:'11111111-1111-4111-8111-111111111111'})).statusCode,503);});
test('admin e mudança de convite exigem autenticação e validam o destino',async()=>{const h=harness();assert.equal((await h.call('/api/admin/products')).statusCode,401);assert.equal((await h.call('/api/settings','POST',{whatsapp_link:'https://evil.test'})).statusCode,401);assert.equal((await h.call('/api/settings','POST',{whatsapp_link:'https://evil.test'},true)).statusCode,400);assert.equal((await h.call('/api/settings','POST',{whatsapp_link:'https://chat.whatsapp.com/ExampleInvite'},true)).statusCode,200);assert.equal((await h.call('/api/settings')).data.whatsapp_link,'https://chat.whatsapp.com/ExampleInvite');});
test('site público não afirma que o WhatsApp está conectado',async()=>{const h=harness();assert.equal((await h.call('/api/admin/whatsapp/status','GET',null,true)).data.status,'unavailable');assert.equal((await h.call('/api/admin/whatsapp/connect','POST',{},true)).statusCode,409);});
test('prévia não usa rede nem converte links de afiliado',async()=>{let requests=0;const api=createClient({SHOPEE_SAFE_MODE:'1'},()=>{requests++;throw Error('network forbidden');});assert.equal((await api.fetchTopOffers()).length,2);assert.equal(await api.fetchProductById('999'),null);await assert.rejects(api.generateAffiliateLink('https://shopee.com.br/'));assert.equal(requests,0);});
test('API rejeita identidade de produto diferente da solicitada',async()=>{const api=createClient({SHOPEE_APP_ID:'fixture',SHOPEE_SECRET:'fixture'},async()=>({ok:true,json:async()=>({data:{productOfferV2:{nodes:[item]}}})}));assert.equal(await api.fetchProductById('777'),null);});
test('scripts inline das páginas têm sintaxe válida',()=>{for(const file of ['index.html','admin.html','vip.html']){const source=fs.readFileSync(path.join(__dirname,'../public',file),'utf8');for(const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){if(match[1].trim())new vm.Script(match[1],{filename:file});}}});
test('páginas não contêm os principais números fictícios',()=>{const vip=fs.readFileSync(path.join(__dirname,'../public/vip.html'),'utf8');assert.ok(!vip.includes('1.428'));assert.ok(!vip.includes('85%'));assert.ok(!vip.includes('gastoMedio * 0.40'));const admin=fs.readFileSync(path.join(__dirname,'../public/admin.html'),'utf8');assert.ok(!admin.includes('totalGross * 0.08'));});
test('migração SQLite é idempotente e preserva dados existentes',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'shopee-schema-')),database=path.join(tmp,'test.db');
 const {DatabaseSync}=require('node:sqlite');const old=new DatabaseSync(database);
 old.exec("CREATE TABLE products(id INTEGER PRIMARY KEY,title TEXT NOT NULL,description TEXT,price_original REAL,price_discount REAL NOT NULL,discount_pct INTEGER,category TEXT,image_url TEXT NOT NULL,affiliate_link TEXT NOT NULL,badge TEXT,clicks INTEGER DEFAULT 0,is_active INTEGER DEFAULT 1,created_at DATETIME DEFAULT CURRENT_TIMESTAMP);CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);INSERT INTO products(id,title,price_discount,image_url,affiliate_link,clicks) VALUES(9,'Preservar',20,'image','link',7);INSERT INTO settings VALUES('admin_password','fixture-only');");old.close();
 const source=fs.readFileSync(path.join(__dirname,'../db.js'),'utf8');
 for(let n=0;n<2;n++){
  const sandbox={require:name=>name==='./lib/env'?{}:require(name),process:{env:{SHOPEE_DB_PATH:database}},__dirname:tmp,module:{exports:{}}};vm.runInNewContext(source,sandbox);const db=sandbox.module.exports;assert.equal(db.prepare('SELECT clicks FROM products WHERE id=9').get().clicks,7);assert.equal(db.prepare("SELECT value FROM settings WHERE key='admin_password'").get().value,'fixture-only');assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='dispatch_history'").get());db.close();
 }
});
