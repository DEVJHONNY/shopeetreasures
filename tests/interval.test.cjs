'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateConfig,dueSlot}=require('../lib/schedule');
const {publicState}=require('../lib/bot-monitor');
test('intervalo respeita 15 minutos, falha persistida, reinício e virada do dia',()=>{
 const start=Date.parse('2026-10-28T02:58:00Z');
 const config=validateConfig({mode:'interval',intervalMinutes:15,anchor:start});
 assert.equal(dueSlot(config,[],new Date(start+899999)),null);
 const due=dueSlot(config,[],new Date(start+900000));assert.ok(due);
 const attempts=[{...due,day_key:due.day,kind:'automatic',created_at:start+900000,status:'failed'}];
 assert.equal(dueSlot(config,attempts,new Date(start+1799999)),null);
 assert.ok(dueSlot(config,attempts,new Date(start+1800000)));
 assert.equal(dueSlot(config,attempts,new Date(start+900000)),null);
});
test('intervalo não tem o antigo limite diário e não acumula atrasados',()=>{
 const now=Date.parse('2026-10-28T18:00:00Z');const config=validateConfig({mode:'interval',anchor:now-86400000});
 const attempts=Array.from({length:5},(_,i)=>({kind:'automatic',created_at:now-(i+1)*900000}));
 const due=dueSlot(config,attempts,new Date(now));assert.ok(due);
 attempts.push({kind:'automatic',day_key:due.day,slot:due.slot,created_at:now});
 assert.equal(dueSlot(config,attempts,new Date(now)),null);
 assert.throws(()=>validateConfig({mode:'interval',intervalMinutes:0}));
});
test('monitor publica estado real sem senha, QR ou identificador do grupo',()=>{
 const snapshot=publicState({status:'connected',isAutoPostEnabled:true,dispatchInFlight:true,intervalMinutes:15,qrCode:'private',targetGroupJid:'private',user:{id:'private'}},100);
 assert.equal(snapshot.state,'sending');assert.equal(snapshot.updatedAt,100);
 assert.ok(!JSON.stringify(snapshot).includes('private'));
 assert.equal(publicState({status:'connected',isAutoPostEnabled:false}).state,'paused');
 assert.equal(publicState({status:'disconnected'}).state,'disconnected');
});
