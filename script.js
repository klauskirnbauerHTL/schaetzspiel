const STORAGE_DEFAULT = 'schaetzspiel-data';

const rankingSizeEl = document.getElementById('rankingSize');
const resultEl = document.getElementById('result');
const statusBox = document.getElementById('statusBox');
const rankingContainer = document.getElementById('rankingContainer');
const guessRowsEl = document.getElementById('guessRows');
const historyContainer = document.getElementById('historyContainer');

const tipCount = 5;

let state = {
  guesses: [],
  result: null
};

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
    confirmed: false
  };
}

function normalizeState(raw){
  const base = { guesses: [], result: null };
  if(!raw || typeof raw !== 'object') return base;
  base.result = raw.result ?? null;
  base.guesses = Array.isArray(raw.guesses) ? raw.guesses.map(row => ({
    person: row.person || '',
    tips: Array.isArray(row.tips) ? [...row.tips, ...Array.from({length: Math.max(0, tipCount - row.tips.length)}, () => '')].slice(0, tipCount) : Array.from({length: tipCount}, () => ''),
    confirmed: !!row.confirmed
  })) : [];
  return base;
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
  state.guesses[index] = row;
  autoSave();
  renderRows();
  renderHistory();
}

function getHistoryRows(){
  return state.guesses.map((row, index) => ({row, index})).filter(item => item.row.confirmed);
}

function startEditRow(index){
  const row = state.guesses[index];
  if(!row) return;
  row.editing = true;
  row.editBuffer = {
    person: row.person,
    tips: [...row.tips]
  };
  renderHistory();
}

function cancelEditRow(index){
  const row = state.guesses[index];
  if(!row) return;
  row.editing = false;
  delete row.editBuffer;
  renderHistory();
}

function saveEditRow(index){
  const row = state.guesses[index];
  if(!row || !row.editBuffer) return;
  if(!validateRow(row.editBuffer)){
    alert('Bitte gib einen Namen und mindestens einen Tipp ein.');
    return;
  }
  row.person = row.editBuffer.person.trim();
  row.tips = [...row.editBuffer.tips];
  row.editing = false;
  delete row.editBuffer;
  autoSave();
  renderRows();
  renderHistory();
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

  historyContainer.innerHTML = entries.map(({row, index}) => {
    if(row.editing){
      return `
        <div class="history-item">
          <div class="history-head">
            <div class="history-title">Bearbeite Eintrag</div>
          </div>
          <div class="history-edit">
            <label>Name<br><input data-index="${index}" data-field="person" value="${escapeHtml(row.editBuffer.person)}"></label>
            ${row.editBuffer.tips.map((tip, tipIndex) => `
              <label>Tipp ${tipIndex + 1}<br><input data-index="${index}" data-field="editTip${tipIndex}" type="number" step="any" value="${escapeHtml(tip)}"></label>
            `).join('')}
          </div>
          <div class="history-controls">
            <button class="btn secondary" data-action="save" data-index="${index}">Speichern</button>
            <button class="btn secondary" data-action="cancel" data-index="${index}">Abbrechen</button>
            <button class="btn danger" data-action="delete" data-index="${index}">Löschen</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="history-item">
        <div class="history-head">
          <div class="history-title">${escapeHtml(row.person)}</div>
          <div class="history-controls">
            <button class="btn secondary" data-action="edit" data-index="${index}">Bearbeiten</button>
            <button class="btn danger" data-action="delete" data-index="${index}">Löschen</button>
          </div>
        </div>
        <div class="history-tips">
          ${row.tips.filter(v => v !== '' && v !== null).map(tip => `<span class="history-tip">${escapeHtml(String(tip))}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');

  historyContainer.querySelectorAll('button[data-action]').forEach(button => {
    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    button.addEventListener('click', () => {
      if(action === 'edit') startEditRow(index);
      if(action === 'delete') deleteRow(index);
      if(action === 'save') saveEditRow(index);
      if(action === 'cancel') cancelEditRow(index);
    });
  });

  historyContainer.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
      const index = Number(input.dataset.index);
      const field = input.dataset.field;
      const row = state.guesses[index];
      if(!row || !row.editBuffer) return;

      if(field === 'person'){
        row.editBuffer.person = input.value;
      } else if(field.startsWith('editTip')){
        const tipIndex = Number(field.slice(7));
        row.editBuffer.tips[tipIndex] = input.value;
      }
    });
  });
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
      label: `Tipp ${tipIndex + 1}`,
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
          <th>Tipp</th>
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
                  <td>${escapeHtml(r.label)}</td>
                  <td>${r.value}</td>
                  <td>${r.diff}</td>
                </tr>
              `).join('')
            : '<tr><td colspan="5" class="muted">Keine Tipps vorhanden.</td></tr>'
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
  const headers = ['Platz', 'Person', 'Tipp', 'Wert', 'Abweichung'];
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
    entry.label,
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
