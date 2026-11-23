// Calcoli dell'app (senza grafica): periodo da stipendio a stipendio, piano del mese e soldi veri sul conto
const ENG = (() => {
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const dim = (y, m) => new Date(y, m + 1, 0).getDate();
  const onDay = (y, m, g) => { const t = new Date(y, m, 1); return new Date(t.getFullYear(), t.getMonth(), Math.min(g, dim(t.getFullYear(), t.getMonth()))); };
  const num = v => { const x = Number(v); return isFinite(x) ? x : 0; };
  const sum = a => a.reduce((s, x) => s + num(x), 0);
  const r2 = x => Math.round(x * 100) / 100;
  const ymKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);
  // periodo che contiene T: dal giorno dello stipendio al giorno prima del prossimo
  function periodo(T, g) {
    let S = onDay(T.getFullYear(), T.getMonth(), g);
    if (S > T) S = onDay(T.getFullYear(), T.getMonth() - 1, g);
    const N = onDay(S.getFullYear(), S.getMonth() + 1, g);
    return { S, E: addDays(N, -1), N, key: ymKey(S) };
  }
  // tutte le date "giorno g di ogni mese" fra a e b (compresi)
  function mensili(g, a, b) {
    const out = []; if (b < a) return out;
    for (let y = a.getFullYear(), m = a.getMonth() - 1, i = 0; i < 400; i++, m++) { const d = onDay(y, m, g); if (d > b) break; if (d >= a) out.push(d); }
    return out;
  }
  // date di una scadenza (mesi 1-12, giorno) fra a e b
  function scadOcc(s, a, b) {
    const out = []; if (b < a) return out;
    for (let y = a.getFullYear() - 1; y <= b.getFullYear() + 1; y++) for (const mm of s.mesi || []) { const d = onDay(y, mm - 1, s.giorno || 1); if (d >= a && d <= b) out.push(d); }
    return out.sort((x, y) => x - y);
  }
  const quotaMese = s => num(s.importo) * (s.mesi || []).length / 12;
  const ov = (st, key) => (st.periodi || {})[key] || {};
  const impFissa = (st, f, key) => { const o = ov(st, key); return f.tipo === 'risparmio' && o.risparmio != null ? num(o.risparmio) : num(f.importo); };
  const stipendioDi = (st, key) => { const o = ov(st, key); return num(o.stipendio != null ? o.stipendio : st.stipendio); };
  function calcola(st, movs, oggi) {
    const T = parse(oggi), g = st.giornoStipendio || 1, P = periodo(T, g), o = ov(st, P.key);
    const fisse = (st.fisse || []).filter(f => f.attiva !== false), scad = st.scadenze || [];
    const stip = stipendioDi(st, P.key);
    // 📋 piano del mese
    const occF = []; for (const f of fisse) for (const d of mensili(f.giorno, P.S, P.E)) occF.push({ f, d, importo: impFissa(st, f, P.key) });
    const totFisse = sum(occF.map(x => x.importo));
    const quotaPiena = sum(scad.map(quotaMese)), quota = o.quota != null ? num(o.quota) : quotaPiena;
    const budget = stip - totFisse - quota;
    const spese = movs.filter(m => m.tipo === 'spesa' && !m.esclusa);   // le spese «non contate» (es. pagate coi soldi di Revolut) restano fuori
    const inP = m => { const d = parse(m.data); return d >= P.S && d <= P.E; };
    const speso = sum(spese.filter(inP).map(m => m.importo));
    const spesoOggi = sum(spese.filter(m => m.data === oggi).map(m => m.importo));
    const giorni = Math.round((P.E - T) / 864e5) + 1, giorniTot = Math.round((P.N - P.S) / 864e5);
    const pianoGiorno = (budget - (speso - spesoOggi)) / giorni;
    // 🏦 soldi veri: ultimo saldo inserito + quello che è successo dopo
    const sd = parse(st.saldo.data), sts = num(st.saldo.ts);
    const dopoSaldo = (d, creato) => d > sd || (+d === +sd && num(creato) > sts);
    const ieri = addDays(T, -1);
    let cassa = num(st.saldo.importo);
    for (const d of mensili(g, addDays(sd, 1), T)) cassa += stipendioDi(st, periodo(d, g).key);
    for (const f of fisse) for (const d of mensili(f.giorno, addDays(sd, 1), ieri)) cassa -= impFissa(st, f, periodo(d, g).key);
    for (const s of scad) for (const d of scadOcc(s, addDays(sd, 1), ieri)) cassa -= num(s.importo);
    let spesoOggiConto = 0;
    for (const m of movs) {
      if (m.esclusa) continue;
      const dd = parse(m.addebito || m.data);
      if (!dopoSaldo(dd, m.creato)) continue;
      if (m.tipo === 'spesa') { if (dd < T) cassa -= num(m.importo); else if (+dd === +T) spesoOggiConto += num(m.importo); }
      if (m.tipo === 'entrata' && m.categoria !== 'stipendio' && dd <= T) cassa += num(m.importo);   // lo stipendio si conta già nel giorno di paga
    }
    const contoOggi = cassa - spesoOggiConto;   // saldo stimato adesso
    // uscite ancora da arrivare prima del prossimo stipendio
    const daPagare = [];
    for (const f of fisse) for (const d of mensili(f.giorno, T, P.E)) if (d > sd) daPagare.push({ nome: f.nome, data: iso(d), importo: impFissa(st, f, P.key), tipo: 'fissa' });
    for (const s of scad) for (const d of scadOcc(s, T, P.E)) if (d > sd) daPagare.push({ nome: s.nome, data: iso(d), importo: num(s.importo), tipo: 'scadenza' });
    for (const m of spese) if (m.addebito) { const dd = parse(m.addebito); if (dd > T && dd <= P.E && dopoSaldo(dd, m.creato)) daPagare.push({ nome: m.nota || m.categoria, data: m.addebito, importo: num(m.importo), tipo: 'addebito' }); }
    daPagare.sort((a, b) => a.data < b.data ? -1 : 1);
    const uscite = sum(daPagare.map(x => x.importo));
    const contoPerSpese = cassa - uscite;   // a inizio giornata
    const contoGiorno = contoPerSpese / giorni;
    const oggiPiano = pianoGiorno - spesoOggi, oggiConto = contoGiorno - spesoOggiConto;
    const limite = oggiConto < oggiPiano ? 'conto' : 'piano';
    // 🐷 accantonati per le scadenze (da quando si è cominciato)
    const dal = st.accantonaDal ? parse(st.accantonaDal) : P.S;
    const acc = scad.map(s => {
      const prima = scadOcc(s, addDays(T, -800), T), ultima = prima.length ? prima[prima.length - 1] : null;
      const da = ultima && addDays(ultima, 1) > dal ? addDays(ultima, 1) : dal;
      const n = mensili(g, da, T).length;
      return { id: s.id, nome: s.nome, accantonato: r2(Math.min(num(s.importo), quotaMese(s) * n)), quota: r2(quotaMese(s)) };
    });
    // 🐷 libretto: ultimo saldo + risparmi dopo quella data
    const lib = st.libretto || { saldo: 0, data: oggi };
    let libretto = num(lib.saldo);
    for (const f of fisse) if (f.tipo === 'risparmio') for (const d of mensili(f.giorno, addDays(parse(lib.data), 1), T)) libretto += impFissa(st, f, periodo(d, g).key);
    const risparmio = sum(occF.filter(x => x.f.tipo === 'risparmio').map(x => x.importo));
    return {
      periodo: { inizio: iso(P.S), fine: iso(P.E), prossimo: iso(P.N), key: P.key, giorni, giorniTot },
      stipendio: r2(stip), totFisse: r2(totFisse), quota: r2(quota), quotaPiena: r2(quotaPiena), budget: r2(budget),
      speso: r2(speso), spesoOggi: r2(spesoOggi), restoPiano: r2(budget - speso), pianoGiorno: r2(pianoGiorno),
      contoOggi: r2(contoOggi), contoPerSpese: r2(contoPerSpese - spesoOggiConto), contoGiorno: r2(contoGiorno), uscite: r2(uscite), daPagare,
      oggiPuoi: r2(Math.min(oggiPiano, oggiConto)), oggiPiano: r2(oggiPiano), oggiConto: r2(oggiConto), limite,
      accantonati: acc, accTot: r2(sum(acc.map(a => a.accantonato))), libretto: r2(libretto), risparmio: r2(risparmio),
      fissePeriodo: occF.map(x => ({ id: x.f.id, nome: x.f.nome, data: iso(x.d), importo: r2(x.importo), tipo: x.f.tipo }))
    };
  }
  // prossime uscite/entrate (per la lista "In arrivo")
  function prossime(st, movs, oggi, giorni) {
    const T = parse(oggi), B = addDays(T, giorni || 35), g = st.giornoStipendio || 1, out = [];
    for (const d of mensili(g, T, B)) out.push({ nome: 'Stipendio', data: iso(d), importo: stipendioDi(st, periodo(d, g).key), segno: 1, tipo: 'stipendio' });
    for (const f of (st.fisse || []).filter(f => f.attiva !== false)) for (const d of mensili(f.giorno, T, B)) out.push({ nome: f.nome, data: iso(d), importo: impFissa(st, f, periodo(d, g).key), segno: -1, tipo: f.tipo || 'fissa' });
    for (const s of st.scadenze || []) for (const d of scadOcc(s, T, B)) out.push({ nome: s.nome, data: iso(d), importo: num(s.importo), segno: -1, tipo: 'scadenza' });
    for (const e of st.entrate || []) for (const d of scadOcc({ mesi: e.mesi, giorno: e.giorno }, T, B)) out.push({ nome: e.nome, data: iso(d), importo: num(e.importo), segno: 1, tipo: 'extra' });
    for (const m of movs) if (m.tipo === 'spesa' && !m.esclusa && m.addebito && parse(m.addebito) >= T && parse(m.addebito) <= B) out.push({ nome: m.nota || m.categoria, data: m.addebito, importo: num(m.importo), segno: -1, tipo: 'addebito' });
    return out.sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : a.segno - b.segno);
  }
  return { calcola, prossime, periodo, parse, iso, addDays, quotaMese, mensili, scadOcc };
})();
if (typeof module !== 'undefined') module.exports = ENG;
