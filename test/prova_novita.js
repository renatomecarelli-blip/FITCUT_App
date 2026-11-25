// Prova delle novità: «da domani», carta di credito nel mese dopo, mail MPS della carta (TZ=Europe/Rome)
const path = require('path');
const A = path.join(__dirname, '../android/app/src/main/assets');
global.ENG = require(path.join(A, 'engine.js'));
const FIN = require(path.join(A, 'comune.js'));
const seed = require('/home/claude/finanze/app/seed.json');
let ok = 0, ko = 0;
const verifica = (cond, nome, info) => { if (cond) ok++; else { ko++; console.log('❌', nome, info !== undefined ? JSON.stringify(info) : ''); } };
const t = s => new Date(s).getTime();
const ST = JSON.parse(JSON.stringify(seed.stato));
const carta17 = seed.movimenti.map(m => m.id === 's15' ? Object.assign({}, m, { data: '2026-12-17', addebito: '2026-12-17' }) : Object.assign({}, m));

// 1) carta spostata al 17/12: a novembre non pesa, si vede in 8,88 € al giorno
const R25 = ENG.calcola(ST, carta17, '2026-11-25');
verifica(R25.oggiPuoi === 8.88, 'carta a dicembre: oggi 8,88', R25.oggiPuoi);
// 2) il 17/12 la carta non è «speso oggi»: si divide sul mese
const R17 = ENG.calcola(ST, carta17, '2026-12-17');
verifica(R17.spesoOggi === 0 && R17.speso === 110 && R17.oggiPuoi > 0, 'il 17/12 la carta si spalma sul mese', { spesoOggi: R17.spesoOggi, speso: R17.speso, oggi: R17.oggiPuoi });
// 3) sforo di oggi: da domani la media scende (6,50 + 2,50 come nello screenshot)
const oggi = carta17.concat([{ id: 'x1', data: '2026-11-25', importo: 6.5, tipo: 'spesa', categoria: 'bar', creato: 2 }, { id: 'x2', data: '2026-11-25', importo: 10, tipo: 'spesa', categoria: 'bar', creato: 3 }]);
const Ro = ENG.calcola(ST, oggi, '2026-11-25'), Rd = ENG.calcola(ST, oggi, '2026-11-26');
verifica(Ro.oggiPuoi < 0 && Rd.oggiPuoi > 0 && Math.abs(Rd.oggiPuoi - (Ro.contoPerSpese / 21)) < 0.01, 'da domani = resto diviso i giorni rimasti', { oggi: Ro.oggiPuoi, domani: Rd.oggiPuoi });
// 4) avviso dopo una spesa che fa sforare
FIN.impostaOra(() => t('2026-11-25T21:00:00+01:00'));
const r = FIN.elabora({ app: 'com.google.android.apps.walletnfcrel', titolo: 'BAR CENTRALE', testo: '12,00 € con MPS Debit Mastercard ••1234', quando: t('2026-11-25T21:00:00+01:00') }, ST, carta17);
verifica(r.avviso && /Oggi sei oltre di .*Da domani puoi spendere .* al giorno/.test(r.avviso.testo), 'avviso con «da domani»', r.avviso && r.avviso.testo);
// 5) la mail del 15/12 della carta: resta a dicembre nel piano, ma il giorno vero vale per il conto
FIN.impostaOra(() => t('2026-12-15T02:00:00+01:00'));
const rc = FIN.elabora({ app: 'com.google.android.gm', titolo: 'Banca Monte dei Paschi di Siena', testo: 'Addebito in conto: un promemoria per te', grande: 'Addebito in conto\nCiao Renato, hai ricevuto sul tuo Conto 632500 un addebito di 110,00 Euro con descrizione Addebito carta di credito', quando: t('2026-12-15T02:00:00+01:00') }, ST, carta17);
verifica(rc.movs && rc.movs[0].id === 's15' && rc.movs[0].addebito === '2026-12-15' && rc.movs[0].data === '2026-12-17' && !rc.avviso, 'carta: giorno vero dalla mail, mese scelto da te', rc.esito);
FIN.impostaOra();
console.log(`\n${ok} ok, ${ko} sbagliati`);
process.exit(ko ? 1 : 0);
