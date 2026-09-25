/* Agente - $$ — collegamento al server (Apps Script pubblicato come API).
 * L'indirizzo del server e la chiave segreta restano solo su questo dispositivo (localStorage):
 * non sono nel codice pubblicato. Si impostano una volta con il link di collegamento
 * (…/#chiave=…&api=…) oppure dalla schermata "Collega questo dispositivo". */

const CONFIG_CHIAVE = 'agente_config';
const Config = {
  leggi() { try { return JSON.parse(localStorage.getItem(CONFIG_CHIAVE)) || {}; } catch (e) { return {}; } },
  salva(c) { try { localStorage.setItem(CONFIG_CHIAVE, JSON.stringify(c)); } catch (e) { /* archivio non disponibile */ } },
  collegato() { const c = this.leggi(); return !!(c.api && c.chiave); },
};

// Link di collegamento: salva i dati e li toglie subito dalla barra degli indirizzi
function leggiLinkCollegamento() {
  if (!/(^|[#&])(chiave|api)=/.test(location.hash.slice(1))) return false;
  const p = new URLSearchParams(location.hash.slice(1));
  const c = Config.leggi();
  if (p.get('chiave')) c.chiave = p.get('chiave').trim();
  if (p.get('api')) c.api = p.get('api').trim();
  Config.salva(c);
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}
leggiLinkCollegamento();
// link aperto con l'app già aperta nella stessa scheda: si ricarica con i nuovi dati
window.addEventListener('hashchange', () => { if (leggiLinkCollegamento()) location.reload(); });

class ErroreCollegamento extends Error {}

/** Chiama una funzione del server. Le letture che il dispositivo sa calcolare da sé (vedi Locale) non vanno
 *  in rete; dopo ogni modifica i dati sul dispositivo si aggiornano. */
async function chiama(fn, ...args) {
  if (Locale.serve(fn)) return Locale.esegui(fn, args);
  const r = await chiamaRete(fn, ...args);
  if (!SOLO_LETTURA.test(fn)) Locale.dopoScrittura();
  return r;
}
/** Le letture (get…, statoScontrino) si ritentano una volta se la rete o Google rispondono male
 *  (capita: server occupato, nuova versione appena pubblicata). */
async function chiamaRete(fn, ...args) {
  const lettura = /^get|^statoScontrino$/.test(fn);
  try { return await chiamaUnaVolta(fn, args); }
  catch (e) {
    if (!lettura || e instanceof ErroreCollegamento || e.daServer) throw e;
    await new Promise(r => setTimeout(r, 1500));
    return chiamaUnaVolta(fn, args);
  }
}
async function chiamaUnaVolta(fn, args) {
  const c = Config.leggi();
  if (!c.api || !c.chiave) throw new ErroreCollegamento('Questo dispositivo non è ancora collegato.');
  const controllo = new AbortController();
  const timer = setTimeout(() => controllo.abort(), 150000);   // la lettura di uno scontrino può durare a lungo
  let res;
  try {
    // text/plain evita la richiesta preliminare CORS, che Apps Script non gestisce
    res = await fetch(c.api, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ chiave: c.chiave, fn, args }),
      redirect: 'follow',
      signal: controllo.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Il server non ha risposto in tempo.');
    if (navigator.onLine === false) throw new Error('Sei offline: controlla la rete e riprova.');
    // Rete presente ma risposta bloccata: di solito il deployment non è "Chiunque" o non ha la versione con Api.gs
    throw new Error('Il server non risponde all’app. Se succede sempre: in Apps Script il deployment deve essere accessibile a “Chiunque” e aggiornato a una nuova versione che contiene Api.gs; l’indirizzo deve finire con /exec.');
  } finally {
    clearTimeout(timer);
  }
  let r;
  try { r = await res.json(); } catch (e) {
    // pagina d'errore di Google invece dei dati: di solito momentanea (non è un problema di chiave o indirizzo)
    throw new Error(`Il server non ha risposto correttamente${res.status && res.status !== 200 ? ` (errore ${res.status})` : ''}: riprova tra qualche secondo.`);
  }
  if (!r.ok) {
    if (r.codice === 'CHIAVE') { Locale.dimentica(); throw new ErroreCollegamento(r.errore); }
    const err = new Error(r.errore); err.daServer = true;   // errore vero del server: ritentare non serve
    throw err;
  }
  if (r.specchio && r.specchio !== 'ok') Locale.forzaApps = true;   // copia su Firestore non riuscita: dati dal server
  return r.dati;
}

// ------------------------------------------------------------------ dati sul dispositivo
// Movimenti, categorie, progetti e budget restano anche sul dispositivo e le schermate si calcolano qui
// (motore.js: gli stessi conti del server). Si scarica di nuovo solo se sul server qualcosa è cambiato:
// all'apertura, al ritorno in primo piano e dopo ogni modifica. Finché i dati dopo una modifica non sono
// arrivati, le schermate aspettano; se non arrivano, si torna a chiedere tutto al server.
const SOLO_LETTURA = /^get|^statoScontrino$|^leggiScontrino$|^salvaScontrino$|^inviaReportProva$/;
const DATI_CHIAVE = 'agente_dati';
const Locale = {
  ver: '', st: null, affidabile: false, attesa: null, inCorso: null, ancora: false, forzaApps: false,
  alCambio: null,   // impostata da app.js: ridisegna con i dati nuovi
  avvia() {
    if (typeof Motore === 'undefined') return;
    try {
      const d = JSON.parse(localStorage.getItem(DATI_CHIAVE));
      if (d && d.modo === 'fb') { Motore.carica(perMotore(d)); this.st = d; this.affidabile = true; }
      else if (d && d.ver) { Motore.carica(d); this.ver = d.ver; this.affidabile = true; }
    } catch (e) { /* si riscaricano */ }
  },
  serve(fn) { return this.affidabile && Motore.funzioni.includes(fn); },
  async esegui(fn, args) {
    if (this.attesa) await this.attesa;
    return this.affidabile ? Motore.esegui(fn, args) : chiamaRete(fn, ...args);
  },
  /** Scarica i dati se sono cambiati; true se sono cambiati. Richieste sovrapposte: una sola alla volta,
   *  più un giro in più se nel frattempo ne è arrivata un'altra (per esempio dopo una modifica).
   *  Prima Firestore (solo le novità); se non è collegato o non risponde, il server (getDati). */
  sincronizza() {
    if (typeof Motore === 'undefined') return Promise.resolve(false);
    if (this.inCorso) { this.ancora = true; return this.inCorso; }
    this.inCorso = (async () => {
      let cambiato = false;
      do {
        this.ancora = false;
        let fb = null;
        if (!this.forzaApps && !Fb.assente) {
          try { fb = await this.daFirestore(); } catch (e) { if (e instanceof ErroreCollegamento) throw e; fb = null; }
        }
        this.forzaApps = false;
        cambiato = (fb !== null ? fb : await this.daApps()) || cambiato;
        this.affidabile = true; this.ultimo = Date.now();
      } while (this.ancora);
      return cambiato;
    })().finally(() => { this.inCorso = null; });
    return this.inCorso;
  },
  async daApps() {
    const d = await chiamaRete('getDati', this.st ? '' : this.ver);
    if (d.invariato) return false;
    Motore.carica(d); this.ver = d.ver; this.st = null;
    this.conserva(d);
    return true;
  },
  /** Novità da Firestore (la prima volta tutto). null se Firebase non è collegato. */
  async daFirestore() {
    if (!Fb.cfg) Fb.leggi();
    if (!Fb.cfg && !(await Fb.accedi())) return null;
    const cfg = Fb.cfg;
    const nuovo = !(this.st && this.st.progetto === cfg.progetto);
    const st = nuovo ? { modo: 'fb', progetto: cfg.progetto, tabelle: {}, agg: {}, meta: cfg.meta } : this.st;
    let cambiato = nuovo;
    const nomi = Object.keys(cfg.collezioni);
    if (!(await Fb.token())) return null;
    // le raccolte insieme; un minuto di margine: una scrittura con orario di poco precedente non va persa
    const risposte = await Promise.all(nomi.map(nome =>
      Fb.novita(cfg.collezioni[nome], st.agg[nome] ? new Date(st.agg[nome] - 60000).toISOString() : '')));
    if (risposte.includes(null)) return null;
    for (const [i, nome] of nomi.entries()) {
      const righe = st.tabelle[nome] || (st.tabelle[nome] = {});
      for (const x of risposte[i]) {
        if (!x.document) continue;
        const f = x.document.fields || {}, id = x.document.name.split('/').pop();
        const agg = f._agg ? Date.parse(f._agg.timestampValue) : 0;
        if (agg > (st.agg[nome] || 0)) st.agg[nome] = agg;
        if (f._eliminato) { if (righe[id]) { delete righe[id]; cambiato = true; } continue; }
        const h = f._h ? f._h.stringValue : '';
        if (righe[id] && righe[id]._h === h) continue;
        righe[id] = Object.assign(daFirestore(f, cfg.colonneData[nome] || []), { _h: h });
        cambiato = true;
      }
    }
    if (cfg.meta) st.meta = cfg.meta;
    if (cambiato) { Motore.carica(perMotore(st)); this.st = st; this.ver = ''; this.conserva(st); }
    return cambiato;
  },
  /** Per Gestione: da dove arrivano i dati e quando sono stati controllati l'ultima volta. */
  descrizione() {
    if (!this.affidabile) return 'Dati: chiesti ogni volta al server.';
    const da = this.st ? 'Firestore' : 'server';
    const quando = this.ultimo ? new Date(this.ultimo).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
    return `Dati sul dispositivo, aggiornati da ${da}${quando ? ' · controllati alle ' + quando : ''}.`;
  },
  conserva(d) {
    try { localStorage.setItem(DATI_CHIAVE, JSON.stringify(d)); }
    catch (e) { try { localStorage.removeItem(DATI_CHIAVE); } catch (e2) { /* niente */ } }
  },
  dopoScrittura() {
    const attesa = this.sincronizza().then(() => { }, () => { this.affidabile = false; })
      .finally(() => { if (this.attesa === attesa) this.attesa = null; });
    this.attesa = attesa;
  },
  /** Aggiornamento in background (apertura, ritorno in primo piano). */
  aggiorna() {
    return this.sincronizza().then(c => { if (c && this.alCambio) return this.alCambio(); })
      .catch(e => { if (e instanceof ErroreCollegamento && this.alScollegato) this.alScollegato(e); /* altrimenti si riproverà */ });
  },
  alScollegato: null,   // impostata da app.js: schermata di collegamento
  /** Chiave non più valida (per esempio dispositivo perso e chiave rigenerata): via i dati dal dispositivo. */
  dimentica() {
    this.affidabile = false; this.ver = ''; this.st = null; Fb.dimentica();
    ['agente_dati', 'agente_memo', 'agente_avvio'].forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* niente */ } });
  },
};

// Firestore → valori come nel Foglio (date di calendario {g}, istanti {t}: come getDati)
function daFirestore(campi, colonneData) {
  const o = {};
  for (const k in campi) {
    if (k.startsWith('_')) { if (k === '_r') o._r = Number(campi[k].integerValue); continue; }
    const v = campi[k];
    if ('stringValue' in v) o[k] = colonneData.includes(k) && /^\d{4}-\d{2}-\d{2}$/.test(v.stringValue) ? { g: v.stringValue } : v.stringValue;
    else if ('integerValue' in v) o[k] = Number(v.integerValue);
    else if ('doubleValue' in v) o[k] = v.doubleValue;
    else if ('booleanValue' in v) o[k] = v.booleanValue;
    else if ('timestampValue' in v) o[k] = { t: Date.parse(v.timestampValue) };
    else o[k] = '';
  }
  return o;
}
/** Dal formato conservato (righe per id) a quello del motore (intestazioni + righe, nell'ordine del Foglio). */
function perMotore(st) {
  const tabelle = {};
  Object.keys(st.tabelle).forEach(nome => {
    const righe = Object.values(st.tabelle[nome]).sort((a, b) => (a._r || 0) - (b._r || 0));
    const h = [...new Set(righe.flatMap(o => Object.keys(o)))].filter(k => !k.startsWith('_'));
    tabelle[nome] = { h, r: righe.map(o => h.map(k => (k in o ? o[k] : ''))) };
  });
  return { tabelle, meta: st.meta || {} };
}

// ------------------------------------------------------------------ Firestore (tappa 2)
// Lettura diretta con l'API REST (niente librerie): permesso firmato da Apps Script (getAccessoFirebase),
// scambiato con Firebase Authentication e rinnovato da solo. Le regole permettono solo la lettura.
const FB_CHIAVE = 'agente_fb';
const Fb = {
  cfg: null, assente: false,
  leggi() { try { this.cfg = JSON.parse(localStorage.getItem(FB_CHIAVE)) || null; } catch (e) { this.cfg = null; } },
  salva() { try { localStorage.setItem(FB_CHIAVE, JSON.stringify(this.cfg)); } catch (e) { /* resta in memoria */ } },
  dimentica() { this.cfg = null; try { localStorage.removeItem(FB_CHIAVE); } catch (e) { /* niente */ } },
  /** Permesso da Apps Script → accesso a Firebase. false se Firebase non è (ancora) collegato. */
  async accedi() {
    const a = await chiamaRete('getAccessoFirebase');
    if (!a) { this.assente = true; this.dimentica(); return false; }
    const r = await this.post(`${a.url.identitytoolkit}accounts:signInWithCustomToken?key=${encodeURIComponent(a.apiKey)}`,
      { token: a.token, returnSecureToken: true });
    delete a.token;
    this.cfg = Object.assign(a, { idToken: r.idToken, refresh: r.refreshToken, scade: Date.now() + Number(r.expiresIn) * 1000 });
    this.salva();
    return true;
  },
  async token() {
    if (!this.cfg && !(await this.accedi())) return null;
    if (Date.now() < this.cfg.scade - 120000) return this.cfg.idToken;
    try {
      const res = await fetch(`${this.cfg.url.securetoken}token?key=${encodeURIComponent(this.cfg.apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(this.cfg.refresh),
      });
      if (!res.ok) throw new Error('Rinnovo non riuscito: ' + res.status);
      const r = await res.json();
      Object.assign(this.cfg, { idToken: r.id_token, refresh: r.refresh_token, scade: Date.now() + Number(r.expires_in) * 1000 });
      this.salva();
      return this.cfg.idToken;
    } catch (e) {
      if (e instanceof TypeError) throw e;   // rete assente
      return (await this.accedi()) ? this.cfg.idToken : null;
    }
  },
  async post(url, corpo, token) {
    const res = await fetch(url, {
      method: 'POST', body: JSON.stringify(corpo),
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    });
    if (!res.ok) { const err = new Error('Firebase ' + res.status); err.stato = res.status; throw err; }
    return res.json();
  },
  /** Documenti di una raccolta aggiornati dopo `dopo` (ISO), o tutti. null se Firebase non è collegato. */
  async novita(raccolta, dopo) {
    const q = { from: [{ collectionId: raccolta }] };
    if (dopo) {
      q.where = { fieldFilter: { field: { fieldPath: '_agg' }, op: 'GREATER_THAN', value: { timestampValue: dopo } } };
      q.orderBy = [{ field: { fieldPath: '_agg' } }];
    }
    const url = `${this.cfg.url.firestore}projects/${this.cfg.progetto}/databases/(default)/documents:runQuery`;
    let t = await this.token();
    if (!t) return null;
    try { return await this.post(url, { structuredQuery: q }, t); }
    catch (e) {
      if (e.stato !== 401 && e.stato !== 403) throw e;
      // permesso revocato (nuova chiave) o scaduto: se ne chiede uno nuovo; con la chiave revocata → ErroreCollegamento
      this.dimentica();
      if (!(await this.accedi())) return null;
      return this.post(url, { structuredQuery: q }, this.cfg.idToken);
    }
  },
};
Locale.avvia();

// ------------------------------------------------------------------ aspetto (chiaro / scuro / automatico)
const TEMA_CHIAVE = 'agente_tema';
function temaScelto() { try { return localStorage.getItem(TEMA_CHIAVE) || 'chiaro'; } catch (e) { return 'chiaro'; } }
function applicaTema() {
  const t = temaScelto();
  document.documentElement.dataset.tema = t;
  const scuro = t === 'scuro' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = scuro ? '#000000' : '#F1F4F2';
}
function impostaTema(t) { try { localStorage.setItem(TEMA_CHIAVE, t); } catch (e) { /* niente */ } applicaTema(); }
applicaTema();
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applicaTema);
