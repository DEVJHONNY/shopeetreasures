const crypto = require('crypto');

const APP_ID = '18305010276';
const SECRET = '5V4WXVRMCB4NWPH2VFGNNJE4ZSGLTINT';
const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

async function testShopeeApi() {
  const query = `
    query {
      productOfferV2(page: 1, limit: 5) {
        nodes {
          itemId
          productName
          priceMin
          priceMax
          priceDiscountRate
          imageUrl
          offerLink
          sales
          ratingStar
        }
      }
    }
  `;

  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);

  // Shopee Affiliate API Signature: SHA256(appId + timestamp + payload + secret)
  const factor = APP_ID + timestamp + payload + SECRET;
  const signature = crypto.createHash('sha256').update(factor).digest('hex');

  const authHeader = `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`;

  console.log('Sending request to Shopee Affiliate GraphQL...');
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: payload
    });

    const data = await res.json();
    console.log('Status HTTP:', res.status);
    console.log('Resposta da Shopee API:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erro na requisição:', err);
  }
}

testShopeeApi();
