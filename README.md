# Agente $$

App installabile (PWA) per registrare e analizzare le spese personali.

Questo repository contiene **solo l'interfaccia**: nessun dato, nessuna chiave.
I dati stanno in un foglio Google e sono serviti da uno script Google Apps Script personale;
l'indirizzo dello script e la chiave d'accesso vengono salvati solo sul dispositivo che si collega.

- `index.html`, `stile.css`, `app.js`, `viste.js` — l'interfaccia
- `api.js` — collegamento allo script (POST JSON con chiave)
- `sw.js`, `manifest.webmanifest`, `icone/` — installazione e apertura rapida
