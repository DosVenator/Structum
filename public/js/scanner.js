// public/js/scanner.js
// Отвечает за intake modal (ручное добавление / быстрый приход) + (каркас под сканер)

import './store.js';

const store = window.store;

// ===== DOM: intake modal =====
const intakeModal = document.getElementById('intakeModal');
const mCode = document.getElementById('mCode');
const mName = document.getElementById('mName');
const mQty  = document.getElementById('mQty');
const mUnit = document.getElementById('mUnit');
const mUnitCustom = document.getElementById('mUnitCustom');
const mFrom = document.getElementById('mFrom');
const mError = document.getElementById('mError');
const mSave = document.getElementById('mSave');
const mCancel = document.getElementById('mCancel');

const manualAddBtn = document.getElementById('manualAdd');

// optional: continue modal (если хочешь оставить поведение)
const continueModal = document.getElementById('continueModal');
const contYes = document.getElementById('contYes');
const contNo  = document.getElementById('contNo');

let _afterSaveAskContinue = false; // можно использовать при сканировании
let _lastOpenedFromScan = false;

function openModal() {
  if (!intakeModal) return;
  intakeModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}
function closeModal() {
  if (!intakeModal) return;
  intakeModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  _lastOpenedFromScan = false;
}

function showErr(msg){
  if (mError) mError.textContent = String(msg || '');
}

function cleanCode(v){
  return String(v || '').replace(/\s+/g, '').trim();
}

function getUnitFinal(){
  const sel = String(mUnit?.value || '').trim();
  if (sel === '_custom') {
    return String(mUnitCustom?.value || '').trim();
  }
  return sel; // 'шт', 'кг', ...
}

function syncUnitCustomVisibility(){
  const isCustom = String(mUnit?.value || '') === '_custom';
  if (!mUnitCustom) return;
  if (isCustom) mUnitCustom.classList.remove('hidden');
  else mUnitCustom.classList.add('hidden');
}

if (mUnit) {
  mUnit.addEventListener('change', syncUnitCustomVisibility);
}

// закрытие по кнопке Отмена
if (mCancel) mCancel.onclick = closeModal;

// закрытие по клику на фон
if (intakeModal) {
  intakeModal.addEventListener('click', (e) => {
    if (e.target === intakeModal) closeModal();
  });
}

function fillForNew({ code = '', name = '' } = {}) {
  if (mCode) mCode.value = cleanCode(code);
  if (mName) mName.value = String(name || '').trim();

  if (mQty) mQty.value = '';
  if (mFrom) mFrom.value = '';

  if (mUnit) mUnit.value = '';
  if (mUnitCustom) mUnitCustom.value = '';
  syncUnitCustomVisibility();

  showErr('');
}

function fillForExistingItem(itemId){
  const it = store.getItem(itemId);
  if (!it) return;

  if (mCode) mCode.value = cleanCode(it.code);
  if (mName) mName.value = String(it.name || '').trim();

  // qty/from пустые
  if (mQty) mQty.value = '';
  if (mFrom) mFrom.value = '';

  // unit можно подставить
  const unitVal = String(it.unit || '').trim();
  if (mUnit) {
    // если unit один из списка — ставим его, иначе custom
    const allowed = new Set(['шт','кг','л','м','м²','м³','упак']);
    if (!unitVal) {
      mUnit.value = '';
      if (mUnitCustom) mUnitCustom.value = '';
    } else if (allowed.has(unitVal)) {
      mUnit.value = unitVal;
      if (mUnitCustom) mUnitCustom.value = '';
    } else {
      mUnit.value = '_custom';
      if (mUnitCustom) mUnitCustom.value = unitVal;
    }
  }
  syncUnitCustomVisibility();

  showErr('');
}

async function saveIntake(){
  showErr('');

  const code = cleanCode(mCode?.value);
  const name = String(mName?.value || '').trim();
  const qty = Number(mQty?.value);
  const from = String(mFrom?.value || '—').trim() || '—';

  if (!code) { showErr('Введите штрихкод'); return; }
  if (!name) { showErr('Введите название'); return; }
  if (!Number.isFinite(qty) || qty <= 0) { showErr('Количество должно быть числом > 0'); return; }

  // Определяем: новый товар или уже есть (по коду в текущем списке)
  const existing = store.getItemByCodeForCurrentObject?.(code) || null;

  const unitFinal = getUnitFinal();

  // ✅ unit обязателен ТОЛЬКО при создании нового товара
  if (!existing && !unitFinal) {
    showErr('Выберите единицу измерения');
    return;
  }

  mSave.disabled = true;
  try {
    const r = await store.addOperation({
      code,
      name,
      unit: unitFinal,     // ✅ ключевая строка: отправляем unit на сервер
      qty,
      from,
      type: 'in'
    });

    if (!r.ok) {
      // нормальные сообщения
      const msg =
        r.error === 'unit-required' ? 'Выберите единицу измерения' :
        r.error === 'qty' ? 'Некорректное количество' :
        r.error === 'bad-request' ? 'Заполните код и название' :
        `Ошибка: ${r.status || ''} ${r.error || 'server'}`.trim();

      showErr(msg);
      return;
    }

    closeModal();
    window.appToast?.(r.queued ? '⏳ Добавлено в офлайн-очередь' : '✅ Сохранено');

    // обновим список
    await window.renderList?.(document.getElementById('search')?.value || '');

    // если было из сканирования — можно спрашивать "продолжить?"
    if (_lastOpenedFromScan && continueModal) {
      _afterSaveAskContinue = true;
      continueModal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    }
  } finally {
    mSave.disabled = false;
  }
}

if (mSave) mSave.onclick = saveIntake;

// ===== Continue modal (опционально) =====
function closeContinueModal(){
  if (!continueModal) return;
  continueModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  _afterSaveAskContinue = false;
}

if (contNo) contNo.onclick = closeContinueModal;
if (contYes) contYes.onclick = async () => {
  // тут можно снова запускать сканер, если он у тебя есть
  closeContinueModal();
};

// ===== API для app.js =====
// app.js уже зовёт window.intakeApi.openForExistingItem(id)
window.intakeApi = {
  openForExistingItem(id){
    _lastOpenedFromScan = false;
    fillForExistingItem(id);
    openModal();
    setTimeout(() => mQty?.focus(), 50);
  },
  openForNewCode(code){
    _lastOpenedFromScan = true;
    fillForNew({ code, name: '' });
    openModal();
    setTimeout(() => mName?.focus(), 50);
  },
  openManual(){
    _lastOpenedFromScan = false;
    fillForNew({ code: '', name: '' });
    openModal();
    setTimeout(() => mCode?.focus(), 50);
  }
};

// Кнопка "➕ Додати вручну"
if (manualAddBtn) {
  manualAddBtn.onclick = () => window.intakeApi.openManual();
}

// ===== Каркас под сканер, чтобы logout не падал =====
window.scannerApi = {
  async stopScanner(){
    // если у тебя есть реальный сканер — сюда вставишь stop
    return true;
  }
};