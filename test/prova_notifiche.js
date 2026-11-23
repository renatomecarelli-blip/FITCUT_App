// Prova della lettura notifiche con un telefono finto (TZ=Europe/Rome)
const path = require('path');
const A = path.join(__dirname, '../android/app/src/main/assets');
global.ENG = require(path.join(A, 'engine.js'));
const FIN = require(path.join(A, 'comune.js'));
const seed = require('/home/claude/finanze/app/seed.json');
let ok = 0, ko = 0;
const verifica = (cond, nome, info) => { if (cond) ok++; else { ko++; console.log('❌', nome, info !== undefined ? JSON.stringify(info) : ''); } };
const t = s => new Date(s).getTime();

// importi
const imp = s => FIN.importi(s).map(x => x.v);
verifica(JSON.stringify(imp('Ciao Mario, ecco la situazione del tuo Conto 123456. AG')) === '[]', 'numero conto non è un importo', imp('Conto 123456. AG'));
verifica(JSON.stringify(imp('10,00 € con MPS Debit Mastercard ••1234')) === '[10]', 'importo wallet', imp('10,00 € con MPS Debit Mastercard ••1234'));
verifica(JSON.stringify(imp('saldo € 1.234,56')) === '[1234.56]', 'migliaia', imp('saldo € 1.234,56'));
verifica(JSON.stringify(imp('saldo -12,50 €')) === '[-12.5]', 'negativo', imp('saldo -12,50 €'));
verifica(JSON.stringify(imp('il 23/11/2026 alle 06:35')) === '[]', 'date e ore', imp('il 23/11/2026 alle 06:35'));
verifica(JSON.stringify(imp('5 EUR e poi 1.300 €')) === '[5,1300]', 'interi con valuta', imp('5 EUR e poi 1.300 €'));
verifica(JSON.stringify(imp('€10.00 with Visa')) === '[10]', 'formato inglese', imp('€10.00 with Visa'));
// categorie
const cat = s => FIN.categoria(s);
for (const [s, c] of [['Bar Tabaccheria', 'bar'], ['Barbiere Mario', 'vestiti'], ['ENI STATION 1234', 'benzina'], ['Distributore benzina', 'benzina'], ['Capisco tutto', 'altro'], ['CONAD SUPERSTORE', 'spesa'], ['Pizzeria da Gino', 'ristoranti'], ['3 euro e 50 al bar', 'bar'], ['caffè e cornetto', 'bar'], ['Amazon Marketplace', 'online'], ['Farmacia Comunale', 'salute']])
  verifica(cat(s) === c, 'categoria ' + s, cat(s));
verifica(FIN.chiave('CONAD 123 PERUGIA') === 'conad perugia' && FIN.categoria('Negozio Strano 12', { 'negozio strano': 'svago' }) === 'svago', 'regole imparate', FIN.chiave('CONAD 123 PERUGIA'));
verifica(FIN.pulisciNegozio('Revolut**9969*') === 'Revolut', 'pulisci Revolut', FIN.pulisciNegozio('Revolut**9969*'));
verifica(FIN.pulisciNegozio('SUPERMERCATO CONAD SUPERSTORE') === 'Supermercato Conad Superstore', 'maiuscole', FIN.pulisciNegozio('SUPERMERCATO CONAD SUPERSTORE'));

// telefono finto
function telefono(stato, movs) {
  const sp = { stato: JSON.stringify(stato), movimenti: JSON.stringify(Object.fromEntries(movs.map(m => { const b = Object.assign({}, m); delete b.id; return [m.id, b]; }))), coda: '[]', registro: '[]' };
  return {
    sp,
    leggi: k => sp[k] == null ? null : sp[k], scrivi: (k, v) => { if (v === '' || v == null) delete sp[k]; else sp[k] = v; },
    movimenti: () => sp.movimenti, movSalva: (id, b) => { const o = JSON.parse(sp.movimenti); o[id] = JSON.parse(b); sp.movimenti = JSON.stringify(o); },
    movCancella: id => { const o = JSON.parse(sp.movimenti); delete o[id]; sp.movimenti = JSON.stringify(o); },
    codaLeggi: () => sp.coda, codaTogli: n => { const a = JSON.parse(sp.coda); a.splice(0, n); sp.coda = JSON.stringify(a); },
    registro: () => sp.registro, registra: v => { const a = JSON.parse(sp.registro); a.push(JSON.parse(v)); sp.registro = JSON.stringify(a.slice(-40)); },
    accoda: n => { const a = JSON.parse(sp.coda); a.push(n); sp.coda = JSON.stringify(a); }
  };
}
const ST0 = JSON.parse(JSON.stringify(seed.stato)), MOV0 = seed.movimenti.map(m => Object.assign({}, m));
const tel = telefono(ST0, MOV0); global.Android = tel;
const W = 'com.google.android.apps.walletnfcrel', GM = 'com.google.android.gm', PP = 'com.paypal.android.p2pmobile';
const casi = [
  { n: 'wallet revolut (screenshot)', app: W, titolo: 'Revolut**9969*', testo: '10,00 € con MPS Debit Mastercard ••1234', quando: t('2026-11-23T15:46:10+01:00') },
  { n: 'stessa notifica ripetuta', app: W, titolo: 'Revolut**9969*', testo: '10,00 € con MPS Debit Mastercard ••1234', quando: t('2026-11-23T15:46:40+01:00') },
  { n: 'conad', app: W, titolo: 'CONAD SUPERSTORE PERUGIA', testo: '23,45 € con MPS Debit Mastercard ••1234', quando: t('2026-11-23T18:02:00+01:00') },
  { n: 'carta revolut', app: W, titolo: 'Lidl', testo: '12,30 € con Revolut Mastercard ••1234', quando: t('2026-11-23T18:30:00+01:00') },
  { n: 'non riuscito', app: W, titolo: 'Bar Centrale', testo: 'Pagamento non riuscito · 2,00 €', quando: t('2026-11-23T19:00:00+01:00') },
  { n: 'wallet senza importo', app: W, titolo: 'Google Wallet', testo: 'La tua carta è pronta', quando: t('2026-11-23T19:10:00+01:00') },
  { n: 'saldo mail', app: GM, titolo: 'Banca Monte dei Paschi di Siena', testo: 'Saldo conto: un promemoria per te', grande: 'Saldo conto: un promemoria per te\nCiao Mario, ecco la situazione del tuo Conto 123456. AGGIORNATO AL 24/11/2026: saldo contabile 250,00 EUR - saldo disponibile 222,85 EUR', quando: t('2026-11-24T06:35:00+01:00') },
  { n: 'saldo mail senza importo', app: GM, titolo: 'Banca Monte dei Paschi di Siena', testo: 'Saldo conto: un promemoria per te', grande: 'Saldo conto: un promemoria per te\nCiao Mario, ecco la situazione del tuo Conto 123456. AG', quando: t('2026-11-25T06:35:00+01:00') },
  { n: 'addebito generali', app: GM, titolo: 'Banca Monte dei Paschi di Siena', testo: 'Addebito in conto: un promemoria per te', grande: 'Addebito in conto: un promemoria per te\nCiao Mario, hai ricevuto sul tuo Conto 123456 un addebito di 51,00 EUR. Causale: SDD GENERALI', quando: t('2026-11-30T01:14:00+01:00') },
  { n: 'addebito strano', app: GM, titolo: 'Banca Monte dei Paschi di Siena', testo: 'Addebito in conto: un promemoria per te', grande: 'Addebito in conto: un promemoria per te\nCiao Mario, hai ricevuto sul tuo Conto 123456 un addebito di 23,40 EUR', quando: t('2026-11-26T01:14:00+01:00') },
  { n: 'addebito carta di credito 15/12', app: GM, titolo: 'Banca Monte dei Paschi di Siena', testo: 'Addebito in conto: un promemoria per te', grande: 'Addebito in conto\nCiao Mario, hai ricevuto sul tuo Conto 123456 un addebito di 110,00 EUR', quando: t('2026-12-15T02:00:00+01:00') },
  { n: 'stipendio', app: GM, titolo: 'Banca Monte dei Paschi di Siena', testo: 'Accredito in conto: un promemoria per te', grande: 'Accredito in conto\nCiao Mario, hai ricevuto sul tuo Conto 123456 un accredito di 1.737,00 EUR', quando: t('2026-12-16T09:00:00+01:00') },
  { n: 'paypal mail', app: GM, titolo: 'PayPal', testo: 'Ricevuta del tuo pagamento a favore di Meta Platforms Ireland Limited', grande: 'Ricevuta del tuo pagamento a favore di Meta Platforms Ireland Limited\nMario Rossi, hai inviato un pagamento. Ciao Mario, hai inviato un pagamento di 5,00 € EUR a Meta Platforms Ireland Limited.', quando: t('2026-11-24T10:00:00+01:00') },
  { n: 'paypal app stesso pagamento', app: PP, titolo: 'PayPal', testo: 'Hai inviato 5,00 € EUR a Meta Platforms Ireland Limited', quando: t('2026-11-24T10:00:05+01:00') },
  { n: 'paypal senza importo', app: GM, titolo: 'PayPal', testo: 'Ricevuta del tuo pagamento a favore di Davide Rossi', grande: 'Ricevuta del tuo pagamento a favore di Davide Rossi\nMario Rossi, hai inviato un pagamento. Ciao Mario,', quando: t('2026-11-24T11:00:00+01:00') },
  { n: 'paypal pubblicità', app: GM, titolo: 'PayPal', testo: 'Perché dire "Inviameli su PayPal"', grande: 'Mario Rossi - Ecco perché ricevere pagamenti con PayPal', quando: t('2026-11-24T12:00:00+01:00') },
  { n: 'altra mail', app: GM, titolo: 'Poste Italiane', testo: 'Scegli Tu - Spedizione in consegna', grande: 'Poste Italiane Notifica spedizione', quando: t('2026-11-24T12:30:00+01:00') }
];
const attesi = {
  'wallet revolut (screenshot)': r => r.movs && r.movs[0].importo === 10 && r.movs[0].categoria === 'revolut' && r.movs[0].nota === 'Ricarica Revolut' && !r.movs[0].esclusa && r.avviso && /Oggi/.test(r.avviso.testo),
  'stessa notifica ripetuta': r => !r.movs && /Già/.test(r.esito),
  'conad': r => r.movs && r.movs[0].categoria === 'spesa' && r.movs[0].nota === 'Conad Superstore Perugia' && r.movs[0].carta === '1234',
  'carta revolut': r => r.movs && r.movs[0].esclusa === true,
  'non riuscito': r => !r.movs && /non riuscito/.test(r.esito),
  'wallet senza importo': r => !r.movs,
  'saldo mail': r => r.stato && r.stato.saldo.importo === 222.85 && r.stato.saldo.fonte === 'mail' && r.avviso && r.avviso.canale === 'info',
  'saldo mail senza importo': r => !r.stato && /importo/.test(r.esito),
  'addebito generali': r => r.stato && /Generali.*già in lista/.test(r.esito) && !r.avviso && r.stato.periodi['2026-11'].fatti.generali === true,
  'addebito strano': r => r.stato && r.stato.daControllare.length === 1 && r.avviso,
  'addebito carta di credito 15/12': r => /Carta di credito/.test(r.esito) && !r.avviso,
  'stipendio': r => r.stato && r.stato.periodi['2026-12'].stipendio === 1737 && r.movs[0].data === '2026-12-17' && /Dal 17 \(nuovo mese\) puoi spendere/.test(r.avviso.testo),
  'paypal mail': r => r.movs && r.movs[0].importo === 5 && r.movs[0].categoria === 'online' && /Meta Platforms/.test(r.movs[0].nota),
  'paypal app stesso pagamento': r => !r.movs && /già/.test(r.esito),
  'paypal senza importo': r => r.stato && r.stato.daControllare.some(x => /Davide/.test(x.nota) && x.importo === null),
  'paypal pubblicità': r => !r.movs && !r.stato,
  'altra mail': r => !r.movs && !r.stato
};
for (const c of casi) tel.accoda(c);
// elaboro uno per uno come farebbe la coda, guardando ogni risultato
let ST = JSON.parse(tel.sp.stato), MOVS = FIN.dati.movimenti();
for (const c of casi) {
  FIN.impostaOra(() => c.quando + 1000);
  const r = FIN.elabora(c, ST, MOVS);
  verifica(attesi[c.n](r), c.n, r.esito + (r.avviso ? ' | ' + r.avviso.titolo + ' — ' + r.avviso.testo : ''));
  console.log('·', c.n.padEnd(32), '→', r.esito, r.avviso ? '| 🔔 ' + r.avviso.titolo + ' — ' + r.avviso.testo : '');
  if (r.stato) ST = r.stato;
  for (const m of r.movs || []) MOVS.push(m);
}
// coda vera, con i dati salvati sul telefono finto
const av = JSON.parse(FIN.elaboraCoda());
const salvati = FIN.dati.movimenti(), st2 = FIN.dati.stato();
verifica(JSON.parse(tel.sp.coda).length === 0, 'coda svuotata');
FIN.impostaOra();
verifica(salvati.length === MOV0.length + 5, 'movimenti salvati (5 nuovi)', salvati.length - MOV0.length);
verifica(st2.saldo.importo === 222.85 && st2.daControllare.length === 2, 'stato salvato', st2.saldo);
verifica(JSON.parse(tel.sp.registro).length === casi.length, 'registro', JSON.parse(tel.sp.registro).length);
verifica(av.length === 3, 'avvisi (ultimi 3)', av.length);
// i conti col nuovo motore: la spesa con carta Revolut non conta
const R = ENG.calcola(st2, salvati, '2026-11-24');
const R2 = ENG.calcola(st2, salvati.filter(m => !m.esclusa), '2026-11-24');
verifica(JSON.stringify(R) === JSON.stringify(R2), 'spesa esclusa ignorata dai conti');
console.log(`\n${ok} ok, ${ko} sbagliati`);
process.exit(ko ? 1 : 0);
