const { createHandler } = require('../../lib/cloud-api');
const api = require('./shopee_api');
const { storeName } = require('../../lib/store-name');
exports.handler = createHandler({ api, getStore: async event => {
  const { connectLambda, getStore } = require('@netlify/blobs');
  connectLambda(event);
  // O adaptador Lambda fornece edgeURL. Leituras são eventuais; as escritas
  // condicionais continuam atômicas. O painel informa o atraso de atualização.
  return getStore({ name: storeName(event) });
}});
