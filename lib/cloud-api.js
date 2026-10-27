'use strict';
const crypto=require('node:crypto');
const {normalizeOffer,formatOffer}=require('./offers');
const {CATEGORIES}=require('./schedule');
const DEFAULTS={site_title:'ShopeeTreasures',site_subtitle:'Ofertas para o que você precisa comprar.',site_badge:'Curadoria independente',site_disclaimer:'Vitrine independente. Links de afiliado podem gerar comissão. Preços, frete e disponibilidade variam.',whatsapp_link:'https://chat.whatsapp.com/KjHrqfJp3HuIHQiR8Zfl3L',instagram_link:'https://instagram.com/'};
function json(statusCode,body){return {statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)};}
function authorized(event,env){const expected=env.ADMIN_PASSWORD||env.ADMIN_TOKEN, actual=(event.headers?.authorization||event.headers?.Authorization||'').replace(/^Bearer /,'');return !!expected&&Buffer.byteLength(expected)===Buffer.byteLength(actual)&&crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual));}
function createHandler({api,getStore,env=process.env}) {
  async function products(keyword='',page=1,cat='Achadinhos') {return (await api.fetchTopOffers({keyword,page,limit:30})).map(p=>normalizeOffer(p,cat)).filter(p=>p.title&&p.price_discount&&p.affiliate_link);}
  async function product(id){const p=await api.fetchProductById(id); if(!p)return null;const n=normalizeOffer(p);return n.price_discount&&n.affiliate_link?n:null;}
  async function summary(store,days=30){
    const counts={},byDay={},byChannel={}; let total=0;
    for(let n=0;n<days;n++) {
      const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-n*86400000));
      for await(const page of store.list({prefix:`clicks/${day}/`,paginate:true})) for(const blob of page.blobs){
        const parts=blob.key.split('/');const id=parts[2],channel=parts[3];counts[id]=(counts[id]||0)+1;byDay[day]=(byDay[day]||0)+1;byChannel[channel]=(byChannel[channel]||0)+1;total++;
      }
    }
    return {available:true,days,total,by_product:counts,by_day:byDay,by_channel:byChannel,scope:'site_publico',sales:null,notice:'Cliques registrados, não pessoas únicas nem vendas. Contagem inclui possíveis acessos automatizados.'};
  }
  return async event=>{
    const method=event.httpMethod||'GET'; let route=(event.path||'').replace('/.netlify/functions/api',''); if(!route.startsWith('/api'))route='/api'+route;
    const q=event.queryStringParameters||{};let body={};
    if(method==='OPTIONS')return json(204,{});
    if(event.body){if(event.body.length>16000)return json(413,{error:'Corpo muito grande.'});try{body=JSON.parse(event.body);}catch{return json(400,{error:'JSON inválido.'});}}
    try {
      if(route==='/api/admin/login'&&method==='POST'){
        if(!env.ADMIN_PASSWORD&&!env.ADMIN_TOKEN)return json(503,{error:'Configure a senha do administrador no ambiente.'});
        if(!authorized({headers:{authorization:`Bearer ${body.password||''}`}},env))return json(401,{error:'Senha incorreta.'});
        return json(200,{success:true,token:env.ADMIN_PASSWORD||env.ADMIN_TOKEN});
      }
      if((route.startsWith('/api/admin/')||method!=='GET')&&!authorized(event,env)&&!/^\/api\/click\/\d+$/.test(route))return json(401,{error:'Não autorizado.'});
      if(route==='/api/settings'&&method==='GET'){
        try {return json(200,{...DEFAULTS,...await (await getStore(event)).get('config/public',{type:'json'})});}catch{return json(200,{...DEFAULTS,storage_available:false});}
      }
      if(route==='/api/settings'&&method==='POST'){
        const store=await getStore(event),previous=await store.get('config/public',{type:'json'})||{}; const next={...previous};
        for(const k of Object.keys(DEFAULTS))if(body[k]!=null)next[k]=String(body[k]).slice(0,1000);
        if(next.whatsapp_link&&!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+$/.test(next.whatsapp_link))return json(400,{error:'Link de convite inválido.'});
        if(next.instagram_link&&!/^https:\/\/(www\.)?instagram\.com\//.test(next.instagram_link))return json(400,{error:'Link do Instagram inválido.'});
        await store.setJSON('config/public',next);return json(200,{success:true});
      }
      if(route==='/api/categories')return json(200,['Todos','Destaques',...CATEGORIES,'Achadinhos VIP']);
      if(route==='/api/admin/analytics'&&method==='GET')return json(200,await summary(await getStore(event),Math.min(30,Math.max(1,parseInt(q.days)||7))));
      if(route==='/api/admin/whatsapp/status')return json(200,{status:'unavailable',isAutoPostEnabled:false,intervalMinutes:null,dispatchedLog:[],message:'O WhatsApp é controlado pelo painel local. Este site não confirma conexão nem envia mensagens.'});
      if(route.startsWith('/api/admin/whatsapp/'))return json(409,{error:'Use o painel local para controlar o WhatsApp.'});
      if(route==='/api/admin/cron-status')return json(200,{enabled:false,mode:'on_demand',lastSync:null,nextSync:null,intervalHours:null,lastCount:null});
      if(route==='/api/admin/cron-config')return json(409,{error:'A vitrine pública consulta a Shopee ao carregar; agendamento pertence ao painel local.'});
      if(route==='/api/admin/cron-trigger'){await products();return json(200,{success:true,message:'Consulta à Shopee concluída.'});}
      const detail=route.match(/^\/api\/products\/(\d{1,20})$/),redirect=route.match(/^\/api\/r\/(\d{1,20})$/),click=route.match(/^\/api\/click\/(\d{1,20})$/);
      if(detail&&method==='GET'){const p=await product(detail[1]);return p?json(200,p):json(404,{error:'Oferta indisponível.'});}
      if(redirect&&method==='GET'){const p=await product(redirect[1]);return p?{statusCode:302,headers:{Location:p.affiliate_link,'Cache-Control':'no-store'},body:''}:json(404,{error:'Oferta indisponível.'});}
      if(click&&method==='POST'){
        if(!/^[a-f0-9-]{36}$/i.test(body.event_id||''))return json(400,{error:'Identificador de evento inválido.'});
        if(!await product(click[1]))return json(404,{error:'Oferta indisponível.'});
        const channel=['site','grupo','status'].includes(body.channel)?body.channel:'site';
        const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const result=await (await getStore(event)).setJSON(`clicks/${day}/${click[1]}/${channel}/${body.event_id}`,{product_id:click[1],channel,at:new Date().toISOString()},{onlyIfNew:true});
        return json(200,{success:true,recorded:result.modified!==false});
      }
      if(['/api/products','/api/shopee/load-more','/api/homepage/flash-sale','/api/admin/products'].includes(route)&&method==='GET'){
        const cat=q.cat&&q.cat!=='Todos'?q.cat:'',keyword=String(q.q||cat||'').slice(0,150),page=Math.min(100,Math.max(1,parseInt(q.page)||1));
        let list=await products(keyword,page,cat||'Achadinhos');
        list=list.filter(p=>p.price_discount>=(Number(q.minPrice)||0)&&p.price_discount<=(Number(q.maxPrice)||Infinity));
        if(route==='/api/homepage/flash-sale')list=list.filter(p=>p.discount_pct>=30&&p.rating>=4.8).slice(0,10);
        if(q.sort==='price_asc')list.sort((a,b)=>a.price_discount-b.price_discount);
        if(q.sort==='price_desc')list.sort((a,b)=>b.price_discount-a.price_discount);
        if(q.sort==='discount_desc')list.sort((a,b)=>(b.discount_pct||0)-(a.discount_pct||0));
        if(route==='/api/admin/products'){try{const stats=await summary(await getStore(event),7);list=list.map(p=>({...p,clicks:stats.by_product[p.id]||0,clicks_period_days:7}));}catch{list=list.map(p=>({...p,clicks:null}));}}
        return json(200,route==='/api/shopee/load-more'?{success:true,products:list,newImported:list.length,total:list.length}:list);
      }
      if(route==='/api/shopee/convert-link'&&method==='POST')return json(200,{success:true,shortLink:await api.generateAffiliateLink(body.url)});
      if(['/api/promo/latest','/api/promo/generate'].includes(route)){
        const list=(await products()).filter(p=>p.rating>=4.8&&p.discount_pct>=30).slice(0,10);
        const messages=list.map(formatOffer);return json(200,{success:true,generated_at:new Date().toISOString(),total_products:list.length,products:list.map(p=>({...p,itemId:p.id,productName:p.title,priceCurrent:p.price_discount,originalPrice:p.price_original,discountPct:p.discount_pct,ratingStar:p.rating,salesCount:p.sales_count,shopName:p.shop_name,imageUrl:p.image_url,offerLink:p.affiliate_link})),individual_messages:messages,digest:messages.join('\n\n────────\n\n')});
      }
      return json(404,{error:'Rota não encontrada.'});
    } catch(error) {return json(503,{error:'Serviço temporariamente indisponível. Confira a configuração e tente novamente.',success:false});}
  };
}
module.exports={createHandler};
