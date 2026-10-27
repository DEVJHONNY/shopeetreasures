// Favoritos ficam somente neste navegador; preços são consultados novamente ao abrir.
(function(){
  const key='shopeetreasures_saved_v1';
  function saved(){try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.slice(0,50):[];}catch{return [];}}
  const dialog=document.createElement('dialog');dialog.id='savedOffersDialog';
  dialog.style.cssText='border:1px solid #ddd;border-radius:20px;padding:24px;width:min(92vw,520px);max-height:80vh;color:#172026';
  dialog.innerHTML='<button id="closeSaved" style="float:right;padding:8px" aria-label="Fechar ofertas salvas">✕</button><h2>Suas ofertas salvas</h2><p style="margin:12px 0">Ficam neste navegador. Confirme o preço no anúncio antes de comprar.</p><div id="savedOffersList"></div>';
  document.body.append(dialog);dialog.querySelector('#closeSaved').onclick=()=>dialog.close();
  const button=document.createElement('button');button.textContent='☆ Ofertas salvas';button.style.cssText='position:fixed;left:16px;bottom:20px;z-index:900;background:#fff;color:#b83a22;border:1px solid #edc8bf;border-radius:24px;padding:12px 16px;box-shadow:0 4px 16px #0002';
  button.setAttribute('aria-live','polite');
  document.body.append(button);button.onclick=()=>{render();dialog.showModal();};
  function render(){
    const list=dialog.querySelector('#savedOffersList');list.replaceChildren();
    for(const item of saved()){
      const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;padding:12px 0;border-bottom:1px solid #eee';
      const open=document.createElement('button');open.textContent=item.title;open.style.cssText='flex:1;text-align:left;background:none;border:0;color:#ad321c;padding:8px';
      open.onclick=()=>{dialog.close();openProductById(item.id,true,true);};
      const remove=document.createElement('button');remove.textContent='Remover';remove.onclick=()=>{try{localStorage.setItem(key,JSON.stringify(saved().filter(s=>String(s.id)!==String(item.id))));render();}catch{alert('Não foi possível atualizar os favoritos.');}};
      row.append(open,remove);list.append(row);
    }
    if(!list.children.length)list.textContent='Use a estrela de uma oferta para encontrá-la aqui depois.';
  }
  window.toggleSavedOffer=id=>{
    const product=productsList.find(p=>String(p.id)===String(id));if(!product)return;
    const list=saved(),existing=list.find(p=>String(p.id)===String(id));
    try {localStorage.setItem(key,JSON.stringify(existing?list.filter(p=>String(p.id)!==String(id)):[{id:product.id,title:product.title},...list].slice(0,50)));button.textContent=existing?'☆ Oferta removida':'★ Oferta salva';setTimeout(()=>button.textContent='☆ Ofertas salvas',1800);}catch{alert('Seu navegador não permitiu salvar a oferta.');}
  };
})();

// O diálogo de produto mantém o teclado dentro dele e fecha com Escape.
document.addEventListener('keydown',event=>{
  const modal=document.getElementById('productModal');
  if(modal.style.display!=='flex')return;
  if(event.key==='Escape'){event.preventDefault();closeProductModal();return;}
  if(event.key!=='Tab')return;
  const controls=[...modal.querySelectorAll('a[href],button,input,select,[tabindex="0"]')].filter(el=>el.offsetParent!==null&&!el.disabled);
  const first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});
