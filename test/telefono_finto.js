// Un window.Android finto che fa da telefono, per provare la pagina in Chrome
module.exports = backup => `(() => {
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
    chiediNotifiche: () => T.chiamate.push('chiediNotifiche'),
    scegliFile: () => { T.chiamate.push('scegliFile'); setTimeout(() => __ponte.evento(T.file === 'errore' ? { tipo: 'file', errore: true } : { tipo: 'file', testo: T.file || JSON.stringify(B) }), 300); },
    appunti: () => T.appunti || ''
  };
  T.accoda = n => { const a = JSON.parse(sp.coda || '[]'); a.push(n); sp.coda = JSON.stringify(a); salva(); };
})();`;
