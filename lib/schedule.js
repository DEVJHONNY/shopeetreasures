'use strict';
const ZONE='America/Sao_Paulo';
const CATEGORIES=['Casa & Cozinha','Beleza','Eletrônicos','Moda','Acessórios','Bebês & Crianças'];
const KEYWORDS={'Casa & Cozinha':['organizador cozinha','utensilios cozinha'],'Beleza':['cuidados pessoais','skincare'],'Eletrônicos':['fone bluetooth','cabo usb'],'Moda':['camiseta','tenis'],'Acessórios':['mochila','garrafa termica'],'Bebês & Crianças':['fralda','brinquedo infantil']};
function clockParts(now=new Date()) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  return {day:`${p.year}-${p.month}-${p.day}`,minutes:Number(p.hour)*60+Number(p.minute)};
}
function validateConfig(input) {
  const slots=input.slots||['12:00','19:00'];
  if(!Array.isArray(slots)||slots.length<1||slots.length>4||slots.some(s=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))) throw new Error('Use de 1 a 4 horários no formato HH:MM.');
  const unique=[...new Set(slots)].sort();
  if(unique.length!==slots.length||unique.some(s=>s<'08:00'||s>'21:00')) throw new Error('Escolha horários diferentes entre 08:00 e 21:00.');
  const categories=input.categories||[];
  if(!Array.isArray(categories)||categories.length>3||categories.some(c=>!CATEGORIES.includes(c))) throw new Error('Escolha até três categorias válidas.');
  const maxDaily=Number(input.maxDaily??2);
  if(!Number.isInteger(maxDaily)||maxDaily<1||maxDaily>4) throw new Error('O limite diário deve ficar entre 1 e 4.');
  return {slots:unique,categories:[...new Set(categories)],maxDaily};
}
function dueSlot(config,attempts,now=new Date()) {
  const {day,minutes}=clockParts(now), today=attempts.filter(a=>a.day_key===day&&a.kind==='automatic');
  if(today.length>=config.maxDaily||!config.categories.length) return null;
  for(const slot of config.slots) {const [h,m]=slot.split(':').map(Number), start=h*60+m; if(minutes>=start&&minutes<start+15&&!today.some(a=>a.slot===slot)) return {day,slot};}
  return null;
}
module.exports={ZONE,CATEGORIES,KEYWORDS,clockParts,validateConfig,dueSlot};
