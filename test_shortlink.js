const crypto = require('crypto');

const APP_ID = '18305010276';
const SECRET = '5V4WXVRMCB4NWPH2VFGNNJE4ZSGLTINT';
const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

async function testGenerateShortLink() {
  const query = `
    mutation {
      generateShortLink(input: { originUrl: "https://shopee.com.br/m/ofertas-do-dia" }) {
        shortLink
      }
    }
  `;

  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const factor = APP_ID + timestamp + payload + SECRET;
  const signature = crypto.createHash('sha256').update(factor).digest('hex');
  const authHeader = `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`;

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
    console.log('ShortLink resultado:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erro na requisição:', err);
  }
}

testGenerateShortLink();
