const shopeeApi = require('./shopee_api');

async function testSearch() {
  const kws = ['pula pula', 'piscina de bolinha'];
  for (const kw of kws) {
    console.log(`\n--- Testando busca por: "${kw}" ---`);
    try {
      const res = await shopeeApi.fetchTopOffers({ keyword: kw, limit: 10 });
      console.log(`Total retornado: ${res.length}`);
      if (res.length > 0) {
        res.forEach((item, i) => {
          console.log(`[${i+1}] ${item.productName} | R$ ${item.priceMin} | Vendas: ${item.sales} | Rating: ${item.ratingStar} | Link: ${item.offerLink}`);
        });
      } else {
        console.log('Nenhum resultado retornado da API da Shopee.');
      }
    } catch (err) {
      console.error('Erro na API:', err.message);
    }
  }
}

testSearch();
