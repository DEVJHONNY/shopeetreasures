// All displayed labels come from the localized, read-only local endpoint.
(()=>{const host=document.createElement('aside');host.id='shopee-bot-companion';
const shadow=host.attachShadow({mode:'open'});
shadow.innerHTML=`<style>
:host{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:30;font:12px system-ui;color:#f6f5ed;max-width:calc(100vw - 24px)}
.card{display:flex;gap:14px;align-items:center;background:#171f2bf2;border:1px solid #526477;border-radius:14px;padding:14px 18px;box-shadow:0 8px 28px #0008;min-width:270px}
svg{width:54px;height:72px;image-rendering:pixelated;flex:none;--lamp:#64748b}.name{font-weight:800;font-size:15px}.sub{color:#9daebc;margin-top:3px}.state{margin-top:8px;max-width:240px;line-height:1.4}.lamp{fill:var(--lamp)}
[data-state=waiting] svg{--lamp:#4ade80}[data-state=paused] svg{--lamp:#fbbf24}[data-state=error] svg,[data-state=disconnected] svg{--lamp:#fb7185}[data-state=sending] svg{--lamp:#4ade80;animation:work .5s steps(2) infinite}
@keyframes work{to{transform:translateY(-3px)}}@media(prefers-reduced-motion:reduce){svg{animation:none!important}}
.detail{color:#b8c5cf;margin-top:4px;font-size:11px}a{display:inline-block;margin-top:9px;color:#ffba77;text-underline-offset:3px}
</style><section class="card" data-state="offline">
<svg viewBox="0 0 24 32" aria-hidden="true" shape-rendering="crispEdges"><path fill="#0b1018" d="M4 7h16v13H4zM6 21h12v8H6z"/><path fill="#ed873f" d="M5 8h14v10H5zM7 20h10v8H7zM3 21h3v6H3zM18 21h3v6h-3z"/><path fill="#ffe7b3" d="M7 10h10v6H7z"/><path fill="#15273b" d="M8 11h2v2H8zM14 11h2v2h-2zM10 14h4v1h-4z"/><path fill="#c2d5dd" d="M11 4h2v4h-2zM7 28h4v3H7zM13 28h4v3h-4z"/><path class="lamp" d="M10 2h4v3h-4zM10 22h4v3h-4z"/></svg>
<div><div class="name"></div><div class="sub"></div><div class="state" role="status" aria-live="polite"></div><div class="detail"></div><a href="http://127.0.0.1:4000/admin" target="_blank" rel="noopener"></a></div></section>`;
const el=s=>shadow.querySelector(s);let labels=null;
async function update(){
 try{
  const response=await fetch('/api/shopee-bot/status',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error();
  const d=await response.json();labels=d;
  el('.card').dataset.state=d.state;el('.name').textContent=d.title;el('.sub').textContent=d.subtitle;el('.state').textContent=d.label;el('a').textContent=d.panel;
  const clock=n=>new Date(n).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  el('.detail').textContent=d.nextAutomaticAt?d.nextLabel+': '+clock(d.nextAutomaticAt):d.lastSentAt?d.lastLabel+': '+clock(d.lastSentAt):d.intervalMinutes?d.intervalLabel+': '+d.intervalMinutes:'';
  if(!host.isConnected)document.body.append(host);
 }catch{if(labels){el('.card').dataset.state='offline';el('.state').textContent=labels.stale;el('.detail').textContent='';}}
}
update();setInterval(update,5000);})();
