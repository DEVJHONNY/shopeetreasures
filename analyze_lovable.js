async function analyze() {
  try {
    const res = await fetch('https://shopeetreasuresoficial.lovable.app/assets/index-advzUsZf.js');
    const text = await res.text();
    console.log('Tamanho total do JS:', (text.length / 1024).toFixed(1), 'KB');

    // 1. Procurar links da Shopee
    const shopeeLinks = text.match(/https?:\/\/[^\s"'`]+shopee[^\s"'`]+/g) || [];
    const uniqueLinks = [...new Set(shopeeLinks)];
    console.log('\n--- Links da Shopee encontrados no site (' + uniqueLinks.length + ') ---');
    uniqueLinks.slice(0, 15).forEach(l => console.log(' ->', l));

    // 2. Procurar produtos / objetos
    const titles = text.match(/title:\s*"[^"]+"/g) || [];
    console.log('\n--- Títulos/Textos de Produtos (' + titles.length + ') ---');
    titles.slice(0, 10).forEach(t => console.log(' ->', t));

    // 3. Procurar categorias
    const catMatches = text.match(/category:\s*"[^"]+"/g) || [];
    console.log('\n--- Categorias (' + catMatches.length + ') ---');
    [...new Set(catMatches)].forEach(c => console.log(' ->', c));

    // 4. Procurar número de WhatsApp ou contatos
    const phoneMatches = text.match(/55\d{10,11}/g) || [];
    console.log('\n--- Telefones/WhatsApp ---', [...new Set(phoneMatches)]);

    // 5. Procurar Supabase ou Backend
    const supabaseMatches = text.match(/https?:\/\/[^\s"'`]+supabase[^\s"'`]+/g) || [];
    console.log('\n--- Conexão Supabase / Backend ---', [...new Set(supabaseMatches)]);

  } catch (err) {
    console.error('Erro:', err);
  }
}

analyze();
