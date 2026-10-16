const crypto = require('crypto');

const APP_ID = process.env.SHOPEE_APP_ID || '18305010276';
const SECRET = process.env.SHOPEE_SECRET || '5V4WXVRMCB4NWPH2VFGNNJE4ZSGLTINT';
const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

/**
 * Executes a GraphQL query against the official Shopee Affiliate API
 */
async function executeQuery(query) {
  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const factor = APP_ID + timestamp + payload + SECRET;
  const signature = crypto.createHash('sha256').update(factor).digest('hex');
  const authHeader = `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: payload
  });

  return await res.json();
}

/**
 * Convert any regular Shopee URL into the user's tracked affiliate link
 */
async function generateAffiliateLink(originUrl) {
  const query = `
    mutation {
      generateShortLink(input: { originUrl: "${originUrl.replace(/"/g, '\\"')}" }) {
        shortLink
      }
    }
  `;

  const result = await executeQuery(query);
  if (result.data && result.data.generateShortLink && result.data.generateShortLink.shortLink) {
    return result.data.generateShortLink.shortLink;
  }
  throw new Error((result.errors && result.errors[0]?.message) || 'Falha ao gerar link na Shopee');
}

/**
 * Fetch top/trending product offers from Shopee
 */
async function fetchTopOffers({ keyword = '', page = 1, limit = 20 } = {}) {
  let query;
  if (keyword) {
    query = `
      query {
        productOfferV2(keyword: "${keyword.replace(/"/g, '\\"')}", page: ${page}, limit: ${limit}) {
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
            shopName
          }
        }
      }
    `;
  } else {
    query = `
      query {
        productOfferV2(page: ${page}, limit: ${limit}) {
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
            shopName
          }
        }
      }
    `;
  }

  const result = await executeQuery(query);
  if (result.data && result.data.productOfferV2 && result.data.productOfferV2.nodes) {
    return result.data.productOfferV2.nodes;
  }
  return [];
}

/**
 * Fetch a specific product by its itemId using the Shopee Affiliate API
 * Uses keyword search with itemId as filter (Shopee API doesn't have direct itemId lookup)
 */
async function fetchProductById(itemId) {
  const query = `
    query {
      productOfferV2(itemId: "${itemId}", limit: 1) {
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
          shopName
        }
      }
    }
  `;

  try {
    const result = await executeQuery(query);
    if (result.data && result.data.productOfferV2 && result.data.productOfferV2.nodes && result.data.productOfferV2.nodes.length > 0) {
      return result.data.productOfferV2.nodes[0];
    }
  } catch (e) {}
  return null;
}

module.exports = {
  APP_ID,
  generateAffiliateLink,
  fetchTopOffers,
  fetchProductById
};
