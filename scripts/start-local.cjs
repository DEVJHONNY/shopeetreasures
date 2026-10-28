'use strict';
require('../lib/env');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '127.0.0.1';
const url = 'http://' + (host === '0.0.0.0' ? '127.0.0.1' : host) + ':' + port + '/admin';
function probe() {
  return new Promise(resolve => {
    let settled = false;
    const done = result => { if (!settled) { settled = true; resolve(result); } };
    const request = http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 1024 * 1024) { done('occupied'); response.destroy(); }
      });
      response.on('end', () => done(response.statusCode === 200 && body.includes('Painel do Afiliado') && body.includes('loginModal') ? 'running' : 'occupied'));
      response.on('error', () => done('occupied'));
    });
    request.setTimeout(5000, () => { done('occupied'); request.destroy(); });
    request.on('error', error => done(error.code === 'ECONNREFUSED' ? 'stopped' : 'occupied'));
  });
}
async function main() {
  const status = await probe();
  if (process.argv.includes('--check')) { console.log('Estado: ' + status); return; }
  if (status === 'running') {
    console.log('ShopeeTreasures ja esta ligado. Abrindo o painel: ' + url);
    console.log('Fechar esta janela nao encerra o servidor que ja estava ativo.');
    if (process.platform === 'win32') {
      const browser = spawn('explorer.exe', [url], { detached: true, stdio: 'ignore', windowsHide: true });
      browser.on('error', () => console.log('Abra o endereco acima no navegador.'));
      browser.unref();
    }
    return;
  }
  if (status === 'occupied') {
    console.error('A porta ' + port + ' esta ocupada ou o servidor nao respondeu. Nenhum processo foi encerrado.');
    process.exitCode = 1;
    return;
  }
  console.log('Iniciando ShopeeTreasures. Painel: ' + url);
  console.log('Nesta janela, Ctrl+C encerra o servidor iniciado agora.');
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'), stdio: 'inherit'
  });
  server.on('error', error => { console.error('Nao foi possivel iniciar: ' + error.message); process.exitCode = 1; });
  server.on('exit', code => { process.exitCode = code || 0; });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
