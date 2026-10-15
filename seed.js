const db = require('./db');

try {
  db.exec("ALTER TABLE products ADD COLUMN sales_count TEXT DEFAULT '1,2 mil vendidos';");
} catch (e) {}

try {
  db.exec("ALTER TABLE products ADD COLUMN rating REAL DEFAULT 4.8;");
} catch (e) {}

try {
  db.exec("ALTER TABLE products ADD COLUMN shop_name TEXT DEFAULT 'Loja Parceira Verificada';");
} catch (e) {}

try {
  db.exec("ALTER TABLE products ADD COLUMN video_url TEXT;");
} catch (e) {}

// Clear and seed rich Shopee catalog
db.exec('DELETE FROM products;');

const insert = db.prepare(`
  INSERT INTO products (title, description, price_original, price_discount, discount_pct, category, image_url, affiliate_link, badge, sales_count, rating, shop_name, video_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const items = [
  ['Fone de Ouvido Bluetooth Sem Fio TWS Display LED Graves Potentes', 'Fone de ouvido estéreo de alta fidelidade com display digital de bateria e cancelamento de ruído passivo.', 89.90, 24.90, 72, 'Eletrônicos', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Indicado', '14,8 mil vendidos', 4.9, 'TechWorld Brasil', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'],
  ['Copo Térmico Inox 473ml com Tampa e Abridor Mantém Gelado', 'Aço inoxidável 304 com parede dupla e isolamento a vácuo para bebidas geladas por até 12 horas.', 65.00, 27.90, 57, 'Casa & Cozinha', 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Destaque', '22,4 mil vendidos', 4.8, 'TermoLar Utilidades', null],
  ['Mini Processador Elétrico de Alimentos USB Triturador Alho Legumes', '3 lâminas em aço inox cirúrgico com motor de 30W recarregável via USB para preparar temperos em segundos.', 49.90, 18.99, 62, 'Casa & Cozinha', 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Indicado', '35,1 mil vendidos', 4.9, 'Cozinha Prática Oficial', null],
  ['Luminária Projetor Galáxia Astronauta LED com Controle Remoto', 'Efeito nebulosa estrelada 360 graus com controle remoto e temporizador automático para quartos.', 149.90, 54.90, 63, 'Decoração', 'https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Destaque', '8,9 mil vendidos', 4.9, 'Galaxy Lamps Import', null],
  ['Garrafa Motivacional 2 Litros com Canudo Marcador de Horário', 'Acompanha kit de adesivos 2D e 3D, trava de segurança ergonômica e alça de transporte reforçada.', 39.90, 16.50, 59, 'Esportes', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Indicado', '42,6 mil vendidos', 4.8, 'VidaFit Store', null],
  ['Escova Secadora e Alisadora de Cabelo Multifuncional 1200W', 'Cerdas flexíveis com pontas arredondadas massageadoras, revestimento cerâmico e íons anti-frizz.', 119.00, 49.90, 58, 'Beleza', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Destaque', '19,3 mil vendidos', 4.7, 'Beauty Express Brasil', null],
  ['Smartwatch Relógio Inteligente D20 Rastreador Notificações', 'Sensor biométrico cardíaco, contador de passos, calorias e espelhamento de notificações do celular.', 75.00, 22.90, 69, 'Eletrônicos', 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Indicado', '58,2 mil vendidos', 4.6, 'SmartEletronics Store', null],
  ['Ring Light Iluminador LED 26cm com Tripé Ajustável para Celular', '3 modos de temperatura de luz com ajuste de intensidade de 10 níveis alimentado por porta USB.', 69.90, 26.90, 61, 'Acessórios', 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Indicado', '11,4 mil vendidos', 4.8, 'Studio Criativo Tech', null],
  ['Máquina de Cortar Cabelo e Barba Dragão Vintage Recarregável T9', 'Lâmina em T de titânio ultra afiada para acabamentos precisos e desenhos capilares sem machucar a pele.', 59.90, 21.90, 63, 'Beleza', 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Indicado', '28,9 mil vendidos', 4.9, 'Barber Shop Prime', null],
  ['Kit 10 Pares de Meias Invisíveis Algodão Macias Confortáveis', 'Cano sapatilha unissex confeccionada em algodão penteado de toque suave e alta absorção.', 45.00, 19.90, 56, 'Moda', 'https://images.unsplash.com/photo-1582966779680-97eb3388a1a3?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Destaque', '64,1 mil vendidos', 4.9, 'ConfortMeias Oficial', null],
  ['Suporte Veicular Magnético de Celular para Saída de Ar Carro', 'Conjunto de 6 ímãs de neodímio N52 com revestimento emborrachado para fixação estável mesmo em buracos.', 29.90, 11.90, 60, 'Automotivo', 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Indicado', '31,5 mil vendidos', 4.8, 'AutoTech Acessórios', null],
  ['Robô Aspirador de Pó Inteligente Varre e Aspira USB Automático', 'Tecnologia de navegação autônoma com sensores antiqueda e bateria de lítio de longa duração.', 189.90, 79.90, 58, 'Casa & Cozinha', 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80', 'https://shopee.com.br/', 'Destaque', '7,4 mil vendidos', 4.7, 'HomeSmart Eletro', null]
];

for (const it of items) {
  insert.run(...it);
}

console.log('Catalogo ShopeeTreasures semeado com sucesso! Total:', items.length);
