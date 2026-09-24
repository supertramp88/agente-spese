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

/** Chiama una funzione del server: stessa interfaccia di google.script.run, ma con fetch. */
async function chiama(fn, ...args) {
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
    throw new Error(e.name === 'AbortError' ? 'Il server non ha risposto in tempo.' : 'Connessione non riuscita: controlla la rete e riprova.');
  } finally {
    clearTimeout(timer);
  }
  let r;
  try { r = await res.json(); } catch (e) {
    throw new ErroreCollegamento('Il server non ha risposto come previsto: controlla l’indirizzo del server e che il deployment sia accessibile a "Chiunque".');
  }
  if (!r.ok) {
    if (r.codice === 'CHIAVE') throw new ErroreCollegamento(r.errore);
    throw new Error(r.errore);
  }
  return r.dati;
}
