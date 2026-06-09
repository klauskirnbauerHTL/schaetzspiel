const STORAGE_DEFAULT = 'schaetzspiel-data';

const rankingSizeEl = document.getElementById('rankingSize');
const resultEl = document.getElementById('result');
const statusBox = document.getElementById('statusBox');
const rankingContainer = document.getElementById('rankingContainer');
const guessRowsEl = document.getElementById('guessRows');
const historyContainer = document.getElementById('historyContainer');

const tipCount = 5;
const HISTORY_PAGE_SIZE_DEFAULT = 8;
const HISTORY_PAGE_SIZE_OPTIONS = [8, 15, 25];

let state = {
  guesses: [],
  result: null
};

let historyPage = 1;
let historyPageSize = HISTORY_PAGE_SIZE_DEFAULT;

function safeNumber(v){
  const raw = String(v).trim();
  if(raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;'
  }[m]));
}

function defaultRow(i){
  return {
    person: '',
    tips: Array.from({length: tipCount}, () => ''),
    confirmed: false,
    confirmedAt: null
  };
}

function normalizeState(raw){
  const base = { guesses: [], result: null };
  if(!raw || typeof raw !== 'object') return base;
  base.result = raw.result ?? null;
  base.guesses = Array.isArray(raw.guesses) ? raw.guesses.map(row => ({
    person: row.person || '',
    tips: Array.isArray(row.tips) ? [...row.tips, ...Array.from({length: Math.max(0, tipCount - row.tips.length)}, () => '')].slice(0, tipCount) : Array.from({length: tipCount}, () => ''),
    confirmed: !!row.confirmed,
    confirmedAt: row.confirmedAt || null
  })) : [];
  return base;
}

function formatTimestamp(iso){
  if(!iso) return 'Zeitpunkt unbekannt';
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return 'Zeitpunkt unbekannt';
  return d.toLocaleString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getActiveRowIndex(){
  const next = state.guesses.findIndex(row => !row.confirmed);
  if(next !== -1) return next;
  return state.guesses.length;
}

function renderRows(){
  const active = getActiveRowIndex();
  if(active === null){
    guessRowsEl.innerHTML = `<tr><td colspan="7" class="muted">Alle Personen sind bestätigt.</td></tr>`;
    return;
  }

  const g = state.guesses[active] || defaultRow(active);
  const rows = [`
    <tr>
      <td data-label="Person">
        <input data-index="${active}" data-field="person" placeholder="Name" value="${escapeHtml(g.person || '')}">
      </td>
      <td data-label="Tipps" colspan="5">
        <div class="tip-grid">
          ${Array.from({length: tipCount}, (_, tipIndex) => `
            <div class="tip-item tip-${tipIndex}">
              <input data-index="${active}" data-field="tip${tipIndex}" type="number" step="any" placeholder="Tipp ${tipIndex + 1}" value="${escapeHtml(g.tips?.[tipIndex] ?? '')}">
            </div>
          `).join('')}
          <div class="confirm-item">
            <button class="btn secondary" data-index="${active}">Bestätigen</button>
          </div>
        </div>
      </td>
    </tr>
  `];

  guessRowsEl.innerHTML = rows.join('');

  guessRowsEl.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
      const i = Number(input.dataset.index);
      const field = input.dataset.field;
      if(!state.guesses[i]) state.guesses[i] = defaultRow(i);

      if(field === 'person'){
        state.guesses[i].person = input.value.trim();
      } else if(field.startsWith('tip')){
        const tipIndex = Number(field.slice(3));
        state.guesses[i].tips[tipIndex] = input.value;
      }

      autoSave();
    });
  });

  guessRowsEl.querySelectorAll('button[data-index]').forEach(button => {
    button.addEventListener('click', () => {
      const i = Number(button.dataset.index);
      confirmRow(i);
    });
  });
  renderHistory();
}

function validateRow(row){
  const person = (row.person || '').trim();
  const numbers = Array.isArray(row.tips) ? row.tips.map(v => safeNumber(v)).filter(v => v !== null) : [];
  return person && numbers.length > 0;
}

function confirmRow(index){
  const row = state.guesses[index] || defaultRow(index);
  if(!validateRow(row)){
    alert('Bitte gib einen Namen und mindestens einen Tipp ein, bevor du bestätigst.');
    return;
  }
  row.confirmed = true;
  row.confirmedAt = row.confirmedAt || new Date().toISOString();
  state.guesses[index] = row;
  autoSave();
  renderRows();
  renderHistory();
}

function getHistoryRows(){
  return state.guesses.map((row, index) => ({row, index})).filter(item => item.row.confirmed);
}

function deleteRow(index){
  if(!confirm('Diese Person wirklich löschen?')) return;
  state.guesses.splice(index, 1);
  autoSave();
  renderRows();
  renderHistory();
}

function renderHistory(){
  if(!historyContainer) return;
  const entries = getHistoryRows();
  if(!entries.length){
    historyContainer.innerHTML = '<div class="muted">Keine bestätigten Tipps vorhanden.</div>';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(entries.length / historyPageSize));
  if(historyPage > totalPages) historyPage = totalPages;
  if(historyPage < 1) historyPage = 1;

  const start = (historyPage - 1) * historyPageSize;
  const pageEntries = entries.slice(start, start + historyPageSize);

  const itemsHtml = pageEntries.map(({row, index}) => {
    return `
      <div class="history-item">
        <div class="history-head">
          <div>
            <div class="history-title">${escapeHtml(row.person)}</div>
            <div class="history-time">${escapeHtml(formatTimestamp(row.confirmedAt))}</div>
          </div>
          <div class="history-controls">
            <button class="btn danger" data-action="delete" data-index="${index}">Löschen</button>
          </div>
        </div>
        <div class="history-tips">
          ${row.tips.filter(v => v !== '' && v !== null).map(tip => `<span class="history-tip">${escapeHtml(String(tip))}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');

  const sizeOptionsHtml = HISTORY_PAGE_SIZE_OPTIONS.map(size => `
    <option value="${size}" ${size === historyPageSize ? 'selected' : ''}>${size}</option>
  `).join('');

  const paginationHtml = totalPages > 1
    ? `
      <div class="history-pagination">
        <div class="history-page-size">
          <label for="historyPageSize">Pro Seite</label>
          <select id="historyPageSize" data-history-size>${sizeOptionsHtml}</select>
        </div>
        <button class="btn secondary" data-history-nav="prev" ${historyPage === 1 ? 'disabled' : ''}>Zurück</button>
        <div class="history-page-info">Seite ${historyPage} von ${totalPages}</div>
        <button class="btn secondary" data-history-nav="next" ${historyPage === totalPages ? 'disabled' : ''}>Weiter</button>
      </div>
    `
    : `
      <div class="history-pagination">
        <div class="history-page-size">
          <label for="historyPageSize">Pro Seite</label>
          <select id="historyPageSize" data-history-size>${sizeOptionsHtml}</select>
        </div>
        <div class="history-page-info">${entries.length} Einträge</div>
      </div>
    `;

  historyContainer.innerHTML = `${itemsHtml}${paginationHtml}`;

  historyContainer.querySelectorAll('button[data-action]').forEach(button => {
    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    button.addEventListener('click', () => {
      if(action === 'delete') deleteRow(index);
    });
  });

  historyContainer.querySelectorAll('button[data-history-nav]').forEach(button => {
    const direction = button.dataset.historyNav;
    button.addEventListener('click', () => {
      if(direction === 'prev' && historyPage > 1) historyPage -= 1;
      if(direction === 'next' && historyPage < totalPages) historyPage += 1;
      renderHistory();
    });
  });

  const pageSizeSelect = historyContainer.querySelector('select[data-history-size]');
  if(pageSizeSelect){
    pageSizeSelect.addEventListener('change', () => {
      const nextSize = Number(pageSizeSelect.value);
      historyPageSize = HISTORY_PAGE_SIZE_OPTIONS.includes(nextSize) ? nextSize : HISTORY_PAGE_SIZE_DEFAULT;
      historyPage = 1;
      renderHistory();
    });
  }

}

function collectRows(){
  const rows = [];
  for(const row of state.guesses){
    if(!row.confirmed) continue;
    const person = (row.person || '').trim();
    const tips = Array.isArray(row.tips) ? row.tips : [];
    const numbers = tips
      .map(v => safeNumber(v))
      .filter(v => v !== null);

    if(person && numbers.length){
      rows.push({
        person,
        tips: numbers
      });
    }
  }
  return rows;
}

function autoSave(){
  localStorage.setItem(STORAGE_DEFAULT, JSON.stringify({
    guesses: state.guesses,
    result: state.result
  }));
}

function load(){
  const raw = localStorage.getItem(STORAGE_DEFAULT);
  if(!raw){
    statusBox.innerHTML = '<span class="bad">Keine gespeicherten Daten gefunden.</span>';
    return;
  }

  try{
    const parsed = normalizeState(JSON.parse(raw));
    state.guesses = Array.isArray(parsed.guesses) ? parsed.guesses : [];
    state.result = parsed.result ?? null;
    resultEl.value = state.result ?? '';
    renderRows();
    renderHistory();
    statusBox.innerHTML = '<span class="ok">Geladen.</span>';
  }catch(e){
    statusBox.innerHTML = '<span class="bad">Speicherinhalt ist ungültig.</span>';
  }
}

function resetAll(){
  if(!confirm('Alle Daten löschen?')) return;
  state = { guesses: [], result: null };
  resultEl.value = '';
  renderRows();
  renderHistory();
  rankingContainer.innerHTML = '';
  statusBox.textContent = 'Zurückgesetzt.';
  localStorage.removeItem(STORAGE_DEFAULT);
}

function buildRanking(result, size){
  const ranked = collectRows()
    .flatMap(g => g.tips.map((tip, tipIndex) => ({
      person: g.person,
      value: tip,
      diff: Math.abs(tip - result)
    })))
    .sort((a, b) => a.diff - b.diff || a.value - b.value);

  return {
    rows: ranked,
    top: ranked.slice(0, size)
  };
}

function evaluate(){
  const result = safeNumber(resultEl.value);
  if(result === null){
    alert('Bitte ein gültiges Ergebnis eingeben.');
    return;
  }

  state.result = result;
  const size = Math.max(1, parseInt(rankingSizeEl.value || '10', 10));
  const ranking = buildRanking(result, size);

  statusBox.innerHTML = `
    <div><strong>Ergebnis:</strong> ${escapeHtml(String(result))}</div>
    <div><strong>Ranking-Größe:</strong> ${size}</div>
    <div><strong>Tipps gesamt:</strong> ${ranking.rows.length}</div>
  `;

  rankingContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Platz</th>
          <th>Person</th>
          <th>Wert</th>
          <th>Abweichung</th>
        </tr>
      </thead>
      <tbody>
        ${
          ranking.top.length
            ? ranking.top.map((r, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${escapeHtml(r.person)}</td>
                  <td>${r.value}</td>
                  <td>${r.diff}</td>
                </tr>
              `).join('')
            : '<tr><td colspan="4" class="muted">Keine Tipps vorhanden.</td></tr>'
        }
      </tbody>
    </table>
  `;

  autoSave();
}

function exportCsv(){
  const result = safeNumber(resultEl.value);
  if(result === null){
    alert('Bitte zuerst ein gültiges Ergebnis eingeben.');
    return;
  }

  const size = Math.max(1, parseInt(rankingSizeEl.value || '10', 10));
  const ranking = buildRanking(result, size);
  const headers = ['Platz', 'Person', 'Wert', 'Abweichung'];
  const csvEscape = (value) => {
    const str = String(value ?? '');
    return /[";,\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const metaLine = [
    `Ergebnis: ${result}`,
    `Ranking-Größe: ${size}`,
    `Tipps gesamt: ${ranking.rows.length}`
  ].map(csvEscape).join(';');

  const body = ranking.top.map((entry, index) => [
    index + 1,
    entry.person,
    entry.value,
    entry.diff
  ].map(csvEscape).join(';'));

  const csvContent = [metaLine, headers.join(';'), ...body].join('\n');
  const blob = new Blob([csvContent], {type:'text/csv;charset=utf-8;'});

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'schaetzspiel.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById('resetBtn').onclick = resetAll;
document.getElementById('evaluateBtn').onclick = evaluate;
document.getElementById('exportBtn').onclick = exportCsv;

resultEl.addEventListener('input', () => {
  state.result = resultEl.value;
  autoSave();
});

rankingSizeEl.addEventListener('change', () => {
  autoSave();
});

renderRows();

try{
  load();
}catch(e){}
