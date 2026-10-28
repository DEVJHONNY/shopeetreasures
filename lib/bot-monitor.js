'use strict';
const fs=require('node:fs');
function publicState(status,now=Date.now()) {
  const state=status.status!=='connected'?'disconnected':status.dispatchInFlight?'sending':status.lastError?'error':!status.isAutoPostEnabled?'paused':'waiting';
  return {version:1,pid:process.pid,updatedAt:now,state,connected:status.status==='connected',automatic:!!status.isAutoPostEnabled,intervalMinutes:status.intervalMinutes,nextAutomaticAt:status.nextAutomaticAt||null,lastSentAt:status.lastPostTimestamp||null};
}
function startMonitor(getStatus,file) {
  let warned=false;
  const publish=()=>{try{fs.writeFileSync(file+'.tmp',JSON.stringify(publicState(getStatus())));fs.renameSync(file+'.tmp',file);warned=false;}catch{if(!warned)console.warn('[Monitor] Não foi possível atualizar o estado local do bot.');warned=true;}};
  const timer=setInterval(publish,3000);timer.unref();publish();return publish;
}
module.exports={publicState,startMonitor};
