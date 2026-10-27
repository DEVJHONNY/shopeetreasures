'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const schedule=require('../lib/schedule'),offers=require('../lib/offers');
const fixed=new Date('2026-10-27T15:05:00Z');
function botFixture(send){
  const db=new DatabaseSync(':memory:');
  db.exec("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE products(id INTEGER PRIMARY KEY,source_item_id TEXT);CREATE TABLE dispatch_history(id INTEGER PRIMARY KEY,source_key TEXT,title TEXT,day_key TEXT,slot TEXT,kind TEXT,status TEXT,created_at INTEGER,UNIQUE(day_key,slot));");
  const product={itemId:12345,productName:'Produto de teste',priceMin:20,offerLink:'https://s.shopee.com.br/example'};
  const sandbox={module:{exports:{}},__dirname:'/fixture-only',console:{log(){},warn(){},error(){}},process:{env:{}},setInterval:()=>1,clearInterval(){},setTimeout(){},Date,
    require:name=>{
      if(name==='./db.js')return db;
      if(name==='fs')return {existsSync:()=>false,mkdirSync(){}};
      if(name==='./lib/offers')return offers;
      if(name==='./lib/schedule')return {...schedule,clockParts:()=>schedule.clockParts(fixed),dueSlot:(c,a)=>schedule.dueSlot(c,a,fixed)};
      if(name==='./shopee_api')return {fetchProductById:async()=>product};
      if(name==='./promo_bot')return {generatePromos:async()=>({products:[product,{...product,itemId:67890}]})};
      if(['path','node:crypto'].includes(name))return require(name);
      throw Error('Dependência não permitida no teste: '+name);
    },sendStub:send};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../whatsapp_bot.js'),'utf8'),sandbox);
  vm.runInContext("connectionStatus='connected';targetGroupJid='fixture-group';sock={sendMessage:sendStub};",sandbox);
  sandbox.module.exports.setConfig({categories:['Casa & Cozinha'],slots:['12:00','19:00'],maxDaily:2});
  return {bot:sandbox.module.exports,db,product};
}
test('reserva persistida impede repetir o mesmo horário após falha ambígua',async()=>{
 let sends=0;const f=botFixture(async()=>{sends++;throw Error('Conexão perdida');});
 try{await assert.rejects(f.bot.dispatchOffer(null,false,{slot:'12:00'}),/Conexão perdida/);await assert.rejects(f.bot.dispatchOffer(null,false,{slot:'12:00'}));assert.equal(sends,1);assert.equal(f.db.prepare('SELECT status FROM dispatch_history').get().status,'failed');}finally{f.db.close();}
});
test('envios concorrentes não duplicam a mensagem e formato informa afiliação',async()=>{
 let release,sends=0,caption='';const gate=new Promise(resolve=>release=resolve);
 const f=botFixture(async(_,message)=>{sends++;caption=message.text||message.caption;await gate;});
 try{const first=f.bot.dispatchOffer(f.product,true);await assert.rejects(f.bot.dispatchOffer(f.product,true),/andamento/);release();await first;assert.equal(sends,1);assert.match(caption,/comissão/);assert.equal(f.db.prepare('SELECT status FROM dispatch_history').get().status,'sent');}finally{f.db.close();}
});
test('configuração inválida mantém as preferências anteriores',()=>{
 const f=botFixture(async()=>{});try{assert.throws(()=>f.bot.setConfig({slots:['00:00'],maxDaily:99}));assert.deepEqual(Array.from(f.bot.getStatus().slots),['12:00','19:00']);assert.equal(f.bot.getStatus().maxDaily,2);}finally{f.db.close();}
});
