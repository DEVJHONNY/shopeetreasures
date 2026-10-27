async function loadRealAnalytics(){
  try {
    const r=await fetch(API_BASE+'/api/admin/analytics?days=7',{headers:{Authorization:'Bearer '+authToken}});
    if(!r.ok)throw new Error();
    const data=await r.json();
    document.getElementById('statClicks').textContent=Number(data.total).toLocaleString('pt-BR');
    let notice=document.getElementById('analyticsNotice');
    if(!notice){notice=document.createElement('p');notice.id='analyticsNotice';document.getElementById('statClicks').closest('.stat-card').append(notice);}
    notice.textContent=(data.scope==='site_local'?'Painel local':'Site público')+' • últimos 7 dias. Cliques não são vendas.'+(data.scope==='site_publico'?' Pode haver atraso na atualização.':'');
    // O gráfico usa o mesmo período do total, sem atribuir tráfego a produtos aleatórios.
    if(Array.isArray(allAdminProducts))renderCrmCharts(allAdminProducts.map(p=>({...p,clicks:data.by_product[p.id]||0})));
  } catch {document.getElementById('statClicks').textContent='Indisponível';}
}
