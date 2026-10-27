'use strict';
const crypto=require('node:crypto');
const {affiliateUrl}=require('./offers');
function createClient(env=process.env, request=global.fetch) {
  async function executeQuery(query) {
    if(env.SHOPEE_SAFE_MODE==='1') {
      if(query.includes('generateShortLink')) throw new Error('Conversão externa desabilitada na prévia.');
      const all=[{itemId:900001,productName:'EXEMPLO — Organizador de cozinha',priceMin:29.9,priceDiscountRate:30,ratingStar:4.8,sales:120,shopName:'Loja de exemplo',offerLink:'https://shopee.com.br/',imageUrl:'/icons/icon-192.png'},{itemId:900002,productName:'EXEMPLO — Kit de cuidados pessoais',priceMin:39.9,priceDiscountRate:35,ratingStar:4.9,sales:80,shopName:'Loja de exemplo',offerLink:'https://shopee.com.br/',imageUrl:'/icons/icon-192.png'}];
      const match=query.match(/itemId:\s*"?(\d+)/);
      return {data:{productOfferV2:{nodes:match?all.filter(p=>String(p.itemId)===match[1]):all}}};
    }
    const app=env.SHOPEE_APP_ID, secret=env.SHOPEE_SECRET;
    if(!app||!secret) throw new Error('Configure SHOPEE_APP_ID e SHOPEE_SECRET no ambiente.');
    const payload=JSON.stringify({query}),timestamp=Math.floor(Date.now()/1000);
    const signature=crypto.createHash('sha256').update(app+timestamp+payload+secret).digest('hex');
    const res=await request('https://open-api.affiliate.shopee.com.br/graphql',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`SHA256 Credential=${app}, Timestamp=${timestamp}, Signature=${signature}`},body:payload,signal:AbortSignal.timeout(15000)});
    if(!res.ok) throw new Error(`A Shopee respondeu HTTP ${res.status}.`);
    const result=await res.json();
    if(result.errors?.length) throw new Error('A Shopee não conseguiu concluir a consulta. Confira as credenciais e os parâmetros.');
    return result;
  }
  const fields='itemId productName priceMin priceMax priceDiscountRate imageUrl offerLink sales ratingStar shopName';
  async function fetchTopOffers({keyword='',page=1,limit=20}={}) {
    page=Math.min(100,Math.max(1,parseInt(page,10)||1)); limit=Math.min(50,Math.max(1,parseInt(limit,10)||20));
    const q=`query { productOfferV2(keyword: ${JSON.stringify(String(keyword).slice(0,150))}, page: ${page}, limit: ${limit}) { nodes { ${fields} } } }`;
    return (await executeQuery(q)).data?.productOfferV2?.nodes||[];
  }
  async function fetchProductById(id) {
    if(!/^\d{1,20}$/.test(String(id))) return null;
    const result=await executeQuery(`query { productOfferV2(itemId: "${id}", limit: 1) { nodes { ${fields} } } }`);
    return result.data?.productOfferV2?.nodes?.find(p=>String(p.itemId)===String(id))||null;
  }
  async function generateAffiliateLink(url) {
    const safe=affiliateUrl(url); if(!safe) throw new Error('Use um link HTTPS da Shopee.');
    const result=await executeQuery(`mutation { generateShortLink(input: { originUrl: ${JSON.stringify(safe)} }) { shortLink } }`);
    const link=affiliateUrl(result.data?.generateShortLink?.shortLink);
    if(!link) throw new Error('Não foi possível gerar um link de afiliado válido.');
    return link;
  }
  return {fetchTopOffers,fetchProductById,generateAffiliateLink};
}
module.exports={createClient};
