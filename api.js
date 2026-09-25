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
  ver: '', affidabile: false, attesa: null, inCorso: null, ancora: false,
  alCambio: null,   // impostata da app.js: ridisegna con i dati nuovi
  avvia() {
    if (typeof Motore === 'undefined') return;
    try {
      const d = JSON.parse(localStorage.getItem(DATI_CHIAVE));
      if (d && d.ver) { Motore.carica(d); this.ver = d.ver; this.affidabile = true; }
    } catch (e) { /* si riscaricano */ }
  },
  serve(fn) { return this.affidabile && Motore.funzioni.includes(fn); },
  async esegui(fn, args) {
    if (this.attesa) await this.attesa;
    return this.affidabile ? Motore.esegui(fn, args) : chiamaRete(fn, ...args);
  },
  /** Scarica i dati se sono cambiati; true se sono cambiati. Richieste sovrapposte: una sola alla volta,
   *  più un giro in più se nel frattempo ne è arrivata un'altra (per esempio dopo una modifica). */
  sincronizza() {
    if (typeof Motore === 'undefined') return Promise.resolve(false);
    if (this.inCorso) { this.ancora = true; return this.inCorso; }
    this.inCorso = (async () => {
      let cambiato = false;
      do {
        this.ancora = false;
        const d = await chiamaRete('getDati', this.ver);
        if (!d.invariato) {
          Motore.carica(d); this.ver = d.ver; cambiato = true;
          try { localStorage.setItem(DATI_CHIAVE, JSON.stringify(d)); }
          catch (e) { try { localStorage.removeItem(DATI_CHIAVE); } catch (e2) { /* niente */ } }
        }
        this.affidabile = true;
      } while (this.ancora);
      return cambiato;
    })().finally(() => { this.inCorso = null; });
    return this.inCorso;
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
    this.affidabile = false; this.ver = '';
    ['agente_dati', 'agente_memo', 'agente_avvio'].forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* niente */ } });
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
