/* Agente - $$ — schermate della fase 7: Analisi, Budget, Progetti, Altro (gestione). */

// ------------------------------------------------------------------ componenti comuni
/** Un solo salvataggio alla volta: blocca i pulsanti finché il server non risponde (evita i doppi tocchi). */
async function unaVolta(fn) {
  if (document.body.classList.contains('occupato')) return undefined;
  document.body.classList.add('occupato');
  try { return await fn(); } finally { document.body.classList.remove('occupato'); }
}
function meterHtml(pct, over, tick, etichetta) {
  return `<div class="meter" role="img" aria-label="${esc(etichetta)}"><div class="fill${over ? ' over' : ''}" style="width:${Math.max(0, Math.min(100, pct))}%;"></div>${tick == null ? '' : `<div class="tick" style="left:${Math.max(0, Math.min(100, tick))}%;"></div>`}</div>`;
}
function rigaBudget(r, conModifica) {
  const annuale = r.periodicita === 'ANNUALE';
  const pct = r.importo ? Math.round(r.speso / r.importo * 100) : 0;
  const tick = annuale ? Math.round(r.maturato / r.importo * 100) : null;
  const stato = r.sopra
    ? `<span class="status ko">${ic('alert', 14, 2)} ${euroTondo(r.speso - (annuale ? r.maturato : r.importo))} ${annuale ? 'sopra la quota' : 'oltre'}</span>`
    : `<span class="small num">${annuale ? `quota a oggi ${euroTondo(r.maturato)}` : `restano ${euroTondo(r.importo - r.speso)}`}</span>`;
  return `<div style="display:flex;flex-direction:column;gap:8px;padding:10px 0;border-bottom:1px solid #EFECE5;">
<div style="display:flex;align-items:center;gap:10px;">
<span class="badge" style="width:32px;height:32px;border-radius:9px;">${ic(ICONA_MACRO[r.id] || 'tag', 18)}</span>
<span class="grow strong" style="font-size:15px;">${esc(r.nome)}</span>
<span class="num" style="font-size:14px;">${euroTondo(r.speso)} di ${euroTondo(r.importo)}${annuale ? ' / anno' : ''}</span></div>
${meterHtml(pct, r.sopra, tick, `${r.nome}: speso ${pct}% del budget ${annuale ? 'annuale' : 'mensile'}`)}
<div style="display:flex;justify-content:${conModifica ? 'space-between' : 'flex-end'};align-items:center;">
${conModifica ? `<button type="button" class="link" data-azione="bud-modifica" data-v="${r.id}" style="border:0;background:transparent;padding:0;min-height:36px;cursor:pointer;">Modifica</button>` : ''}${stato}</div>
</div>`;
}
function barreHtml(voci, totale, scala) {
  const max = scala || Math.max(1, ...voci.map(v => v.valore));
  return voci.map(v => `<div style="display:flex;flex-direction:column;gap:4px;padding:6px 0;">
<div style="display:flex;justify-content:space-between;gap:8px;font-size:14px;"><span>${esc(v.nome)}</span>
<span class="num"><span class="strong">${euro(v.valore)}</span>${totale ? ` <span class="small">${Math.round(v.valore / totale * 100)}%</span>` : ''}</span></div>
<div class="meter" style="background:transparent;" title="${esc(v.nome)}: ${euro(v.valore)}"><div class="fill" style="width:${Math.max(1, Math.round(v.valore / max * 100))}%;"></div></div>
</div>`).join('');
}
const caricamento = testo => `<div class="vuoto"><span class="attesa">${esc(testo || 'Caricamento')}</span></div>`;
function intestazione(titolo, indietro, destra) {
  return `<header class="top">${indietro ? `<button class="iconbtn" data-azione="vai" data-v="${indietro}" aria-label="Indietro">${ic('left')}</button>` : ''}
<h1 class="h1 grow">${esc(titolo)}</h1>${destra || ''}</header>`;
}
const confrontoHtml = (att, prec, nome) => {
  if (!prec) return `<span class="small">Nessuna spesa in ${esc(nome)} per il confronto</span>`;
  const d = Math.round((att - prec) / prec * 100);
  if (d === 0) return `<span class="small">Uguale a ${esc(nome)}</span>`;
  return `<span class="status ${d > 0 ? 'ko' : 'ok'}">${ic(d > 0 ? 'alert' : 'check', 14, 2.2)} ${Math.abs(d)}% ${d > 0 ? 'in più' : 'in meno'} di ${esc(nome)} (${euroTondo(prec)})</span>`;
};

// ------------------------------------------------------------------ HOME: sezioni aggiuntive
function homeBudgetHtml() {
  const b = S.avvio.budget;
  if (!b || !b.righe.length) return '';
  const mensili = b.righe.filter(r => r.periodicita === 'MENSILE');
  const annuali = b.righe.filter(r => r.periodicita === 'ANNUALE').sort((x, y) => y.pressione - x.pressione);
  return `${mensili.length ? `<section class="card" aria-label="Budget mensili" style="gap:4px;">
<div class="sechead"><h2 class="h2">Budget del mese</h2><a class="link" href="#" data-azione="vai" data-v="budget">Tutti</a></div>
<div>${mensili.map(r => rigaBudget(r)).join('')}</div></section>` : ''}
${annuali.length ? `<section class="card" aria-label="Budget annuali" style="gap:4px;">
<div class="sechead"><h2 class="h2">Budget annuali</h2><span class="small">da gennaio · tacca = quota a oggi</span></div>
<div>${annuali.slice(0, 3).map(r => rigaBudget(r)).join('')}</div>
${annuali.length > 3 ? `<a class="link" href="#" data-azione="vai" data-v="budget" style="padding-top:8px;">Altri ${annuali.length - 3} budget annuali</a>` : ''}</section>` : ''}`;
}
function homeProgettiHtml() {
  const p = S.avvio.progettiAttivi || [];
  if (!p.length) return '';
  return `<section class="card" aria-label="Progetti attivi">
<div class="sechead"><h2 class="h2">Progetti attivi</h2><a class="link" href="#" data-azione="vai" data-v="progetti">Tutti</a></div>
<div class="chips">${p.slice(0, 6).map(x => `<button type="button" class="chip" data-azione="prog-movimenti" data-v="${x.id}">${esc(x.nome)} · ${x.budget ? `${euroTondo(x.totale)}/${euroTondo(x.budget)}` : euroTondo(x.anno)}</button>`).join('')}</div>
</section>`;
}

// ------------------------------------------------------------------ ANALISI
function renderAnalisi() {
  if (!S.an) S.an = { anno: S.avvio.mese.anno, mese: S.avvio.mese.mese, vista: 'mese', aperte: {} };
  const a = S.an;
  $('#vista').innerHTML = `${intestazione('Analisi')}
<main class="scroll" id="anScroll">
<div class="seg two" role="group" aria-label="Periodo">
<button type="button" class="${a.vista === 'mese' ? 'on' : ''}" data-azione="an-vista" data-v="mese" aria-pressed="${a.vista === 'mese'}">Mese</button>
<button type="button" class="${a.vista === 'anno' ? 'on' : ''}" data-azione="an-vista" data-v="anno" aria-pressed="${a.vista === 'anno'}">Anno</button></div>
<div class="mesenav"><button class="iconbtn" data-azione="an-sposta" data-d="-1" aria-label="Periodo precedente">${ic('left')}</button>
<span class="strong">${a.vista === 'mese' ? `${maiusc(MESI[a.mese - 1])} ${a.anno}` : `${a.anno} fino a ${MESI[a.mese - 1]}`}</span>
<button class="iconbtn" data-azione="an-sposta" data-d="1" aria-label="Periodo successivo">${ic('right')}</button></div>
<div id="anCorpo">${memoDati(`an:${a.anno}-${a.mese}`) ? '' : caricamento()}</div>
</main>`;
  const salvati = memoDati(`an:${a.anno}-${a.mese}`);
  if (salvati) { a.dati = salvati; renderAnalisiCorpo(); }
  if (!memoFresco(`an:${a.anno}-${a.mese}`)) caricaAnalisi();
}
async function caricaAnalisi() {
  const a = S.an, chiave = `an:${a.anno}-${a.mese}`;
  a.richiesta = chiave;
  try {
    const d = await recupera(chiave, 'getAnalisi', a.anno, a.mese);
    if (a.richiesta !== chiave || S.vista !== 'analisi') return;
    a.dati = d; renderAnalisiCorpo();
  } catch (e) { errore(e); }
}
function graficoMesi(mesi, budget, corrente) {
  const w = 358, h = 196, top = 24, base = 164, asse = 30, passo = (w - asse) / 12, bw = 18;
  const max = Math.max(budget || 0, ...mesi.map(m => m.valore)) * 1.12 || 1;
  const y = v => base - (base - top) * v / max;
  const tacche = [0.25, 0.5, 0.75].map(f => Math.round(max * f / 500) * 500)
    .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i && (!budget || Math.abs(y(v) - y(budget)) > 12));
  const iMax = mesi.reduce((im, m, i) => m.valore > mesi[im].valore ? i : im, 0);
  let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Spesa mensile degli ultimi 12 mesi${budget ? ' rispetto al budget di ' + euroTondo(budget) : ''}">`;
  tacche.forEach(t => { svg += `<line x1="0" x2="${w - asse}" y1="${y(t)}" y2="${y(t)}" stroke="#EFECE5"/><text x="${w}" y="${y(t) + 4}" text-anchor="end" font-size="10" fill="#56615F">${(t / 1000).toLocaleString('it-IT')}k</text>`; });
  mesi.forEach((m, i) => {
    const x = i * passo + (passo - bw) / 2, ty = y(m.valore), ultimo = i === mesi.length - 1;
    const alt = Math.max(0, base - ty);
    const r = Math.min(4, alt);
    const colore = ultimo && corrente ? '#8FC1BC' : '#1F6F6B';
    svg += `<g data-azione="an-apri-mese" data-a="${m.anno}" data-m="${m.mese}" style="cursor:pointer;"><title>${maiusc(MESI[m.mese - 1])} ${m.anno}: ${euro(m.valore)}</title>
<rect x="${i * passo}" y="${top}" width="${passo}" height="${base - top + 20}" fill="transparent"/>
${alt > 0 ? `<path d="M${x},${base} V${ty + r} Q${x},${ty} ${x + r},${ty} H${x + bw - r} Q${x + bw},${ty} ${x + bw},${ty + r} V${base} Z" fill="${colore}"/>` : ''}
<text x="${x + bw / 2}" y="${base + 16}" text-anchor="middle" font-size="11" fill="${i === mesi.length - 1 ? '#1B2528' : '#56615F'}" font-weight="${i === mesi.length - 1 ? 600 : 400}">${MESI[m.mese - 1].charAt(0).toUpperCase()}</text></g>`;
  });
  if (budget) svg += `<line x1="0" x2="${w - asse}" y1="${y(budget)}" y2="${y(budget)}" stroke="#1B2528" stroke-width="1.5" stroke-dasharray="4 4"/><text x="${w}" y="${y(budget) + 4}" text-anchor="end" font-size="10" fill="#1B2528" font-weight="600">${(budget / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k</text>`;
  const mx = mesi[iMax];
  if (mx.valore) svg += `<text x="${Math.min(w - asse - 30, Math.max(30, iMax * passo + passo / 2))}" y="${y(mx.valore) - 6}" text-anchor="middle" font-size="11" fill="#1B2528" font-weight="600" paint-order="stroke" stroke="#FFFFFF" stroke-width="3">${euroTondo(mx.valore)}</text>`;
  svg += `<line x1="0" x2="${w - asse}" y1="${base}" y2="${base}" stroke="#C9C4B8"/></svg>`;
  return svg;
}
function categorieHtml(lista, totale, periodo) {
  const a = S.an;
  if (!lista.length) return '<p class="vuoto">Nessuna spesa nel periodo</p>';
  const scala = Math.max(1, ...lista.map(c => c.valore));
  return lista.map(c => {
    const aperta = a.aperte[c.id];
    return `<div style="border-bottom:1px solid #EFECE5;">
<button type="button" data-azione="an-apri" data-v="${c.id}" aria-expanded="${!!aperta}" style="width:100%;border:0;background:transparent;font:inherit;color:inherit;cursor:pointer;padding:0;text-align:left;">${barreHtml([c], totale, scala)}</button>
${aperta ? `<div style="background:#F5F3EE;border-radius:12px;padding:4px 12px;margin-bottom:8px;">${barreHtml(c.subs, c.valore)}
<button type="button" class="link" data-azione="an-movimenti" data-v="${c.id}" data-periodo="${periodo}" style="border:0;background:transparent;padding:0;min-height:40px;cursor:pointer;">Vedi i movimenti</button></div>` : ''}
</div>`;
  }).join('');
}
function renderAnalisiCorpo() {
  const a = S.an, d = a.dati, el = $('#anCorpo');
  if (!el) return;
  const nomeMese = `${MESI[d.mese - 1]} ${d.anno}`;
  if (a.vista === 'mese') {
    const m = d.mese_;
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px;">
<section class="card"><span class="label">${esc(maiusc(nomeMese))}${d.corrente ? ` (fino al ${d.giornoLimite})` : ''}</span>
<span class="hero num">${euroTondo(m.totale)}</span>
${confrontoHtml(m.totale, m.totalePrec, `${MESI[d.mese - 1]} ${d.anno - 1}${d.corrente ? ', stessi giorni' : ''}`)}
${m.budget ? `<span class="small">Budget del mese ${euroTondo(m.budget)} · ${Math.round(m.totale / m.budget * 100)}% usato</span>` : ''}</section>
<section class="card"><h2 class="h2">Ultimi 12 mesi</h2>${graficoMesi(d.mesi12, m.budget, d.corrente)}
<span class="small">Tratteggio = budget mensile${m.budget ? ` (${euroTondo(m.budget)})` : ''} · media ${euroTondo(d.mesi12.reduce((s, x) => s + x.valore, 0) / 12)} al mese · tocca una barra per aprire quel mese</span></section>
<section class="card" style="gap:4px;"><div class="sechead"><h2 class="h2">Dove vanno i soldi</h2><span class="small">tocca per il dettaglio</span></div>
${categorieHtml(m.perMacro, m.totale, 'mese')}</section>
${m.perProgetto.length ? `<section class="card" style="gap:4px;"><h2 class="h2">Progetti nel mese</h2>${barreHtml(m.perProgetto)}</section>` : ''}
</div>`;
  } else {
    const y = d.anno_;
    const stato = y.quotaBudget ? (y.totale > y.quotaBudget
      ? `<span class="status ko">${ic('alert', 14, 2)} ${Math.round((y.totale / y.quotaBudget - 1) * 100)}% sopra la quota del budget (${euroTondo(y.quotaBudget)} a oggi)</span>`
      : `<span class="status ok">${ic('check', 14, 2.4)} Sotto la quota del budget (${euroTondo(y.quotaBudget)} a oggi)</span>`) : '';
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px;">
<section class="card"><span class="label">${d.anno} da gennaio${d.corrente ? ' a oggi' : ` a fine ${MESI[d.mese - 1]}`}</span>
<span class="hero num">${euroTondo(y.totale)}</span>${stato}
<div class="divider"></div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
<div><span class="label" style="display:block;">Media mensile</span><span class="h2 num">${euroTondo(y.mediaMensile)}</span></div>
<div><span class="label" style="display:block;">Stesso periodo ${d.anno - 1}</span><span class="h2 num">${euroTondo(y.totalePrec)}</span></div></div>
${confrontoHtml(y.totale, y.totalePrec, `${d.anno - 1}`)}</section>
<section class="card" style="gap:4px;"><div class="sechead"><h2 class="h2">Dove vanno i soldi</h2><span class="small">${d.anno}</span></div>
${categorieHtml(y.perMacro, y.totale, 'anno')}</section>
${y.perProgetto.length ? `<section class="card" style="gap:4px;"><h2 class="h2">Progetti nell'anno</h2>${barreHtml(y.perProgetto.slice(0, 10))}</section>` : ''}
</div>`;
  }
}

// ------------------------------------------------------------------ BUDGET
function renderBudget() {
  if (!S.bud) S.bud = { aperto: '' };
  const b = S.avvio.budget, bud = S.bud;
  const mensili = b.righe.filter(r => r.periodicita === 'MENSILE');
  const annuali = b.righe.filter(r => r.periodicita === 'ANNUALE');
  const riga = r => rigaBudget(r, true) + (bud.aperto === r.id ? editorBudget(r.id, r.periodicita, r.importo) : '');
  $('#vista').innerHTML = `${intestazione(`Budget ${b.anno}`, 'altro')}
<main class="scroll">
<section class="card"><span class="label">Budget totale</span>
<div style="display:flex;align-items:baseline;gap:8px;"><span class="hero num">${euroTondo(b.totale)}</span><span class="label">al mese</span></div>
<span class="small">Somma dei budget per categoria: ${euroTondo(b.somma)} · ${b.margine >= 0 ? `margine libero ${euroTondo(b.margine)}` : `<span class="ko strong">le categorie superano il totale di ${euroTondo(-b.margine)}</span>`}</span>
<button type="button" class="link" data-azione="bud-modifica" data-v="*" style="border:0;background:transparent;padding:0;min-height:36px;cursor:pointer;text-align:left;">Modifica il budget totale</button>
${bud.aperto === '*' ? editorBudget('*', b.totalePeriodicita, b.totaleImporto) : ''}</section>
${mensili.length ? `<section class="card" style="gap:0;"><div class="sechead" style="padding-bottom:4px;"><h2 class="h2">Mensili</h2><span class="small">${esc(MESI[b.mese - 1])}</span></div>${mensili.map(riga).join('')}</section>` : ''}
${annuali.length ? `<section class="card" style="gap:0;"><div class="sechead" style="padding-bottom:4px;"><h2 class="h2">Annuali</h2><span class="small">da gennaio · tacca = quota a oggi</span></div>${annuali.map(riga).join('')}</section>` : ''}
${b.senza.length ? `<section class="card" style="gap:0;"><h2 class="h2" style="padding-bottom:4px;">Senza budget</h2>
${b.senza.map(c => `<div class="row"><span class="badge" style="width:32px;height:32px;border-radius:9px;">${ic(ICONA_MACRO[c.id] || 'tag', 18)}</span>
<span class="grow"><span style="display:block;font-weight:500;">${esc(c.nome)}</span><span class="small">${euroTondo(c.speso)} nel mese · ${euroTondo(c.spesoAnno)} da gennaio</span></span>
<button type="button" class="link" data-azione="bud-modifica" data-v="${c.id}" style="border:0;background:transparent;cursor:pointer;min-height:40px;">Imposta</button></div>
${bud.aperto === c.id ? editorBudget(c.id, 'MENSILE', 0) : ''}`).join('')}</section>` : ''}
</main>`;
}
function editorBudget(id, periodicita, importo) {
  const b = S.avvio.budget, bud = S.bud;
  if (bud.editPer === undefined || bud.editId !== id) { bud.editId = id; bud.editPer = periodicita || 'MENSILE'; }
  const questo = `${b.anno}-${String(b.mese).padStart(2, '0')}`;
  const pross = new Date(b.anno, b.mese, 1);
  const prossimo = `${pross.getFullYear()}-${String(pross.getMonth() + 1).padStart(2, '0')}`;
  return `<div style="background:#F5F3EE;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;margin:8px 0;">
<div class="field"><label class="label" for="budImporto">Importo${bud.editPer === 'ANNUALE' ? ' annuo' : ' mensile'}</label>
<input id="budImporto" class="input num" inputmode="decimal" value="${esc(importo ? String(importo).replace('.', ',') : '')}" placeholder="0 = nessun budget"></div>
<div class="seg two" role="group" aria-label="Periodicità">
<button type="button" class="${bud.editPer === 'MENSILE' ? 'on' : ''}" data-azione="bud-per" data-v="MENSILE">Mensile</button>
<button type="button" class="${bud.editPer === 'ANNUALE' ? 'on' : ''}" data-azione="bud-per" data-v="ANNUALE">Annuale</button></div>
<div class="field"><label class="label" for="budDal">Valido dal</label>
<select id="budDal" class="input"><option value="${questo}">${maiusc(MESI[b.mese - 1])} ${b.anno} (questo mese)</option>
<option value="${prossimo}">${maiusc(MESI[pross.getMonth()])} ${pross.getFullYear()} (dal prossimo mese)</option></select></div>
<span class="small">I mesi precedenti restano confrontati con il budget di allora.</span>
<div style="display:flex;gap:8px;"><button type="button" class="btn sec" style="min-height:44px;" data-azione="bud-chiudi">Annulla</button>
<button type="button" class="btn" style="min-height:44px;" data-azione="bud-salva" data-v="${id}">Salva</button></div></div>`;
}
function salvaBudgetUI(id) { return unaVolta(() => salvaBudgetUI_(id)); }
async function salvaBudgetUI_(id) {
  const importo = leggiImporto($('#budImporto').value || '0');
  if (!(importo >= 0)) { toast('Importo non valido', null, true); return; }
  try {
    const b = await chiama('salvaBudget', { categoria_id: id, periodicita: S.bud.editPer, importo, valido_dal: $('#budDal').value });
    datiModificati(); S.avvio.budget = b; S.bud.aperto = ''; renderBudget();
    toast('Budget salvato');
    chiama('getAvvio').then(a => { S.avvio = a; indicizza(); }).catch(() => { });
  } catch (e) { errore(e); }
}

// ------------------------------------------------------------------ PROGETTI
const TIPI_PROG = [['VIAGGIO', 'Viaggio'], ['VEICOLO', 'Veicolo'], ['LUOGO', 'Luogo'], ['PERCORSO', 'Percorso'], ['ATTIVITA', 'Attività'], ['PROGETTO', 'Progetto']];
const nomeTipoProg = t => (TIPI_PROG.find(x => x[0] === t) || [t, t])[1];
function periodoProg(p) {
  const f = s => { const d = daIso(s); return `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
  if (p.data_inizio && p.data_fine) return `${f(p.data_inizio)} – ${f(p.data_fine)}`;
  if (p.data_inizio) return `dal ${f(p.data_inizio)}`;
  return '';
}
const PROG_DESTRA = () => `<button type="button" class="chip" data-azione="prog-nuovo">${ic('plus', 16, 2.2)} Nuovo</button>`;
function renderProgetti() {
  if (!S.prog) S.prog = { tab: 'attivi', form: null, lista: null };
  const pr = S.prog;
  if (memoDati('progetti')) pr.lista = memoDati('progetti');
  if (!memoFresco('progetti')) {
    recupera('progetti', 'getProgetti').then(l => {
      pr.lista = l;
      if (S.vista === 'progetti' && !pr.form) disegnaProgetti();   // con il modulo aperto non si ridisegna
    }).catch(errore);
  }
  if (!pr.lista) { $('#vista').innerHTML = `${intestazione('Progetti', 'altro', PROG_DESTRA())}${caricamento()}`; return; }
  disegnaProgetti();
}
function disegnaProgetti() {
  const pr = S.prog, destra = PROG_DESTRA();
  const attivi = pr.lista.filter(p => p.stato === 'ATTIVO'), chiusi = pr.lista.filter(p => p.stato !== 'ATTIVO');
  const mostrati = pr.tab === 'attivi' ? attivi : chiusi;
  $('#vista').innerHTML = `${intestazione('Progetti', 'altro', destra)}
<main class="scroll">
${pr.form ? formProgetto() : ''}
<div class="seg two" role="group" aria-label="Stato progetti">
<button type="button" class="${pr.tab === 'attivi' ? 'on' : ''}" data-azione="prog-tab" data-v="attivi">Attivi · ${attivi.length}</button>
<button type="button" class="${pr.tab === 'chiusi' ? 'on' : ''}" data-azione="prog-tab" data-v="chiusi">Chiusi · ${chiusi.length}</button></div>
${mostrati.length ? mostrati.map(cardProgetto).join('') : '<p class="vuoto">Nessun progetto</p>'}
</main>`;
}
function cardProgetto(p) {
  const anno = daIso(S.avvio.oggi).getFullYear();
  const meter = p.budget_totale ? `${meterHtml(Math.round(p.totale / p.budget_totale * 100), p.totale > p.budget_totale, null, `${p.nome}: speso ${Math.round(p.totale / p.budget_totale * 100)}% del budget`)}
<span class="small num">${euro(p.totale)} di ${euro(p.budget_totale)} · ${p.totale > p.budget_totale ? `<span class="ko strong">${euro(p.totale - p.budget_totale)} oltre</span>` : `restano ${euro(p.budget_totale - p.totale)}`}</span>` : '';
  return `<section class="card">
<div style="display:flex;align-items:center;gap:12px;"><span class="badge">${ic({ VIAGGIO: 'plane', VEICOLO: 'moto', LUOGO: 'house', PERCORSO: 'tool', ATTIVITA: 'brief' }[p.tipo] || 'folder', 20)}</span>
<span class="grow"><span class="strong" style="display:block;font-size:16px;">${esc(p.nome)}</span><span class="small">${nomeTipoProg(p.tipo)}${periodoProg(p) ? ' · ' + periodoProg(p) : ''}${p.stato === 'ARCHIVIATO' ? ' · archiviato' : ''}</span></span>
<span class="num strong" style="font-size:16px;">${euroTondo(p.stato === 'ATTIVO' && !p.budget_totale ? p.totaleAnno : p.totale)}</span></div>
${p.stato === 'ATTIVO' && !p.budget_totale ? `<span class="small">nel ${anno} · ${euro(p.totale)} dall'inizio · ${p.conteggio} movimenti</span>` : `<span class="small">${p.conteggio} movimenti${p.escludi_da_totali ? ' · escluso dai totali personali' : ''}</span>`}
${meter}
<div style="display:flex;gap:16px;"><button type="button" class="link" data-azione="prog-movimenti" data-v="${p.id}" style="border:0;background:transparent;padding:0;min-height:40px;cursor:pointer;">Movimenti</button>
<button type="button" class="link" data-azione="prog-modifica" data-v="${p.id}" style="border:0;background:transparent;padding:0;min-height:40px;cursor:pointer;">Modifica</button></div>
</section>`;
}
function formProgetto() {
  const f = S.prog.form;
  return `<section class="card"><h2 class="h2">${f.id ? 'Modifica progetto' : 'Nuovo progetto'}</h2>
<div class="field"><label class="label" for="pNome">Nome</label><input id="pNome" class="input" maxlength="80" value="${esc(f.nome)}" placeholder="Es. Libreria soggiorno"></div>
<div class="field"><span class="label">Tipo</span><div class="chips">${TIPI_PROG.map(([id, t]) => `<button type="button" class="chip${f.tipo === id ? ' on' : ''}" data-azione="prog-tipo" data-v="${id}">${t}</button>`).join('')}</div></div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
<div class="field"><label class="label" for="pInizio">Inizio</label><input id="pInizio" class="input" type="date" value="${esc(f.data_inizio)}"></div>
<div class="field"><label class="label" for="pFine">Fine (facoltativa)</label><input id="pFine" class="input" type="date" value="${esc(f.data_fine)}"></div></div>
<div class="field"><label class="label" for="pBudget">Budget complessivo (facoltativo)</label><input id="pBudget" class="input" inputmode="decimal" value="${esc(f.budget_totale === '' ? '' : String(f.budget_totale).replace('.', ','))}" placeholder="Es. 800"></div>
${f.id ? `<div class="field"><label class="label" for="pStato">Stato</label><select id="pStato" class="input">${[['ATTIVO', 'Attivo'], ['CHIUSO', 'Chiuso'], ['ARCHIVIATO', 'Archiviato']].map(([v, t]) => `<option value="${v}"${f.stato === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>` : ''}
<div style="display:flex;align-items:center;gap:12px;"><span class="grow"><span style="display:block;font-weight:500;">Escludi dai totali personali</span><span class="small">Spese tracciate nel progetto ma fuori da budget e report</span></span>
<button type="button" class="switch${f.escludi_da_totali ? ' on' : ''}" role="switch" aria-checked="${f.escludi_da_totali}" aria-label="Escludi dai totali personali" data-azione="prog-escludi"><span></span></button></div>
<div class="field"><label class="label" for="pNote">Note</label><input id="pNote" class="input" maxlength="300" value="${esc(f.note)}"></div>
<div style="display:flex;gap:8px;"><button type="button" class="btn sec" data-azione="prog-annulla">Annulla</button><button type="button" class="btn" data-azione="prog-salva">Salva</button></div>
${f.id && !f.conteggio ? `<button type="button" class="link" data-azione="prog-elimina" style="border:0;background:transparent;cursor:pointer;min-height:44px;color:#B3261E;">Elimina progetto (nessun movimento collegato)</button>` : ''}
</section>`;
}
function leggiFormProgetto() {
  const f = S.prog.form, v = id => $(id) ? $(id).value : undefined;
  if (v('#pNome') !== undefined) f.nome = v('#pNome');
  if (v('#pInizio') !== undefined) f.data_inizio = v('#pInizio');
  if (v('#pFine') !== undefined) f.data_fine = v('#pFine');
  if (v('#pBudget') !== undefined) f.budget_totale = v('#pBudget');
  if (v('#pStato') !== undefined) f.stato = v('#pStato');
  if (v('#pNote') !== undefined) f.note = v('#pNote');
}
function salvaProgettoUI() { return unaVolta(salvaProgettoUI_); }
async function eliminaProgettoUI() {
  const f = S.prog.form;
  if (!confirm(`Eliminare il progetto “${f.nome}”?`)) return;
  return unaVolta(async () => {
    try {
      const r = await chiama('eliminaProgetto', f.id);
      datiModificati(); memoSalva('progetti', r.progetti); S.prog.lista = r.progetti; S.prog.form = null;
      const a = await chiama('getAvvio'); S.avvio = a; indicizza();
      renderProgetti(); toast('Progetto eliminato');
    } catch (e) { errore(e); }
  });
}
async function salvaProgettoUI_() {
  leggiFormProgetto();
  const f = S.prog.form;
  const budget = String(f.budget_totale).trim() === '' ? '' : leggiImporto(f.budget_totale);
  if (budget !== '' && !(budget >= 0)) { toast('Budget non valido', null, true); return; }
  try {
    const r = await chiama('salvaProgetto', Object.assign({}, f, { budget_totale: budget }));
    datiModificati(); memoSalva('progetti', r.progetti); S.prog.lista = r.progetti; S.prog.form = null;
    const a = await chiama('getAvvio'); S.avvio = a; indicizza();
    renderProgetti(); toast('Progetto salvato');
  } catch (e) { errore(e); }
}

// ------------------------------------------------------------------ ALTRO (gestione)
function renderAltro() {
  if (!S.alt) S.alt = { dati: null, aperta: '', ric: null };
  const al = S.alt;
  if (memoDati('gestione')) al.dati = memoDati('gestione');
  if (!memoFresco('gestione')) {
    recupera('gestione', 'getGestione').then(d => {
      al.dati = d;
      const scrive = al.ric || (document.activeElement && document.activeElement.id === 'repEmail');
      if (S.vista === 'altro' && !scrive) disegnaAltro();
    }).catch(errore);
  }
  if (!al.dati) { $('#vista').innerHTML = `${intestazione('Altro')}${caricamento()}`; return; }
  disegnaAltro();
}
function disegnaAltro() {
  const al = S.alt;
  const d = al.dati, b = S.avvio.budget;
  const macro = S.avvio.categorie.filter(c => !c.parent_id).sort((x, y) => x.ordine - y.ordine);
  const scroll = $('#altScroll') ? $('#altScroll').scrollTop : 0;
  $('#vista').innerHTML = `${intestazione('Altro')}
<main class="scroll" id="altScroll">
<section class="card" style="padding:4px 16px;gap:0;">
${voceAltro('budget', 'chart', 'Budget', `${euroTondo(b.totale)}/mese · ${b.righe.length} categorie con budget`)}
${voceAltro('progetti', 'folder', 'Progetti', `${(S.avvio.progettiAttivi || []).length} attivi`)}
<a class="row" href="${esc(S.avvio.dbUrl)}" target="_blank" rel="noopener"><span class="badge">${ic('sheet', 20)}</span>
<span class="grow"><span style="display:block;font-size:15px;font-weight:500;">Database</span><span class="small">Il foglio Google con tutti i dati</span></span>${ic('right', 18)}</a>
<button type="button" class="row" data-azione="alt-scollega" style="width:100%;border:0;background:transparent;font:inherit;color:inherit;cursor:pointer;text-align:left;"><span class="badge">${ic('x', 20)}</span>
<span class="grow"><span style="display:block;font-size:15px;font-weight:500;">Scollega questo dispositivo</span><span class="small">Cancella chiave e dati salvati su questo dispositivo</span></span></button>
</section>

<section class="card" style="gap:0;"><div class="sechead" style="padding-bottom:6px;"><h2 class="h2">Rimborsi attesi</h2><span class="strong num">${euro(d.totaleRimborsi)}</span></div>
${d.rimborsi.length ? d.rimborsi.map(m => `<div class="row"><span class="badge">${ic('brief', 20)}</span>
<span class="grow"><span style="display:block;font-weight:500;">${esc(m.descrizione)}</span><span class="small">${esc(breveGiorno(m.data))} · ${euro(m.importo)}</span></span>
<button type="button" class="chip" style="min-height:36px;" data-azione="alt-rimborsato" data-v="${m.id}">Rimborsato</button></div>`).join('')
    : '<p class="small" style="margin:4px 0 8px;">Nessuna spesa in attesa di rimborso. Le segni con "Da rimborsare" quando le inserisci.</p>'}
</section>

<section class="card" style="gap:6px;"><div class="sechead"><h2 class="h2">Categorie</h2>
<button type="button" class="chip" style="min-height:36px;" data-azione="alt-cat-nuova" data-v="">${ic('plus', 14, 2.2)} Macro</button></div>
<span class="small">Rinominare o archiviare non modifica lo storico: le spese restano collegate.</span>
${macro.map(m => {
    const subs = S.avvio.categorie.filter(c => c.parent_id === m.id).sort((x, y) => x.ordine - y.ordine);
    const aperta = al.aperta === m.id;
    return `<div style="border-bottom:1px solid #EFECE5;">
<button type="button" data-azione="alt-cat-apri" data-v="${m.id}" aria-expanded="${aperta}" style="width:100%;display:flex;align-items:center;gap:10px;min-height:48px;border:0;background:transparent;font:inherit;color:inherit;cursor:pointer;padding:0;text-align:left;${m.attiva ? '' : 'opacity:.55;'}">
<span class="grow" style="font-size:15px;font-weight:500;">${esc(m.nome)}${m.attiva ? '' : ' (archiviata)'}</span><span class="small">${subs.filter(s => s.attiva).length} sottocategorie</span>${ic('down', 16, 2)}</button>
${aperta ? `<div style="display:flex;flex-direction:column;padding:0 0 10px 12px;">
${subs.map(s => `<div style="display:flex;align-items:center;gap:8px;min-height:40px;${s.attiva ? '' : 'opacity:.55;'}"><span class="grow" style="font-size:14px;">${esc(s.nome)}${s.attiva ? '' : ' (archiviata)'}</span>
<button type="button" class="link" data-azione="alt-cat-rinomina" data-v="${s.id}" style="border:0;background:transparent;cursor:pointer;font-size:13px;min-height:36px;">Rinomina</button>
<button type="button" class="link" data-azione="alt-cat-attiva" data-v="${s.id}" data-attiva="${!s.attiva}" style="border:0;background:transparent;cursor:pointer;font-size:13px;min-height:36px;color:#56615F;">${s.attiva ? 'Archivia' : 'Ripristina'}</button></div>`).join('')}
<div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:4px;">
<button type="button" class="chip ghost" style="min-height:36px;" data-azione="alt-cat-nuova" data-v="${m.id}">${ic('plus', 14, 2.2)} Sottocategoria</button>
<button type="button" class="chip" style="min-height:36px;" data-azione="alt-cat-rinomina" data-v="${m.id}">Rinomina macro</button>
<button type="button" class="chip" style="min-height:36px;" data-azione="alt-cat-attiva" data-v="${m.id}" data-attiva="${!m.attiva}">${m.attiva ? 'Archivia macro' : 'Ripristina macro'}</button></div>
</div>` : ''}</div>`;
  }).join('')}
</section>

<section class="card" style="gap:0;"><div class="sechead" style="padding-bottom:6px;"><h2 class="h2">Spese ricorrenti</h2>
<button type="button" class="chip" style="min-height:36px;" data-azione="alt-ric-nuova">${ic('plus', 14, 2.2)} Nuova</button></div>
${al.ric && !al.ric.id ? formRicorrente() : ''}
${d.ricorrenti.map(r => `<div class="row" style="${r.attiva ? '' : 'opacity:.55;'}"><span class="badge">${ic('list', 20)}</span>
<span class="grow"><span style="display:block;font-weight:500;">${esc(r.descrizione)}</span><span class="small">${euro(r.importo)} · ${testoFrequenza(r)}${r.attiva ? (r.prossima ? ` · prossima ${esc(breveGiorno(r.prossima))}` : '') : ' · in pausa'}</span></span>
<button type="button" class="link" data-azione="alt-ric-modifica" data-v="${r.id}" style="border:0;background:transparent;cursor:pointer;min-height:40px;">Modifica</button></div>
${al.ric && al.ric.id === r.id ? formRicorrente() : ''}`).join('')}
<p class="small" style="margin:8px 0 4px;">Le spese vengono create in automatico il giorno dovuto (serve aver attivato gli automatismi).</p>
</section>

<section class="card"><h2 class="h2">Report via email</h2>
<div class="field"><label class="label" for="repEmail">Indirizzo</label><input id="repEmail" class="input" type="email" value="${esc(d.report.email)}"></div>
${[['settimanale', 'Settimanale', 'venerdì 19:30 · da sabato a venerdì'], ['mensile', 'Mensile', 'giorno 1 alle 08:00 · mese precedente'], ['annuale', 'Annuale', 'primo lunedì di gennaio alle 08:00']].map(([k, t, s]) =>
    `<div style="display:flex;align-items:center;gap:12px;"><span class="grow"><span style="display:block;font-weight:500;">${t}</span><span class="small">${s}</span></span>
<button type="button" class="switch${d.report[k] ? ' on' : ''}" role="switch" aria-checked="${d.report[k]}" aria-label="Report ${t.toLowerCase()}" data-azione="alt-rep" data-v="${k}"><span></span></button></div>`).join('')}
<div style="display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="btn" style="min-height:44px;" data-azione="alt-rep-salva">Salva</button>
<button type="button" class="btn sec" style="min-height:44px;" data-azione="alt-rep-prova" data-v="settimanale">Prova settimanale</button>
<button type="button" class="btn sec" style="min-height:44px;" data-azione="alt-rep-prova" data-v="mensile">Prova mensile</button></div>
</section>

<section class="card"><h2 class="h2">Automatismi</h2>
${d.automatismi ? `<span class="status ok">${ic('check', 14, 2.4)} Attivi: report, spese ricorrenti, backup domenicale</span>`
    : `<span class="status ko">${ic('alert', 14, 2)} Non attivi</span><span class="small">Nell’editor Apps Script esegui una volta <b>installaAutomatismi</b> (file Automatismi.gs).</span>`}
<span class="small">Ultimo backup: ${d.ultimoBackup ? esc(d.ultimoBackup.quando) : 'nessuno'}</span>
</section>
</main>`;
  if ($('#altScroll')) $('#altScroll').scrollTop = scroll;
}
function voceAltro(v, icona, titolo, sotto) {
  return `<a class="row" href="#" data-azione="vai" data-v="${v}"><span class="badge">${ic(icona, 20)}</span>
<span class="grow"><span style="display:block;font-size:15px;font-weight:500;">${titolo}</span><span class="small">${esc(sotto)}</span></span>${ic('right', 18)}</a>`;
}
function testoFrequenza(r) {
  if (r.frequenza === 'SETTIMANALE') return `ogni ${GIORNI[r.giorno % 7]}`;
  if (r.frequenza === 'ANNUALE') { const d = r.data_inizio ? daIso(r.data_inizio) : null; return `ogni anno il ${r.giorno}${d ? ' ' + MESI[d.getMonth()] : ''}`; }
  return `ogni mese il giorno ${r.giorno}`;
}
function formRicorrente() {
  const f = S.alt.ric;
  const subs = S.avvio.categorie.filter(c => c.parent_id && c.attiva);
  const macro = S.avvio.categorie.filter(c => !c.parent_id && c.attiva).sort((x, y) => x.ordine - y.ordine);
  return `<div style="background:#F5F3EE;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;margin:8px 0;">
<div class="field"><label class="label" for="rDescr">Descrizione</label><input id="rDescr" class="input" maxlength="120" value="${esc(f.descrizione)}"></div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
<div class="field"><label class="label" for="rImporto">Importo</label><input id="rImporto" class="input num" inputmode="decimal" value="${esc(f.importo === '' ? '' : String(f.importo).replace('.', ','))}"></div>
<div class="field"><label class="label" for="rGiorno">${f.frequenza === 'SETTIMANALE' ? 'Giorno (1 = lun)' : 'Giorno del mese'}</label><input id="rGiorno" class="input num" inputmode="numeric" value="${esc(f.giorno)}"></div></div>
<div class="seg" role="group" aria-label="Frequenza">${[['MENSILE', 'Mensile'], ['ANNUALE', 'Annuale'], ['SETTIMANALE', 'Settimanale']].map(([v, t]) =>
    `<button type="button" class="${f.frequenza === v ? 'on' : ''}" data-azione="ric-freq" data-v="${v}">${t}</button>`).join('')}</div>
<div class="field"><label class="label" for="rCat">Categoria</label><select id="rCat" class="input">${macro.map(m => `<optgroup label="${esc(m.nome)}">${subs.filter(s => s.parent_id === m.id).map(s =>
    `<option value="${s.id}"${f.categoria_id === s.id ? ' selected' : ''}>${esc(s.nome)}</option>`).join('')}</optgroup>`).join('')}</select></div>
<div class="field"><label class="label" for="rProg">Progetto</label><select id="rProg" class="input"><option value="">Nessuno</option>${S.avvio.progetti.filter(p => p.stato === 'ATTIVO' || p.id === f.progetto_id).map(p =>
    `<option value="${p.id}"${f.progetto_id === p.id ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
<div class="field"><label class="label" for="rInizio">Dal</label><input id="rInizio" class="input" type="date" value="${esc(f.data_inizio)}"></div>
<div class="field"><label class="label" for="rFine">Al (facoltativo)</label><input id="rFine" class="input" type="date" value="${esc(f.data_fine)}"></div></div>
${f.id ? `<div style="display:flex;align-items:center;gap:12px;"><span class="grow" style="font-weight:500;">Attiva</span>
<button type="button" class="switch${f.attiva ? ' on' : ''}" role="switch" aria-checked="${f.attiva}" aria-label="Ricorrenza attiva" data-azione="ric-attiva"><span></span></button></div>` : ''}
<div style="display:flex;gap:8px;"><button type="button" class="btn sec" style="min-height:44px;" data-azione="ric-annulla">Annulla</button>
<button type="button" class="btn" style="min-height:44px;" data-azione="ric-salva">Salva</button></div></div>`;
}
function leggiFormRicorrente() {
  const f = S.alt.ric, v = id => $(id) ? $(id).value : undefined;
  if (v('#rDescr') !== undefined) f.descrizione = v('#rDescr');
  if (v('#rImporto') !== undefined) f.importo = v('#rImporto');
  if (v('#rGiorno') !== undefined) f.giorno = v('#rGiorno');
  if (v('#rCat') !== undefined) f.categoria_id = v('#rCat');
  if (v('#rProg') !== undefined) f.progetto_id = v('#rProg');
  if (v('#rInizio') !== undefined) f.data_inizio = v('#rInizio');
  if (v('#rFine') !== undefined) f.data_fine = v('#rFine');
}
function eseguiGestione(fn, args, messaggio) { return unaVolta(() => eseguiGestione_(fn, args, messaggio)); }
async function eseguiGestione_(fn, args, messaggio) {
  try {
    const r = await chiama(fn, ...args);
    datiModificati();
    if (r && r.categorie) { S.avvio = r; indicizza(); }
    else if (r && r.ricorrenti) { S.alt.dati = r; memoSalva('gestione', r); }
    renderAltro();
    if (messaggio) toast(messaggio);
    if (!(r && r.categorie)) chiama('getAvvio').then(a => { S.avvio = a; indicizza(); }).catch(() => { });
    return r;
  } catch (e) { errore(e); }
}

// ------------------------------------------------------------------ azioni delle viste (chiamato dal gestore click di App)
function azioneViste(a, el) {
  const v = el.dataset.v;
  // Analisi
  if (a === 'an-vista') { S.an.vista = v; renderAnalisi(); return true; }
  if (a === 'an-sposta') {
    const passo = Number(el.dataset.d) * (S.an.vista === 'anno' ? 12 : 1);
    const d = new Date(S.an.anno, S.an.mese - 1 + passo, 1);
    const oggi = daIso(S.avvio.oggi);
    if (d > new Date(oggi.getFullYear(), oggi.getMonth(), 1)) { d.setFullYear(oggi.getFullYear()); d.setMonth(oggi.getMonth()); }
    S.an.anno = d.getFullYear(); S.an.mese = d.getMonth() + 1; renderAnalisi(); return true;
  }
  if (a === 'an-apri-mese') { S.an.anno = Number(el.dataset.a); S.an.mese = Number(el.dataset.m); S.an.vista = 'mese'; renderAnalisi(); return true; }
  if (a === 'an-apri') { S.an.aperte[v] = !S.an.aperte[v]; renderAnalisiCorpo(); return true; }
  if (a === 'an-movimenti') {
    S.mov = { anno: S.an.anno, mese: S.an.mese, testo: '', dati: null, filtri: { categoria: v, tutto: false } };
    if (el.dataset.periodo === 'anno') S.mov.filtri.anno = S.an.anno;
    S.tornaA = 'analisi'; vai('movimenti'); return true;
  }
  // Budget
  if (a === 'bud-modifica') { S.bud.aperto = S.bud.aperto === v ? '' : v; S.bud.editId = undefined; S.bud.editPer = undefined; renderBudget(); return true; }
  if (a === 'bud-per') { const imp = $('#budImporto').value; S.bud.editPer = v; renderBudget(); $('#budImporto').value = imp; return true; }
  if (a === 'bud-chiudi') { S.bud.aperto = ''; renderBudget(); return true; }
  if (a === 'bud-salva') { salvaBudgetUI(v); return true; }
  // Progetti
  if (a === 'prog-tab') { S.prog.tab = v; renderProgetti(); return true; }
  if (a === 'prog-nuovo') {
    S.prog.form = { id: '', nome: '', tipo: 'PROGETTO', data_inizio: S.avvio.oggi, data_fine: '', budget_totale: '', stato: 'ATTIVO', escludi_da_totali: false, note: '' };
    renderProgetti(); return true;
  }
  if (a === 'prog-modifica') {
    const p = S.prog.lista.find(x => x.id === v);
    S.prog.form = Object.assign({}, p); renderProgetti(); if ($('.scroll')) $('.scroll').scrollTop = 0; return true;
  }
  if (a === 'prog-tipo') { leggiFormProgetto(); S.prog.form.tipo = v; renderProgetti(); return true; }
  if (a === 'prog-escludi') { leggiFormProgetto(); S.prog.form.escludi_da_totali = !S.prog.form.escludi_da_totali; renderProgetti(); return true; }
  if (a === 'prog-annulla') { S.prog.form = null; renderProgetti(); return true; }
  if (a === 'prog-salva') { salvaProgettoUI(); return true; }
  if (a === 'prog-elimina') { eliminaProgettoUI(); return true; }
  if (a === 'prog-movimenti') {
    S.mov = { anno: S.avvio.mese.anno, mese: S.avvio.mese.mese, testo: '', dati: null, filtri: { progetto: v, tutto: true } };
    S.tornaA = S.vista; vai('movimenti'); return true;
  }
  // Altro
  if (a === 'alt-scollega') {
    if (confirm('Scollegare questo dispositivo? Per usarlo di nuovo servirà il link di collegamento.')) {
      try { localStorage.clear(); } catch (e) { /* niente */ }
      location.reload();
    }
    return true;
  }
  if (a === 'alt-rimborsato') { eseguiGestione('segnaRimborsato', [v], 'Segnato come rimborsato: esce dai totali'); return true; }
  if (a === 'alt-cat-apri') { S.alt.aperta = S.alt.aperta === v ? '' : v; renderAltro(); return true; }
  if (a === 'alt-cat-nuova') {
    const nome = prompt(v ? `Nuova sottocategoria di “${nomeCat(v)}”` : 'Nome della nuova macro-categoria');
    if (nome && nome.trim()) { if (!v) S.alt.aperta = ''; eseguiGestione('salvaCategoria', [{ parent_id: v, nome: nome.trim() }], 'Categoria creata'); }
    return true;
  }
  if (a === 'alt-cat-rinomina') {
    const nome = prompt('Nuovo nome', CAT[v] ? CAT[v].nome : '');
    if (nome && nome.trim()) eseguiGestione('salvaCategoria', [{ id: v, nome: nome.trim() }], 'Categoria rinominata');
    return true;
  }
  if (a === 'alt-cat-attiva') {
    const attiva = el.dataset.attiva === 'true';
    eseguiGestione('impostaCategoriaAttiva', [v, attiva], attiva ? 'Categoria ripristinata' : 'Categoria archiviata');
    return true;
  }
  if (a === 'alt-ric-nuova') {
    S.alt.ric = { id: '', descrizione: '', importo: '', categoria_id: 'bollette.digitali', progetto_id: '', frequenza: 'MENSILE', giorno: '1', data_inizio: S.avvio.oggi, data_fine: '', attiva: true };
    renderAltro(); return true;
  }
  if (a === 'alt-ric-modifica') {
    const r = S.alt.dati.ricorrenti.find(x => x.id === v);
    S.alt.ric = S.alt.ric && S.alt.ric.id === v ? null : Object.assign({}, r, { giorno: String(r.giorno) });
    renderAltro(); return true;
  }
  if (a === 'ric-freq') { leggiFormRicorrente(); S.alt.ric.frequenza = v; renderAltro(); return true; }
  if (a === 'ric-attiva') { leggiFormRicorrente(); S.alt.ric.attiva = !S.alt.ric.attiva; renderAltro(); return true; }
  if (a === 'ric-annulla') { S.alt.ric = null; renderAltro(); return true; }
  if (a === 'ric-salva') {
    leggiFormRicorrente();
    const f = S.alt.ric;
    const importo = leggiImporto(f.importo);
    if (!(importo > 0)) { toast('Importo non valido', null, true); return true; }
    eseguiGestione('salvaRicorrente', [Object.assign({}, f, { importo, giorno: Number(f.giorno) })], 'Spesa ricorrente salvata')
      .then(r => { if (r) { S.alt.ric = null; renderAltro(); } });
    return true;
  }
  if (a === 'alt-rep') { S.alt.dati.report[v] = !S.alt.dati.report[v]; const email = $('#repEmail').value; renderAltro(); $('#repEmail').value = email; return true; }
  if (a === 'alt-rep-salva') {
    const r = S.alt.dati.report;
    eseguiGestione('salvaImpostazioniReport', [{ email: $('#repEmail').value, settimanale: r.settimanale, mensile: r.mensile, annuale: r.annuale }], 'Impostazioni report salvate');
    return true;
  }
  if (a === 'alt-rep-prova') {
    toast('Invio in corso…');
    unaVolta(() => chiama('inviaReportProva', v).then(msg => toast(msg)).catch(errore));
    return true;
  }
  return false;
}
