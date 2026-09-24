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

/** Chiama una funzione del server. Le letture (get…, statoScontrino) si ritentano una volta se la rete
 *  o Google rispondono male (capita: server occupato, nuova versione appena pubblicata). */
async function chiama(fn, ...args) {
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
    if (r.codice === 'CHIAVE') throw new ErroreCollegamento(r.errore);
    const err = new Error(r.errore); err.daServer = true;   // errore vero del server: ritentare non serve
    throw err;
  }
  return r.dati;
}

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
