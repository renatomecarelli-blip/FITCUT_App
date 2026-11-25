// Prova della pagina Android in Chrome, con un window.Android finto che fa da telefono
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DIR = path.join(__dirname, 'foto'); fs.mkdirSync(DIR, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, '../android/app/src/main/assets/index.html');
const backup = JSON.parse(fs.readFileSync('/home/claude/finanze/consegna/finanze-renato-backup.json', 'utf8'));
const out = { errori: [], passi: {} };
let ok = 0, ko = 0;
const verifica = (c, n, info) => { if (c) ok++; else { ko++; console.log('❌', n, info !== undefined ? JSON.stringify(info) : ''); } };

const FINTO = require('./telefono_finto.js')(backup);

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

    // sforo: in grande quanto posso spendere da domani
    await ev(`__tel.accoda(${JSON.stringify({ app: 'com.google.android.apps.walletnfcrel', titolo: 'PIZZERIA DA GINO', testo: '30,00 € con MPS Debit Mastercard ••1234', quando: ora + 900000 })}); __ponte.elabora()`);
    verifica(await until("document.querySelector('.receipt').innerText.includes('Oggi hai sforato di') && document.querySelector('.receipt').innerText.includes('Da domani puoi spendere')", 3000), 'sforo: da domani in grande', await ev("document.querySelector('.receipt').innerText.slice(0, 160)"));
    verifica(await ev("!document.querySelector('.receipt .big').classList.contains('neg') && /al giorno/.test(document.querySelector('.receipt .big').textContent)"), 'sforo: numero grande non rosso', await ev("document.querySelector('.receipt .big').textContent"));
    out.passi.sforo = await ev("document.querySelector('.receipt').innerText.replace(/\\s+/g, ' ')");
    await foto('2b_sforo.png');
    // carta di credito: di base nel mese dopo
    await ev("location.hash = '#conti'"); await sleep(200);
    await clic('[data-act="carta"]');
    verifica(await until("!!document.getElementById('fAdd')", 2000), 'carta: modulo aperto');
    const prossimo = await ev("ENG.calcola(window.__app.stato().ST, window.__app.stato().MOVS, ENG.iso(new Date())).periodo.prossimo");
    verifica(await ev("document.getElementById('fData').value + '|' + document.getElementById('fAdd').value") === prossimo + '|' + prossimo, 'carta: nel mese dopo', await ev("document.getElementById('fData').value + '|' + document.getElementById('fAdd').value"));
    await ev("__ponte.indietro()"); await ev("location.hash = '#oggi'"); await sleep(200);
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
    verifica(await ev("window.__app.stato().MOVS.length") === backup.movimenti.length + 4, 'dati ancora lì dopo la riapertura', await ev("window.__app.stato().MOVS.length"));
    await ev("location.hash = '#movimenti'"); await sleep(200);
    await foto('7_movimenti.png');

    // primo avvio senza dati
    await ev("sessionStorage.clear(); sessionStorage.setItem('vuoto', '1'); localStorage.clear()");
    await send('Page.reload'); await until("!!document.getElementById('fo')", 8000);
    verifica(await ev("document.body.innerText.includes('Hai già i tuoi dati?') && !!document.querySelector('[data-act=importaFile]') && !!document.querySelector('[data-act=incolla]')"), 'primo avvio: importa o incolla');
    await foto('8_primo_avvio.png');
    // scrivo nel modulo e torno nell'app: quello che ho scritto resta
    await ev("document.getElementById('oStip').value = '1.500,00'; __ponte.evento({ tipo: 'ripresa' })"); await sleep(300);
    verifica(await ev("document.getElementById('oStip') && document.getElementById('oStip').value") === '1.500,00', 'il ritorno nell\'app non cancella quello che scrivi');
    // incolla con gli appunti vuoti
    await clic('[data-act="incolla"]');
    verifica(/Negli appunti non c'è niente/.test(await ev("document.getElementById('toast').textContent")), 'appunti vuoti: messaggio chiaro', await ev("document.getElementById('toast').textContent"));
    // incolla il backup copiato dalla chat (anche con roba intorno)
    await ev("__tel.appunti = '```json\\n' + JSON.stringify(" + JSON.stringify(backup) + ") + '\\n```'");
    await clic('[data-act="incolla"]');
    verifica(await until("document.getElementById('sheet').classList.contains('on') && !!document.getElementById('siImp')", 2000), 'incolla: chiede conferma', await ev("document.getElementById('toast').textContent"));
    out.passi.conferma = await ev("document.getElementById('sheetIn').innerText.replace(/\\s+/g, ' ')");
    await clic('#siImp');
    verifica(await until("window.__app.stato().ST && window.__app.stato().ST.saldo.importo === 256.37 && window.__app.stato().MOVS.length === " + backup.movimenti.length, 3000), 'incolla: dati caricati', await ev("window.__app.stato().MOVS.length"));
    verifica(await until("!!document.querySelector('.receipt')", 2000), 'dopo l\'importazione si vede Oggi');
    await foto('9_dopo_incolla.png');
    // di nuovo da zero, col file scelto dall'app
    await ev("sessionStorage.clear(); sessionStorage.setItem('vuoto', '1'); localStorage.clear()");
    await send('Page.reload'); await until("!!document.getElementById('fo')", 8000);
    await clic('[data-act="importaFile"]');
    verifica(await until("!!document.getElementById('siImp')", 3000), 'file scelto: chiede conferma');
    await clic('#siImp');
    verifica(await until("window.__app.stato().ST && window.__app.stato().MOVS.length === " + backup.movimenti.length, 3000), 'file scelto: dati caricati');
    // "Apri con Finanze" quando i dati ci sono già
    await ev("__ponte.evento({ tipo: 'file', testo: JSON.stringify(" + JSON.stringify(backup) + ") })");
    verifica(await until("!!document.getElementById('siImp') && document.getElementById('sheetIn').innerText.includes('Prende il posto dei dati di adesso')", 2000), 'apri con: chiede se sostituire');
    await ev("__ponte.indietro()");
    await ev("__ponte.evento({ tipo: 'file', errore: true })");
    verifica(/Non riesco a leggere il file/.test(await ev("document.getElementById('toast').textContent")), 'file illeggibile: messaggio chiaro');
    await ev("__ponte.evento({ tipo: 'file', testo: 'ciao' })");
    verifica(/non è un backup/.test(await ev("document.getElementById('toast').textContent")), 'file sbagliato: messaggio chiaro');
    // impostazioni: i bottoni del backup
    await ev("location.hash = '#impostazioni'"); await sleep(200);
    verifica(await ev("!!document.querySelector('[data-act=importaFile]') && !!document.querySelector('[data-act=incolla]') && !document.getElementById('imp')"), 'impostazioni: importa e incolla');
  } catch (e) { out.fatale = String(e && e.stack || e); }
  verifica(!out.errori.length, 'nessun errore nella pagina', out.errori);
  console.log(JSON.stringify(out.passi, null, 1));
  console.log(`\n${ok} ok, ${ko} sbagliati`, out.fatale || '');
  ch.kill(); process.exit(ko || out.fatale ? 1 : 0);
})();
