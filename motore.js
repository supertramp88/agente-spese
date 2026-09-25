// Generato da strumenti/genera-motore.js da apps-script/Codice.gs e Analisi.gs: non modificare a mano.
// Gli stessi calcoli del server, eseguiti sul dispositivo con i dati scaricati (getDati, Sincronia.gs).
const Motore = (function () {
// ---------------------------------------------------------------- Codice.gs
/**
 * Web app Agente - $$ — fase 6: inserimento, elenco e modifica dei movimenti.
 * Le funzioni senza "_" finale sono chiamate dall'app tramite l'API (Api.gs, elenco FUNZIONI_API).
 * Le date viaggiano verso l'app come testo "yyyy-MM-dd".
 */

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto',
  'settembre', 'ottobre', 'novembre', 'dicembre'];
const FUSO = 'Europe/Rome';
const TIPI = ['SPESA', 'RIMBORSO', 'ENTRATA'];
const RIMBORSABILE = ['', 'DA_RIMBORSARE', 'RIMBORSATO', 'AZIENDA'];
const FREQUENTI_DEFAULT = ['cibo.spesa', 'cibo.ristoranti', 'cibo.pranzi', 'cibo.aperitivi',
  'veicoli.carburante', 'hobby.stampa3d', 'regali.regali', 'bollette.telefonia'];

// ------------------------------------------------------------------ API per l'app

/** Tutto ciò che serve all'apertura: categorie, progetti, suggerimenti, riepilogo del mese. */
function getAvvio() {
  const movimenti = movimenti_();
  const oggi = new Date();
  const categorie = tabellaInCache_('Categorie')
    .filter(c => c.id)
    .map(c => ({ id: c.id, parent_id: c.parent_id || '', nome: c.nome, attiva: c.attiva !== false, ordine: c.ordine }));
  const progetti = tabella_('Progetti').filter(p => p.id).map(p => ({
    id: p.id, nome: p.nome, tipo: p.tipo, stato: p.stato,
    data_inizio: iso_(p.data_inizio), data_fine: iso_(p.data_fine),
    escludi_da_totali: p.escludi_da_totali === true,
    budget_totale: p.budget_totale === '' || p.budget_totale == null ? '' : Number(p.budget_totale),
  }));
  const esclusi = new Set(progetti.filter(p => p.escludi_da_totali).map(p => p.id));
  const validi = movimenti.filter(m => m.eliminato !== true);

  const annoCorrente = oggi.getFullYear();
  const progettiAttivi = progetti.filter(p => p.stato === 'ATTIVO').map(p => {
    const mov = validi.filter(m => m.progetto_id === p.id);
    const tot = l => arrotonda_(l.reduce((s, m) => s + valoreSpesa_(m, new Set()), 0));
    return { id: p.id, nome: p.nome, totale: tot(mov), anno: tot(mov.filter(m => m.data.getFullYear() === annoCorrente)),
      budget: p.budget_totale };
  }).sort((a, b) => b.anno - a.anno);

  return {
    oggi: iso_(oggi),
    categorie,
    progetti,
    frequenti: frequenti_(validi),
    suggerimenti: suggerimenti_(validi),
    mese: riepilogoMese_(validi, esclusi, oggi.getFullYear(), oggi.getMonth() + 1),
    budget: statoBudget_(validi, esclusi, oggi.getFullYear(), oggi.getMonth() + 1),
    progettiAttivi,
    ultimi: validi.slice().sort(ordinaRecenti_).slice(0, 8).map(serializza_),
    dbUrl: db_().getUrl(),
    geminiConfigurato: !!chiaveGemini_(false),
  };
}

/**
 * Movimenti di un mese (o di tutto il periodo con filtri.tutto), con ricerca testuale su tutto lo storico
 * e filtri facoltativi: categoria (macro o sotto), progetto, tipo (SPESA/RIMBORSO/ENTRATA/DA_RIMBORSARE).
 * Massimo 300 righe restituite; conteggio e totale sono su tutte.
 */
function getMovimenti(anno, mese, testo, filtri) {
  filtri = filtri || {};
  const esclusi = progettiEsclusi_();
  let righe = movimenti_().filter(m => m.eliminato !== true);
  const q = String(testo || '').trim().toLowerCase();
  const ricerca = q.length >= 2;
  if (ricerca) {
    const qNum = q.replace(',', '.');
    righe = righe.filter(m => `${m.descrizione} ${m.note}`.toLowerCase().includes(q) || String(m.importo).includes(qNum));
  } else if (filtri.anno) {
    righe = righe.filter(m => m.data.getFullYear() === Number(filtri.anno));
  } else if (!filtri.tutto) {
    righe = righe.filter(m => m.data.getFullYear() === anno && m.data.getMonth() + 1 === mese);
  }
  if (filtri.categoria) {
    righe = righe.filter(m => m.categoria_id === filtri.categoria || String(m.categoria_id).startsWith(filtri.categoria + '.'));
  }
  if (filtri.progetto) righe = righe.filter(m => m.progetto_id === filtri.progetto);
  if (filtri.tipo === 'DA_RIMBORSARE') righe = righe.filter(m => m.rimborsabile === 'DA_RIMBORSARE');
  else if (filtri.tipo) righe = righe.filter(m => m.tipo === filtri.tipo);
  righe.sort(ordinaRecenti_);
  // nei progetti esclusi dai totali si mostra comunque la loro somma
  const escl = filtri.progetto ? new Set() : esclusi;
  const totale = righe.reduce((s, m) => s + valoreSpesa_(m, escl), 0);
  return {
    righe: righe.slice(0, 300).map(serializza_),
    conteggio: righe.length,
    totale: arrotonda_(totale),
    ricerca,
  };
}

/**
 * Crea o aggiorna un movimento. `m` arriva dalla pagina: importo numero positivo, data "yyyy-MM-dd".
 * Restituisce l'id e i dati di avvio aggiornati (così la pagina non deve fare un'altra chiamata).
 */
function salvaMovimento(m) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (movimentiSuFirestore_()) {
      const o = movimentoDaSalvare_(m, new Date());
      scriviMovimentiFs_([o]);
      return { id: o.id, avvio: getAvvio() };
    }
    const errore = validaMovimento_(m);
    if (errore) throw new Error(errore);
    assicuraColonne_('Movimenti');
    datiCambiati_();
    const sh = db_().getSheetByName('Movimenti');
    const riga = trovaRiga_(sh, m.id);
    const esistente = riga ? comeOggetti_([SCHEMA.Movimenti, sh.getRange(riga, 1, 1, SCHEMA.Movimenti.length).getValues()[0]])[0] : null;
    const o = costruisciMovimento_(m, esistente, new Date());
    const valori = SCHEMA.Movimenti.map(k => o[k]);
    if (riga) sh.getRange(riga, 1, 1, valori.length).setValues([valori]);
    else scriviRighe_(db_(), 'Movimenti', [valori]);
    return { id: o.id, avvio: getAvvio() };
  } finally {
    lock.releaseLock();
  }
}

/** Il movimento come riga completa (tutte le colonne), da un modulo già validato. Usata anche dall'app (motore.js). */
function costruisciMovimento_(m, esistente, adesso) {
  return {
    id: m.id || nuovoId_(),
    data: dataDaIso_(m.data),
    importo: arrotonda_(Number(m.importo)),
    tipo: m.tipo,
    categoria_id: m.categoria_id,
    progetto_id: m.progetto_id || '',
    descrizione: String(m.descrizione).trim().slice(0, 200),
    note: String(m.note || '').trim().slice(0, 500),
    rimborsabile: m.rimborsabile || '',
    importo_orig: m.importo_orig === '' || m.importo_orig == null ? '' : Number(m.importo_orig),
    valuta_orig: String(m.valuta_orig || '').trim().toUpperCase().slice(0, 3),
    allegato_url: m.allegato_url || '',
    fonte: esistente ? esistente.fonte : (m.fonte === 'SCONTRINO' ? 'SCONTRINO' : 'APP'),
    ricorrente_id: esistente ? esistente.ricorrente_id : '',
    creato_il: esistente ? esistente.creato_il : adesso,
    modificato_il: adesso,
    eliminato: false,
    ora: m.ora || '',
  };
}

/** Validazione + riga completa, cercando il movimento esistente tra quelli letti (server su Firestore e app). */
function movimentoDaSalvare_(m, adesso) {
  const errore = validaMovimento_(m);
  if (errore) throw new Error(errore);
  const esistente = m.id ? movimenti_().find(x => x.id === m.id) : null;
  if (m.id && !esistente) throw new Error('Movimento non trovato: ' + m.id);
  return costruisciMovimento_(m, esistente, adesso);
}

/** La riga del movimento con un campo cambiato (cestino, rimborso). */
function movimentoModificato_(id, modifiche, adesso) {
  const x = movimenti_().find(m => m.id === id);
  if (!x) throw new Error('Movimento non trovato: ' + id);
  return Object.assign(x, modifiche, { modificato_il: adesso });
}

/** Sposta nel cestino (eliminato = TRUE). Reversibile con ripristinaMovimento. */
function eliminaMovimento(id) {
  return impostaEliminato_(id, true);
}

function ripristinaMovimento(id) {
  return impostaEliminato_(id, false);
}

// ------------------------------------------------------------------ calcoli

/** Regola "spesa personale": SPESA − RIMBORSO, esclusi cestino, rimborsati/azienda e progetti esclusi. */
function valoreSpesa_(m, progettiEsclusi) {
  if (m.eliminato === true || m.rimborsabile === 'RIMBORSATO' || m.rimborsabile === 'AZIENDA') return 0;
  if (m.progetto_id && progettiEsclusi.has(m.progetto_id)) return 0;
  if (m.tipo === 'SPESA') return m.importo;
  if (m.tipo === 'RIMBORSO') return -m.importo;
  return 0;
}

/** Home di un mese qualsiasi (frecce accanto al nome del mese): riepilogo e stato dei budget di quel mese. */
function getMese(anno, mese) {
  anno = Number(anno); mese = Number(mese);
  if (!(anno > 2000 && mese >= 1 && mese <= 12)) throw new Error('Mese non valido.');
  const validi = movimenti_().filter(m => m.eliminato !== true);
  const esclusi = progettiEsclusi_();
  return { mese: riepilogoMese_(validi, esclusi, anno, mese), budget: statoBudget_(validi, esclusi, anno, mese) };
}

/** Spese nei progetti esclusi dai totali (viaggi, progetti, DIY…): fuori dai budget, mostrate a parte. */
function speseEscluse_(lista, esclusi) {
  const nomi = Object.fromEntries(tabella_('Progetti').map(p => [p.id, p.nome]));
  const per = {};
  lista.forEach(m => {
    if (!m.progetto_id || !esclusi.has(m.progetto_id)) return;
    per[m.progetto_id] = (per[m.progetto_id] || 0) + valoreSpesa_(m, new Set());
  });
  const voci = Object.keys(per).map(id => ({ id, nome: nomi[id] || id, valore: arrotonda_(per[id]) }))
    .filter(v => v.valore).sort((a, b) => b.valore - a.valore);
  return { totale: arrotonda_(voci.reduce((s, v) => s + v.valore, 0)), voci };
}

function riepilogoMese_(validi, esclusi, anno, mese) {
  const primo = new Date(anno, mese - 1, 1);
  const giorniMese = new Date(anno, mese, 0).getDate();
  const oggi = new Date();
  const corrente = oggi.getFullYear() === anno && oggi.getMonth() + 1 === mese;
  const delMese = validi.filter(m => m.data.getFullYear() === anno && m.data.getMonth() + 1 === mese);
  const speso = delMese.reduce((s, m) => s + valoreSpesa_(m, esclusi), 0);
  return {
    anno, mese,
    nome: `${MESI[mese - 1]} ${anno}`,
    speso: arrotonda_(speso),
    esclusi: speseEscluse_(delMese, esclusi),
    budget: budgetTotale_(primo),
    giorniMese,
    giorniTrascorsi: corrente ? oggi.getDate() : giorniMese,
  };
}

/** Budget totale mensile valido per il mese (riga con categoria "*" più recente con valido_dal ≤ mese). */
function budgetTotale_(primoDelMese) {
  const righe = tabella_('Budget')
    .filter(b => b.categoria_id === '*' && b.valido_dal instanceof Date && b.valido_dal <= primoDelMese)
    .sort((a, b) => b.valido_dal - a.valido_dal);
  if (!righe.length) return 0;
  const b = righe[0];
  return arrotonda_(b.periodicita === 'ANNUALE' ? b.importo / 12 : b.importo);
}

/** Le 8 sotto-categorie più usate negli ultimi 180 giorni (completate con quelle di default). */
function frequenti_(validi) {
  const limite = new Date(Date.now() - 180 * 864e5);
  const conta = {};
  validi.filter(m => m.data >= limite && m.tipo === 'SPESA')
    .forEach(m => { conta[m.categoria_id] = (conta[m.categoria_id] || 0) + 1; });
  const top = Object.keys(conta).sort((a, b) => conta[b] - conta[a]).slice(0, 8);
  FREQUENTI_DEFAULT.forEach(id => { if (top.length < 8 && !top.includes(id)) top.push(id); });
  return top;
}

/**
 * Descrizioni già usate con la loro categoria/progetto più recenti, per i suggerimenti mentre scrivi.
 * Formato compatto: [descrizione, categoria_id, progetto_id, conteggio].
 */
function suggerimenti_(validi) {
  const mappa = {};
  validi.slice().sort((a, b) => a.data - b.data).forEach(m => {
    const chiave = m.descrizione.toLowerCase().trim();
    if (!chiave || chiave.length > 60) return;
    const e = mappa[chiave] || (mappa[chiave] = { n: 0 });
    e.d = m.descrizione.trim(); e.c = m.categoria_id; e.p = m.progetto_id || ''; e.n++; e.t = m.data.getTime();
  });
  return Object.values(mappa)
    .sort((a, b) => b.n - a.n || b.t - a.t)
    .slice(0, 500)
    .map(e => [e.d, e.c, e.p, e.n]);
}

// ------------------------------------------------------------------ accesso ai dati

function movimenti_() {
  return tabella_('Movimenti')
    .filter(m => m.id && m.data instanceof Date)
    .map(m => Object.assign(m, {
      descrizione: String(m.descrizione || ''), note: String(m.note || ''),
      importo: Number(m.importo) || 0, progetto_id: m.progetto_id || '', rimborsabile: m.rimborsabile || '',
    }));
}

function progettiEsclusi_() {
  return new Set(tabella_('Progetti').filter(p => p.escludi_da_totali === true).map(p => p.id));
}

function serializza_(m) {
  return {
    id: m.id, data: iso_(m.data), importo: m.importo, tipo: m.tipo, categoria_id: m.categoria_id,
    progetto_id: m.progetto_id, descrizione: m.descrizione, note: m.note, rimborsabile: m.rimborsabile,
    importo_orig: m.importo_orig === '' ? '' : Number(m.importo_orig), valuta_orig: m.valuta_orig || '',
    allegato_url: m.allegato_url || '', fonte: m.fonte || '', ora: oraMovimento_(m),
  };
}

/** Ora "HH:mm" del movimento. Se manca, per quelli inseriti dall'app lo stesso giorno della spesa si usa
 *  l'ora di inserimento (solo in lettura: nel foglio resta vuota). */
function oraMovimento_(m) {
  const o = m.ora;
  if (o instanceof Date) return Utilities.formatDate(o, db_().getSpreadsheetTimeZone(), 'HH:mm');
  if (/^\d{1,2}:\d{2}$/.test(String(o || '').trim())) return String(o).trim().padStart(5, '0');
  const c = m.creato_il instanceof Date ? m.creato_il : null;
  if (c && ['APP', 'SCONTRINO'].includes(m.fonte) && m.data instanceof Date && iso_(c) === iso_(m.data)) {
    return Utilities.formatDate(c, FUSO, 'HH:mm');
  }
  return '';
}

function ordinaRecenti_(a, b) {
  return b.data - a.data || oraMovimento_(b).localeCompare(oraMovimento_(a)) ||
    new Date(b.creato_il) - new Date(a.creato_il);
}

function validaMovimento_(m) {
  if (!m || typeof m !== 'object') return 'Dati mancanti.';
  if (!(Number(m.importo) > 0)) return 'Importo non valido: deve essere maggiore di zero.';
  if (!TIPI.includes(m.tipo)) return 'Tipo di movimento non valido.';
  if (!RIMBORSABILE.includes(m.rimborsabile || '')) return 'Valore "rimborsabile" non valido.';
  if (!String(m.descrizione || '').trim()) return 'Inserisci una descrizione.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.data || '')) return 'Data non valida.';
  if (m.ora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.ora)) return 'Ora non valida.';
  const cat = tabellaInCache_('Categorie').find(c => c.id === m.categoria_id);
  if (!cat || !cat.parent_id) return 'Scegli una categoria.';
  if (m.progetto_id && !tabella_('Progetti').some(p => p.id === m.progetto_id)) return 'Progetto non trovato.';
  if (m.id && !/^[A-Z]\w+$/.test(m.id)) return 'Identificativo non valido.';
  return '';
}

function trovaRiga_(sh, id) {
  if (!id) return 0;
  const n = sh.getLastRow() - 1;
  if (n <= 0) return 0;
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) if (ids[i][0] === id) return i + 2;
  throw new Error('Movimento non trovato: ' + id);
}

function impostaEliminato_(id, valore) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (movimentiSuFirestore_()) {
      scriviMovimentiFs_([movimentoModificato_(id, { eliminato: valore }, new Date())]);
      return { id, avvio: getAvvio() };
    }
    datiCambiati_();
    const sh = db_().getSheetByName('Movimenti');
    const riga = trovaRiga_(sh, id);
    sh.getRange(riga, 16, 1, 2).setValues([[new Date(), valore]]);
    return { id, avvio: getAvvio() };
  } finally {
    lock.releaseLock();
  }
}

function nuovoId_() {
  return 'A' + Utilities.formatDate(new Date(), FUSO, 'yyMMddHHmmss') +
    Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0');
}

function iso_(d) {
  return d instanceof Date ? Utilities.formatDate(d, FUSO, 'yyyy-MM-dd') : '';
}

function dataDaIso_(s) {
  const [a, m, g] = s.split('-').map(Number);
  return new Date(a, m - 1, g);
}

function arrotonda_(n) {
  return Math.round(n * 100) / 100;
}

// ------------------------------------------------------------------ configurazione in cache

/** Tabelle piccole e poco variabili (Categorie, Impostazioni) lette dalla cache per 10 minuti. */
function tabellaInCache_(nome) {
  const cache = CacheService.getScriptCache();
  const inCache = cache.get('tabella_' + nome);
  if (inCache) return JSON.parse(inCache);
  const righe = leggiTabella_(nome);
  cache.put('tabella_' + nome, JSON.stringify(righe), 600);
  return righe;
}

function impostazione_(chiave) {
  const riga = tabellaInCache_('Impostazioni').find(r => r.chiave === chiave);
  return riga ? riga.valore : '';
}

function impostaValore_(chiave, valore) {
  const sh = db_().getSheetByName('Impostazioni');
  const chiavi = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues().map(r => r[0]);
  const i = chiavi.indexOf(chiave);
  if (i >= 0) sh.getRange(i + 2, 2).setValue(valore);
  else sh.appendRow([chiave, valore, '']);
  CacheService.getScriptCache().remove('tabella_Impostazioni');
}

// ---------------------------------------------------------------- Analisi.gs
/**
 * Fase 7 — calcoli per Home, Analisi, Budget e Progetti.
 * Tutti gli importi seguono la regola "spesa personale" di valoreSpesa_ (Codice.gs).
 */

/** Stato dei budget per macro-categoria nel mese indicato (MENSILE sul mese, ANNUALE da gennaio). */
function getBudget(anno, mese) {
  const oggi = new Date();
  anno = anno || oggi.getFullYear();
  mese = mese || oggi.getMonth() + 1;
  return statoBudget_(movimenti_().filter(m => m.eliminato !== true), progettiEsclusi_(), anno, mese);
}

/** Analisi di un mese e dell'anno fino a quel mese, con confronto sull'anno precedente. */
function getAnalisi(anno, mese) {
  const validi = movimenti_().filter(m => m.eliminato !== true);
  const esclusi = progettiEsclusi_();
  const oggi = new Date();
  const corrente = oggi.getFullYear() === anno && oggi.getMonth() + 1 === mese;
  const giorniMese = new Date(anno, mese, 0).getDate();
  const giornoLimite = corrente ? oggi.getDate() : giorniMese;

  const nelMese = (m, a, me, finoAl) => m.data.getFullYear() === a && m.data.getMonth() + 1 === me &&
    (!finoAl || m.data.getDate() <= finoAl);
  const somma = lista => arrotonda_(lista.reduce((s, m) => s + valoreSpesa_(m, esclusi), 0));

  const movMese = validi.filter(m => nelMese(m, anno, mese));
  const movMesePrec = validi.filter(m => nelMese(m, anno - 1, mese, corrente ? giornoLimite : 0));
  const fineAnno = new Date(anno, mese - 1, giornoLimite, 23, 59, 59);
  const movAnno = validi.filter(m => m.data.getFullYear() === anno && m.data <= fineAnno);
  const fineAnnoPrec = new Date(anno - 1, mese - 1, Math.min(giornoLimite, new Date(anno - 1, mese, 0).getDate()), 23, 59, 59);
  const movAnnoPrec = validi.filter(m => m.data.getFullYear() === anno - 1 && m.data <= fineAnnoPrec);

  // Ultimi 12 mesi fino al mese scelto
  const mesi12 = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(anno, mese - 1 - i, 1);
    const a = d.getFullYear(), me = d.getMonth() + 1;
    mesi12.push({ anno: a, mese: me, valore: somma(validi.filter(m => nelMese(m, a, me))) });
  }
  const budgetMese = budgetTotale_(new Date(anno, mese - 1, 1));
  // Budget totale maturato da gennaio: mese per mese con il budget di allora (l'ultimo mese in proporzione ai giorni)
  let maturato = 0;
  for (let me = 1; me <= mese; me++) {
    maturato += budgetTotale_(new Date(anno, me - 1, 1)) * (me === mese ? giornoLimite / giorniMese : 1);
  }
  maturato = arrotonda_(maturato);
  const spesoAnno = somma(movAnno);
  // Salvadanaio viaggi: quanto si è risparmiato sul budget contro quanto è andato nei progetti esclusi dai totali
  const inEsclusi = movAnno.filter(m => m.progetto_id && esclusi.has(m.progetto_id));
  const nomiProg = Object.fromEntries(tabella_('Progetti').map(p => [p.id, p.nome]));
  const perEscluso = {};
  inEsclusi.forEach(m => { perEscluso[m.progetto_id] = (perEscluso[m.progetto_id] || 0) + valoreSpesa_(m, new Set()); });
  const viaggi = arrotonda_(Object.values(perEscluso).reduce((s, v) => s + v, 0));
  const salvadanaio = maturato ? {
    maturato, speso: spesoAnno, risparmiato: arrotonda_(maturato - spesoAnno), viaggi,
    saldo: arrotonda_(maturato - spesoAnno - viaggi),
    progetti: Object.keys(perEscluso).map(id => ({ id, nome: nomiProg[id] || id, valore: arrotonda_(perEscluso[id]) }))
      .filter(p => p.valore).sort((a, b) => b.valore - a.valore),
  } : null;

  return {
    anno, mese, corrente, giornoLimite,
    mese_: {
      totale: somma(movMese),
      totalePrec: somma(movMesePrec),
      budget: budgetMese,
      perMacro: perCategoria_(movMese, esclusi),
      perProgetto: perProgetto_(movMese, esclusi),
      esclusi: speseEscluse_(movMese, esclusi),
      conteggio: movMese.length,
    },
    anno_: {
      totale: spesoAnno,
      totalePrec: somma(movAnnoPrec),
      quotaBudget: maturato,
      mediaMensile: arrotonda_(spesoAnno / Math.max(1, mese - 1 + giornoLimite / giorniMese)),
      salvadanaio,
      perMacro: perCategoria_(movAnno, esclusi),
      perProgetto: perProgetto_(movAnno, esclusi),
      esclusi: speseEscluse_(movAnno, esclusi),
    },
    mesi12,
    // budget per categoria: del mese (mensili sul mese, annuali da gennaio) e dell'anno (per la vista Anno)
    budget: statoBudget_(validi, esclusi, anno, mese),
    budgetAnno: budgetAnnoPerCategoria_(anno, mese, giornoLimite, giorniMese),
  };
}

/** Budget dell'anno per macro-categoria: importo per l'anno intero e quota maturata alla data.
 *  Le mensili sommano i budget di ogni mese (con i cambi durante l'anno); le annuali usano quello valido nel mese. */
function budgetAnnoPerCategoria_(anno, mese, giornoLimite, giorniMese) {
  const out = {};
  for (let me = 1; me <= 12; me++) {
    const b = budgetValidi_(new Date(anno, me - 1, 1));
    Object.keys(b).forEach(id => {
      const x = b[id], imp = Number(x.importo) || 0;
      if (id === '*' || x.periodicita !== 'MENSILE' || !imp) return;
      const r = out[id] || (out[id] = { periodicita: 'MENSILE', importo: 0, quota: 0 });
      r.importo += imp;
      if (me < mese) r.quota += imp; else if (me === mese) r.quota += imp * giornoLimite / giorniMese;
    });
  }
  const valido = budgetValidi_(new Date(anno, mese - 1, 1));
  const frazione = (mese - 1 + giornoLimite / giorniMese) / 12;
  Object.keys(valido).forEach(id => {
    const x = valido[id], imp = Number(x.importo) || 0;
    if (id !== '*' && x.periodicita === 'ANNUALE' && imp) out[id] = { periodicita: 'ANNUALE', importo: imp, quota: imp * frazione };
  });
  Object.values(out).forEach(r => { r.importo = arrotonda_(r.importo); r.quota = arrotonda_(r.quota); });
  return out;
}

/** Riepilogo di un progetto (viaggio, veicolo, DIY…): totale e budget, andamento nel tempo, categorie
 *  e sotto-categorie, ultimi movimenti. Conta sempre tutte le sue spese, anche se è escluso dai totali. */
function getProgetto(id) {
  const p = tabella_('Progetti').find(x => x.id === id);
  if (!p) throw new Error('Progetto non trovato.');
  const nessuno = new Set();
  const mov = movimenti_().filter(m => m.eliminato !== true && m.progetto_id === id);
  const somma = l => arrotonda_(l.reduce((s, m) => s + valoreSpesa_(m, nessuno), 0));
  const giorno = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const tempi = mov.map(m => giorno(m.data).getTime());
  const primo = tempi.length ? new Date(Math.min(...tempi)) : null, ultimo = tempi.length ? new Date(Math.max(...tempi)) : null;
  const inizio = p.data_inizio instanceof Date ? giorno(p.data_inizio) : primo;
  const fine = p.data_fine instanceof Date ? giorno(p.data_fine) : ultimo;
  const durata = inizio && fine && fine >= inizio ? Math.round((fine - inizio) / 864e5) + 1 : 0;

  // Andamento: per giorno fino a un mese, per settimana fino a sei mesi (con "prima" e "dopo" per acconti
  // e code fuori dalle date), altrimenti per mese
  let andamento = null;
  if (durata && mov.length) {
    const voci = [];
    if (durata <= 183) {
      const perSettimana = durata > 31;
      const prima = somma(mov.filter(m => giorno(m.data) < inizio)), dopo = somma(mov.filter(m => giorno(m.data) > fine));
      if (prima) voci.push({ etichetta: 'prima', valore: prima, fuori: true });
      const passo = perSettimana ? 7 : 1;
      // passi di calendario (non di 24 ore): al cambio dell'ora legale le settimane restano da lunedì a domenica
      for (let d = inizio; d <= fine; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + passo)) {
        const da = d.getTime(), a = Math.min(new Date(d.getFullYear(), d.getMonth(), d.getDate() + passo - 1).getTime(), fine.getTime());
        voci.push({
          etichetta: perSettimana ? `${d.getDate()}/${d.getMonth() + 1}` : String(d.getDate()), data: iso_(d),
          valore: somma(mov.filter(m => { const g = giorno(m.data).getTime(); return g >= da && g <= a; })),
        });
      }
      if (dopo) voci.push({ etichetta: 'dopo', valore: dopo, fuori: true });
      andamento = { tipo: perSettimana ? 'settimana' : 'giorno', voci };
    } else {
      const da = new Date(Math.min(inizio, primo || inizio)), a = new Date(Math.max(fine, ultimo || fine));
      for (let d = new Date(da.getFullYear(), da.getMonth(), 1); d <= a; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const an = d.getFullYear(), me = d.getMonth();
        voci.push({ etichetta: MESI[me].charAt(0).toUpperCase(), anno: an, mese: me + 1,
          valore: somma(mov.filter(m => m.data.getFullYear() === an && m.data.getMonth() === me)) });
      }
      andamento = { tipo: 'mese', voci };
    }
  }
  const budget = p.budget_totale === '' || p.budget_totale == null ? 0 : Number(p.budget_totale) || 0;
  return {
    progetto: {
      id: p.id, nome: p.nome, tipo: p.tipo, stato: p.stato, note: p.note || '',
      data_inizio: iso_(p.data_inizio), data_fine: iso_(p.data_fine), budget_totale: budget || '',
      escludi_da_totali: p.escludi_da_totali === true,
    },
    totale: somma(mov),
    spese: arrotonda_(mov.filter(m => m.tipo === 'SPESA').reduce((s, m) => s + valoreSpesa_(m, nessuno), 0)),
    rimborsi: arrotonda_(-mov.filter(m => m.tipo === 'RIMBORSO').reduce((s, m) => s + valoreSpesa_(m, nessuno), 0)),
    conteggio: mov.length, primo: iso_(primo), ultimo: iso_(ultimo),
    inizio: iso_(inizio), fine: iso_(fine), durata,
    perMacro: perCategoria_(mov, nessuno),
    andamento,
    ultimi: mov.slice().sort(ordinaRecenti_).slice(0, 10).map(serializza_),
  };
}

/** Progetti con totale dell'anno in corso, totale complessivo, budget e date. */
function getProgetti() {
  const validi = movimenti_().filter(m => m.eliminato !== true && m.progetto_id);
  const anno = new Date().getFullYear();
  const perProg = {};
  validi.forEach(m => {
    // i progetti esclusi dai totali mostrano comunque le proprie spese
    const v = valoreSpesa_(m, new Set());
    const p = perProg[m.progetto_id] || (perProg[m.progetto_id] = { totale: 0, anno: 0, conteggio: 0, ultima: '' });
    p.totale += v; p.conteggio++;
    if (m.data.getFullYear() === anno) p.anno += v;
    const d = iso_(m.data);
    if (d > p.ultima) p.ultima = d;
  });
  return tabella_('Progetti').filter(p => p.id).map(p => {
    const t = perProg[p.id] || { totale: 0, anno: 0, conteggio: 0, ultima: '' };
    return {
      id: p.id, nome: p.nome, tipo: p.tipo, stato: p.stato, note: p.note || '',
      data_inizio: iso_(p.data_inizio), data_fine: iso_(p.data_fine),
      budget_totale: p.budget_totale === '' ? '' : Number(p.budget_totale),
      escludi_da_totali: p.escludi_da_totali === true,
      totale: arrotonda_(t.totale), totaleAnno: arrotonda_(t.anno), conteggio: t.conteggio, ultima: t.ultima,
    };
  }).sort((a, b) => (b.ultima || '').localeCompare(a.ultima || ''));
}

// ------------------------------------------------------------------ helper

/**
 * Budget per macro: MENSILE confrontato con lo speso del mese, ANNUALE con lo speso da gennaio
 * e con la "quota a oggi" (budget × frazione d'anno trascorsa).
 */
function statoBudget_(validi, esclusi, anno, mese) {
  const primo = new Date(anno, mese - 1, 1);
  const budget = budgetValidi_(primo);
  const oggi = new Date();
  const corrente = oggi.getFullYear() === anno && oggi.getMonth() + 1 === mese;
  const giorniMese = new Date(anno, mese, 0).getDate();
  const giorno = corrente ? oggi.getDate() : giorniMese;
  const frazioneAnno = (mese - 1 + giorno / giorniMese) / 12;
  const fine = new Date(anno, mese - 1, giorno, 23, 59, 59);

  const speseMese = {}, speseAnno = {}, subMese = {}, subAnno = {};
  validi.forEach(m => {
    if (m.data.getFullYear() !== anno || m.data > fine) return;
    const macro = String(m.categoria_id).split('.')[0];
    const v = valoreSpesa_(m, esclusi);
    if (!v) return;
    speseAnno[macro] = (speseAnno[macro] || 0) + v;
    subAnno[m.categoria_id] = (subAnno[m.categoria_id] || 0) + v;
    if (m.data.getMonth() + 1 === mese) {
      speseMese[macro] = (speseMese[macro] || 0) + v;
      subMese[m.categoria_id] = (subMese[m.categoria_id] || 0) + v;
    }
  });
  // dettaglio per sotto-categoria (si apre toccando il nome del budget in Home)
  const nomiCat = Object.fromEntries(tabellaInCache_('Categorie').map(c => [c.id, c.nome]));
  const dettaglio = (idMacro, fonte) => Object.keys(fonte)
    .filter(id => id === idMacro || id.startsWith(idMacro + '.'))
    .map(id => ({ id, nome: nomiCat[id] || id, valore: arrotonda_(fonte[id]) }))
    .filter(x => x.valore).sort((a, b) => b.valore - a.valore);

  const macro = tabellaInCache_('Categorie').filter(c => c.id && !c.parent_id).sort((a, b) => a.ordine - b.ordine);
  const righe = [], senza = [];
  let somma = 0;
  macro.forEach(c => {
    const b = budget[c.id];
    const importo = b ? Number(b.importo) || 0 : 0;
    if (!importo) {
      if (c.attiva !== false) senza.push({ id: c.id, nome: c.nome, speso: arrotonda_(speseMese[c.id] || 0), spesoAnno: arrotonda_(speseAnno[c.id] || 0) });
      return;
    }
    const annuale = b.periodicita === 'ANNUALE';
    somma += annuale ? importo / 12 : importo;
    const speso = arrotonda_((annuale ? speseAnno[c.id] : speseMese[c.id]) || 0);
    const maturato = annuale ? arrotonda_(importo * frazioneAnno) : null;
    righe.push({
      id: c.id, nome: c.nome, periodicita: b.periodicita, importo, speso, maturato,
      spesoAnno: arrotonda_(speseAnno[c.id] || 0),
      valido_dal: iso_(b.valido_dal), note: b.note || '',
      sopra: annuale ? speso > maturato : speso > importo,
      pressione: annuale ? (maturato ? speso / maturato : 0) : speso / importo,
      subs: dettaglio(c.id, annuale ? subAnno : subMese),
    });
  });
  const totale = budgetTotale_(primo);
  const rigaTotale = budget['*'];
  return {
    anno, mese, giorno, giorniMese,
    totale, totalePeriodicita: rigaTotale ? rigaTotale.periodicita : 'MENSILE',
    totaleImporto: rigaTotale ? Number(rigaTotale.importo) : 0,
    totaleValidoDal: rigaTotale ? iso_(rigaTotale.valido_dal) : '',
    somma: arrotonda_(somma),
    margine: arrotonda_(totale - somma),
    prossimo: sommaBudget_(new Date(anno, mese, 1)),
    righe, senza,
  };
}

/** Totale e somma dei budget per categoria (annuali contati 1/12) validi in un mese: serve a segnalare
 *  quando le categorie superano il totale, anche per i budget già impostati dal mese successivo. */
function sommaBudget_(primoDelMese) {
  const budget = budgetValidi_(primoDelMese);
  let somma = 0;
  const voci = {};   // budget per categoria in quel mese: l'app mostra "Da ottobre: …" dove cambiano
  tabellaInCache_('Categorie').filter(c => c.id && !c.parent_id).forEach(c => {
    const b = budget[c.id], importo = b ? Number(b.importo) || 0 : 0;
    if (b) voci[c.id] = { periodicita: b.periodicita, importo };
    if (importo) somma += b.periodicita === 'ANNUALE' ? importo / 12 : importo;
  });
  const totale = budgetTotale_(primoDelMese);
  const t = budget['*'];
  if (t) voci['*'] = { periodicita: t.periodicita, importo: Number(t.importo) || 0 };
  return { anno: primoDelMese.getFullYear(), mese: primoDelMese.getMonth() + 1, totale, somma: arrotonda_(somma), margine: arrotonda_(totale - somma), voci };
}

/** Per ogni categoria (e "*") la riga di budget più recente con valido_dal ≤ primo del mese. */
function budgetValidi_(primoDelMese) {
  const mappa = {};
  tabella_('Budget')
    .filter(b => b.categoria_id && b.valido_dal instanceof Date && b.valido_dal <= primoDelMese)
    .forEach(b => {
      const x = mappa[b.categoria_id];
      if (!x || b.valido_dal > x.valido_dal || (b.valido_dal.getTime() === x.valido_dal.getTime() && String(b.id) > String(x.id))) {
        mappa[b.categoria_id] = b;
      }
    });
  return mappa;
}

function perCategoria_(lista, esclusi) {
  const nomi = Object.fromEntries(tabellaInCache_('Categorie').map(c => [c.id, c.nome]));
  const macro = {};
  lista.forEach(m => {
    const v = valoreSpesa_(m, esclusi);
    if (!v) return;
    const idM = String(m.categoria_id).split('.')[0];
    const x = macro[idM] || (macro[idM] = { id: idM, nome: nomi[idM] || idM, valore: 0, subs: {} });
    x.valore += v;
    x.subs[m.categoria_id] = (x.subs[m.categoria_id] || 0) + v;
  });
  return Object.values(macro)
    .map(x => ({
      id: x.id, nome: x.nome, valore: arrotonda_(x.valore),
      subs: Object.keys(x.subs).map(id => ({ id, nome: nomi[id] || id, valore: arrotonda_(x.subs[id]) }))
        .filter(s => s.valore).sort((a, b) => b.valore - a.valore),
    }))
    .filter(x => x.valore)
    .sort((a, b) => b.valore - a.valore);
}

function perProgetto_(lista, esclusi) {
  const progetti = Object.fromEntries(tabella_('Progetti').map(p => [p.id, p]));
  const tot = {};
  lista.filter(m => m.progetto_id).forEach(m => {
    tot[m.progetto_id] = (tot[m.progetto_id] || 0) + valoreSpesa_(m, new Set());
  });
  // per i progetti con budget: totale di tutto il progetto (il budget è del progetto intero, non del periodo)
  const conBudget = Object.keys(tot).filter(id => progetti[id] && Number(progetti[id].budget_totale) > 0);
  const totaleProgetto = {};
  if (conBudget.length) {
    movimenti_().forEach(m => {
      if (m.eliminato === true || !conBudget.includes(m.progetto_id)) return;
      totaleProgetto[m.progetto_id] = (totaleProgetto[m.progetto_id] || 0) + valoreSpesa_(m, new Set());
    });
  }
  return Object.keys(tot).map(id => {
    const p = progetti[id], budget = p && Number(p.budget_totale) > 0 ? Number(p.budget_totale) : 0;
    return { id, nome: p ? p.nome : id, valore: arrotonda_(tot[id]), escluso: esclusi.has(id),
      budget, totale: budget ? arrotonda_(totaleProgetto[id] || 0) : 0 };
  }).filter(p => p.valore).sort((a, b) => b.valore - a.valore);
}

// ---------------------------------------------------------------- al posto dei servizi di Apps Script
// (dichiarate dopo il codice del server: a parità di nome valgono queste)
let D = null;
const due = n => String(n).padStart(2, '0');
const Utilities = {
  // sul dispositivo le date sono già nell'ora locale: il fuso richiesto non serve
  formatDate: (d, fuso, f) => f.replace('yyyy', d.getFullYear()).replace('yy', String(d.getFullYear()).slice(2))
    .replace('MM', due(d.getMonth() + 1)).replace('dd', due(d.getDate())).replace('HH', due(d.getHours()))
    .replace('mm', due(d.getMinutes())).replace('ss', due(d.getSeconds())),
};
function db_() {
  return { getUrl: () => D.meta.dbUrl || '', getSpreadsheetTimeZone: () => FUSO,
    getSheetByName() { throw new Error('Non disponibile sul dispositivo.'); } };
}
function tabella_(nome) { return (D.tabelle[nome] || []).map(r => Object.assign({}, r)); }
function tabellaInCache_(nome) { return tabella_(nome); }
function chiaveGemini_() { return D.meta.geminiConfigurato ? 'si' : ''; }

const FUNZIONI = { getAvvio, getMovimenti, getMese, getAnalisi, getBudget, getProgetti, getProgetto };
/** Dati ricevuti da getDati: { ver, tabelle: { Nome: { h, r } }, meta }. */
function carica(dati) {
  const tabelle = {};
  Object.keys(dati.tabelle).forEach(nome => {
    const { h, r } = dati.tabelle[nome];
    tabelle[nome] = r.map(riga => {
      const o = {};
      h.forEach((k, i) => {
        const v = riga[i];
        if (v && typeof v === 'object' && 'g' in v) { const [a, m, g] = v.g.split('-').map(Number); o[k] = new Date(a, m - 1, g); }
        else if (v && typeof v === 'object' && 't' in v) o[k] = new Date(v.t);
        else o[k] = v;
      });
      return o;
    });
  });
  D = { tabelle, meta: dati.meta || {} };
}
/** Come una risposta del server: dati semplici (le date diventano testo come nel JSON). */
function esegui(fn, args) {
  return JSON.parse(JSON.stringify(FUNZIONI[fn].apply(null, args || [])));
}
/** Tappa 3: il movimento da scrivere, come riga completa con le date come Date (stessa logica del server). */
function prepara(op, args) {
  if (op === 'salva') return movimentoDaSalvare_(args[0], new Date());
  if (op === 'eliminato') return movimentoModificato_(args[0], { eliminato: !!args[1] }, new Date());
  throw new Error('Operazione sconosciuta: ' + op);
}
return { carica, esegui, prepara, pronto: () => !!D, funzioni: Object.keys(FUNZIONI) };
})();
