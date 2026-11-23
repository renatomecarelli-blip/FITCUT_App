// Collega la pagina all'app Android: dati sul telefono (al posto del database di claude.ai), voce, salvataggio file, tasto indietro
(() => {
  const A = window.Android; if (!A) return;
  const D = FIN.dati;
  const docL = [], colL = [];
  const ordina = l => l.sort((a, b) => a.data < b.data ? 1 : a.data > b.data ? -1 : (b.creato || 0) - (a.creato || 0));
  const snapDoc = () => { const v = D.stato(); return { exists: v != null, data: () => v, metadata: { fromCache: false } }; };
  const snapCol = () => ({ docs: ordina(D.movimenti()).map(m => { const b = Object.assign({}, m); delete b.id; return { id: m.id, data: () => b }; }) });
  let attesa = 0, ultima = null;
  const firma = () => (A.leggi('stato') || '') + '\u0001' + A.movimenti();
  // avvisa la pagina che i dati sono cambiati (se non sono cambiati non ridisegna: così non si perdono i campi che stai scrivendo)
  const avvisa = () => {
    clearTimeout(attesa);
    attesa = setTimeout(() => {
      const f = firma(); if (f === ultima) return; ultima = f;
      const a = snapDoc(), b = snapCol(); docL.forEach(f => { try { f(a); } catch (e) { } }); colL.forEach(f => { try { f(b); } catch (e) { } });
    }, 0);
  };
  D.ascolta(avvisa);
  let k = 0;
  const nuovoId = () => 'm' + Date.now().toString(36) + (k++).toString(36) + Math.random().toString(36).slice(2, 6);
  const db = {
    doc: () => ({
      set: v => { D.salvaStato(v); avvisa(); return Promise.resolve(); },
      delete: () => { D.salvaStato(null); avvisa(); return Promise.resolve(); },
      onSnapshot: cb => { docL.push(cb); setTimeout(() => { ultima = firma(); cb(snapDoc()); }, 0); return () => { }; }
    }),
    collection: () => ({
      doc: x => {
        const i = x || nuovoId();
        return { id: i, set: b => { D.salvaMov(Object.assign({}, b, { id: i })); avvisa(); return Promise.resolve(); }, delete: () => { D.cancellaMov(i); avvisa(); return Promise.resolve(); } };
      },
      orderBy: () => ({ limit: () => ({ onSnapshot: cb => { colL.push(cb); setTimeout(() => cb(snapCol()), 0); return () => { }; } }) })
    })
  };
  // 🎙 voce: usa il riconoscimento vocale di Google
  const voce = { f: null, s: null, attiva: false };
  let puoiDettare = false; try { puoiDettare = A.puoiDettare(); } catch (e) { }
  const dictation = puoiDettare ? {
    onPartial: () => { }, onFinal: cb => { voce.f = cb; }, onState: cb => { voce.s = cb; },
    start: () => { voce.attiva = true; A.detta(); if (voce.s) voce.s({ state: 'listening' }); return Promise.resolve(); },
    stop: () => Promise.resolve()
  } : null;
  // 💾 salva un file (backup) dove vuoi tu
  let salva = null;
  const downloads = { save: ({ filename, data }) => new Promise((ok, no) => { salva = { ok, no }; A.salvaFile(filename, data); }) };

  window.claude = { use: name => name === 'db' ? db : name === 'dictation' ? dictation : name === 'downloads' ? downloads : null };
  window.__ponte = {
    evento(e) {
      if (!e) return;
      if (e.tipo === 'dettato') {
        if (!voce.attiva) return; voce.attiva = false;
        if (e.testo && voce.f) voce.f({ text: e.testo });
        if (voce.s) voce.s({ state: 'idle', reason: e.testo ? 'fine' : 'viewer_stopped' });
      } else if (e.tipo === 'salvato') {
        if (salva) { const s = salva; salva = null; if (e.ok) s.ok(); else s.no({ code: 'declined' }); }
      } else if (e.tipo === 'file') {
        window.dispatchEvent(new CustomEvent('finanze-file', { detail: e }));
      } else if (e.tipo === 'ripresa') {
        this.elabora(); avvisa(); window.dispatchEvent(new Event('finanze-ripresa'));
      }
    },
    // le notifiche arrivate mentre l'app è aperta
    elabora() {
      let av = []; try { av = JSON.parse(FIN.elaboraCoda() || '[]'); } catch (e) { }
      if (av.length) window.dispatchEvent(new CustomEvent('finanze-avviso', { detail: av[av.length - 1] }));
      return true;
    },
    indietro() {
      const sh = document.getElementById('sheet');
      if (sh && sh.classList.contains('on')) { document.getElementById('sheetBg').click(); return true; }
      const li = document.getElementById('listen');
      if (li && li.classList.contains('on')) { li.classList.remove('on'); return true; }
      if (location.hash && location.hash !== '#oggi') { location.hash = '#oggi'; return true; }
      return false;
    }
  };
  window.addEventListener('load', () => setTimeout(() => window.__ponte.elabora(), 400));
})();
