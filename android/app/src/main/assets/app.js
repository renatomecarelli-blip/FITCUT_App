(() => {
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => { const [i, d] = Math.abs(Number(n) || 0).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
const fmtIn = v => v === '' || v == null ? '' : (Number(v) || 0).toFixed(2).replace('.', ',');
const eur = n => ((Number(n) || 0) < -0.004 ? '−' : '') + fmt(n) + ' €';
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MESI_L = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GG = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const dBreve = s => { const d = ENG.parse(s); return d.getDate() + ' ' + MESI[d.getMonth()]; };
const dLunga = s => { const d = ENG.parse(s); return GG[d.getDay()] + ' ' + d.getDate() + ' ' + MESI_L[d.getMonth()]; };
const oggiISO = () => ENG.iso(new Date());
const clone = o => JSON.parse(JSON.stringify(o));
const MIC = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

const CATS = FIN.CATS;   // categorie in comune con la lettura delle notifiche
const ALTRI = { stipendio: { nome: 'Stipendio', col: 'var(--good)' }, extra: { nome: 'Entrata', col: 'var(--good)' }, risparmio: { nome: 'Risparmio', col: 'var(--accent)' }, scadenza: { nome: 'Scadenza', col: 'var(--warn)' }, fissa: { nome: 'Spesa fissa', col: 'var(--muted)' } };
const catInfo = id => CATS.find(c => c.id === id) || ALTRI[id] || CATS[CATS.length - 1];
const TIPI_FISSA = [['fissa', 'Spesa fissa'], ['abbonamento', 'Abbonamento'], ['risparmio', 'Risparmio (va sul libretto)'], ['trasferimento', 'Soldi da spostare (es. Revolut)']];

let ST = null, MOVS = [], DB = null, DICT = null, DL = null, DICT_NO = false;
const AND = window.Android || null, ANDROID = !!AND;
const chiama = (f, ...x) => { try { return AND && typeof AND[f] === 'function' ? AND[f](...x) : null; } catch (e) { return null; } };
const S = { caricato: false, arrivato: false, errore: '', locale: false };
let TAB = 'oggi', VISTO = null;

const use = name => { try { return window.claude && typeof window.claude.use === 'function' ? Promise.resolve(window.claude.use(name)).catch(() => null) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); } };
const CK = 'finanze-renato-cache-v1';
const leggiCache = () => { try { return JSON.parse(localStorage.getItem(CK) || 'null'); } catch (e) { return null; } };
const scriviCache = () => { try { localStorage.setItem(CK, JSON.stringify({ st: ST, movs: MOVS })); } catch (e) { } };
let tt = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 3000); }
const erroreDb = e => e && e.code === 'quota_exceeded' ? 'Spazio finito: cancella qualche movimento vecchio' : e && e.code === 'invalid_argument' ? 'Non posso salvare: apri l\'app col tuo account' : 'Non salvato: controlla la connessione e riprova';

// 💾 salvataggi (uno alla volta per documento)
let coda = Promise.resolve();
function salvaStato(nuovo, msg) {
  ST = nuovo; scriviCache(); render();
  if (!DB) { if (msg) toast(msg + ' (solo su questo telefono)'); return; }
  const copia = clone(nuovo);
  coda = coda.then(() => DB.doc('budget/stato').set(copia)).then(() => { if (msg) toast(msg); }, e => toast(erroreDb(e)));
}
function nuovoId() { try { if (DB) return DB.collection('movimenti').doc().id; } catch (e) { } return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const ordina = () => MOVS.sort((a, b) => a.data < b.data ? 1 : a.data > b.data ? -1 : (b.creato || 0) - (a.creato || 0));
async function salvaMov(m, msg) {
  const i = MOVS.findIndex(x => x.id === m.id); if (i >= 0) MOVS[i] = m; else MOVS.push(m);
  ordina(); scriviCache(); render();
  if (!DB) { toast((msg || 'Salvato') + ' (solo su questo telefono)'); return; }
  const body = clone(m); delete body.id;
  try { await DB.collection('movimenti').doc(m.id).set(body); if (msg) toast(msg); } catch (e) { toast(erroreDb(e)); }
}
async function cancellaMov(id) {
  MOVS = MOVS.filter(x => x.id !== id); scriviCache(); render();
  if (!DB) return toast('Eliminato');
  try { await DB.collection('movimenti').doc(id).delete(); toast('Movimento eliminato'); } catch (e) { toast(erroreDb(e)); }
}
const conPeriodo = (key, fn) => { const s = clone(ST); s.periodi = s.periodi || {}; s.periodi[key] = s.periodi[key] || {}; fn(s.periodi[key], s); return s; };

// 🎙 detta una spesa
const UNITA = { zero: 0, uno: 1, un: 1, una: 1, due: 2, tre: 3, 'tré': 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19 };
const DECINE = [['venti', 20], ['vent', 20], ['trenta', 30], ['trent', 30], ['quaranta', 40], ['quarant', 40], ['cinquanta', 50], ['cinquant', 50], ['sessanta', 60], ['sessant', 60], ['settanta', 70], ['settant', 70], ['ottanta', 80], ['ottant', 80], ['novanta', 90], ['novant', 90], ['cento', 100]];
function parola(w) {
  if (w in UNITA) return UNITA[w];
  for (const [t, v] of DECINE) if (w.startsWith(t)) { const r = w.slice(t.length); if (!r) return v; if (r in UNITA && UNITA[r] < 10) return v + UNITA[r]; }
  return null;
}
function leggiFrase(t) {
  let s = ' ' + t.toLowerCase().replace(/€/g, ' euro ').replace(/[^\p{L}\d,.\s]/gu, ' ') + ' ';
  s = s.replace(/\p{L}+/gu, w => { const n = parola(w); return n == null ? w : String(n); });
  let imp = null, m;
  if ((m = s.match(/(\d+)\s*(?:euro\s*)?(?:e|virgola)\s*(\d{1,2})\b/))) imp = +m[1] + (m[2].length === 1 ? +m[2] / 10 : +m[2] / 100);
  else if ((m = s.match(/(\d+)[.,](\d{1,2})\b/))) imp = +m[1] + +('0.' + m[2]);
  else if ((m = s.match(/(\d+)/))) imp = +m[1];
  const cat = FIN.categoria(s);
  let nota = s.replace(/(\d+)\s*(?:euro\s*)?(?:e|virgola)\s*(\d{1,2})\b/, ' ').replace(/\d+[.,]\d{1,2}/, ' ').replace(/\b\d+\b/, ' ').replace(/\beuro\b/g, ' ').replace(/^\s*(?:al|alla|allo|per|di|da|in)\s+/, ' ').replace(/\s+/g, ' ').trim();
  return { importo: imp, categoria: cat, nota: (nota ? nota.charAt(0).toUpperCase() + nota.slice(1) : '').slice(0, 80) };
}
const ascolto = { finale: '', attivo: false };
function initDetta() {
  DICT.onPartial(({ text }) => { $('listenTxt').textContent = (ascolto.finale + ' ' + text).trim(); });
  DICT.onFinal(({ text }) => { ascolto.finale = (ascolto.finale + ' ' + text).trim(); $('listenTxt').textContent = ascolto.finale; });
  DICT.onState(({ state, reason }) => {
    if (state === 'listening') { ascolto.attivo = true; $('listen').classList.add('on'); return; }
    if (state === 'idle' && ascolto.attivo) {
      ascolto.attivo = false; $('listen').classList.remove('on');
      const t = ascolto.finale; ascolto.finale = '';
      if (t) { const p = leggiFrase(t); formMov(null, { importo: p.importo == null ? '' : p.importo, categoria: p.categoria, nota: p.nota }); }
      else if (reason !== 'viewer_stopped') toast('Non ho sentito niente: riprova o scrivi con ＋ Spesa');
    }
  });
}
function detta() {
  if (!DICT) return;
  ascolto.finale = ''; $('listenTxt').textContent = '';
  let p; try { p = DICT.start(); } catch (e) { toast('Il microfono non parte'); return; }
  $('listen').classList.add('on');
  Promise.resolve(p).catch(e => {
    $('listen').classList.remove('on'); ascolto.attivo = false;
    if (e && e.code === 'not_granted') { DICT_NO = true; render(); toast('Microfono non permesso: scrivi la spesa con ＋ Spesa'); }
    else toast('Il microfono non è partito: riprova');
  });
}

// 📄 fogli (moduli dal basso)
function apri(html, init) {
  $('sheetIn').innerHTML = '<div class="grab"></div>' + html;
  $('sheet').classList.add('on'); $('sheetBg').classList.add('on');
  const root = $('sheetIn');
  root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', chiudi));
  if (init) init(root);
  const f = root.querySelector('[autofocus]'); if (f) setTimeout(() => { try { f.focus(); } catch (e) { } }, 80);
}
function chiudi() { $('sheet').classList.remove('on'); $('sheetBg').classList.remove('on'); }
function importo(s) {
  let t = String(s == null ? '' : s).replace(/[€\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const v = Math.round(parseFloat(t) * 100) / 100;
  return isFinite(v) ? v : NaN;
}
const errore = (root, t) => { let e = root.querySelector('.ferr'); if (!e) { e = document.createElement('div'); e.className = 'ferr note'; root.querySelector('form').prepend(e); } e.textContent = t; };
const prossimo15 = () => { const d = new Date(); return ENG.iso(new Date(d.getFullYear(), d.getMonth() + (d.getDate() >= 15 ? 1 : 0), 15)); };
const pressed = (root, sel) => { const b = root.querySelector(sel + '[aria-pressed="true"]'); return b ? b : null; };
function toggles(root, sel, multi) {
  root.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => {
    if (!multi) root.querySelectorAll(sel).forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', multi ? String(b.getAttribute('aria-pressed') !== 'true') : 'true');
  }));
}
function bottoneElimina(root, fn) {
  const b = root.querySelector('#fDel'); if (!b) return;
  b.addEventListener('click', () => { if (b.dataset.sure) { chiudi(); fn(); } else { b.dataset.sure = '1'; b.textContent = 'Tocca ancora per eliminare'; } });
}

function formMov(m, pre) {
  const nuovo = !m;
  m = m ? clone(m) : Object.assign({ id: nuovoId(), data: oggiISO(), importo: '', tipo: 'spesa', categoria: 'bar', nota: '' }, pre || {});
  const speciale = m.tipo === 'fissa' || m.tipo === 'scadenza';
  apri(`<h3 id="sheetTitle">${nuovo ? 'Nuova spesa' : speciale ? 'Movimento (' + esc(catInfo(m.categoria).nome.toLowerCase()) + ')' : 'Modifica movimento'}</h3>
  <form id="fm" style="display:grid;gap:14px">
    ${speciale ? '' : `<div class="seg" role="group" aria-label="Tipo di movimento"><button type="button" data-tipo="spesa" aria-pressed="${m.tipo === 'spesa'}">Spesa</button><button type="button" data-tipo="entrata" aria-pressed="${m.tipo === 'entrata'}">Entrata</button></div>`}
    <div class="field"><label for="fImp">Importo in euro</label><input id="fImp" class="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(fmtIn(m.importo))}" ${nuovo && m.importo === '' ? 'autofocus' : ''}></div>
    <div class="field" id="fCatBox" ${m.tipo === 'spesa' ? '' : 'hidden'}><span class="small muted" style="font-weight:600">Categoria</span><div class="cats">${CATS.map(c => `<button type="button" data-cat="${c.id}" aria-pressed="${m.categoria === c.id}"><span class="dot" style="background:${c.col}"></span>${esc(c.nome)}</button>`).join('')}</div></div>
    <label class="check" id="fStipBox" style="border:0;padding:0" ${m.tipo === 'entrata' ? '' : 'hidden'}><input type="checkbox" id="fStip" ${m.categoria === 'stipendio' ? 'checked' : ''}><span class="t">È lo stipendio</span></label>
    <div class="field"><label for="fNota">Nota (facoltativa)</label><input id="fNota" value="${esc(m.nota || '')}" placeholder="es. caffè e cornetto" autocomplete="off"></div>
    <div class="field"><label for="fData">Giorno</label><input id="fData" type="date" value="${esc(m.data)}"></div>
    <div id="fPiuBox" ${m.tipo === 'spesa' ? '' : 'hidden'} style="display:grid;gap:10px">
      <label class="check" style="border:0;padding:0"><input type="checkbox" id="fEscl" ${m.esclusa ? 'checked' : ''}><span class="t">Non contarla nel budget (es. pagata coi soldi di Revolut)</span></label>
      <label class="check" style="border:0;padding:0"><input type="checkbox" id="fPiu" ${m.addebito ? 'checked' : ''}><span class="t">La scalano dal conto più avanti (carta di credito)</span></label>
      <div class="field" id="fAddBox" ${m.addebito ? '' : 'hidden'}><label for="fAdd">Giorno in cui la scalano</label><input id="fAdd" type="date" value="${esc(m.addebito || prossimo15())}"></div>
    </div>
    <div class="foot"><button type="button" class="btn ghost" data-close>Annulla</button><button class="btn primary">Salva</button></div>
    ${nuovo ? '' : '<button type="button" class="btn danger" id="fDel">Elimina</button>'}
  </form>`, root => {
    toggles(root, '[data-cat]');
    root.querySelectorAll('[data-tipo]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-tipo]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const sp = b.dataset.tipo === 'spesa'; root.querySelector('#fCatBox').hidden = !sp; root.querySelector('#fPiuBox').hidden = !sp; root.querySelector('#fStipBox').hidden = sp;
    }));
    root.querySelector('#fPiu').addEventListener('change', e => { root.querySelector('#fAddBox').hidden = !e.target.checked; });
    bottoneElimina(root, () => cancellaMov(m.id));
    root.querySelector('#fm').addEventListener('submit', e => {
      e.preventDefault();
      const v = importo(root.querySelector('#fImp').value);
      if (!(v > 0)) return errore(root, 'Scrivi un importo, per esempio 3,50');
      const tb = pressed(root, '[data-tipo]'), tipo = speciale ? m.tipo : (tb ? tb.dataset.tipo : 'spesa');
      const out = { id: m.id, data: root.querySelector('#fData').value || oggiISO(), importo: v, tipo, nota: root.querySelector('#fNota').value.trim(), creato: m.creato || Date.now() };
      if (tipo === 'spesa') { const c = pressed(root, '[data-cat]'); out.categoria = c ? c.dataset.cat : 'altro'; if (root.querySelector('#fPiu').checked && root.querySelector('#fAdd').value) out.addebito = root.querySelector('#fAdd').value; if (root.querySelector('#fEscl').checked) out.esclusa = true; }
      for (const k of ['fonte', 'esercente', 'carta']) if (m[k] != null) out[k] = m[k];
      else if (tipo === 'entrata') out.categoria = root.querySelector('#fStip').checked ? 'stipendio' : 'extra';
      else out.categoria = m.categoria;
      chiudi();
      if (tipo === 'entrata' && out.categoria === 'stipendio') { const k = ENG.periodo(ENG.parse(out.data), ST.giornoStipendio).key; ST = conPeriodo(k, p => { p.stipendio = v; }); salvaStato(ST); }
      if ((m.esercente && !nuovo && tipo === 'spesa' && out.categoria !== m.categoria) || m._ctrl) {
        const s = clone(ST);
        if (m.esercente && !nuovo && tipo === 'spesa' && out.categoria !== m.categoria) { s.regole = s.regole || {}; s.regole[m.esercente] = out.categoria; }   // la prossima volta questo negozio va qui
        if (m._ctrl) s.daControllare = (s.daControllare || []).filter(x => x.id !== m._ctrl);
        salvaStato(s);
      }
      salvaMov(out, nuovo ? (tipo === 'entrata' ? 'Entrata segnata' : 'Spesa segnata: ' + eur(v)) : 'Movimento aggiornato');
    });
  });
}

function formFissa(f, tipo) {
  const nuovo = !f; f = f ? clone(f) : { id: 'f' + Date.now().toString(36), nome: '', importo: '', giorno: 1, tipo: tipo || 'fissa' };
  apri(`<h3 id="sheetTitle">${nuovo ? (f.tipo === 'abbonamento' ? 'Nuovo abbonamento' : 'Nuova spesa fissa') : esc(f.nome)}</h3>
  <form id="ff" style="display:grid;gap:14px">
    <div class="field"><label for="xNome">Nome</label><input id="xNome" value="${esc(f.nome)}" placeholder="es. Palestra" ${nuovo ? 'autofocus' : ''}></div>
    <div class="field"><label for="xImp">Importo al mese</label><input id="xImp" class="amount" inputmode="decimal" value="${esc(fmtIn(f.importo))}" placeholder="0,00"></div>
    <div class="field"><label for="xGg">Giorno del mese in cui esce</label><input id="xGg" type="number" min="1" max="31" inputmode="numeric" value="${esc(f.giorno)}"></div>
    <div class="field"><label for="xTipo">Che cos'è</label><select id="xTipo">${TIPI_FISSA.map(([k, n]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="foot"><button type="button" class="btn ghost" data-close>Annulla</button><button class="btn primary">Salva</button></div>
    ${nuovo ? '' : '<button type="button" class="btn danger" id="fDel">Elimina</button>'}
  </form>`, root => {
    bottoneElimina(root, () => { const s = clone(ST); s.fisse = s.fisse.filter(x => x.id !== f.id); salvaStato(s, 'Spesa fissa tolta'); });
    root.querySelector('#ff').addEventListener('submit', e => {
      e.preventDefault();
      const nome = root.querySelector('#xNome').value.trim(), v = importo(root.querySelector('#xImp').value), g = Math.round(+root.querySelector('#xGg').value);
      if (!nome) return errore(root, 'Scrivi un nome');
      if (!(v >= 0) || root.querySelector('#xImp').value.trim() === '') return errore(root, 'Scrivi l\'importo, per esempio 51,00');
      if (!(g >= 1 && g <= 31)) return errore(root, 'Il giorno va da 1 a 31');
      const s = clone(ST), out = { id: f.id, nome, importo: v, giorno: g, tipo: root.querySelector('#xTipo').value };
      const i = s.fisse.findIndex(x => x.id === f.id); if (i >= 0) s.fisse[i] = out; else s.fisse.push(out);
      if (out.tipo === 'risparmio') s.obiettivoRisparmio = v;
      chiudi(); salvaStato(s, nuovo ? 'Spesa fissa aggiunta' : 'Spesa fissa aggiornata');
    });
  });
}

function mesiPicker(sel) { return `<div class="months" role="group" aria-label="Mesi">${MESI.map((m, i) => `<button type="button" data-mese="${i + 1}" aria-pressed="${sel.includes(i + 1)}">${m}</button>`).join('')}</div>`; }
function formScadenza(x, entrata) {
  const nuovo = !x; x = x ? clone(x) : { id: (entrata ? 'e' : 's') + Date.now().toString(36), nome: '', importo: '', mesi: [], giorno: 1 };
  apri(`<h3 id="sheetTitle">${entrata ? (nuovo ? 'Nuova entrata extra' : 'Entrata extra') : (nuovo ? 'Nuova scadenza' : 'Scadenza')}</h3>
  <form id="fs" style="display:grid;gap:14px">
    <div class="field"><label for="yNome">Nome</label><input id="yNome" value="${esc(x.nome)}" placeholder="${entrata ? 'es. Quattordicesima' : 'es. Assicurazione auto'}" ${nuovo ? 'autofocus' : ''}></div>
    <div class="field"><label for="yImp">Importo${entrata ? ' (circa)' : ' ogni volta'}</label><input id="yImp" class="amount" inputmode="decimal" value="${esc(fmtIn(x.importo))}" placeholder="0,00"></div>
    <div class="field"><span class="small muted" style="font-weight:600">${entrata ? 'Mese in cui arriva' : 'Mesi in cui si paga'}</span>${mesiPicker(x.mesi || [])}</div>
    <div class="field"><label for="yGg">Giorno</label><input id="yGg" type="number" min="1" max="31" inputmode="numeric" value="${esc(x.giorno || 1)}"></div>
    ${entrata ? '' : '<p class="muted small" style="margin:0">L\'app mette da parte una quota ogni mese, così quando arriva la scadenza i soldi ci sono.</p>'}
    <div class="foot"><button type="button" class="btn ghost" data-close>Annulla</button><button class="btn primary">Salva</button></div>
    ${nuovo ? '' : '<button type="button" class="btn danger" id="fDel">Elimina</button>'}
  </form>`, root => {
    toggles(root, '[data-mese]', true);
    const lista = entrata ? 'entrate' : 'scadenze';
    bottoneElimina(root, () => { const s = clone(ST); s[lista] = (s[lista] || []).filter(y => y.id !== x.id); salvaStato(s, 'Tolta'); });
    root.querySelector('#fs').addEventListener('submit', e => {
      e.preventDefault();
      const nome = root.querySelector('#yNome').value.trim(), v = importo(root.querySelector('#yImp').value), g = Math.round(+root.querySelector('#yGg').value);
      const mesi = [...root.querySelectorAll('[data-mese][aria-pressed="true"]')].map(b => +b.dataset.mese);
      if (!nome) return errore(root, 'Scrivi un nome');
      if (!(v > 0)) return errore(root, 'Scrivi l\'importo');
      if (!mesi.length) return errore(root, 'Scegli almeno un mese');
      if (!(g >= 1 && g <= 31)) return errore(root, 'Il giorno va da 1 a 31');
      const s = clone(ST); s[lista] = s[lista] || [];
      const out = { id: x.id, nome, importo: v, mesi, giorno: g };
      const i = s[lista].findIndex(y => y.id === x.id); if (i >= 0) s[lista][i] = out; else s[lista].push(out);
      chiudi(); salvaStato(s, 'Salvato');
    });
  });
}

function formNumero(titolo, label, valore, testo, fn) {
  apri(`<h3 id="sheetTitle">${titolo}</h3>
  <form id="fn" style="display:grid;gap:14px">
    ${testo ? `<p class="muted small" style="margin:0">${testo}</p>` : ''}
    <div class="field"><label for="nVal">${label}</label><input id="nVal" class="amount" inputmode="decimal" value="${esc(fmtIn(valore))}" placeholder="0,00" autofocus></div>
    <div class="foot"><button type="button" class="btn ghost" data-close>Annulla</button><button class="btn primary">Salva</button></div>
  </form>`, root => {
    root.querySelector('#fn').addEventListener('submit', e => {
      e.preventDefault();
      const raw = root.querySelector('#nVal').value.trim(), neg = /^[-−]/.test(raw), v = importo(raw.replace(/^[-−]/, ''));
      if (!(v >= 0) || raw === '') return errore(root, 'Scrivi un numero, per esempio 250,00');
      chiudi(); fn(neg ? -v : v);
    });
  });
}
function formBudget() {
  const ris = (ST.fisse || []).find(f => f.tipo === 'risparmio');
  apri(`<h3 id="sheetTitle">Budget</h3>
  <form id="fb" style="display:grid;gap:14px">
    <div class="field"><label for="bStip">Stipendio di solito</label><input id="bStip" class="amount" inputmode="decimal" value="${esc(fmtIn(ST.stipendio))}"></div>
    <div class="field"><label for="bGg">Giorno in cui arriva</label><input id="bGg" type="number" min="1" max="28" inputmode="numeric" value="${esc(ST.giornoStipendio)}"></div>
    <div class="field"><label for="bRis">Risparmio ogni mese (va sul libretto)</label><input id="bRis" class="amount" inputmode="decimal" value="${esc(fmtIn(ris ? ris.importo : ST.obiettivoRisparmio || 0))}"></div>
    <div class="foot"><button type="button" class="btn ghost" data-close>Annulla</button><button class="btn primary">Salva</button></div>
  </form>`, root => {
    root.querySelector('#fb').addEventListener('submit', e => {
      e.preventDefault();
      const st = importo(root.querySelector('#bStip').value), g = Math.round(+root.querySelector('#bGg').value), r = importo(root.querySelector('#bRis').value);
      if (!(st > 0)) return errore(root, 'Scrivi lo stipendio');
      if (!(g >= 1 && g <= 28)) return errore(root, 'Il giorno va da 1 a 28');
      if (!(r >= 0)) return errore(root, 'Scrivi quanto vuoi mettere da parte');
      const s = clone(ST); s.stipendio = st; s.giornoStipendio = g; s.obiettivoRisparmio = r;
      const f = s.fisse.find(x => x.tipo === 'risparmio');
      if (f) f.importo = r; else s.fisse.unshift({ id: 'risparmio', nome: 'Risparmio sul libretto', importo: r, giorno: g, tipo: 'risparmio' });
      chiudi(); salvaStato(s, 'Budget aggiornato');
    });
  });
}

// 🖼 viste
const riga = (sx, dx) => `<div><span>${sx}</span><i></i><b>${dx}</b></div>`;
function movItem(m) {
  const c = catInfo(m.tipo === 'spesa' ? m.categoria : m.tipo === 'entrata' ? m.categoria : m.tipo === 'scadenza' ? 'scadenza' : (m.categoria === 'risparmio' ? 'risparmio' : 'fissa'));
  const piu = m.tipo === 'entrata', soft = m.tipo === 'fissa' || m.tipo === 'scadenza' || m.esclusa;
  const tag = (m.tipo === 'fissa' ? '<span class="tag">fissa</span>' : m.tipo === 'scadenza' ? '<span class="tag">scadenza</span>' : '') + (m.esclusa ? '<span class="tag">non conta</span>' : '')
    + (m.fonte === 'gpay' ? '<span class="tag auto">Google Pay</span>' : m.fonte === 'paypal' ? '<span class="tag auto">PayPal</span>' : m.fonte === 'mail' ? '<span class="tag auto">mail MPS</span>' : '');
  const sub = [c.nome, m.addebito ? 'la scalano il ' + dBreve(m.addebito) : ''].filter(Boolean).join(' · ');
  return `<button class="item" data-act="mov" data-id="${esc(m.id)}"><span class="dot" style="background:${c.col}"></span><span><span class="t">${esc(m.nota || c.nome)}${tag}</span><br><span class="d">${esc(sub)}</span></span><span class="a ${piu ? 'plus' : soft ? 'soft' : ''}">${piu ? '+' : '−'}${fmt(m.importo)} €</span></button>`;
}
function arrivoItem(x) {
  const d = ENG.parse(x.data);
  return `<div class="item"><span class="date"><b>${d.getDate()}</b>${MESI[d.getMonth()]}</span><span><span class="t">${esc(x.nome)}</span><br><span class="d">${{ stipendio: 'entrata', extra: 'entrata extra', scadenza: 'scadenza', addebito: 'addebito carta', risparmio: 'sul libretto', trasferimento: 'da spostare', abbonamento: 'abbonamento', fissa: 'spesa fissa' }[x.tipo] || ''}</span></span><span class="a ${x.segno > 0 ? 'plus' : ''}">${x.segno > 0 ? '+' : '−'}${fmt(x.importo)} €</span></div>`;
}
function spiegazione(R) {
  const fine = dBreve(R.periodo.fine);
  if (R.limite === 'conto') return `Fino al ${fine}, tolte le uscite già in arrivo (${eur(R.uscite)}), sul conto restano <b>${eur(R.contoPerSpese)}</b> per le spese: sono ${eur(R.contoGiorno)} al giorno.`;
  return `Il piano del mese ti lascia <b>${eur(R.restoPiano)}</b> fino al ${fine}: sono ${eur(R.pianoGiorno)} al giorno. Sul conto ci sono abbastanza soldi.`;
}
function daSpostare(R) {
  const key = R.periodo.key, p = ((ST.periodi || {})[key] || {}).fatti || {};
  return R.fissePeriodo.filter(x => x.tipo === 'risparmio' || x.tipo === 'trasferimento').map(x => ({ ...x, fatto: !!p[x.id] }));
}
function avvisiOggi() {
  let h = '';
  if (ANDROID && !chiama('letturaAttiva')) h += `<div class="note"><strong>Fai segnare le spese all'app</strong><span>Attiva la lettura delle notifiche: i pagamenti con Google Pay si segnano da soli e il saldo si aggiorna con la mail di MPS.</span><div class="riga-btn"><button class="btn sm primary" data-act="attivaLettura">Attiva</button><a class="btn sm" href="#impostazioni">Come si fa</a></div></div>`;
  const dc = ST.daControllare || [];
  if (dc.length) h += `<div class="card"><header><h2>Da controllare</h2><small>${dc.length === 1 ? '1 cosa' : dc.length + ' cose'}</small></header><div class="list">${dc.map(x => `<div class="ctrl"><div class="item"><span class="date"><b>${ENG.parse(x.data).getDate()}</b>${MESI[ENG.parse(x.data).getMonth()]}</span><span><span class="t">${esc(x.nota)}</span><br><span class="d">${esc(x.tipo === 'addebito' ? 'Non è tra le spese fisse' : x.tipo === 'accredito' ? 'Soldi arrivati sul conto' : 'Non leggo l\'importo: scrivilo tu')}</span></span><span class="a ${x.tipo === 'accredito' ? 'plus' : ''}">${x.importo == null ? '? €' : (x.tipo === 'accredito' ? '+' : '−') + fmt(x.importo) + ' €'}</span></div><div class="riga-btn"><button class="btn sm primary" data-act="ctrlSi" data-id="${esc(x.id)}">${x.tipo === 'accredito' ? 'È un\'entrata' : 'Segna la spesa'}</button><button class="btn sm" data-act="ctrlNo" data-id="${esc(x.id)}">${x.tipo === 'addebito' ? 'Era già in lista' : 'Ignora'}</button></div></div>`).join('')}</div></div>`;
  return h;
}
function testoSaldo() {
  const s = ST.saldo, d = s.ts ? new Date(s.ts) : null, hh = d ? ' alle ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '';
  if (s.fonte === 'mail') return `Saldo letto dalla mail di MPS: ${eur(s.importo)} il ${dBreve(s.data)}${hh}. Si aggiorna da solo ogni mattina.`;
  return `Ultimo saldo che hai scritto: ${eur(s.importo)} il ${dBreve(s.data)}${hh}.` + (ANDROID ? ' Con la lettura automatica si aggiorna da solo con la mail di MPS del mattino.' : ' Ogni tanto aggiornalo col saldo disponibile dell\'app MPS.');
}
function cardLettura() {
  const on = !!chiama('letturaAttiva'), nt = chiama('notificheAttive') !== false;
  const reg = FIN.dati.registro().slice(-12).reverse();
  const hhmm = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  return `<div class="card"><header><h2>Lettura automatica</h2><small class="${on ? 'si' : 'no'}">${on ? '● attiva' : '● spenta'}</small></header>
    <div class="list">
      <div class="item stato"><span class="pallino ${on ? 'si' : ''}"></span><span><span class="t">Lettura delle notifiche</span><br><span class="d">${on ? 'Legge Google Pay, le mail di MPS e PayPal' : 'Spenta: le spese non si segnano da sole'}</span></span>${on ? '<span></span>' : '<button class="btn sm primary" data-act="attivaLettura">Attiva</button>'}</div>
      <div class="item stato"><span class="pallino ${nt ? 'si' : ''}"></span><span><span class="t">Avvisi dell'app</span><br><span class="d">${nt ? 'Dopo ogni spesa ti dice quanto puoi spendere ancora' : 'Spenti: non vedrai il messaggio dopo ogni spesa'}</span></span>${nt ? '<span></span>' : '<button class="btn sm primary" data-act="attivaAvvisi">Attiva</button>'}</div>
    </div>
    ${on ? '' : `<div class="note"><strong>Se l'interruttore è grigio</strong><span>Android lo blocca per le app installate fuori dal Play Store. 1) Tocca «Attiva» una volta. 2) Tocca «Apri info app», poi i tre puntini in alto a destra e «Consenti impostazioni con restrizioni». 3) Torna qui e tocca di nuovo «Attiva».</span><button class="btn sm" data-act="infoApp" style="justify-self:start">Apri info app</button></div>`}
    <p class="small muted" style="margin:0">Cosa legge: <b>Google Pay</b> (le spese, subito) · <b>mail di MPS</b> in Gmail (saldo del mattino, addebiti, stipendio) · <b>PayPal</b>. Nell'app Gmail lascia accese le notifiche.</p>
    <h3 class="sub">Ultime notifiche lette</h3>
    <div class="list">${reg.length ? reg.map(r => `<div class="item"><span class="date"><b>${new Date(r.quando).getDate()}</b>${MESI[new Date(r.quando).getMonth()]}</span><span><span class="t">${esc(r.esito || '')}</span><br><span class="d">${esc(hhmm(r.quando) + ' · ' + r.app + ' · ' + [r.titolo, r.testo].filter(Boolean).join(' — '))}</span></span><span></span></div>`).join('') : '<div class="empty">Ancora nessuna: paga qualcosa con Google Pay e la vedrai qui</div>'}</div>
    <p class="small muted" style="margin:0">Versione ${esc(chiama('versione') || '')}</p>
  </div>`;
}
const V = {};
V.oggi = (R, oggi) => {
  const neg = R.oggiPuoi < 0, key = R.periodo.key, ov = (ST.periodi || {})[key] || {};
  const sposta = daSpostare(R), manca = sposta.filter(x => !x.fatto);
  const giorniDa = Math.round((ENG.parse(oggi) - ENG.parse(R.periodo.inizio)) / 864e5);
  let h = `<section class="receipt" aria-label="Quanto puoi spendere oggi">
    <div class="lbl"><span>${esc(dLunga(oggi))}</span><span>${R.periodo.giorni} ${R.periodo.giorni === 1 ? 'giorno' : 'giorni'} allo stipendio</span></div>
    <div style="margin-top:12px;font-weight:600">${neg ? 'Oggi hai speso più del previsto' : 'Oggi puoi spendere ancora'}</div>
    <div class="big ${neg ? 'neg' : ''}"><span>${neg ? '−' : ''}${fmt(R.oggiPuoi)}</span><span class="eur">€</span></div>
    <span class="chip ${R.limite === 'conto' ? 'warn' : ''}">${R.limite === 'conto' ? 'Il limite è il conto' : 'Il limite è il piano del mese'}</span>
    <div class="rows mono">${riga('Sul conto per le spese', eur(R.contoPerSpese))}${riga('Piano del mese, rimasto', eur(R.restoPiano))}${riga('Speso oggi', eur(R.spesoOggi))}</div>
    <div class="hint">${spiegazione(R)}</div>
  </section>
  <div class="actions"><button class="btn primary" data-act="spesa">＋ Spesa</button>${DICT && !DICT_NO ? `<button class="btn" data-act="detta">${MIC} Detta</button>` : ''}</div>`;
  h += avvisiOggi();
  if (ov.stipendio == null && giorniDa <= 5) h += `<div class="note"><strong>È arrivato lo stipendio?</strong><span>Segna l'importo vero: ora conto ${eur(ST.stipendio)}.</span><button class="btn sm primary" data-act="stipendio" style="justify-self:start">Segna lo stipendio</button></div>`;
  if (manca.length) h += `<div class="card"><header><h2>Da spostare</h2><small>dopo lo stipendio</small></header><div>${manca.map(x => `<label class="check"><input type="checkbox" data-act="fatto" data-id="${esc(x.id)}"><span class="t">${esc(x.nome)}</span><b class="num">${eur(x.importo)}</b></label>`).join('')}</div></div>`;
  else if (sposta.length) h += `<div class="note ok"><span>Fatto: ${sposta.map(x => eur(x.importo) + ' ' + (x.tipo === 'risparmio' ? 'sul libretto' : 'su Revolut')).join(' e ')}.</span></div>`;
  h += `<div class="tiles">
    <div class="tile"><span class="k">Già speso nel mese</span><span class="v">${eur(R.speso)}</span><span class="s">piano ${eur(R.budget)}</span></div>
    <div class="tile"><span class="k">Risparmio del mese</span><span class="v">${eur(R.risparmio)}</span><span class="s">libretto ${eur(R.libretto)}</span></div>
    <div class="tile"><span class="k">Accantonati per le scadenze</span><span class="v">${eur(R.accTot)}</span><span class="s">${R.quota > 0 ? eur(R.quota) + ' al mese' : 'si parte dal ' + dBreve(ST.accantonaDal || R.periodo.prossimo)}</span></div>
    <div class="tile"><span class="k">Spese fisse del mese</span><span class="v">${eur(R.totFisse)}</span><span class="s">risparmio compreso</span></div>
    <div class="tile"><span class="k">Stipendio</span><span class="v">${eur(R.stipendio)}</span><span class="s">prossimo il ${dBreve(R.periodo.prossimo)}</span></div>
    <div class="tile"><span class="k">Giorni rimasti</span><span class="v">${R.periodo.giorni}</span><span class="s">su ${R.periodo.giorniTot}</span></div>
  </div>`;
  const arr = ENG.prossime(ST, MOVS, oggi, 35).slice(0, 8);
  h += `<div class="card"><header><h2>In arrivo</h2><small>prossimi 35 giorni</small></header><div class="list">${arr.length ? arr.map(arrivoItem).join('') : '<div class="empty">Niente in arrivo</div>'}</div></div>`;
  const ult = MOVS.slice(0, 6);
  h += `<div class="card"><header><h2>Ultimi movimenti</h2><a class="small" href="#movimenti">Vedi tutti</a></header><div class="list">${ult.length ? ult.map(movItem).join('') : '<div class="empty">Ancora nessun movimento</div>'}</div></div>`;
  return h;
};
V.movimenti = (R, oggi) => {
  const g = ST.giornoStipendio, P = ENG.periodo(ENG.parse(VISTO || oggi), g), ini = ENG.iso(P.S), fin = ENG.iso(P.E);
  const lista = MOVS.filter(m => m.data >= ini && m.data <= fin);
  const spese = lista.filter(m => m.tipo === 'spesa' && !m.esclusa), tot = spese.reduce((s, m) => s + m.importo, 0);
  const perCat = {}; for (const m of spese) perCat[m.categoria] = (perCat[m.categoria] || 0) + m.importo;
  const cats = Object.entries(perCat).sort((a, b) => b[1] - a[1]), max = cats.length ? cats[0][1] : 1;
  const attuale = ini === R.periodo.inizio;
  let h = `<div class="card"><div class="periodnav"><button class="btn sm" data-act="per" data-d="${ENG.iso(ENG.addDays(P.S, -1))}" aria-label="Mese prima">‹</button><strong>${dBreve(ini)} – ${dBreve(fin)}</strong><button class="btn sm" data-act="per" data-d="${ENG.iso(P.N)}" aria-label="Mese dopo" ${attuale ? 'disabled' : ''}>›</button></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted small">Spese di tutti i giorni</span><strong class="num" style="font:800 22px var(--display)">${eur(tot)}</strong></div>
    ${cats.map(([c, v]) => `<div class="catrow"><span>${esc(catInfo(c).nome)}</span><span class="num">${eur(v)}</span><div class="bar"><span style="width:${Math.max(3, v / max * 100)}%;background:${catInfo(c).col}"></span></div></div>`).join('') || '<div class="empty">Nessuna spesa in questo mese</div>'}
    <button class="btn primary" data-act="spesa">＋ Spesa</button></div>`;
  const perGiorno = {}; for (const m of lista) (perGiorno[m.data] = perGiorno[m.data] || []).push(m);
  const giorni = Object.keys(perGiorno).sort().reverse();
  h += `<div class="card"><header><h2>Movimenti</h2><small>${lista.length}</small></header><div>${giorni.map(d => `<div class="day">${esc(dLunga(d))}</div><div class="list">${perGiorno[d].map(movItem).join('')}</div>`).join('') || '<div class="empty">Nessun movimento</div>'}</div></div>`;
  if ((ST.storico || []).length) {
    const st = ST.storico, mx = Math.max(...st.map(x => x[1])), tt = st.reduce((s, x) => s + x[1], 0);
    h += `<div class="card"><header><h2>L'ultimo anno</h2><small>media al mese, dal conto MPS</small></header>${st.map(([n, v]) => `<div class="catrow"><span>${esc(n)}</span><span class="num">${eur(v)}</span><div class="bar"><span style="width:${v / mx * 100}%"></span></div></div>`).join('')}<div style="display:flex;justify-content:space-between"><strong>Totale</strong><strong class="num">${eur(tt)}</strong></div></div>`;
  }
  return h;
};
V.conti = (R, oggi) => {
  const sposta = daSpostare(R), ris = (ST.fisse || []).find(f => f.tipo === 'risparmio'), rm = ris ? ris.importo : 0;
  const carta = MOVS.filter(m => m.tipo === 'spesa' && m.addebito && m.addebito >= oggi).sort((a, b) => a.addebito < b.addebito ? -1 : 1);
  let h = `<div class="card"><header><h2>Conto MPS</h2><small>conto principale</small></header>
    <div><span class="muted small">Saldo stimato adesso</span><div class="num" style="font:800 34px/1.1 var(--display)">${eur(R.contoOggi)}</div><span class="muted small">${testoSaldo()}</span></div>
    <button class="btn sm" data-act="saldo" style="justify-self:start">Aggiorna saldo</button>
    <div class="list">${R.daPagare.map(x => `<div class="item"><span class="date"><b>${ENG.parse(x.data).getDate()}</b>${MESI[ENG.parse(x.data).getMonth()]}</span><span class="t">${esc(x.nome)}</span><span class="a">−${fmt(x.importo)} €</span></div>`).join('') || '<div class="empty">Nessuna uscita in arrivo prima dello stipendio</div>'}</div>
    <div class="rows mono">${riga('Restano per le spese', eur(R.contoPerSpese))}${riga('Fino al', dBreve(R.periodo.fine))}</div></div>`;
  h += `<div class="card"><header><h2>Da spostare</h2><small>questo mese</small></header>${sposta.length ? sposta.map(x => `<label class="check"><input type="checkbox" data-act="fatto" data-id="${esc(x.id)}" ${x.fatto ? 'checked' : ''}><span class="t">${esc(x.nome)}</span><b class="num">${eur(x.importo)}</b></label>`).join('') : '<div class="empty">Niente da spostare</div>'}</div>`;
  const p6 = R.libretto + rm * 6, p12 = R.libretto + rm * 12;
  h += `<div class="card"><header><h2>Libretto postale</h2><small>i tuoi risparmi</small></header>
    <div class="num" style="font:800 34px/1.1 var(--display)">${eur(R.libretto)}</div>
    ${rm > 0 ? `<div class="rows mono">${riga('Ogni mese', '+' + eur(rm))}${riga('Fra 6 mesi, circa', eur(p6))}${riga('Fra 12 mesi, circa', eur(p12))}</div>` : ''}
    <button class="btn sm" data-act="libretto" style="justify-self:start">Aggiorna saldo libretto</button></div>`;
  const rev = (ST.fisse || []).find(f => f.tipo === 'trasferimento');
  if (rev) h += `<div class="card"><header><h2>Revolut</h2><small>spesa con la tua ragazza</small></header><p style="margin:0">Ogni mese ci metti <b>${eur(rev.importo)}</b> per la spesa da mangiare. È già tra le spese fisse.</p>${ANDROID ? '<p class="muted small" style="margin:0">Le ricariche che fai con Google Pay le segno come spese tue. Quello che paghi con la carta Revolut non lo conto: quei soldi sono già usciti dal conto MPS.</p>' : ''}</div>`;
  h += `<div class="card"><header><h2>Carta di credito MPS</h2><small>la scalano il 15</small></header>
    <div class="list">${carta.map(m => `<button class="item" data-act="mov" data-id="${esc(m.id)}"><span class="date"><b>${ENG.parse(m.addebito).getDate()}</b>${MESI[ENG.parse(m.addebito).getMonth()]}</span><span class="t">${esc(m.nota || 'Carta di credito')}</span><span class="a">−${fmt(m.importo)} €</span></button>`).join('') || '<div class="empty">Nessun addebito segnato</div>'}</div>
    <button class="btn sm" data-act="carta" style="justify-self:start">Segna addebito carta</button></div>`;
  return h;
};
V.fisse = R => {
  const fisse = ST.fisse || [], norm = fisse.filter(f => f.tipo !== 'abbonamento'), abb = fisse.filter(f => f.tipo === 'abbonamento');
  const tot = a => a.reduce((s, x) => s + (+x.importo || 0), 0);
  const acc = {}; for (const a of R.accantonati) acc[a.id] = a;
  const fItem = f => `<button class="item" data-act="fissa" data-id="${esc(f.id)}"><span class="date"><b>${f.giorno}</b>del mese</span><span><span class="t">${esc(f.nome)}</span><br><span class="d">${esc((TIPI_FISSA.find(t => t[0] === f.tipo) || ['', 'Spesa fissa'])[1])}</span></span><span class="a">${fmt(f.importo)} €</span></button>`;
  const sItem = (s, ent) => `<button class="item" data-act="${ent ? 'entrata' : 'scad'}" data-id="${esc(s.id)}"><span class="date"><b>${s.giorno}</b>${s.mesi.length > 1 ? s.mesi.length + ' volte' : MESI[s.mesi[0] - 1]}</span><span><span class="t">${esc(s.nome)}</span><br><span class="d">${ent ? 'arriva a ' + s.mesi.map(m => MESI_L[m - 1]).join(', ') : (s.mesi.length > 1 ? s.mesi.map(m => MESI[m - 1]).join(', ') + ' · ' : '') + 'quota ' + eur(ENG.quotaMese(s)) + ' al mese' + (acc[s.id] ? ' · da parte ' + eur(acc[s.id].accantonato) : '')}</span></span><span class="a ${ent ? 'plus' : ''}">${ent ? '+' : ''}${fmt(s.importo)} €</span></button>`;
  const qp = R.quotaPiena;
  let h = `<section class="receipt" aria-label="Riepilogo spese fisse"><div class="lbl"><span>Ogni mese</span><span>dal ${dBreve(ST.accantonaDal || R.periodo.prossimo)}</span></div>
    <div class="big" style="font-size:clamp(44px,13vw,60px)"><span>${fmt(tot(fisse) + qp)}</span><span class="eur">€</span></div>
    <div class="rows mono">${riga('Spese fisse e risparmio', eur(tot(norm)))}${riga('Abbonamenti', eur(tot(abb)))}${riga('Quota per le scadenze', eur(qp))}${riga('Stipendio di solito', eur(ST.stipendio))}${riga('Restano per il resto', eur(ST.stipendio - tot(fisse) - qp))}</div></section>`;
  h += `<div class="card"><header><h2>Spese fisse mensili</h2><small>${eur(tot(norm))}</small></header><div class="list">${norm.map(fItem).join('') || '<div class="empty">Nessuna</div>'}</div><button class="btn sm" data-act="fissa" style="justify-self:start">＋ Aggiungi spesa fissa</button></div>`;
  h += `<div class="card"><header><h2>Abbonamenti</h2><small>${eur(tot(abb))} al mese</small></header><div class="list">${abb.map(fItem).join('') || '<div class="empty">Nessuno</div>'}</div><button class="btn sm" data-act="fissa" data-tipo="abbonamento" style="justify-self:start">＋ Aggiungi abbonamento</button></div>`;
  h += `<div class="card"><header><h2>Scadenze annuali</h2><small>${eur(qp)} al mese</small></header><p class="muted small" style="margin:0">Una quota al mese, così alla scadenza i soldi ci sono.</p><div class="list">${(ST.scadenze || []).map(s => sItem(s)).join('') || '<div class="empty">Nessuna</div>'}</div><button class="btn sm" data-act="scad" style="justify-self:start">＋ Aggiungi scadenza</button></div>`;
  h += `<div class="card"><header><h2>Entrate extra</h2><small>non contano nel piano</small></header><div class="list">${(ST.entrate || []).map(e => sItem(e, true)).join('') || '<div class="empty">Nessuna</div>'}</div><button class="btn sm" data-act="entrata" style="justify-self:start">＋ Aggiungi entrata extra</button></div>`;
  return h;
};
V.impostazioni = R => {
  const ris = (ST.fisse || []).find(f => f.tipo === 'risparmio');
  return `<div class="card"><header><h2>Budget</h2></header><div class="rows mono">${riga('Stipendio di solito', eur(ST.stipendio))}${riga('Arriva il giorno', ST.giornoStipendio)}${riga('Risparmio ogni mese', eur(ris ? ris.importo : 0))}</div><button class="btn sm" data-act="budget" style="justify-self:start">Modifica</button></div>
  <div class="card"><header><h2>Come funziona</h2></header>
    <p style="margin:0">Ogni giorno l'app ti dice quanto puoi spendere fino al prossimo stipendio. Guarda due cose e prende la più bassa: il <b>piano del mese</b> (stipendio meno spese fisse, risparmio e quota delle scadenze) e i <b>soldi veri sul conto</b> (ultimo saldo meno le uscite già in arrivo).</p>
    ${ANDROID ? '<p class="muted small" style="margin:0">Le spese pagate con Google Pay si segnano da sole; le altre le segni tu con ＋ Spesa o a voce. I dati restano su questo telefono: ogni tanto fai un backup.</p>' : '<p class="muted small" style="margin:0">Le spese le segni tu con ＋ Spesa o a voce. La lettura automatica delle notifiche della banca c\'è solo nell\'app Android. I dati sono salvati nel tuo account Claude: li vedi uguali dal telefono e dal PC.</p>'}</div>
  ${ANDROID ? cardLettura() : ''}
  <div class="card"><header><h2>Backup</h2></header><p class="muted small" style="margin:0">Una copia di tutti i dati in un file, da tenere da parte.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn sm" data-act="esporta">Esporta backup</button><label class="btn sm" for="imp">Importa backup</label><input type="file" id="imp" accept=".json,application/json" hidden></div></div>
  <div class="card"><header><h2>Cancella tutti i dati</h2></header><p class="muted small" style="margin:0">Toglie stipendio, spese fisse, scadenze e movimenti. Prima fai un backup.</p><button class="btn sm danger" data-act="cancellaTutto" style="justify-self:start">Cancella tutto</button></div>`;
};

function onboarding() {
  return `<section class="receipt"><div class="lbl"><span>Benvenuto</span><span>Finanze</span></div><h2 style="font-size:26px;margin:12px 0 6px">Partiamo dallo stipendio</h2><p class="muted" style="margin:0">Scrivi tre numeri e l'app comincia a dirti quanto puoi spendere ogni giorno.</p></section>
  <div class="card"><form id="fo" style="display:grid;gap:14px">
    <div class="field"><label for="oStip">Stipendio di solito</label><input id="oStip" class="amount" inputmode="decimal" placeholder="1.685,00"></div>
    <div class="field"><label for="oGg">Giorno in cui arriva</label><input id="oGg" type="number" min="1" max="28" inputmode="numeric" value="17"></div>
    <div class="field"><label for="oSaldo">Saldo disponibile sul conto adesso</label><input id="oSaldo" class="amount" inputmode="decimal" placeholder="0,00"></div>
    <button class="btn primary">Inizia</button></form></div>
  ${ANDROID ? '<div class="card"><header><h2>Hai già il file con i tuoi dati?</h2></header><p class="muted small" style="margin:0">Se Claude ti ha mandato il backup, importalo qui e ritrovi tutto com\'era.</p><label class="btn" for="imp">Importa il file</label><input type="file" id="imp" accept=".json,application/json" hidden></div>' : ''}`;
}
function syncTxt() {
  if (ANDROID) return S.caricato ? 'Salvato sul telefono' : '';
  if (S.errore === 'lento') return 'Dati non raggiungibili: forse sono vecchi';
  if (S.errore) return 'Dati non aggiornati';
  if (!DB) return S.caricato ? 'Solo su questo telefono' : '';
  return S.arrivato ? 'Salvato nel tuo account' : 'Mi collego…';
}
function render() {
  const v = $('view');
  $('sync').textContent = syncTxt(); $('sync').className = 'sync' + (S.errore ? ' err' : '');
  if (!ST) {
    $('titolo').textContent = 'Finanze'; $('perLbl').textContent = '';
    if (!S.caricato) { v.innerHTML = '<div class="loading"><div>Carico i tuoi conti…</div></div>'; return; }
    if (S.locale) { v.innerHTML = '<div class="note"><strong>Apri l\'app da claude.ai</strong><span>Per vedere e salvare i tuoi dati apri questa pagina da claude.ai, col tuo account.</span></div>'; return; }
    v.innerHTML = onboarding(); return;
  }
  const oggi = oggiISO(), R = ENG.calcola(ST, MOVS, oggi);
  $('titolo').textContent = { oggi: 'Oggi', movimenti: 'Movimenti', conti: 'Conti', fisse: 'Spese fisse', impostazioni: 'Impostazioni' }[TAB];
  $('perLbl').textContent = 'mese dal ' + dBreve(R.periodo.inizio) + ' al ' + dBreve(R.periodo.fine);
  v.innerHTML = V[TAB](R, oggi);
}

// 👆 azioni
const ACT = {
  spesa: () => formMov(null),
  detta: () => detta(),
  mov: d => { const m = MOVS.find(x => x.id === d.id); if (m) formMov(m); },
  fissa: d => formFissa(d.id ? (ST.fisse || []).find(x => x.id === d.id) : null, d.tipo),
  scad: d => formScadenza(d.id ? (ST.scadenze || []).find(x => x.id === d.id) : null, false),
  entrata: d => formScadenza(d.id ? (ST.entrate || []).find(x => x.id === d.id) : null, true),
  per: d => { VISTO = d.d; render(); },
  saldo: () => formNumero('Aggiorna saldo', 'Saldo disponibile adesso (dall\'app MPS)', ST.saldo.importo, 'Apri l\'app MPS e copia il saldo disponibile: l\'app ripartirà da lì.', v => { const s = clone(ST); s.saldo = { importo: v, data: oggiISO(), ts: Date.now(), fonte: 'manuale' }; salvaStato(s, 'Saldo aggiornato'); }),
  libretto: () => formNumero('Saldo del libretto', 'Quanto c\'è sul libretto adesso', ST.libretto ? ST.libretto.saldo : 0, '', v => { const s = clone(ST); s.libretto = { saldo: v, data: oggiISO() }; salvaStato(s, 'Libretto aggiornato'); }),
  stipendio: () => { const R = ENG.calcola(ST, MOVS, oggiISO()); formNumero('Stipendio arrivato', 'Quanto è arrivato', ST.stipendio, 'Lo trovi nei movimenti dell\'app MPS.', v => { ST = conPeriodo(R.periodo.key, p => { p.stipendio = v; }); salvaStato(ST, 'Stipendio segnato'); salvaMov({ id: nuovoId(), data: R.periodo.inizio, importo: v, tipo: 'entrata', categoria: 'stipendio', nota: 'Stipendio', creato: Date.now() }); }); },
  carta: () => formMov(null, { categoria: 'carta', nota: 'Carta di credito', addebito: prossimo15() }),
  budget: () => formBudget(),
  esporta: () => esporta(),
  attivaLettura: () => chiama('apriLettura'),
  infoApp: () => chiama('apriInfoApp'),
  attivaAvvisi: () => chiama('chiediNotifiche'),
  ctrlSi: d => {
    const x = (ST.daControllare || []).find(y => y.id === d.id); if (!x) return;
    if (x.tipo === 'accredito') return formMov(null, { tipo: 'entrata', categoria: 'extra', importo: x.importo, data: x.data, nota: 'Entrata', _ctrl: x.id });
    const pp = /paypal/i.test(x.nota || '');
    formMov(null, { importo: x.importo == null ? '' : x.importo, data: x.data, nota: x.nota, categoria: pp ? 'paypal' : 'altro', fonte: x.tipo === 'addebito' ? 'mail' : pp ? 'paypal' : undefined, _ctrl: x.id });
  },
  ctrlNo: d => { const s = clone(ST); s.daControllare = (s.daControllare || []).filter(y => y.id !== d.id); salvaStato(s, 'Tolto dalla lista'); },
  cancellaTutto: () => apri(`<h3 id="sheetTitle">Cancellare tutto?</h3><p style="margin:0">Spariscono stipendio, spese fisse, scadenze e tutti i movimenti. Non si torna indietro.</p><div class="foot"><button class="btn ghost" data-close>No</button><button class="btn danger" id="siCanc">Sì, cancella</button></div>`, root => { root.querySelector('#siCanc').onclick = async () => { chiudi(); const ids = MOVS.map(m => m.id); ST = null; MOVS = []; scriviCache(); render(); if (DB) { try { await DB.doc('budget/stato').delete(); for (const id of ids) await DB.collection('movimenti').doc(id).delete(); toast('Dati cancellati'); } catch (e) { toast(erroreDb(e)); } } }; })
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT') return;
  const f = ACT[b.dataset.act]; if (f) { e.preventDefault(); f(b.dataset, b); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('input[data-act="fatto"]')) { const R = ENG.calcola(ST, MOVS, oggiISO()); salvaStato(conPeriodo(R.periodo.key, p => { p.fatti = p.fatti || {}; p.fatti[t.dataset.id] = t.checked; }), t.checked ? 'Segnato come fatto' : 'Tolto il segno'); }
  if (t.id === 'imp' && t.files && t.files[0]) importa(t.files[0]);
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'fo') return;
  e.preventDefault();
  const f = e.target, st = importo(f.querySelector('#oStip').value), g = Math.round(+f.querySelector('#oGg').value), sa = importo(f.querySelector('#oSaldo').value || '0');
  if (!(st > 0) || !(g >= 1 && g <= 28) || !(sa >= 0)) return toast('Controlla i tre numeri');
  salvaStato({ versione: 1, stipendio: st, giornoStipendio: g, obiettivoRisparmio: 0, saldo: { importo: sa, data: oggiISO(), ts: Date.now() }, libretto: { saldo: 0, data: oggiISO() }, fisse: [], scadenze: [], entrate: [], periodi: {}, storico: [] }, 'Pronto');
});
$('sheetBg').addEventListener('click', chiudi);
document.addEventListener('keydown', e => { if (e.key === 'Escape') chiudi(); });
$('listenStop').addEventListener('click', async () => { try { if (DICT) await DICT.stop(); } catch (e) { } $('listen').classList.remove('on'); });

async function esporta() {
  const dati = JSON.stringify({ app: 'finanze-renato', versione: 1, esportato: new Date().toISOString(), stato: ST, movimenti: MOVS }, null, 1);
  const nome = 'finanze-backup-' + oggiISO() + '.json';
  if (DL) {
    try { await DL.save({ filename: nome, data: dati }); toast('Backup salvato'); return; }
    catch (e) { if (e && e.code === 'declined') { toast('Backup non salvato'); return; } }
  }
  apri(`<h3 id="sheetTitle">Copia il backup</h3><p class="muted small" style="margin:0">Copialo e incollalo in una nota o in un file di testo.</p><div class="field"><textarea class="json" readonly id="bkTxt"></textarea></div><div class="foot"><button class="btn ghost" data-close>Chiudi</button><button class="btn primary" id="cp">Copia</button></div>`, root => {
    root.querySelector('#bkTxt').value = dati;
    root.querySelector('#cp').onclick = () => { try { navigator.clipboard.writeText(dati).then(() => toast('Copiato'), () => toast('Seleziona il testo e copialo')); } catch (e) { toast('Seleziona il testo e copialo'); } };
  });
}
function importa(file) {
  const r = new FileReader();
  r.onload = () => {
    let b; try { b = JSON.parse(r.result); } catch (e) { return toast('Questo file non è un backup dell\'app'); }
    if (!b || !b.stato || !Array.isArray(b.movimenti) || !b.stato.saldo) return toast('Questo file non è un backup dell\'app');
    apri(`<h3 id="sheetTitle">Importare il backup?</h3><p style="margin:0">Prende il posto dei dati di adesso (${b.movimenti.length} movimenti nel file).</p><div class="foot"><button class="btn ghost" data-close>No</button><button class="btn primary" id="siImp">Sì, importa</button></div>`, root => {
      root.querySelector('#siImp').onclick = async () => {
        chiudi(); const vecchi = MOVS.map(m => m.id), nuovi = new Set(b.movimenti.map(m => m.id));
        salvaStato(b.stato); MOVS = b.movimenti.slice(); ordina(); scriviCache(); render();
        if (!DB) return toast('Backup importato');
        try {
          for (const m of b.movimenti) { const body = clone(m); delete body.id; await DB.collection('movimenti').doc(m.id).set(body); }
          for (const id of vecchi) if (!nuovi.has(id)) await DB.collection('movimenti').doc(id).delete();
          toast('Backup importato');
        } catch (e) { toast(erroreDb(e)); }
      };
    });
  };
  r.readAsText(file);
}

function route() {
  const h = (location.hash || '').slice(1);
  TAB = V[h] ? h : 'oggi'; if (TAB !== 'movimenti') VISTO = null;
  document.querySelectorAll('nav.tabs a').forEach(a => { if (a.dataset.tab === TAB) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  render(); window.scrollTo(0, 0);
}
async function avvio() {
  const c = leggiCache(); if (c && c.st) { ST = c.st; MOVS = c.movs || []; }
  window.addEventListener('hashchange', route); route();
  const [db, dict, dl] = await Promise.all([use('db'), use('dictation'), use('downloads'), use('user')]);
  DB = db; DICT = dict; DL = dl;
  if (DICT) { try { initDetta(); } catch (e) { DICT = null; } }
  if (!DB) { S.locale = true; S.caricato = true; render(); return; }
  const timer = setTimeout(() => { if (!S.arrivato) { S.errore = 'lento'; S.caricato = true; render(); } }, 10000);
  DB.doc('budget/stato').onSnapshot(s => {
    if (!s.metadata.fromCache) { clearTimeout(timer); S.arrivato = true; if (S.errore === 'lento') S.errore = ''; }
    if (s.exists) ST = clone(s.data()); else if (!s.metadata.fromCache) ST = null;
    S.caricato = true; scriviCache(); render();
  }, e => { clearTimeout(timer); S.errore = (e && e.code) || 'errore'; S.caricato = true; render(); });
  DB.collection('movimenti').orderBy('data', 'desc').limit(1000).onSnapshot(q => {
    MOVS = q.docs.map(d => Object.assign({ id: d.id }, d.data())); ordina(); scriviCache(); render();
  }, e => { S.errore = (e && e.code) || 'errore'; render(); });
}
window.addEventListener('finanze-ripresa', () => { if (ST) render(); });
window.addEventListener('finanze-avviso', e => { const a = e.detail || {}; toast([a.titolo, a.testo].filter(Boolean).join(' — ')); });
avvio();
window.__app = { leggiFrase, ENG, stato: () => ({ ST, MOVS, S }) };
})();
