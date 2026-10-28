'use strict';
const positive = v => Number.isFinite(Number(v)) && Number(v)>0 ? Number(v) : null;
function affiliateUrl(value) {
  try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password && ['shopee.com.br','www.shopee.com.br','s.shopee.com.br','shope.ee'].includes(u.hostname) ? u.href : null; } catch { return null; }
}
function normalizeOffer(item, category='Achadinhos') {
  const price=positive(item.priceMin??item.priceCurrent??item.price_discount??item.priceMax);
  const rating=positive(item.ratingStar??item.rating);
  const discount=Number(item.priceDiscountRate??item.discountPct??item.discount_pct??0);
  const original=positive(item.originalPrice??item.price_original);
  return { id:item.itemId??item.id, source_item_id:String(item.itemId??item.source_item_id??''),
    title:String(item.productName??item.title??'').trim(), description:'Confira características, variante, frete e condições no anúncio da Shopee.',
    price_discount:price, price_original:original&&original>price?original:null,
    discount_pct:Number.isFinite(discount)&&discount>0&&discount<100?discount:null,
    rating:rating&&rating<=5?rating:null, category:item.category||category,
    affiliate_link:affiliateUrl(item.offerLink??item.affiliate_link), image_url:item.imageUrl??item.image_url??'',
    shop_name:item.shopName??item.shop_name??null,
    sales_count:item.salesCount??item.sales_count??(item.sales!=null&&Number.isFinite(Number(item.sales))?`${Number(item.sales)} vendidos`:null),
    badge:'Seleção de ofertas', clicks:null, is_active:1, checked_at:item.checked_at||new Date().toISOString() };
}
function formatOffer(item) {
  const p=normalizeOffer(item), money=v=>v.toFixed(2).replace('.',',');
  if(!p.title||!p.price_discount||!p.affiliate_link) throw new Error('Oferta incompleta: confira título, preço e link de afiliado.');
  const lines=[`🛍️ *${p.title}*`,'',`💰 Preço anunciado: *R$ ${money(p.price_discount)}*`];
  if(p.price_original) lines.push(`Preço de referência informado: R$ ${money(p.price_original)}`);
  if(p.discount_pct) lines.push(`Desconto informado no anúncio: ${p.discount_pct}%`);
  if(p.rating) lines.push(`⭐ Avaliação no anúncio: ${p.rating.toFixed(1)}/5`);
  if(p.shop_name) lines.push(`🏪 ${p.shop_name}`);
  lines.push('','🛒 Confira a opção e as condições:',p.affiliate_link,'','Preço, frete e disponibilidade podem mudar. Confira a variante antes de comprar.','Link de afiliado: posso receber comissão pela compra.','ShopeeTreasures • curadoria independente');
  return lines.join('\n');
}
module.exports={positive,affiliateUrl,normalizeOffer,formatOffer};
