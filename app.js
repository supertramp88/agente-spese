/* Agente - $$ — logica della pagina (fase 6). Nessuna libreria esterna. */

// ------------------------------------------------------------------ utilità
const S = { avvio: null, vista: 'home', form: null, mov: null, toastTimer: 0 };
const $ = sel => document.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euro = n => Number(n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const euroTondo = n => Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 }) + ' €';
const sec = ms => (ms / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' s';
const pausa = ms => new Promise(r => setTimeout(r, ms));
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const maiusc = s => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------------ memoria dei dati delle schermate
// Ogni schermata mostra subito l'ultima versione ricevuta e, se è vecchia, la aggiorna in background.
// S.versione cresce a ogni modifica salvata: i dati ricevuti prima diventano "da aggiornare".
const MEMO = {};
S.versione = 0;
const MEMO_VALIDITA_MS = 2 * 60 * 1000;
function memoFresco(chiave) {
  const m = MEMO[chiave];
  return !!m && m.dati !== undefined && m.versione === S.versione && Date.now() - m.t < MEMO_VALIDITA_MS;
}
function memoDati(chiave) { return MEMO[chiave] && MEMO[chiave].dati; }
function memoSalva(chiave, dati) { MEMO[chiave] = { dati, versione: S.versione, t: Date.now() }; memoConserva(); }
// Copia sul dispositivo: dopo una riapertura le schermate compaiono subito (e si aggiornano in background).
const MEMO_LOCALE = 'agente_memo';
try {
  const salvato = JSON.parse(localStorage.getItem(MEMO_LOCALE)) || {};
  for (const k in salvato) MEMO[k] = { dati: salvato[k], versione: -1, t: 0 };
} catch (e) { /* niente di salvato */ }
let memoTimer = 0;
function memoConserva() {
  clearTimeout(memoTimer);
  memoTimer = setTimeout(() => {
    const voci = Object.entries(MEMO).filter(([, m]) => m.dati !== undefined && m.t).sort((a, b) => b[1].t - a[1].t).slice(0, 15);
    try { localStorage.setItem(MEMO_LOCALE, JSON.stringify(Object.fromEntries(voci.map(([k, m]) => [k, m.dati])))); }
    catch (e) { try { localStorage.removeItem(MEMO_LOCALE); } catch (e2) { /* niente */ } }
  }, 1000);
}
/** Chiede i dati al server una sola volta anche se più schermate li vogliono insieme. */
function recupera(chiave, fn, ...args) {
  const m = MEMO[chiave] || (MEMO[chiave] = {});
  if (m.inCorso) return m.inCorso;
  const versione = S.versione;
  m.inCorso = chiama(fn, ...args)
    .then(dati => { MEMO[chiave] = { dati, versione, t: Date.now() }; memoConserva(); return dati; })
    .finally(() => { if (MEMO[chiave]) delete MEMO[chiave].inCorso; });
  return m.inCorso;
}
function datiModificati() { S.versione++; }
const importoTesto = n => Number(n).toFixed(2).replace('.', ',');

function dataIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function daIso(s) { const [a, m, g] = s.split('-').map(Number); return new Date(a, m - 1, g); }
function ieriIso() { const d = daIso(S.avvio.oggi); d.setDate(d.getDate() - 1); return dataIso(d); }
function etichettaGiorno(iso) {
  const d = daIso(iso);
  const base = `${GIORNI[d.getDay()]} ${d.getDate()}`;
  if (iso === S.avvio.oggi) return `Oggi, ${base}`;
  if (iso === ieriIso()) return `Ieri, ${base}`;
  return maiusc(`${base} ${MESI[d.getMonth()]}${d.getFullYear() !== daIso(S.avvio.oggi).getFullYear() ? ' ' + d.getFullYear() : ''}`);
}
function breveGiorno(iso) {
  if (iso === S.avvio.oggi) return 'Oggi';
  if (iso === ieriIso()) return 'Ieri';
  const d = daIso(iso);
  return `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)}`;
}
/** "12,50" · "1.234,50" · "12.5" → numero */
function leggiImporto(testo) {
  let t = String(testo || '').trim().replace(/[€\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// ------------------------------------------------------------------ icone (tratto, niente emoji)
const ICONE = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>', check: '<path d="M5 12l5 5L20 7"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  cart: '<path d="M3 4h2l2.5 11h10L20 7H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  fork: '<path d="M7 3v8M5 3v4a2 2 0 004 0V3M7 11v10"/><path d="M17 3c-2 0-3 2-3 5s1 4 3 4v9"/>',
  glass: '<path d="M7 3h10l-1 7a4 4 0 01-8 0z"/><path d="M12 14v6M8 21h8"/>',
  fuel: '<path d="M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12M14 9h2a2 2 0 012 2v5a1.5 1.5 0 003 0V8l-3-3"/><path d="M7 7h4"/>',
  wifi: '<path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0"/><path d="M12 19.5h.01"/>',
  gift: '<path d="M3 11h18v10H3zM2 7h20v4H2zM12 7v14"/><path d="M12 7c-2-4-6-4-6-1s6 1 6 1c0 0 6 2 6-1s-4-3-6 1"/>',
  plane: '<path d="M2 16l20-7-4-2-6 3-6-4-2 1 4 5-4 2-2-1-1 1z"/>',
  house: '<path d="M3 11l9-7 9 7v10H3z"/><path d="M9 21v-6h6v6"/>',
  tool: '<path d="M14.5 6.5a4 4 0 00-5 5L3 18l3 3 6.5-6.5a4 4 0 005-5l-2.5 2.5-2.5-2.5z"/>',
  moto: '<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17l4-7h5l4 7M9 10l-1-3H6M15 10l1.5-3H19"/>',
  shirt: '<path d="M8 3l-5 3 2 4 3-1v12h8V9l3 1 2-4-5-3c0 2-2 3-4 3s-4-1-4-3z"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 018-3 4.5 4.5 0 018 3c0 6-8 11-8 11z"/>',
  run: '<circle cx="14" cy="4" r="2"/><path d="M6 21l4-6 3 2 2 5M9 11l3-4 4 3 3 1M12 7l-4 1-2 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  chip: '<path d="M7 7h10v10H7z"/><path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  brief: '<path d="M3 8h18v12H3zM8 8V5h8v3M3 13h18"/>',
  printer: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><path d="M6 14h12v7H6z"/>',
  sheet: '<path d="M5 3h10l4 4v14H5z"/><path d="M8 11h8M8 15h8M8 19h5"/>',
  folder: '<path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
};
function ic(nome, size = 22, sw = 1.8) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE[nome] || ICONE.tag}</svg>`;
}
const ICONA_MACRO = { cibo: 'fork', casa: 'house', bollette: 'wifi', veicoli: 'moto', viaggi: 'plane', abbigliamento: 'shirt',
  salute: 'heart', sport: 'run', tempo: 'sun', hobby: 'tool', tech: 'chip', regali: 'gift', tasse: 'tag', lavoro: 'brief', varie: 'more' };
const ICONA_SUB = { 'cibo.spesa': 'cart', 'cibo.aperitivi': 'glass', 'veicoli.carburante': 'fuel', 'hobby.stampa3d': 'printer' };
const iconaCat = id => ICONA_SUB[id] || ICONA_MACRO[String(id).split('.')[0]] || 'tag';

// ------------------------------------------------------------------ dati di riferimento
let CAT = {}, PROG = {};
const AVVIO_LOCALE = 'agente_avvio';
/** Ultimi dati di avvio salvati sul dispositivo: l'app si apre subito con questi e poi li aggiorna. */
function avvioSalvato() {
  try { const a = JSON.parse(localStorage.getItem(AVVIO_LOCALE)); return a && a.categorie ? a : null; } catch (e) { return null; }
}
function indicizza() {
  try { localStorage.setItem(AVVIO_LOCALE, JSON.stringify(S.avvio)); } catch (e) { /* spazio esaurito: si continua */ }
  CAT = {}; PROG = {};
  const macro = {};
  S.avvio.categorie.filter(c => !c.parent_id).forEach(c => { macro[c.id] = c; });
  S.avvio.categorie.forEach(c => { CAT[c.id] = Object.assign({}, c, { macroNome: c.parent_id ? (macro[c.parent_id] || {}).nome : '' }); });
  S.avvio.progetti.forEach(p => { PROG[p.id] = p; });
}
/** Sotto-categoria attiva con macro attiva: proponibile nell'inserimento. */
const catUsabile = id => !!CAT[id] && CAT[id].attiva && !!CAT[id].parent_id && (CAT[CAT[id].parent_id] || {}).attiva !== false;
const nomeCat = id => CAT[id] ? (CAT[id].parent_id ? `${CAT[id].macroNome} › ${CAT[id].nome}` : CAT[id].nome) : id;
const nomeSub = id => CAT[id] ? CAT[id].nome : id;
const nomeProg = id => PROG[id] ? PROG[id].nome : '';
/**
 * Tutti i progetti attivi: le spese di un progetto possono cadere anche prima dell'inizio
 * (prenotazioni, acconti) o dopo la fine. Prima quelli in corso alla data della spesa.
 */
function progettiProponibili(dataIsoScelta) {
  const inCorso = p => (!p.data_inizio || p.data_inizio <= dataIsoScelta) && (!p.data_fine || p.data_fine >= dataIsoScelta);
  return S.avvio.progetti.filter(p => p.stato === 'ATTIVO')
    .sort((a, b) => inCorso(b) - inCorso(a) || a.nome.localeCompare(b.nome));
}

// ------------------------------------------------------------------ navigazione
function vai(vista, opzioni) {
  S.vista = vista;
  if (vista === 'home') renderHome();
  else if (vista === 'movimenti') apriMovimenti(opzioni);
  else if (vista === 'form') renderForm();
  else if (vista === 'analisi') renderAnalisi();
  else if (vista === 'budget') renderBudget();
  else if (vista === 'progetti') renderProgetti();
  else if (vista === 'altro') renderAltro();
  renderNav();
  // cronologia del browser: il tasto "indietro" del telefono torna alla schermata precedente
  if (!history.state || history.state.vista === vista) history.replaceState({ vista }, '');
  else history.pushState({ vista }, '');
}
const sezioneNav = () => ['budget', 'progetti'].includes(S.vista) ? 'altro' : S.vista;
function renderNav() {
  const nav = $('#nav');
  nav.hidden = S.vista === 'form';
  const voci = [['home', 'home', 'Home'], ['movimenti', 'list', 'Movimenti'], null, ['analisi', 'chart', 'Analisi'], ['altro', 'more', 'Altro']];
  nav.innerHTML = voci.map(v => v === null
    ? `<a href="#" data-azione="nuovo" aria-label="Nuovo movimento"><span class="fab">${ic('plus', 26, 2.2)}</span></a>`
    : `<a href="#" data-azione="vai" data-v="${v[0]}"${sezioneNav() === v[0] ? ' class="on" aria-current="page"' : ''}>${ic(v[1])}<span>${v[2]}</span></a>`).join('');
}

// ------------------------------------------------------------------ toast
function toast(testo, azione, errore) {
  const t = $('#toast');
  clearTimeout(S.toastTimer);
  t.className = 'toast' + (errore ? ' errore' : '');
  t.innerHTML = `<span>${esc(testo)}</span>` + (azione ? `<button type="button" id="toastAzione">${esc(azione.etichetta)}</button>` : '');
  t.hidden = false;
  if (azione) $('#toastAzione').onclick = () => { t.hidden = true; azione.fn(); };
  S.toastTimer = setTimeout(() => { t.hidden = true; }, errore ? 9000 : 6000);
}
const errore = e => e instanceof ErroreCollegamento
  ? toast(e.message, { etichetta: 'Collega', fn: () => renderCollega(e.message) }, true)
  : toast((e && e.message) || String(e), null, true);

// ------------------------------------------------------------------ riga movimento
function rigaMovimento(m, conGiorno) {
  const negativo = m.tipo !== 'SPESA';
  const segno = negativo ? '−' : '';
  const colore = negativo ? ' style="color: var(--ok);"' : '';
  const dett = [conGiorno ? breveGiorno(m.data) : '', m.tipo === 'RIMBORSO' ? 'Rimborso' : m.tipo === 'ENTRATA' ? 'Entrata' : '',
    nomeCat(m.categoria_id), nomeProg(m.progetto_id),
    m.rimborsabile === 'DA_RIMBORSARE' ? 'da rimborsare' : m.rimborsabile === 'AZIENDA' ? 'pagata dall’azienda' : ''].filter(Boolean).join(' · ');
  return `<a class="row" href="#" data-azione="modifica" data-id="${esc(m.id)}">
<span class="badge">${ic(iconaCat(m.categoria_id), 20)}</span>
<span class="grow"><span style="display:block;font-size:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(m.descrizione)}</span>
<span class="small" style="display:block;">${esc(dett)}</span></span>
<span class="num strong"${colore}>${segno}${euro(m.importo)}</span></a>`;
}

// ------------------------------------------------------------------ HOME
/** Anello dello stile 3: esterno = budget speso, interno sottile = parte del mese trascorsa. */
function anelloHtml(pct, quota, sopra) {
  const r = 60, c = 2 * Math.PI * r, ri = 45, ci = 2 * Math.PI * ri;
  const pieno = c * Math.min(pct, 100) / 100, giorni = ci * Math.min(quota, 100) / 100;
  return `<div class="anello-graf" role="img" aria-label="Speso ${pct}% del budget; trascorso ${quota}% del mese">
<svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="${r}" fill="none" stroke-width="12" style="stroke:var(--track)"></circle>
<circle cx="70" cy="70" r="${r}" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="${pieno.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 70 70)" style="stroke:var(${sopra ? '--ko' : '--acc'})"></circle>
<circle cx="70" cy="70" r="${ri}" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="${giorni.toFixed(1)} ${ci.toFixed(1)}" transform="rotate(-90 70 70)" style="stroke:var(--tx2);opacity:.45"></circle></svg>
<div class="anello-testo"><span class="h2 num" style="font-size:28px;font-weight:700;">${pct}%</span><span class="small">del budget</span></div></div>`;
}
function renderHome() {
  const a = S.avvio, m = a.mese;
  const pct = m.budget ? Math.round(m.speso / m.budget * 100) : 0;
  const quota = Math.round(m.giorniTrascorsi / m.giorniMese * 100);
  const sopra = m.budget && pct > quota + 5;
  const proiezione = m.giorniTrascorsi ? m.speso / m.giorniTrascorsi * m.giorniMese : 0;
  $('#vista').innerHTML = `
<header class="top"><h1 class="h1">${esc(maiusc(m.nome.split(' ')[0]))}</h1>
${a.geminiConfigurato ? `<button type="button" class="chip" data-azione="scontrino" style="min-height:44px;">${ic('camera', 18)} Scontrino</button>` : ''}</header>
<main class="scroll">
<section class="card" aria-label="Riepilogo del mese">
${m.budget ? `<div class="anello">${anelloHtml(pct, quota, m.speso > m.budget)}
<div style="display:flex;flex-direction:column;gap:6px;min-width:0;"><span class="cap">${esc(m.nome.split(' ')[0])}</span>
<span class="hero num">${euroTondo(m.speso)}</span><span class="label num">su ${euroTondo(m.budget)}</span>
<span class="small strong ${sopra ? 'ko' : 'ok'}">Giorno ${m.giorniTrascorsi} di ${m.giorniMese}: ${sopra ? 'sopra il ritmo' : 'in linea'}</span></div></div>`
  : `<span class="cap">Speso a ${esc(m.nome)}</span><span class="hero num">${euroTondo(m.speso)}</span>`}
<div class="divider"></div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
<div><span class="label" style="display:block;">Proiezione fine mese</span><span class="h2 num">${euroTondo(proiezione)}</span></div>
<div><span class="label" style="display:block;">${m.budget && m.speso > m.budget ? 'Oltre il budget' : 'Restano da spendere'}</span><span class="h2 num${m.budget && m.speso > m.budget ? ' ko' : ''}">${m.budget ? euroTondo(Math.abs(m.budget - m.speso)) : '—'}</span></div>
</div>
</section>
${homeBudgetHtml()}
${homeProgettiHtml()}
<section class="card" aria-label="Ultimi movimenti" style="gap:4px;">
<div class="sechead"><h2 class="h2">Ultimi movimenti</h2><a class="link" href="#" data-azione="vai" data-v="movimenti">Tutti</a></div>
<div>${a.ultimi.length ? a.ultimi.map(x => rigaMovimento(x, true)).join('') : '<p class="vuoto">Nessun movimento</p>'}</div>
</section>
</main>`;
}

// ------------------------------------------------------------------ MOVIMENTI
function apriMovimenti(opzioni) {
  if (!S.mov || (opzioni && opzioni.reset)) {
    S.mov = { anno: S.avvio.mese.anno, mese: S.avvio.mese.mese, testo: '', dati: null, filtri: {} };
  }
  renderMovimenti();
  caricaMovimenti();
}
function renderMovimenti() {
  const mv = S.mov;
  $('#vista').innerHTML = `
<header class="top"><h1 class="h1">Movimenti</h1>
${S.avvio.geminiConfigurato ? `<button class="iconbtn bordo" data-azione="scontrino" aria-label="Scansiona scontrino">${ic('camera')}</button>` : ''}</header>
<div style="padding:0 16px 8px;display:flex;flex-direction:column;gap:10px;">
<div style="position:relative;"><span style="position:absolute;left:12px;top:13px;color:var(--tx2);">${ic('search', 20)}</span>
<input id="cerca" class="input" type="search" aria-label="Cerca nei movimenti" placeholder="Cerca in tutto lo storico" value="${esc(mv.testo)}" style="padding-left:42px;"></div>
${filtriMovimentiHtml()}
<div class="mesenav" id="mesenav"${mv.testo.length >= 2 ? ' hidden' : ''}>
${mv.filtri.tutto || mv.filtri.anno ? `<span class="strong">${mv.filtri.anno ? 'Tutto il ' + mv.filtri.anno : 'Tutto il periodo'}</span>
<button type="button" class="link" data-azione="mov-mese" style="border:0;background:transparent;cursor:pointer;min-height:44px;">Solo ${esc(MESI[mv.mese - 1])}</button>`
    : `<button class="iconbtn" data-azione="mese" data-d="-1" aria-label="Mese precedente">${ic('left')}</button>
<span class="strong">${maiusc(MESI[mv.mese - 1])} ${mv.anno}</span>
<button class="iconbtn" data-azione="mese" data-d="1" aria-label="Mese successivo">${ic('right')}</button>`}</div>
<div class="sechead" id="movSintesi"><span class="label attesa">Caricamento</span></div>
</div>
<main class="scroll" id="movLista" style="padding-top:0;gap:6px;"></main>`;
  let timer = 0;
  $('#cerca').addEventListener('input', ev => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      mv.testo = ev.target.value.trim();
      $('#mesenav').hidden = mv.testo.length >= 2;
      caricaMovimenti();
    }, 400);
  });
}
function filtriMovimentiHtml() {
  const f = S.mov.filtri;
  const macro = S.avvio.categorie.filter(c => !c.parent_id).sort((a, b) => a.ordine - b.ordine);
  const opzCat = macro.map(m => `<optgroup label="${esc(m.nome)}"><option value="${m.id}"${f.categoria === m.id ? ' selected' : ''}>Tutta ${esc(m.nome)}</option>${S.avvio.categorie
    .filter(c => c.parent_id === m.id).sort((a, b) => a.ordine - b.ordine)
    .map(c => `<option value="${c.id}"${f.categoria === c.id ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>`).join('');
  const progetti = S.avvio.progetti.slice().sort((a, b) => (a.stato === 'ATTIVO' ? 0 : 1) - (b.stato === 'ATTIVO' ? 0 : 1) || a.nome.localeCompare(b.nome));
  const tipi = [['', 'Tutti i tipi'], ['SPESA', 'Spese'], ['RIMBORSO', 'Rimborsi'], ['ENTRATA', 'Entrate'], ['DA_RIMBORSARE', 'Da rimborsare']];
  return `<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;">
<select id="fltCat" class="chip sel${f.categoria ? ' on' : ''}" aria-label="Filtra per categoria"><option value="">Tutte le categorie</option>${opzCat}</select>
<select id="fltProg" class="chip sel${f.progetto ? ' on' : ''}" aria-label="Filtra per progetto"><option value="">Tutti i progetti</option>${progetti.map(p =>
    `<option value="${p.id}"${f.progetto === p.id ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
<select id="fltTipo" class="chip sel${f.tipo ? ' on' : ''}" aria-label="Filtra per tipo">${tipi.map(([v, t]) => `<option value="${v}"${(f.tipo || '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
</div>`;
}
const chiaveMov = mv => `mov:${mv.anno}-${mv.mese}-${mv.testo}-${JSON.stringify(mv.filtri)}`;
async function caricaMovimenti() {
  const mv = S.mov, chiave = chiaveMov(mv);
  mv.ultimaRichiesta = chiave;
  if (memoDati(chiave)) disegnaMovimenti(memoDati(chiave));
  else $('#movSintesi').innerHTML = '<span class="label attesa">Caricamento</span>';
  if (memoFresco(chiave)) return;
  try {
    const r = await recupera(chiave, 'getMovimenti', mv.anno, mv.mese, mv.testo, mv.filtri);
    if (mv.ultimaRichiesta !== chiave || S.vista !== 'movimenti') return;
    disegnaMovimenti(r);
  } catch (e) { errore(e); }
}
function disegnaMovimenti(r) {
  const mv = S.mov;
  if (!$('#movSintesi')) return;
  {
    mv.dati = r;
    $('#movSintesi').innerHTML = `<span class="label">${r.conteggio} moviment${r.conteggio === 1 ? 'o' : 'i'}${r.conteggio > 300 ? ' (primi 300)' : ''}</span><span class="strong num">${euro(r.totale)}</span>`;
    if (!r.righe.length) { $('#movLista').innerHTML = '<p class="vuoto">Nessun movimento</p>'; return; }
    const gruppi = [];
    r.righe.forEach(m => {
      const g = gruppi[gruppi.length - 1];
      if (g && g.data === m.data) g.righe.push(m); else gruppi.push({ data: m.data, righe: [m] });
    });
    $('#movLista').innerHTML = gruppi.map(g => {
      const tot = g.righe.reduce((s, m) => s + (m.tipo === 'SPESA' ? m.importo : m.tipo === 'RIMBORSO' ? -m.importo : 0), 0);
      return `<div class="dayhead"><span>${esc(etichettaGiorno(g.data))}</span><span class="num">${euro(tot)}</span></div>
<div class="card" style="padding:4px 14px;gap:0;">${g.righe.map(m => rigaMovimento(m, false)).join('')}</div>`;
    }).join('');
  }
}

// ------------------------------------------------------------------ FORM (nuovo / modifica / scontrino)
function nuovoForm(base) {
  return Object.assign({
    id: '', tipo: 'SPESA', importo: '', descrizione: '', categoria_id: '', progetto_id: '',
    dataScelta: 'oggi', data: S.avvio.oggi, note: '', rimborsabile: '', importo_orig: '', valuta_orig: '',
    allegato_url: '', fonte: 'APP', altro: false, tutte: false, catManuale: false, letti: {}, lettura: null,
  }, base || {});
}
function apriNuovo(base) { S.form = nuovoForm(base); vai('form'); }
function apriModifica(m) {
  const dataScelta = m.data === S.avvio.oggi ? 'oggi' : m.data === ieriIso() ? 'ieri' : 'altra';
  S.form = nuovoForm(Object.assign({}, m, {
    importo: importoTesto(m.importo), dataScelta, catManuale: true,
    altro: !!(m.note || m.rimborsabile || m.valuta_orig), importo_orig: m.importo_orig === '' ? '' : String(m.importo_orig),
  }));
  vai('form');
}
function pill(campo) {
  const s = S.form.letti[campo];
  if (!s) return '';
  return s === 'dubbio'
    ? `<span class="pill ko">${ic('alert', 12, 2)} da verificare</span>`
    : `<span class="pill ai">${ic('check', 12, 2.4)} ${s}</span>`;
}
function renderForm() {
  const f = S.form;
  $('#vista').innerHTML = `
<header class="top">
<button class="iconbtn" data-azione="chiudiForm" aria-label="Chiudi senza salvare">${ic('x')}</button>
<h1 class="h2" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">${f.id ? 'Modifica movimento' : 'Nuovo movimento'}</h1>
${f.id ? `<button class="iconbtn" data-azione="elimina" aria-label="Elimina movimento">${ic('trash')}</button>`
    : S.avvio.geminiConfigurato ? `<button class="chip" data-azione="scontrino">${ic('camera', 18)} Scontrino</button>` : '<span style="width:44px"></span>'}
</header>
<main class="scroll" id="formScroll" style="gap:18px;">
<div id="sezLettura"></div>
<div class="seg" role="group" aria-label="Tipo di movimento" id="sezTipo"></div>
<div class="field">
<div class="sechead"><label class="label" for="fImporto">Importo in euro</label>${pill('importo')}</div>
<div class="importo-riga${f.letti.importo === 'dubbio' ? ' dubbio' : ''}"><span class="hero" style="color:var(--tx2);">€</span>
<input id="fImporto" class="hero num" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(f.importo)}" style="border:0;background:transparent;width:100%;padding:0;color:var(--tx);outline:none;font-size:40px;"></div>
</div>
<div class="field">
<div class="sechead"><label class="label" for="fDescr">Descrizione</label>${pill('descrizione')}</div>
<input id="fDescr" class="input" autocomplete="off" placeholder="Es. Spesa Esselunga" value="${esc(f.descrizione)}" maxlength="200">
<div id="sezSugg" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
</div>
<div class="field" id="sezCategoria"></div>
<div class="field" id="sezData"></div>
<div class="field" id="sezProgetto"></div>
<div id="sezAltro"></div>
</main>
<div class="azioni">
${f.id ? '' : '<button class="btn sec" data-azione="salva" data-poi="nuovo" style="flex-grow:0;padding:0 16px;">Salva e nuova</button>'}
<button class="btn" data-azione="salva" data-poi="home">${ic('check', 20, 2.2)} Salva</button>
</div>`;
  ['Lettura', 'Tipo', 'Categoria', 'Data', 'Progetto', 'Altro'].forEach(renderSezione);
  $('#fDescr').addEventListener('input', aggiornaSuggerimenti);
  if (!f.id && !f.lettura) setTimeout(() => $('#fImporto').focus(), 50);
}
function leggiCampi() {
  const f = S.form, v = id => ($(id) ? $(id).value : undefined);
  if (v('#fImporto') !== undefined) f.importo = v('#fImporto');
  if (v('#fDescr') !== undefined) f.descrizione = v('#fDescr');
  if (v('#fDataAltra') !== undefined && f.dataScelta === 'altra') f.data = v('#fDataAltra') || f.data;
  if (v('#fNote') !== undefined) f.note = v('#fNote');
  if (v('#fImpOrig') !== undefined) f.importo_orig = v('#fImpOrig');
  if (v('#fValuta') !== undefined) f.valuta_orig = v('#fValuta');
}
function renderSezione(nome) {
  const f = S.form, el = $('#sez' + nome);
  if (!el) return;
  if (nome === 'Tipo') {
    el.innerHTML = [['SPESA', 'Spesa'], ['RIMBORSO', 'Rimborso'], ['ENTRATA', 'Entrata']].map(([id, t]) =>
      `<button type="button" class="${f.tipo === id ? 'on' : ''}" data-azione="tipo" data-v="${id}" aria-pressed="${f.tipo === id}">${t}</button>`).join('');
  } else if (nome === 'Categoria') {
    const frequenti = S.avvio.frequenti.filter(catUsabile);
    const chips = (f.categoria_id && !frequenti.includes(f.categoria_id) ? [f.categoria_id] : []).concat(frequenti);
    const macro = S.avvio.categorie.filter(c => !c.parent_id && c.attiva).sort((a, b) => a.ordine - b.ordine);
    el.innerHTML = `
<div class="sechead"><span class="cap">Categoria</span>${pill('categoria') || `<span class="small strong" style="color:var(--tx);">${esc(f.categoria_id ? nomeCat(f.categoria_id) : '')}</span>`}</div>
<div class="chips">${chips.map(id => `<button type="button" class="chip${f.categoria_id === id ? ' on' : ''}" data-azione="cat" data-v="${id}" aria-pressed="${f.categoria_id === id}">${esc(nomeSub(id))}</button>`).join('')}
<button type="button" class="chip ghost" data-azione="tutte">${ic('list', 16)} ${f.tutte ? 'Chiudi elenco' : 'Tutte le categorie'}</button></div>
${f.tutte ? `<div class="card" style="gap:14px;margin-top:4px;">${macro.map(m => `<div style="display:flex;flex-direction:column;gap:6px;">
<span class="small strong" style="color:var(--tx);">${esc(m.nome)}</span><div class="chips">${S.avvio.categorie.filter(c => c.parent_id === m.id && c.attiva).sort((a, b) => a.ordine - b.ordine)
    .map(c => `<button type="button" class="chip${f.categoria_id === c.id ? ' on' : ''}" style="min-height:36px;font-size:13px;" data-azione="cat" data-v="${c.id}">${esc(c.nome)}</button>`).join('')}</div></div>`).join('')}</div>` : ''}`;
  } else if (nome === 'Data') {
    el.innerHTML = `<div class="sechead"><span class="cap">Data</span>${pill('data')}</div>
<div class="chips">${[['oggi', 'Oggi'], ['ieri', 'Ieri'], ['altra', 'Altra data']].map(([id, t]) =>
      `<button type="button" class="chip${f.dataScelta === id ? ' on' : ''}" data-azione="data" data-v="${id}" aria-pressed="${f.dataScelta === id}">${t}</button>`).join('')}</div>
${f.dataScelta === 'altra' ? `<input id="fDataAltra" class="input${f.letti.data === 'dubbio' ? ' dubbio' : ''}" type="date" aria-label="Data del movimento" value="${esc(f.data)}" max="${esc(S.avvio.oggi)}">` : ''}`;
  } else if (nome === 'Progetto') {
    const lista = progettiProponibili(f.data);
    // chiusi e archiviati: i più recenti per primi (di solito serve quello appena chiuso)
    const recente = p => p.data_fine || p.data_inizio || '';
    const altri = S.avvio.progetti.filter(p => p.stato !== 'ATTIVO').sort((a, b) => recente(b).localeCompare(recente(a)) || a.nome.localeCompare(b.nome));
    // progetto chiuso già scelto (o del movimento in modifica): resta visibile anche con la lista ridotta
    if (!f.tuttiProgetti && f.progetto_id && !lista.some(p => p.id === f.progetto_id) && PROG[f.progetto_id]) lista.unshift(PROG[f.progetto_id]);
    const chip = p => `<button type="button" class="chip${f.progetto_id === p.id ? ' on' : ''}" data-azione="prog" data-v="${p.id}">${esc(p.nome)}</button>`;
    const interruttore = altri.length ? `<button type="button" class="chip" data-azione="altriProg" aria-expanded="${!!f.tuttiProgetti}" style="border-style:dashed;">${f.tuttiProgetti ? 'Meno progetti' : 'Altri progetti'}</button>` : '';
    el.innerHTML = `<span class="cap">Progetto (facoltativo)</span>
<div class="chips"><button type="button" class="chip${!f.progetto_id ? ' on' : ''}" data-azione="prog" data-v="">Nessuno</button>
${lista.map(chip).join('')}${interruttore}</div>
${f.tuttiProgetti ? `<span class="small">Chiusi e archiviati</span><div class="chips">${altri.map(chip).join('')}</div>` : ''}`;
  } else if (nome === 'Altro') {
    const rimb = f.rimborsabile === 'DA_RIMBORSARE';
    el.innerHTML = `<button type="button" class="link" data-azione="altro" style="border:0;background:transparent;text-align:left;padding:0;min-height:44px;cursor:pointer;display:flex;align-items:center;gap:6px;">${ic('down', 16, 2)} ${f.altro ? 'Meno dettagli' : 'Altri dettagli: note, rimborsabile, valuta'}</button>
${f.altro ? `<div class="card">
<div class="field"><label class="label" for="fNote">Note</label><input id="fNote" class="input" placeholder="Facoltative" value="${esc(f.note)}" maxlength="500"></div>
<div style="display:flex;align-items:center;gap:12px;">
<span class="grow"><span style="display:block;font-weight:500;">Da rimborsare</span><span class="small">Spesa di lavoro anticipata: conta finché non la segni come rimborsata</span></span>
<button type="button" class="switch${rimb ? ' on' : ''}" role="switch" aria-checked="${rimb}" aria-label="Da rimborsare" data-azione="rimb"><span></span></button></div>
${f.rimborsabile && f.rimborsabile !== 'DA_RIMBORSARE' ? `<span class="small">Stato attuale: ${f.rimborsabile === 'AZIENDA' ? 'pagata dall’azienda (fuori dai totali)' : 'rimborsata (fuori dai totali)'}</span>` : ''}
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
<div class="field"><label class="label" for="fImpOrig">Importo originale</label><input id="fImpOrig" class="input" inputmode="decimal" placeholder="Es. 120" value="${esc(f.importo_orig)}"></div>
<div class="field"><label class="label" for="fValuta">Valuta</label><input id="fValuta" class="input" placeholder="Es. USD" maxlength="3" value="${esc(f.valuta_orig)}" style="text-transform:uppercase;"></div>
</div></div>` : ''}`;
  } else if (nome === 'Lettura') {
    const l = f.lettura;
    el.innerHTML = !l ? '' : `<div class="banner">${l.foto ? `<img src="${l.foto}" alt="Scontrino">` : ''}
<div style="display:flex;flex-direction:column;gap:4px;">${l.stato === 'in corso'
      ? '<span class="strong attesa">Lettura dello scontrino</span><span class="small">Puoi anche bloccare il telefono: al ritorno il risultato viene recuperato.</span>'
      : l.stato === 'ok' ? `<span class="status ok">${ic('check', 16, 2.4)} Letto in ${sec(l.ms)}</span><span class="small">${esc(l.nota || 'Controlla i campi evidenziati, poi salva.')}</span>`
        : `<span class="status ko">${ic('alert', 16, 2)} Lettura non riuscita</span><span class="small">${esc(l.errore)} Puoi compilare a mano.</span>`}</div></div>`;
  }
}
function aggiornaSuggerimenti() {
  const q = $('#fDescr').value.trim().toLowerCase(), el = $('#sezSugg');
  S.form.descrizione = $('#fDescr').value;
  if (q.length < 2) { el.innerHTML = ''; return; }
  const trovati = S.avvio.suggerimenti.filter(s => s[0].toLowerCase().includes(q) && s[0].toLowerCase() !== q && CAT[s[1]])
    .sort((a, b) => (b[0].toLowerCase().startsWith(q) - a[0].toLowerCase().startsWith(q)) || b[3] - a[3]).slice(0, 3);
  const esatto = S.avvio.suggerimenti.find(s => s[0].toLowerCase() === q);
  if (esatto && !S.form.catManuale && catUsabile(esatto[1]) && S.form.categoria_id !== esatto[1]) {
    S.form.categoria_id = esatto[1];
    renderSezione('Categoria');
  }
  el.innerHTML = trovati.length ? '<span class="small" style="align-self:center;">Dallo storico:</span>' + trovati.map((s, i) =>
    `<button type="button" class="chip" style="min-height:36px;font-size:13px;" data-azione="sugg" data-i="${S.avvio.suggerimenti.indexOf(s)}">${esc(s[0])} · ${esc(nomeSub(s[1]))}</button>`).join('') : '';
}
async function salva(poi) {
  leggiCampi();
  const f = S.form;
  const importo = leggiImporto(f.importo);
  if (!(importo > 0)) { toast('Inserisci un importo maggiore di zero', null, true); $('#fImporto').focus(); return; }
  if (!f.descrizione.trim()) { toast('Inserisci una descrizione', null, true); $('#fDescr').focus(); return; }
  if (!f.categoria_id) { toast('Scegli una categoria', null, true); return; }
  const data = f.dataScelta === 'oggi' ? S.avvio.oggi : f.dataScelta === 'ieri' ? ieriIso() : f.data;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) { toast('Scegli la data', null, true); return; }
  const impOrig = f.importo_orig === '' ? '' : leggiImporto(f.importo_orig);
  const payload = { id: f.id, data, importo, tipo: f.tipo, categoria_id: f.categoria_id, progetto_id: f.progetto_id,
    descrizione: f.descrizione.trim(), note: f.note, rimborsabile: f.rimborsabile,
    importo_orig: isFinite(impOrig) ? impOrig : '', valuta_orig: f.valuta_orig, allegato_url: f.allegato_url, fonte: f.fonte };
  // Si torna subito alla schermata precedente: il salvataggio prosegue in background.
  const nuovo = !f.id, copiaForm = Object.assign({}, f, { letti: {}, lettura: null });
  if (nuovo) anteprimaLocale(payload);
  if (poi === 'nuovo') apriNuovo({ dataScelta: f.dataScelta, data });
  else vai(S.tornaA || 'home');
  toast('Salvataggio…');
  try {
    const r = await chiama('salvaMovimento', payload);
    S.avvio = r.avvio; indicizza(); datiModificati();
    ridisegna();
    toast(nuovo ? `Salvato: ${payload.descrizione} ${euro(importo)}` : 'Modifiche salvate',
      nuovo ? { etichetta: 'Annulla', fn: () => annullaSalvataggio(r.id) } : null);
  } catch (e) {
    toast('Non salvato: ' + ((e && e.message) || e), { etichetta: 'Riapri', fn: () => { S.form = copiaForm; vai('form'); } }, true);
    chiama('getAvvio').then(a => { S.avvio = a; indicizza(); ridisegna(); }).catch(() => { });
  }
}
/** Mostra subito in Home la spesa appena inserita, prima della risposta del server. */
function anteprimaLocale(p) {
  const m = Object.assign({}, p, { id: 'in-salvataggio' });
  S.avvio.ultimi = [m].concat(S.avvio.ultimi).slice(0, 8);
  const d = daIso(p.data);
  if (d.getFullYear() === S.avvio.mese.anno && d.getMonth() + 1 === S.avvio.mese.mese && !p.rimborsabile) {
    S.avvio.mese.speso += p.tipo === 'SPESA' ? p.importo : p.tipo === 'RIMBORSO' ? -p.importo : 0;
  }
}
/** Ridisegna la schermata aperta con i dati aggiornati (mai il modulo, per non perdere ciò che si scrive). */
function ridisegna() {
  if (S.vista === 'home') renderHome();
  else if (S.vista === 'movimenti') caricaMovimenti();
}
async function annullaSalvataggio(id) {
  try { const r = await chiama('eliminaMovimento', id); S.avvio = r.avvio; indicizza(); datiModificati(); vai(S.vista === 'form' ? 'home' : S.vista); toast('Inserimento annullato'); }
  catch (e) { errore(e); }
}
async function elimina() {
  const id = S.form.id;
  try {
    const r = await chiama('eliminaMovimento', id);
    S.avvio = r.avvio; indicizza(); datiModificati();
    vai(S.tornaA || 'home');
    toast('Movimento eliminato', { etichetta: 'Annulla', fn: async () => {
      try { const x = await chiama('ripristinaMovimento', id); S.avvio = x.avvio; indicizza(); datiModificati(); vai(S.vista); toast('Movimento ripristinato'); }
      catch (e) { errore(e); }
    } });
  } catch (e) { errore(e); }
}

// ------------------------------------------------------------------ SCONTRINO
const PENDENTE = 'agente_scontrino_pendente';
const memoria = {
  leggi() { try { return JSON.parse(localStorage.getItem(PENDENTE)); } catch (e) { return null; } },
  salva(v) { try { localStorage.setItem(PENDENTE, JSON.stringify(v)); } catch (e) { } },
  togli() { try { localStorage.removeItem(PENDENTE); } catch (e) { } },
};
function ridimensiona(file, lato = 1600, qualita = 0.75) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lato / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/jpeg', qualita));
    };
    img.onerror = () => ko(new Error('Immagine non leggibile'));
    img.src = URL.createObjectURL(file);
  });
}
const quandoVisibile = () => document.visibilityState === 'visible' ? Promise.resolve()
  : new Promise(r => document.addEventListener('visibilitychange', function f() {
    if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', f); r(); }
  }));
async function attendiEsito(lavoro, inizio) {
  const limite = inizio + 4 * 60 * 1000;
  while (Date.now() < limite) {
    await quandoVisibile();
    let s = null;
    try { s = await chiama('statoScontrino', lavoro); } catch (e) { await pausa(3000); continue; }
    if (s.lettura && s.lettura.stato === 'OK') return { lettura: s.lettura.risultato, foto: s.foto };
    if (s.lettura && s.lettura.stato === 'ERRORE') throw new Error(s.lettura.messaggio);
    if (!s.lettura && Date.now() - inizio > 25000) throw new Error('La foto non è arrivata al server (connessione interrotta durante l’invio).');
    await pausa(3000);
  }
  throw new Error('Nessuna risposta dopo 4 minuti.');
}
async function leggiFoto(file) {
  apriNuovo({ fonte: 'SCONTRINO', lettura: { stato: 'in corso' } });
  let blocco = null;
  try {
    const dataUrl = await ridimensiona(file);
    S.form.lettura.foto = dataUrl; renderSezione('Lettura');
    const base64 = dataUrl.split(',')[1];
    const lavoro = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const avvio = Date.now();
    memoria.salva({ lavoro, avvio });
    try { blocco = navigator.wakeLock ? await navigator.wakeLock.request('screen') : null; } catch (e) { blocco = null; }
    const salvataggio = chiama('salvaScontrino', base64, 'image/jpeg', lavoro).catch(() => null);
    let r, foto = null;
    try { r = await chiama('leggiScontrino', base64, 'image/jpeg', lavoro); }
    catch (e) { ({ lettura: r, foto } = await attendiEsito(lavoro, avvio)); }
    applicaLettura(r, Date.now() - avvio);
    foto = (await Promise.race([salvataggio, pausa(15000).then(() => null)])) || foto ||
      (await chiama('statoScontrino', lavoro).catch(() => ({}))).foto;
    if (foto && foto.url && S.form && S.form.fonte === 'SCONTRINO') S.form.allegato_url = foto.url;
  } catch (e) {
    if (S.form && S.form.lettura) { S.form.lettura.stato = 'errore'; S.form.lettura.errore = e.message; renderSezione('Lettura'); }
  }
  memoria.togli();
  if (blocco) blocco.release().catch(() => { });
}
/** Riempie il modulo con i campi letti da Gemini; segna "da verificare" ciò che è incerto. */
function applicaLettura(r, ms) {
  if (S.vista !== 'form' || !S.form) return;
  leggiCampi();
  const f = S.form, letti = {};
  let nota = '';
  if (r.valuta && r.valuta !== 'EUR') {
    f.importo_orig = importoTesto(r.importo); f.valuta_orig = r.valuta; f.altro = true; f.importo = '';
    letti.importo = 'dubbio';
    nota = `Scontrino in ${r.valuta}: inserisci l’importo addebitato in euro.`;
  } else {
    f.importo = importoTesto(r.importo);
    letti.importo = r.confidenza >= 0.8 ? `letto · ${Math.round(r.confidenza * 100)}%` : 'dubbio';
  }
  if (r.descrizione) { f.descrizione = r.descrizione; letti.descrizione = 'proposta'; }
  if (r.categoria_id && catUsabile(r.categoria_id)) { f.categoria_id = r.categoria_id; letti.categoria = 'proposta'; }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(r.data || '') ? r.data : '';
  const unAnnoFa = dataIso(new Date(daIso(S.avvio.oggi).getTime() - 365 * 864e5));
  if (d && d <= S.avvio.oggi && d >= unAnnoFa) {
    f.data = d; f.dataScelta = d === S.avvio.oggi ? 'oggi' : d === ieriIso() ? 'ieri' : 'altra'; letti.data = 'letto';
  } else { f.dataScelta = 'altra'; f.data = S.avvio.oggi; letti.data = 'dubbio'; }
  f.letti = letti;
  f.lettura = { stato: 'ok', ms, foto: f.lettura && f.lettura.foto, nota };
  const scroll = $('#formScroll') ? $('#formScroll').scrollTop : 0;
  renderForm();
  $('#formScroll').scrollTop = scroll;
}

// ------------------------------------------------------------------ eventi (un solo gestore per tutta la pagina)
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-azione]');
  if (!el) return;
  ev.preventDefault();
  const a = el.dataset.azione, v = el.dataset.v;
  const f = S.form;
  if (a === 'vai') { S.tornaA = v; vai(v, v === 'movimenti' ? { reset: S.vista !== 'movimenti' } : null); }
  else if (a === 'nuovo') { S.tornaA = S.vista === 'form' ? S.tornaA : S.vista; apriNuovo(); }
  else if (a === 'scontrino') { if (S.vista !== 'form') S.tornaA = S.vista; $('#foto').click(); }
  else if (a === 'modifica') {
    const lista = [].concat(S.avvio.ultimi, (S.mov && S.mov.dati && S.mov.dati.righe) || []);
    const m = lista.find(x => x.id === el.dataset.id);
    if (m) { S.tornaA = S.vista; apriModifica(m); }
  }
  else if (a === 'mese') {
    const d = new Date(S.mov.anno, S.mov.mese - 1 + Number(el.dataset.d), 1);
    S.mov.anno = d.getFullYear(); S.mov.mese = d.getMonth() + 1;
    renderMovimenti(); caricaMovimenti();
  }
  else if (a === 'mov-mese') { S.mov.filtri.tutto = false; delete S.mov.filtri.anno; renderMovimenti(); caricaMovimenti(); }
  else if (a === 'chiudiForm') vai(S.tornaA || 'home');
  else if (a === 'salva') salva(el.dataset.poi);
  else if (a === 'elimina') elimina();
  else if (f && a === 'tipo') { f.tipo = v; renderSezione('Tipo'); }
  else if (f && a === 'cat') { f.categoria_id = v; f.catManuale = true; f.tutte = false; delete f.letti.categoria; renderSezione('Categoria'); }
  else if (f && a === 'tutte') { f.tutte = !f.tutte; renderSezione('Categoria'); }
  else if (f && a === 'data') {
    leggiCampi(); f.dataScelta = v; delete f.letti.data;
    f.data = v === 'oggi' ? S.avvio.oggi : v === 'ieri' ? ieriIso() : f.data;
    renderSezione('Data'); renderSezione('Progetto');
  }
  else if (f && a === 'prog') { f.progetto_id = v; renderSezione('Progetto'); }
  else if (f && a === 'altriProg') { f.tuttiProgetti = !f.tuttiProgetti; renderSezione('Progetto'); }
  else if (f && a === 'altro') { leggiCampi(); f.altro = !f.altro; renderSezione('Altro'); }
  else if (f && a === 'rimb') { leggiCampi(); f.rimborsabile = f.rimborsabile === 'DA_RIMBORSARE' ? '' : 'DA_RIMBORSARE'; renderSezione('Altro'); }
  else if (f && a === 'sugg') {
    const s = S.avvio.suggerimenti[Number(el.dataset.i)];
    $('#fDescr').value = s[0]; f.descrizione = s[0];
    f.categoria_id = s[1]; f.catManuale = true; delete f.letti.categoria;
    if (s[2] && PROG[s[2]] && PROG[s[2]].stato === 'ATTIVO') f.progetto_id = s[2];
    $('#sezSugg').innerHTML = '';
    renderSezione('Categoria'); renderSezione('Progetto');
  }
  else azioneViste(a, el);
});
document.addEventListener('change', ev => {
  if (ev.target.id === 'foto' && ev.target.files[0]) { const file = ev.target.files[0]; ev.target.value = ''; leggiFoto(file); }
  if (ev.target.id === 'fDataAltra' && S.form) { S.form.data = ev.target.value; delete S.form.letti.data; renderSezione('Progetto'); }
  const filtro = { fltCat: 'categoria', fltProg: 'progetto', fltTipo: 'tipo' }[ev.target.id];
  if (filtro && S.mov) {
    S.mov.filtri[filtro] = ev.target.value;
    if (filtro === 'progetto') S.mov.filtri.tutto = !!ev.target.value;
    renderMovimenti(); caricaMovimenti();
  }
});

// ------------------------------------------------------------------ avvio
// Si parte solo a pagina completa: le schermate della fase 7 stanno in Viste.html, caricato dopo questo file.
async function avviaApp() {
  try {
    if (!Config.collegato()) { renderCollega(); return; }
    window.addEventListener('popstate', e => {
      let v = (e.state && e.state.vista) || 'home';
      if (v === 'form' && !S.form) v = 'home';
      if (v !== S.vista) { S.vista = v; vaiSenzaStorico(v); }
    });
    const salvato = avvioSalvato();
    if (salvato) { S.avvio = salvato; S.avvio.oggi = dataIso(new Date()); indicizza(); vai('home'); }
    try {
      S.avvio = await chiama('getAvvio');
      indicizza();
      if (salvato) ridisegna(); else vai('home');
    } catch (e) {
      if (e instanceof ErroreCollegamento) { renderCollega(e.message); return; }
      if (!salvato) throw e;
      toast('Dati non aggiornati: ' + e.message, null, true);
    }
    setTimeout(precarica, 1500);
    const p = memoria.leggi();   // lettura scontrino interrotta da una ricarica della pagina
    if (p && Date.now() - p.avvio < 10 * 60 * 1000) {
      apriNuovo({ fonte: 'SCONTRINO', lettura: { stato: 'in corso' } });
      try { const { lettura, foto } = await attendiEsito(p.lavoro, p.avvio); applicaLettura(lettura, Date.now() - p.avvio); if (foto && foto.url) S.form.allegato_url = foto.url; }
      catch (e) { if (S.form) { S.form.lettura = { stato: 'errore', errore: e.message }; renderSezione('Lettura'); } }
      memoria.togli();
    } else memoria.togli();
  } catch (e) {
    const api = Config.leggi().api || '';
    $('#vista').innerHTML = `<div class="vuoto"><p class="ko strong">Impossibile caricare i dati</p><p class="small">${esc(e.message)}</p>
<p class="small" style="word-break:break-all;">Server: ${esc(api)}</p>
<div style="display:flex;gap:8px;justify-content:center;"><button type="button" class="btn" id="eRiprova">Riprova</button>
<button type="button" class="btn sec" id="eCollega">Controlla il collegamento</button></div></div>`;
    $('#eRiprova').onclick = () => location.reload();
    $('#eCollega').onclick = () => renderCollega();
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avviaApp);
else setTimeout(avviaApp, 0);
/** Dopo l'apertura, carica in background i dati delle altre schermate: si apriranno subito. */
async function precarica() {
  const { anno, mese } = S.avvio.mese;
  const lista = [[`an:${anno}-${mese}`, 'getAnalisi', [anno, mese]], ['progetti', 'getProgetti', []],
    [chiaveMov({ anno, mese, testo: '', filtri: {} }), 'getMovimenti', [anno, mese, '', {}]], ['gestione', 'getGestione', []]];
  for (const [chiave, fn, args] of lista) {
    if (!memoFresco(chiave)) { try { await recupera(chiave, fn, ...args); } catch (e) { /* si riproverà all'apertura */ } }
  }
}
/** Schermata di collegamento: indirizzo del server (URL /exec) e chiave segreta. */
function renderCollega(messaggio) {
  const c = Config.leggi();
  $('#nav').hidden = true;
  $('#vista').innerHTML = `<header class="top"><h1 class="h1">Agente $$</h1></header>
<main class="scroll">
<section class="card"><h2 class="h2">Collega questo dispositivo</h2>
${messaggio ? `<p class="small ko" style="margin:0;">${esc(messaggio)}</p>` : ''}
<p class="label" style="margin:0;">Il modo più semplice: nell’editor Apps Script esegui <b>inviaLinkCollegamento</b> e apri su questo dispositivo il link che ricevi via email.</p>
<div class="field"><label class="label" for="cApi">Indirizzo del server (URL che finisce con /exec)</label>
<input id="cApi" class="input" autocomplete="off" value="${esc(c.api || '')}" placeholder="https://script.google.com/macros/s/…/exec"></div>
<div class="field"><label class="label" for="cChiave">Chiave segreta (oppure incolla qui tutto il link ricevuto via email)</label>
<input id="cChiave" class="input" autocomplete="off" type="password" value="${esc(c.chiave || '')}"></div>
<button type="button" class="btn" id="cSalva">Collega</button>
<p class="small" style="margin:0;">Indirizzo e chiave restano solo su questo dispositivo. Non condividere la chiave: dà accesso ai tuoi dati.</p>
</section></main>`;
  $('#cSalva').onclick = async () => {
    let api = $('#cApi').value.trim(), chiave = $('#cChiave').value.trim();
    const link = (chiave.match(/#(.*)$/) || [])[1];   // link intero incollato
    if (link && /(^|&)chiave=/.test(link)) {
      const p = new URLSearchParams(link);
      chiave = p.get('chiave') || ''; api = p.get('api') || api;
    }
    if (/\/dev\/?$/.test(api)) { renderCollega('Questo è l’indirizzo di prova (/dev): serve quello del deployment, che finisce con /exec.'); return; }
    Config.salva({ api, chiave });
    $('#cSalva').disabled = true; $('#cSalva').textContent = 'Verifica…';
    try { await chiama('getAvvio'); location.reload(); }
    catch (e) { renderCollega(e.message); }
  };
}
function vaiSenzaStorico(v) {
  if (v === 'home') renderHome(); else if (v === 'movimenti') apriMovimenti(); else if (v === 'form') renderForm();
  else if (v === 'analisi') renderAnalisi(); else if (v === 'budget') renderBudget();
  else if (v === 'progetti') renderProgetti(); else renderAltro();
  renderNav();
}
