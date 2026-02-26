// scanner.js — отвечает за камеру и за приход/списание (через модалки)

let scanner = null;
let scanning = false;
let lastScannedCode = null;
let intakeSource = 'manual'; // scan | manual | plus

// DOM
const cameraBox = document.getElementById('cameraBox');
const statusEl = document.getElementById('status');

const startBtn = document.getElementById('startScan');
const stopBtn  = document.getElementById('stopScan');
const manualBtn= document.getElementById('manualAdd');

// intake modal
const intakeModal = document.getElementById('intakeModal');
const mCode = document.getElementById('mCode');
const mName = document.getElementById('mName');
const mQty  = document.getElementById('mQty');
const mFrom = document.getElementById('mFrom');
const mError= document.getElementById('mError');
const mSave = document.getElementById('mSave');
const mCancel= document.getElementById('mCancel');

// continue modal
const continueModal = document.getElementById('continueModal');
const contYes = document.getElementById('contYes');
const contNo  = document.getElementById('contNo');

function toast(msg){
  window.appToast?.(msg);
}

function openIntakeModal({ code, prefillName = '', lock = false, source = 'manual' }) {
  intakeSource = source;

  mError.textContent = '';
  mCode.value = String(code || '').replace(/\s+/g, '');
  mName.value = prefillName || '';
  mQty.value = '';
  mFrom.value = '';

  mCode.disabled = !!lock;
  mName.disabled = !!lock;

  intakeModal.classList.remove('hidden');
}

function closeIntakeModal(){
  intakeModal.classList.add('hidden');
}

function openContinueModal(){
  continueModal.classList.remove('hidden');
}
function closeContinueModal(){
  continueModal.classList.add('hidden');
}

async function startScanner(){
  // ✅ FIX: await
  const u = await store.currentUserObj();
  if (!u || u.role !== 'user') {
    toast('Нет доступа к камере (только для кладовщика).');
    return;
  }

  if (scanning) return;

  cameraBox.classList.remove('hidden');
  statusEl.textContent = '📷 Камера активна';
  await new Promise(r => setTimeout(r, 80));

  if (!scanner) scanner = new Html5Qrcode("reader");

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
    statusEl.textContent = '❌ Не удалось запустить камеру';
  }
}

async function stopScanner(){
  try {
    if (scanner && scanning) await scanner.stop();
  } catch {}
  scanning = false;
  cameraBox.classList.add('hidden');
  statusEl.textContent = '';
}

async function onScanSuccess(code){
  if (!scanning) return;

  const clean = String(code).replace(/\s+/g,'');
  if (clean && clean === lastScannedCode) return;
  lastScannedCode = clean;

  await stopScanner();

  const item = store.getItemByCodeForCurrentObject(clean);
  openIntakeModal({
    code,
    prefillName: item?.name || '',
    lock: !!item,
    source: 'scan'
  });
}

function validateQty(val){
  const n = Number(val);
  return Number.isFinite(n) && n > 0;
}

// SAVE приход
mSave.onclick = async () => {
  const code = mCode.value.replace(/\s+/g,'');
  const name = mName.value.trim();
  const qty  = mQty.value;
  const from = mFrom.value.trim() || '—';

  if (!code) { mError.textContent = 'Введите штрихкод'; return; }
  if (!name) { mError.textContent = 'Введите название'; return; }
  if (!validateQty(qty)) { mError.textContent = 'Количество должно быть числом > 0'; return; }

  const res = await store.addOperation({ code, name, qty: Number(qty), from, type:'in' });
  if (!res.ok) {
    mError.textContent = `Ошибка сохранения: ${res.error || 'server'}`;
    return;
  }

  closeIntakeModal();
  window.renderList?.();
  toast('✅ Сохранено');

  if (intakeSource === 'scan') {
    openContinueModal();
  }
};

mCancel.onclick = () => {
  closeIntakeModal();
};

contYes.onclick = async () => {
  closeContinueModal();
  await startScanner();
};
contNo.onclick = () => {
  closeContinueModal();
};

// manual add
manualBtn.onclick = async () => {
  // ✅ FIX: await
  const u = await store.currentUserObj();
  if (!u || u.role !== 'user') { toast('Только кладовщик может добавлять.'); return; }

  openIntakeModal({ code: '', prefillName: '', lock: false, source: 'manual' });
};

// buttons
startBtn.onclick = startScanner;
stopBtn.onclick  = stopScanner;

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

window.scannerApi = { startScanner, stopScanner };