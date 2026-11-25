// Parte comune dell'app Android: dati sul telefono, lettura delle notifiche (Google Pay, mail MPS, PayPal) e avvisi.
// Gira sia nella pagina dell'app sia "di nascosto" quando arriva una notifica con l'app chiusa.
const FIN = (() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const A = () => G.Android || null;
  const num = v => { const x = Number(v); return isFinite(x) ? x : 0; };
  const r2 = x => Math.round(x * 100) / 100;
  const clone = o => JSON.parse(JSON.stringify(o));
  const fmt = n => { const [i, d] = Math.abs(Number(n) || 0).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
  const eur = n => ((Number(n) || 0) < -0.004 ? '−' : '') + fmt(n) + ' €';
  const isoDi = ms => ENG.iso(new Date(ms));
  const nuovoId = (p, ms) => p + Math.floor(ms).toString(36) + Math.random().toString(36).slice(2, 6);

  // 🏷 categorie (parole brevi = parola intera, parole lunghe = inizio di parola)
  const CATS = [
    { id: 'bar', nome: 'Bar e tabacchi', col: '#C47A22', kw: ['bar', 'caff', 'cornett', 'sigarett', 'tabacc', 'birr', 'spritz', 'aperitiv', 'pub', 'colazion', 'pasticcer', 'gelat', 'cafe', 'bistrot', 'vape', 'svapo'] },
    { id: 'spesa', nome: 'Spesa', col: '#3C8C5C', kw: ['spesa', 'supermercat', 'tigre', 'eurospin', 'conad', 'coop', 'lidl', 'pane', 'panific', 'frutta', 'despar', 'pam', 'carrefour', 'esselunga', 'penny', 'aldi', 'md', 'famila', 'todis', 'crai', 'sigma', 'simply', 'auchan', 'ipercoop', 'emisfero', 'alimentar', 'macelleri', 'forno'] },
    { id: 'ristoranti', nome: 'Ristoranti e domicilio', col: '#B5533B', kw: ['pizz', 'ristorant', 'sushi', 'mcdonald', 'burger', 'deliveroo', 'glovo', 'just eat', 'justeat', 'kebab', 'cena', 'pranzo', 'panin', 'trattoria', 'osteria', 'hamburger', 'roadhouse', 'old wild west', 'kfc', 'poke', 'piadin', 'rosticc', 'autogrill', 'tavola calda'] },
    { id: 'benzina', nome: 'Benzina e trasporti', col: '#4A6CA6', kw: ['benzina', 'gasolio', 'diesel', 'carburant', 'distributor', 'esso', 'eni', 'enilive', 'q8', 'ip', 'tamoil', 'agip', 'api', 'shell', 'autobus', 'bus', 'busitalia', 'treno', 'trenitalia', 'italo', 'autostrad', 'telepass', 'pedaggio', 'taxi', 'uber', 'lavaggio'] },
    { id: 'vestiti', nome: 'Vestiti e regali', col: '#965AA3', kw: ['vestit', 'scarpe', 'regal', 'profum', 'parrucch', 'barbier', 'maglia', 'giacca', 'pantalon', 'zara', 'h&m', 'oviesse', 'ovs', 'primark', 'calzedonia', 'intimissimi', 'foot locker', 'sephora', 'douglas', 'kiko', 'bershka', 'pull&bear', 'decathlon'] },
    { id: 'svago', nome: 'Svago e uscite', col: '#2D8796', kw: ['cinema', 'uci', 'the space', 'bowling', 'discoteca', 'concerto', 'partita', 'gioco', 'serata', 'biglietto', 'ticketone', 'palestra', 'piscina', 'museo', 'teatro'] },
    { id: 'online', nome: 'Acquisti online', col: '#6566C9', kw: ['amazon', 'amzn', 'online', 'ebay', 'zalando', 'shein', 'temu', 'aliexpress', 'playstation', 'steam', 'google play', 'nintendo', 'epic games', 'xbox', 'apple com', 'meta platforms', 'facebook'] },
    { id: 'salute', nome: 'Farmacia e salute', col: '#2B9A8A', kw: ['farmacia', 'parafarmacia', 'medicin', 'dottore', 'visita', 'dentist', 'ottica', 'sanitari', 'laboratorio analisi'] },
    { id: 'multe', nome: 'Multe e parcheggi', col: '#A8423A', kw: ['multa', 'parcheggi', 'parcometr', 'easypark', 'mycicero', 'strisce', 'sosta'] },
    { id: 'carta', nome: 'Carta di credito', col: '#56656E', kw: ['carta di credito'] },
    { id: 'paypal', nome: 'PayPal', col: '#2C69B0', kw: ['paypal'] },
    { id: 'revolut', nome: 'Revolut (spese tue)', col: '#47505C', kw: ['revolut'] },
    { id: 'abbonamenti', nome: 'Abbonamenti', col: '#8A6A35', kw: ['abbonament', 'netflix', 'spotify', 'disney', 'dazn', 'prime video', 'sky', 'now tv', 'infinity', 'icloud', 'google one', 'youtube', 'ricarica tim', 'vodafone', 'iliad', 'windtre'] },
    { id: 'altro', nome: 'Altro', col: '#7B857F', kw: [] }
  ];
  const norm = s => ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9&]+/g, ' ').trim() + ' ';
  // chiave di un negozio, per ricordare la categoria scelta da te ("CONAD 123 PERUGIA" e "Conad 456" → "conad")
  const chiave = s => norm(s).replace(/\b\d+\b/g, ' ').trim().split(/\s+/).filter(w => w.length > 1).slice(0, 2).join(' ');
  function categoria(testo, regole) {
    const k = chiave(testo);
    if (regole && k && regole[k]) return regole[k];
    const t = norm(testo);
    for (const c of CATS) for (const w of c.kw) {
      const ww = norm(w).trim();
      if (ww.length <= 3 ? t.includes(' ' + ww + ' ') : t.includes(' ' + ww)) return c.id;
    }
    return 'altro';
  }

  // 💶 importi dentro un testo: "10,00 €", "€ 1.234,56", "5,99 EUR". Niente date, ore, numeri di conto o di carta.
  function importi(t) {
    const s = String(t || ''), out = [];
    const re = /(^|[^\d.,])([-−]?)(\d{1,3}(?:[.  ' ]\d{3})+|\d+)(?:([.,])(\d{1,2}))?(?!\d)/g;
    let m;
    while ((m = re.exec(s))) {
      const ini = m.index + m[1].length, fine = re.lastIndex;
      const prima = s.slice(Math.max(0, ini - 6), ini), dopo = s.slice(fine, fine + 7);
      const valuta = /(€|eur|euro)\s*$/i.test(prima) || /^\s*(€|eur\b|euro)/i.test(dopo);
      const dec = m[5];
      if (!valuta && !(dec && dec.length === 2)) continue;
      let v = Number(m[3].replace(/\D/g, '') + (dec ? '.' + (dec.length === 1 ? dec + '0' : dec) : ''));
      if (m[2]) v = -v;
      if (!isFinite(v) || Math.abs(v) > 1e7) continue;
      out.push({ v: r2(v), i: ini });
    }
    return out;
  }
  function pulisciNegozio(t) {
    let s = String(t || '').replace(/[*#]+\s*\d*\s*[*#]*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    s = s.replace(/^(?:pagamento|acquisto|transazione)\s+(?:presso|a|da|con)\s+/i, '').replace(/[.…]+$/, '').trim();
    if (/^(?:google(?: pay| wallet)?|wallet|pagamento(?: effettuato| riuscito)?|transazione|nuovo pagamento)$/i.test(s)) s = '';
    if (s.length > 2 && s === s.toUpperCase() && /[A-Z]/.test(s)) s = s.toLowerCase().replace(/(^|[\s'’.&-])(\p{L})/gu, (x, a, b) => a + b.toUpperCase());
    return s.slice(0, 60);
  }

  const APP = {
    'com.google.android.apps.walletnfcrel': 'Google Pay', 'com.google.android.gms': 'Google Pay',
    'com.google.android.gm': 'Gmail', 'com.paypal.android.p2pmobile': 'PayPal', 'it.copergmps.rt.pf.android.sp.bmps': 'App MPS', prova: 'Prova'
  };
  let adesso = () => Date.now();   // nelle prove si può spostare l'orologio
  function calcolaSicuro(ST, MOVS, giorno) { try { return ST && ST.saldo ? ENG.calcola(ST, MOVS, giorno || ENG.iso(new Date(adesso()))) : null; } catch (e) { return null; } }
  // quanto si potrà spendere da domani, con le spese di oggi già tolte (null se domani arriva lo stipendio)
  function domaniSicuro(ST, MOVS, R) {
    if (!R || R.periodo.giorni <= 1) return null;
    return calcolaSicuro(ST, MOVS, ENG.iso(ENG.addDays(new Date(adesso()), 1)));
  }
  function frasePuoi(R, RD) {
    if (!R) return 'Apri l\'app per vedere quanto puoi spendere.';
    const resto = Math.min(R.restoPiano, R.contoPerSpese);
    if (R.oggiPuoi < 0 && RD) return 'Oggi sei oltre di ' + eur(-R.oggiPuoi) + '. Da domani puoi spendere ' + eur(RD.oggiPuoi) + ' al giorno.';
    return (R.oggiPuoi >= 0 ? 'Oggi puoi spendere ancora ' + eur(R.oggiPuoi) + '.' : 'Oggi sei oltre di ' + eur(-R.oggiPuoi) + '.') + ' Fino allo stipendio: ' + eur(resto) + '.';
  }
  function avvisoMov(m, ST, MOVS) {
    if (m.esclusa) return { titolo: fmt(m.importo) + ' € con Revolut · ' + m.nota, testo: 'Non la conto: i soldi su Revolut sono già tra le spese.', canale: 'info' };
    const titolo = (m.tipo === 'entrata' ? '+' : '−') + fmt(m.importo) + ' € · ' + m.nota, R = calcolaSicuro(ST, MOVS);
    return { titolo, testo: frasePuoi(R, R && R.oggiPuoi < 0 ? domaniSicuro(ST, MOVS, R) : null), canale: 'spese' };
  }
  const vicino = (a, b) => Math.abs(num(a) - num(b)) <= Math.max(0.5, num(a) * 0.03);
  function daControllare(ST, voce) {
    const st = clone(ST); st.daControllare = st.daControllare || [];
    if (st.daControllare.some(x => x.tipo === voce.tipo && vicino(x.importo, voce.importo) && Math.abs(num(x.quando) - voce.quando) < 864e5 && String(x.nota) === String(voce.nota))) return null;
    st.daControllare.push(voce);
    return st;
  }

  // 📱 Google Pay / Wallet: titolo = negozio, testo = "10,00 € con MPS Debit Mastercard ••1234"
  function wallet(n, ST, MOVS, quando) {
    const righe = [n.testo, n.grande, n.titolo].filter(Boolean).join('\n').split('\n').map(x => x.trim()).filter(Boolean);
    const tutto = righe.join('\n');
    if (/rifiutat|non (?:è )?riuscit|non (?:è )?andat|non complet|annullat|negat|non autorizzat|declin|fallit|failed|insufficient/i.test(tutto)) return { esito: 'Pagamento non riuscito: non lo segno' };
    let imp = null, riga = '';
    for (const r of righe) { const a = importi(r); if (a.length) { imp = Math.abs(a[0].v); riga = r; break; } }
    if (!(imp > 0)) return { esito: 'Nessun importo: non è un pagamento' };
    const mc = /\b(?:con|with|tramite|using)\s+(.+?)\s*(?:[•·*.]{2,}\s*(\d{4}))?\s*$/i.exec(riga);
    const carta = mc ? mc[1].trim() : '', ultime = mc && mc[2] ? mc[2] : '';
    let neg = pulisciNegozio(n.titolo);
    if (!neg && riga !== n.testo) neg = pulisciNegozio(n.testo);
    const k = chiave(neg);
    if (MOVS.some(m => m.fonte === 'gpay' && Math.abs(num(m.importo) - imp) < 0.005 && (m.esercente || '') === k && Math.abs(num(m.creato) - quando) < 3 * 60000)) return { esito: 'Già segnata' };
    const rimborso = /rimbors|storn|refund/i.test(tutto);
    const m = { id: nuovoId('g', quando), data: isoDi(quando), importo: imp, tipo: rimborso ? 'entrata' : 'spesa', categoria: 'altro', nota: '', esercente: k, fonte: 'gpay', creato: quando };
    if (ultime) m.carta = ultime;
    if (rimborso) { m.categoria = 'extra'; m.nota = 'Rimborso' + (neg ? ' · ' + neg : ''); }
    else if (/revolut/i.test(neg) && !/revolut/i.test(carta)) { m.categoria = 'revolut'; m.nota = 'Ricarica Revolut'; }
    else { m.categoria = categoria(neg, ST && ST.regole); m.nota = neg || 'Pagamento con Google Pay'; }
    if (/revolut/i.test(carta) && !rimborso) m.esclusa = true;
    return { movs: [m], esito: (m.esclusa ? 'Pagata con Revolut, non conta: ' : m.tipo === 'entrata' ? 'Rimborso segnato: ' : 'Spesa segnata: ') + eur(imp) + (neg ? ' · ' + neg : ''), avviso: avvisoMov(m, ST, MOVS.concat([m])) };
  }

  // ✉️ Gmail: titolo = mittente, testo = oggetto, grande = oggetto + inizio della mail
  function mail(n, ST, MOVS, quando) {
    const mitt = n.titolo || '', ogg = n.testo || '', corpo = [n.grande || n.testo || '', n.righe || ''].join('\n');
    if (/paypal/i.test(mitt)) return paypal(ogg, corpo, ST, MOVS, quando);
    if (!/monte dei paschi|banca mps|\bmps\b/i.test(mitt + '\n' + corpo.slice(0, 160))) return { esito: 'Mail non della banca: ignorata' };
    if (!ST) return { esito: 'Mail MPS: prima completa l\'app' };
    const a = importi(corpo), d = new Date(quando);
    if (/saldo/i.test(ogg) || /situazione del tuo conto/i.test(corpo)) {
      if (!a.length) return { esito: 'Saldo: nella notifica non c\'è l\'importo' };
      const iD = corpo.search(/disponibil/i), x = (iD >= 0 && a.find(y => y.i > iD)) || a[0];
      if (num(ST.saldo && ST.saldo.ts) >= quando) return { esito: 'Saldo più vecchio di quello che c\'è già' };
      const st = clone(ST); st.saldo = { importo: x.v, data: isoDi(quando), ts: quando, fonte: 'mail' };
      const R = calcolaSicuro(st, MOVS);
      return { stato: st, esito: 'Saldo aggiornato: ' + eur(x.v), avviso: { titolo: 'Saldo MPS: ' + eur(x.v), testo: R ? (R.oggiPuoi >= 0 ? 'Oggi puoi spendere ' + eur(R.oggiPuoi) + '.' : 'Oggi sei già oltre di ' + eur(-R.oggiPuoi) + '.') : 'Saldo aggiornato.', canale: 'info' } };
    }
    if (/addebit/i.test(ogg)) {
      if (!a.length) return { esito: 'Addebito senza importo nella notifica: è una spesa fissa, non faccio niente' };
      const v = Math.abs(a[0].v), c = trovaFissa(ST, MOVS, v, d);
      if (c) {
        const st = clone(ST), key = ENG.periodo(d, st.giornoStipendio || 1).key;
        st.periodi = st.periodi || {}; const p = st.periodi[key] = st.periodi[key] || {}; p.fatti = p.fatti || {}; p.fatti[c.id] = true;
        const r = { stato: st, esito: 'Addebito ' + eur(v) + ': è «' + c.nome + '», già in lista' };
        // carta di credito: resta nelle spese del mese che hai scelto, ma per i soldi sul conto vale il giorno vero in cui l'hanno scalata
        if (c.mov && c.mov.addebito !== isoDi(quando)) r.movs = [Object.assign({}, c.mov, { addebito: isoDi(quando) })];
        return r;
      }
      // pagamento già segnato (Google Pay, PayPal o a mano): lo riconosco e non lo conto due volte
      const gia = giaSegnata(MOVS, v, quando);
      if (gia) return { movs: [Object.assign({}, gia, { banca: true })], esito: 'Addebito ' + eur(v) + ': spesa già segnata (' + (gia.nota || 'spesa') + ')' };
      // pagamento con la carta o prelievo che non avevo: lo segno io
      const prel = /prelev|prelievo|\batm\b/i.test(corpo), pos = !prel && /mastercard|maestro|\bpos\b/i.test(corpo);
      if (prel || pos) {
        const dm = /data addebito\D{0,5}(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(corpo);
        const data = dm ? dm[3] + '-' + dm[2].padStart(2, '0') + '-' + dm[1].padStart(2, '0') : isoDi(quando);
        const m = { id: nuovoId('b', quando), data, importo: v, tipo: 'spesa', categoria: 'altro', nota: prel ? 'Prelievo contanti' : 'Pagamento con carta', fonte: 'mail', banca: true, creato: quando };
        return { movs: [m], esito: (prel ? 'Prelievo' : 'Pagamento con carta') + ' segnato dalla mail: ' + eur(v), avviso: avvisoMov(m, ST, MOVS.concat([m])) };
      }
      const st = daControllare(ST, { id: nuovoId('c', quando), tipo: 'addebito', data: isoDi(quando), importo: v, nota: 'Addebito MPS', testo: corpo.replace(/\s+/g, ' ').slice(0, 160), quando });
      if (!st) return { esito: 'Addebito già da controllare' };
      return { stato: st, esito: 'Addebito ' + eur(v) + ' non tra le fisse: da controllare', avviso: { titolo: 'Da controllare: addebito di ' + eur(v), testo: 'MPS ha scalato ' + eur(v) + ' e non è tra le spese fisse. Apri l\'app per segnarlo o ignorarlo.', canale: 'spese' } };
    }
    if (/accredit/i.test(ogg)) {
      if (!a.length) return { esito: 'Accredito senza importo nella notifica' };
      const v = Math.abs(a[0].v), g = ST.giornoStipendio || 1, dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()), P = ENG.periodo(dd, g);
      const D = (dd - P.S) / 864e5 <= 3 ? P.S : (P.N - dd) / 864e5 <= 5 ? P.N : null;
      if (D && v >= num(ST.stipendio) * 0.5) {
        const key = ENG.periodo(D, g).key, st = clone(ST); st.periodi = st.periodi || {}; const p = st.periodi[key] = st.periodi[key] || {};
        if (p.stipendio != null) return { esito: 'Stipendio già segnato' };
        p.stipendio = v;
        const m = { id: nuovoId('e', quando), data: ENG.iso(D), importo: v, tipo: 'entrata', categoria: 'stipendio', nota: 'Stipendio', fonte: 'mail', creato: quando };
        const oggi = ENG.iso(new Date(adesso())), dal = ENG.iso(D) > oggi ? ENG.iso(D) : oggi, R = calcolaSicuro(st, MOVS.concat([m]), dal);
        const quando2 = dal === oggi ? 'Oggi' : 'Dal ' + D.getDate() + ' (nuovo mese)';
        return { stato: st, movs: [m], esito: 'Stipendio segnato: ' + eur(v), avviso: { titolo: 'Stipendio arrivato: ' + eur(v), testo: R ? quando2 + ' puoi spendere ' + eur(R.pianoGiorno) + ' al giorno.' : 'Nuovo mese.', canale: 'spese' } };
      }
      const e = (ST.entrate || []).find(x => num(x.importo) * 0.5 <= v && v <= num(x.importo) * 1.6 && (x.mesi || []).some(mm => Math.abs((new Date(d.getFullYear(), mm - 1, x.giorno || 1) - dd) / 864e5) <= 12));
      if (e) {
        const m = { id: nuovoId('e', quando), data: isoDi(quando), importo: v, tipo: 'entrata', categoria: 'extra', nota: e.nome, fonte: 'mail', creato: quando };
        return { movs: [m], esito: e.nome + ' arrivata: ' + eur(v), avviso: { titolo: e.nome + ': +' + eur(v), testo: 'Segnata tra le entrate.', canale: 'spese' } };
      }
      const st = daControllare(ST, { id: nuovoId('c', quando), tipo: 'accredito', data: isoDi(quando), importo: v, nota: 'Accredito MPS', testo: corpo.replace(/\s+/g, ' ').slice(0, 160), quando });
      if (!st) return { esito: 'Accredito già da controllare' };
      return { stato: st, esito: 'Accredito ' + eur(v) + ': da controllare', avviso: { titolo: 'Sono arrivati ' + eur(v), testo: 'Apri l\'app se vuoi segnarli come entrata.', canale: 'info' } };
    }
    return { esito: 'Mail MPS: niente da segnare' };
  }
  // la spesa fissa (o scadenza, o addebito carta) che corrisponde a un addebito
  function trovaFissa(ST, MOVS, v, d) {
    const distanza = (g, mesi) => {
      let best = 99;
      for (let k = -1; k <= 1; k++) {
        const y = d.getFullYear(), mm = d.getMonth() + k, t = new Date(y, mm, Math.min(g || 1, new Date(y, mm + 1, 0).getDate()));
        if (mesi && mesi.length && !mesi.includes(t.getMonth() + 1)) continue;
        best = Math.min(best, Math.abs(t - d) / 864e5);
      }
      return best;
    };
    const key = ENG.periodo(d, ST.giornoStipendio || 1).key, ov = (ST.periodi || {})[key] || {};
    for (const f of (ST.fisse || []).filter(f => f.attiva !== false)) {
      const imp = f.tipo === 'risparmio' && ov.risparmio != null ? ov.risparmio : f.importo;
      if (vicino(imp, v) && distanza(f.giorno) <= 7) return { id: f.id, nome: f.nome };
    }
    for (const s of ST.scadenze || []) if (vicino(s.importo, v) && distanza(s.giorno, s.mesi) <= 10) return { id: s.id, nome: s.nome };
    for (const m of MOVS) if (m.tipo === 'spesa' && m.addebito && vicino(m.importo, v) && Math.abs(ENG.parse(m.addebito) - d) / 864e5 <= 7) return { id: m.id, nome: m.nota || 'Carta di credito', mov: m };
    return null;
  }
  // la spesa già segnata che corrisponde a un pagamento arrivato per mail: stesso importo, negli ultimi 6 giorni, non ancora abbinata
  function giaSegnata(MOVS, v, quando) {
    const c = MOVS.filter(m => m.tipo === 'spesa' && !m.esclusa && !m.banca && !m.addebito && Math.abs(num(m.importo) - v) < 0.005)
      .map(m => ({ m, t: num(m.creato) || ENG.parse(m.data).getTime() }))
      .filter(x => x.t <= quando + 36e5 && quando - x.t < 6 * 864e5)
      .sort((a, b) => a.t - b.t);
    return c.length ? c[0].m : null;
  }
  // 🅿️ PayPal (mail o app): "Ricevuta del tuo pagamento a favore di Meta…", "Hai inviato 12,00 € a Davide"
  function paypal(ogg, corpo, ST, MOVS, quando) {
    const tutto = ogg + '\n' + corpo;
    if (/hai ricevuto|ti ha inviato|ti ha mandato|rimborso|accredit/i.test(ogg)) return { esito: 'PayPal: soldi in arrivo, non li segno' };
    if (!/ricevuta|hai inviato|hai pagato|pagamento (?:a|inviato|effettuato|autorizzato)|hai autorizzato/i.test(tutto)) return { esito: 'PayPal: non è un pagamento' };
    const mm = /a favore di\s+([^\n]+)/i.exec(tutto) || /(?:inviato|pagato)[^\n]*?\ba\s+([^\n.]+)/i.exec(tutto);
    const neg = pulisciNegozio(mm ? mm[1].replace(/\s*\(.*$/, '') : '');
    const a = importi(tutto), nota = 'PayPal' + (neg ? ' · ' + neg : '');
    if (!a.length) {
      if (!ST) return { esito: 'PayPal senza importo' };
      const st = daControllare(ST, { id: nuovoId('c', quando), tipo: 'spesa', data: isoDi(quando), importo: null, nota, testo: tutto.replace(/\s+/g, ' ').slice(0, 160), quando });
      if (!st) return { esito: 'PayPal già da controllare' };
      return { stato: st, esito: 'PayPal senza importo: da controllare', avviso: { titolo: 'Da controllare: ' + nota, testo: 'Non leggo l\'importo: apri l\'app e scrivilo tu.', canale: 'spese' } };
    }
    const v = Math.abs(a[0].v);
    if (MOVS.some(m => m.fonte === 'paypal' && vicino(m.importo, v) && Math.abs(num(m.creato) - quando) < 2 * 864e5)) return { esito: 'PayPal già segnato' };
    const m = { id: nuovoId('p', quando), data: isoDi(quando), importo: v, tipo: 'spesa', categoria: neg ? categoria(neg, ST && ST.regole) : 'paypal', nota, esercente: chiave(neg), fonte: 'paypal', creato: quando };
    if (m.categoria === 'altro') m.categoria = 'paypal';
    return { movs: [m], esito: 'Spesa PayPal segnata: ' + eur(v), avviso: avvisoMov(m, ST, MOVS.concat([m])) };
  }

  function elabora(n, ST, MOVS) {
    const q = num(n.quando) || Date.now(), app = n.app || '';
    if (app === 'com.google.android.gm') return mail(n, ST, MOVS, q);
    if (app === 'com.paypal.android.p2pmobile') return paypal(n.titolo + ' ' + (n.testo || ''), n.grande || n.testo || '', ST, MOVS, q);
    if (app === 'com.google.android.apps.walletnfcrel' || app === 'com.google.android.gms' || app === 'prova') return wallet(n, ST, MOVS, q);
    return { esito: 'Solo letta: da quest\'app non segno niente' };
  }

  // 💾 dati sul telefono (tramite l'app Android)
  const ascolti = [];
  const dati = {
    stato() { try { return JSON.parse(A().leggi('stato') || 'null'); } catch (e) { return null; } },
    salvaStato(st) { A().scrivi('stato', st == null ? '' : JSON.stringify(st)); },
    movimenti() { let o = {}; try { o = JSON.parse(A().movimenti() || '{}') || {}; } catch (e) { } return Object.keys(o).map(id => Object.assign({}, o[id], { id })); },
    salvaMov(m) { const b = Object.assign({}, m); delete b.id; A().movSalva(String(m.id), JSON.stringify(b)); },
    cancellaMov(id) { A().movCancella(String(id)); },
    registro() { try { return JSON.parse(A().registro() || '[]') || []; } catch (e) { return []; } },
    ascolta(f) { ascolti.push(f); },
    cambiato() { for (const f of ascolti) try { f(); } catch (e) { } }
  };
  // le notifiche arrivate: le leggo una per una, salvo, e preparo gli avvisi
  function elaboraCoda() {
    const a = A(); if (!a) return '[]';
    let coda = []; try { coda = JSON.parse(a.codaLeggi() || '[]') || []; } catch (e) { }
    if (!coda.length) return '[]';
    let ST = dati.stato(), MOVS = dati.movimenti();
    const avvisi = [];
    for (const n of coda) {
      let r;
      try { r = elabora(n, ST, MOVS) || {}; } catch (e) { r = { esito: 'Errore: ' + ((e && e.message) || e) }; }
      try {
        if (r.stato) { ST = r.stato; dati.salvaStato(ST); }
        for (const m of r.movs || []) { dati.salvaMov(m); MOVS = MOVS.filter(x => x.id !== m.id).concat([m]); }
      } catch (e) { r.esito = 'Non salvato: ' + ((e && e.message) || e); r.avviso = null; }
      try { a.registra(JSON.stringify({ quando: num(n.quando) || Date.now(), app: APP[n.app] || n.app || '', titolo: String(n.titolo || '').slice(0, 70), testo: String(n.testo || '').slice(0, 120), esito: r.esito || '' })); } catch (e) { }
      try { a.codaTogli(1); } catch (e) { }
      if (r.avviso) avvisi.push(r.avviso);
    }
    dati.cambiato();
    return JSON.stringify(avvisi.slice(-3));
  }

  const impostaOra = f => { adesso = f || (() => Date.now()); };
  return { impostaOra, CATS, categoria, chiave, importi, pulisciNegozio, elabora, elaboraCoda, dati, trovaFissa, fmt, eur };
})();
if (typeof module !== 'undefined') module.exports = FIN;
