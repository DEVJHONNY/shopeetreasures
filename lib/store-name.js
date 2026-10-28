'use strict';
const {createHash}=require('node:crypto');
function storeName(event,env=process.env){
  const host=String(event.headers?.host||event.headers?.Host||'').toLowerCase();
  const production=String(env.SHOPEE_PRODUCTION_HOST||'shopeetreasures-vip.netlify.app').toLowerCase();
  if(host===production&&env.CONTEXT!=='deploy-preview'&&env.CONTEXT!=='branch-deploy')return 'shopeetreasures-v2';
  // Missing runtime context never defaults a preview into production storage.
  const suffix=createHash('sha256').update(String(env.DEPLOY_ID||host||'local')).digest('hex').slice(0,24);
  return `shopeetreasures-preview-${suffix}`;
}
module.exports={storeName};
