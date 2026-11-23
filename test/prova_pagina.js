// Prova della pagina Android in Chrome, con un window.Android finto che fa da telefono
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DIR = path.join(__dirname, 'foto'); fs.mkdirSync(DIR, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, '../android/app/src/main/assets/index.html');
const backup = JSON.parse(fs.readFileSync('/home/claude/finanze/consegna/finanze-renato-backup.json', 'utf8'));
const out = { errori: [], passi: {} };
let ok = 0, ko = 0;
const verifica = (c, n, info) => { if (c) ok++; else { ko++; console.log('❌', n, info !== undefined ? JSON.stringify(info) : ''); } };

const FINTO = `(() => {
  const B = ${JSON.stringify(backup)};
  const salvato = sessionStorage.getItem('telefono');
  const sp = salvato ? JSON.parse(salvato) : { stato: JSON.stringify(B.stato), movimenti: JSON.stringify(Object.fromEntries(B.movimenti.map(m => { const b = Object.assign({}, m); delete b.id; return [m.id, b]; }))), coda: '[]', registro: '[]' };
  if (sessionStorage.getItem('vuoto') === '1' && !salvato) { delete sp.stato; sp.movimenti = '{}'; }
  const salva = () => sessionStorage.setItem('telefono', JSON.stringify(sp));
  window.__tel = { sp, lettura: false, notifiche: true, chiamate: [] };
  const T = window.__tel;
  window.Android = {
    leggi: k => sp[k] == null ? null : sp[k],
    scrivi: (k, v) => { if (v === '' || v == null) delete sp[k]; else sp[k] = v; salva(); },
    movimenti: () => sp.movimenti || '{}',
    movSalva: (id, b) => { const o = JSON.parse(sp.movimenti || '{}'); o[id] = JSON.parse(b); sp.movimenti = JSON.stringify(o); salva(); },
    movCancella: id => { const o = JSON.parse(sp.movimenti || '{}'); delete o[id]; sp.movimenti = JSON.stringify(o); salva(); },
    codaLeggi: () => sp.coda || '[]',
    codaTogli: n => { const a = JSON.parse(sp.coda || '[]'); a.splice(0, n); sp.coda = JSON.stringify(a); salva(); },
    registro: () => sp.registro || '[]',
    registra: v => { const a = JSON.parse(sp.registro || '[]'); a.push(JSON.parse(v)); sp.registro = JSON.stringify(a.slice(-40)); salva(); },
    letturaAttiva: () => T.lettura, notificheAttive: () => T.notifiche, versione: () => '1.1',
    puoiDettare: () => true,
    detta: () => { T.chiamate.push('detta'); setTimeout(() => __ponte.evento({ tipo: 'dettato', testo: T.frase || '3 euro e 50 al bar' }), 300); },
    salvaFile: (n, d) => { T.chiamate.push('salva:' + n + ':' + d.length); setTimeout(() => __ponte.evento({ tipo: 'salvato', ok: true }), 200); },
    apriLettura: () => { T.chiamate.push('apriLettura'); T.lettura = true; setTimeout(() => __ponte.evento({ tipo: 'ripresa' }), 200); },
    apriInfoApp: () => T.chiamate.push('infoApp'),
    chiediNotifiche: () => T.chiamate.push('chiediNotifiche')
  };
  T.accoda = n => { const a = JSON.parse(sp.coda || '[]'); a.push(n); sp.coda = JSON.stringify(a); salva(); };
})();`;

(async () => {
  const CP = 9531;
  const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--allow-file-access-from-files', '--remote-debugging-port=' + CP, '--user-data-dir=/tmp/finanze_prova_' + Date.now(), 'about:blank'], { stdio: 'ignore' });
  let list; for (let i = 0; i < 60; i++) { try { list = await (await fetch('http://127.0.0.1:' + CP + '/json/list')).json(); if (list.length) break; } catch (e) { } await sleep(200); }
  const ws = new WebSocket(list.find(x => x.type === 'page').webSocketDebuggerUrl); let id = 0; const wait = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m.result || m); wait.delete(m.id); return; } if (m.method === 'Runtime.exceptionThrown') out.errori.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text); if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'warning' || m.params.type === 'error')) out.errori.push('console: ' + m.params.args.map(a => a.value || a.description).join(' ')); };
  await new Promise(r => ws.onopen = r);
  const send = (method, params) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e, aw) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: !!aw }); if (r.exceptionDetails) return 'ERRORE: ' + ((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text); return r.result ? r.result.value : r; };
  const until = async (e, max) => { for (let t = 0; t < (max || 5000); t += 100) { if (await ev(e) === true) return true; await sleep(100); } return false; };
  const foto = async n => { const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(DIR, n), Buffer.from(s.data, 'base64')); };
  const clic = sel => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return 'manca ' + ${JSON.stringify(sel)}; b.click(); return true; })()`);
  try {
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: FINTO });
    await send('Page.navigate', { url: PAGE + '#oggi' });
    verifica(await until("!!document.querySelector('.receipt')", 8000), 'pagina caricata');
    out.passi.oggi = await ev("document.querySelector('.receipt .big').textContent + ' | ' + document.getElementById('sync').textContent");
    verifica(/Salvato sul telefono/.test(out.passi.oggi), 'scritta salvato sul telefono', out.passi.oggi);
    verifica(await ev("document.body.innerText.includes('Fai segnare le spese all')"), 'invito ad attivare la lettura');
    verifica(await ev("document.body.innerText.includes('Ricarica Revolut') && document.body.innerText.includes('GOOGLE PAY')"), 'ricarica di oggi con etichetta Google Pay', await ev("document.querySelector('.list').innerText.slice(0,200)"));
    await foto('1_oggi.png');

    // pagamento con Google Pay mentre l'app è aperta
    const ora = Date.now();
    await ev(`__tel.accoda(${JSON.stringify({ app: 'com.google.android.apps.walletnfcrel', titolo: 'BAR TABACCHERIA CENTRALE', testo: '1,20 € con MPS Debit Mastercard ••1234', quando: ora })}); __ponte.elabora()`);
    verifica(await until("window.__app.stato().MOVS.some(m => m.fonte === 'gpay' && m.importo === 1.2)", 3000), 'spesa da Google Pay segnata');
    out.passi.toast = await ev("document.getElementById('toast').textContent");
    verifica(/1,20 € · Bar Tabaccheria Centrale/.test(out.passi.toast), 'messaggio dopo la spesa', out.passi.toast);
    await foto('2_dopo_gpay.png');

    // addebito MPS non tra le fisse → da controllare
    await ev(`__tel.accoda(${JSON.stringify({ app: 'com.google.android.gm', titolo: 'Banca Monte dei Paschi di Siena', testo: 'Addebito in conto: un promemoria per te', grande: 'Addebito in conto: un promemoria per te\nCiao Mario, hai ricevuto sul tuo Conto 123456 un addebito di 23,40 EUR', quando: ora + 1000 })}); __ponte.elabora()`);
    verifica(await until("document.body.innerText.includes('Da controllare')", 3000), 'scheda da controllare');
    await foto('3_da_controllare.png');
    await clic('[data-act="ctrlSi"]');
    verifica(await until("document.getElementById('sheet').classList.contains('on')", 2000), 'modulo aperto');
    out.passi.modulo = await ev("document.getElementById('fImp').value + ' | ' + document.getElementById('fNota').value");
    verifica(out.passi.modulo === '23,40 | Addebito MPS', 'modulo precompilato', out.passi.modulo);
    await ev("document.querySelector('#fm button.primary').click()");
    verifica(await until("!(window.__app.stato().ST.daControllare || []).length && window.__app.stato().MOVS.some(m => m.importo === 23.4)", 3000), 'addebito segnato e tolto da controllare');

    // correggo la categoria del bar: la prossima volta la ricorda
    const idBar = await ev("window.__app.stato().MOVS.find(m => m.importo === 1.2).id");
    await ev(`document.querySelector('[data-act="mov"][data-id="${idBar}"]').click()`);
    verifica(await until("!!document.getElementById('fEscl')", 2000), 'casella "non contarla"');
    await ev("document.querySelector('[data-cat=\"svago\"]').click(); document.querySelector('#fm button.primary').click()");
    verifica(await until("(window.__app.stato().ST.regole || {})['bar tabaccheria'] === 'svago'", 3000), 'categoria imparata', await ev("JSON.stringify(window.__app.stato().ST.regole)"));
    verifica(await ev(`window.__app.stato().MOVS.find(m => m.id === '${idBar}').fonte === 'gpay'`), 'resta di Google Pay dopo la modifica');
    await ev(`__tel.accoda(${JSON.stringify({ app: 'com.google.android.apps.walletnfcrel', titolo: 'BAR TABACCHERIA CENTRALE', testo: '2,40 € con MPS Debit Mastercard ••1234', quando: ora + 600000 })}); __ponte.elabora()`);
    verifica(await until("window.__app.stato().MOVS.some(m => m.importo === 2.4 && m.categoria === 'svago')", 3000), 'stesso negozio, categoria giusta');

    // voce
    await clic('[data-act="detta"]');
    verifica(await until("document.getElementById('sheet').classList.contains('on') && document.getElementById('fImp').value === '3,50'", 3000), 'detta una spesa', await ev("document.getElementById('fImp') && document.getElementById('fImp').value"));
    verifica(await ev("document.querySelector('[data-cat=\"bar\"]').getAttribute('aria-pressed') === 'true'"), 'categoria dal dettato');
    // tasto indietro
    verifica(await ev("__ponte.indietro()") === true && await ev("!document.getElementById('sheet').classList.contains('on')"), 'indietro chiude il modulo');
    await ev("location.hash = '#conti'"); await sleep(200);
    await foto('4_conti.png');
    out.passi.saldo = await ev("[...document.querySelectorAll('.card')][0].innerText.slice(0, 260)");
    verifica(await ev("__ponte.indietro()") === true && await until("location.hash === '#oggi'", 1000), 'indietro torna a Oggi');
    verifica(await ev("__ponte.indietro()") === false, 'indietro da Oggi esce');

    // saldo dalla mail del mattino
    await ev(`__tel.accoda(${JSON.stringify({ app: 'com.google.android.gm', titolo: 'Banca Monte dei Paschi di Siena', testo: 'Saldo conto: un promemoria per te', grande: 'Saldo conto: un promemoria per te\nCiao Mario, ecco la situazione del tuo Conto 123456. Saldo disponibile 210,15 EUR', quando: ora + 2000 })}); __ponte.elabora()`);
    verifica(await until("window.__app.stato().ST.saldo.importo === 210.15 && window.__app.stato().ST.saldo.fonte === 'mail'", 3000), 'saldo dalla mail');
    await ev("location.hash = '#conti'"); await sleep(200);
    out.passi.saldoMail = await ev("[...document.querySelectorAll('.card')][0].innerText.slice(0, 200)");
    verifica(/Saldo letto dalla mail di MPS: 210,15 €/.test(out.passi.saldoMail), 'testo saldo dalla mail', out.passi.saldoMail);

    // impostazioni: lettura automatica e registro
    await ev("location.hash = '#impostazioni'"); await sleep(200);
    verifica(await ev("document.body.innerText.includes('Lettura automatica') && document.body.innerText.includes('Ultime notifiche lette')"), 'scheda lettura automatica');
    verifica(await ev("document.body.innerText.includes('Saldo aggiornato: 210,15 €')"), 'registro con le notifiche lette');
    await foto('5_impostazioni_spenta.png');
    await clic('[data-act="attivaLettura"]');
    verifica(await until("document.body.innerText.includes('● attiva')", 2000), 'lettura attivata');
    await foto('6_impostazioni_attiva.png');
    await clic('[data-act="esporta"]');
    verifica(await until("document.getElementById('toast').textContent === 'Backup salvato'", 2000), 'backup salvato', await ev("document.getElementById('toast').textContent"));

    // ricarico: i dati restano
    await send('Page.reload'); await until("!!document.querySelector('.receipt')", 8000);
    verifica(await ev("window.__app.stato().MOVS.length") === backup.movimenti.length + 3, 'dati ancora lì dopo la riapertura', await ev("window.__app.stato().MOVS.length"));
    await ev("location.hash = '#movimenti'"); await sleep(200);
    await foto('7_movimenti.png');

    // primo avvio senza dati
    await ev("sessionStorage.clear(); sessionStorage.setItem('vuoto', '1'); localStorage.clear()");
    await send('Page.reload'); await until("!!document.getElementById('fo')", 8000);
    verifica(await ev("document.body.innerText.includes('Hai già il file con i tuoi dati?') && !!document.getElementById('imp')"), 'primo avvio: importa il file');
    await foto('8_primo_avvio.png');
  } catch (e) { out.fatale = String(e && e.stack || e); }
  verifica(!out.errori.length, 'nessun errore nella pagina', out.errori);
  console.log(JSON.stringify(out.passi, null, 1));
  console.log(`\n${ok} ok, ${ko} sbagliati`, out.fatale || '');
  ch.kill(); process.exit(ko || out.fatale ? 1 : 0);
})();
