// public/js/scanner.js
// Камера (Html5Qrcode) + приход через модалку (с unit)

import './store.js';
import { t } from './i18n.js';

const store = window.store;

let scanner = null;
let scanning = false;
let lastScannedCode = null;
let intakeSource = 'manual'; // scan | manual | plus

// ===== DOM: camera =====
const cameraBox = document.getElementById('cameraBox');
const statusEl  = document.getElementById('status');

const startBtn  = document.getElementById('startScan');
const stopBtn   = document.getElementById('stopScan');
const manualBtn = document.getElementById('manualAdd');

// ===== DOM: intake modal =====
const intakeModal  = document.getElementById('intakeModal');
const mCode        = document.getElementById('mCode');
const mName        = document.getElementById('mName');
const mQty         = document.getElementById('mQty');
const mUnit        = document.getElementById('mUnit');
const mUnitCustom  = document.getElementById('mUnitCustom');
const mFrom        = document.getElementById('mFrom');
const mError       = document.getElementById('mError');
const mSave        = document.getElementById('mSave');
const mCancel      = document.getElementById('mCancel');

// ===== continue modal =====
const continueModal = document.getElementById('continueModal');
const contYes       = document.getElementById('contYes');
const contNo        = document.getElementById('contNo');

function toast(msg){
  window.appToast?.(msg);
}

function cleanCode(v){
  return String(v || '').replace(/\s+/g, '').trim();
}

function openIntakeModal({ code, prefillName = '', lock = false, source = 'manual' }) {
  intakeSource = source;

  if (mError) mError.textContent = '';
  if (mCode) mCode.value = cleanCode(code);
  if (mName) mName.value = String(prefillName || '');

  if (mQty)  mQty.value = '';
  if (mFrom) mFrom.value = '';

  // lock fields when item exists
  if (mCode) mCode.disabled = !!lock;
  if (mName) mName.disabled = !!lock;

  // unit: если товар уже существует — можно подставить его unit
  // если новый — оставляем выбор пустым
  const existing = store.getItemByCodeForCurrentObject?.(cleanCode(code)) || null;
  const unitVal = String(existing?.unit || '').trim();

  if (mUnit) {
    const allowed = new Set(['шт','кг','л','м','м²','м³','упак']);
    if (unitVal && allowed.has(unitVal)) {
      mUnit.value = unitVal;
      if (mUnitCustom) mUnitCustom.value = '';
    } else if (unitVal && !allowed.has(unitVal)) {
      mUnit.value = '_custom';
      if (mUnitCustom) mUnitCustom.value = unitVal;
    } else {
      // нет unit (новый товар)
      mUnit.value = '';
      if (mUnitCustom) mUnitCustom.value = '';
    }
  }

  syncUnitCustomVisibility();

  intakeModal?.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeIntakeModal(){
  intakeModal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function openContinueModal(){
  continueModal?.classList.remove('hidden');
  document.body.classList.add('modal-open');
}
function closeContinueModal(){
  continueModal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function validateQty(val){
  const n = Number(val);
  return Number.isFinite(n) && n > 0;
}

function getUnitFinal(){
  const sel = String(mUnit?.value || '').trim();
  if (sel === '_custom') return String(mUnitCustom?.value || '').trim();
  return sel;
}

function syncUnitCustomVisibility(){
  const isCustom = String(mUnit?.value || '') === '_custom';
  if (!mUnitCustom) return;
  if (isCustom) mUnitCustom.classList.remove('hidden');
  else mUnitCustom.classList.add('hidden');
}

if (mUnit) mUnit.addEventListener('change', syncUnitCustomVisibility);

// ===== Scanner logic =====
async function startScanner(){
  const u = await store.currentUserObj();
  if (!u || u.role !== 'user') {
    toast(t('camera_only_user'));
    return;
  }

  if (scanning) return;

  cameraBox?.classList.remove('hidden');
  if (statusEl) statusEl.textContent = t('camera_active');
  await new Promise(r => setTimeout(r, 80));

  // Html5Qrcode грузится через <script src="https://unpkg.com/html5-qrcode"></script>
  if (typeof window.Html5Qrcode !== 'function') {
    console.error('Html5Qrcode is not loaded');
    scanning = false;
    if (statusEl) statusEl.textContent = t('camera_lib_missing');
    return;
  }

  if (!scanner) scanner = new window.Html5Qrcode("reader");

  scanning = true;
  lastScannedCode = null;

  try {
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 280, height: 190 } },
      onScanSuccess
    );
  } catch (e) {
    console.error(e);
    scanning = false;
    if (statusEl) statusEl.textContent = t('camera_start_failed');
  }
}

async function stopScanner(){
  try {
    if (scanner && scanning) await scanner.stop();
  } catch {}
  scanning = false;
  cameraBox?.classList.add('hidden');
  if (statusEl) statusEl.textContent = '';
}

async function onScanSuccess(code){
  if (!scanning) return;

  const clean = cleanCode(code);
  if (clean && clean === lastScannedCode) return;
  lastScannedCode = clean;

  await stopScanner();

  const item = store.getItemByCodeForCurrentObject?.(clean) || null;

  openIntakeModal({
    code: clean,
    prefillName: item?.name || '',
    lock: !!item,
    source: 'scan'
  });
}

// ===== SAVE intake (приход) =====
if (mSave) mSave.onclick = async () => {
  const code = cleanCode(mCode?.value);
  const name = String(mName?.value || '').trim();
  const qty  = mQty?.value;
  const from = String(mFrom?.value || '').trim() || '—';

  if (!code) { if (mError) mError.textContent = t('enter_barcode'); return; }
  if (!name) { if (mError) mError.textContent = t('enter_name2'); return; }
  if (!validateQty(qty)) { if (mError) mError.textContent = t('qty_must_be_gt0'); return; }

  const existing = store.getItemByCodeForCurrentObject?.(code) || null;
  const unitFinal = getUnitFinal();

  // unit обязателен только для нового товара
  if (!existing && !unitFinal) {
    if (mError) mError.textContent = t('unit_required');
    return;
  }

  mSave.disabled = true;
  try {
    const res = await store.addOperation({
      code,
      name,
      unit: unitFinal,
      qty: Number(qty),
      from,
      type: 'in'
    });

    if (!res.ok) {
      const msg =
        res.error === 'unit-required'
          ? t('unit_required')
          : t('save_error', { err: res.error || 'server' });
      if (mError) mError.textContent = msg;
      return;
    }

    closeIntakeModal();
    await window.renderList?.(document.getElementById('search')?.value || '');

    // queued / saved
    toast(res.queued ? t('queued_toast') : `✅ ${t('saved_title')}`);

    if (intakeSource === 'scan') {
      openContinueModal();
    }
  } finally {
    mSave.disabled = false;
  }
};

if (mCancel) mCancel.onclick = closeIntakeModal;

if (contYes) contYes.onclick = async () => {
  closeContinueModal();
  await startScanner();
};
if (contNo) contNo.onclick = closeContinueModal;

// manual add
if (manualBtn) manualBtn.onclick = async () => {
  const u = await store.currentUserObj();
  if (!u || u.role !== 'user') { toast(t('only_storekeeper')); return; }
  openIntakeModal({ code: '', prefillName: '', lock: false, source: 'manual' });
};

// buttons
if (startBtn) startBtn.onclick = startScanner;
if (stopBtn)  stopBtn.onclick  = stopScanner;

// API for app.js
window.intakeApi = {
  openForExistingItem: (itemId) => {
    const item = store.getItem(itemId);
    if (!item) return;
    openIntakeModal({
      code: item.code,
      prefillName: item.name,
      lock: true,
      source: 'plus'
    });
  },
  openManualBlank: () => openIntakeModal({ code: '', prefillName: '', lock: false, source: 'manual' })
};

// expose scanner controls (logout uses stopScanner)
window.scannerApi = { startScanner, stopScanner };