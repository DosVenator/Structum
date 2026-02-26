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
  intakeSource = source; // 👈 запоминаем источник

  mError.textContent = '';
  mCode.value = String(code || '').replace(/\s+/g, '');
  mName.value = prefillName || '';
  mQty.value = '';
  mFrom.value = '';

  // 🔒 если приход по существующему товару — не даём менять код/название
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
  const u = store.currentUserObj();
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
  // защита от "дробления" одного и того же кода подряд
  if (clean && clean === lastScannedCode) return;
  lastScannedCode = clean;

  // останавливаем камеру, чтобы пользователь спокойно ввёл данные
  await stopScanner();

  const item = store.getItemByCodeForCurrentObject(clean);
  openIntakeModal({
  code,
  prefillName: item?.name || '',
  lock: !!item,      // если товар уже есть — блокируем имя/код
  source: 'scan'     // 👈 важно!
});
}

function validateQty(val){
  const n = Number(val);
  return Number.isFinite(n) && n > 0;
}

// SAVE приход
mSave.onclick = () => {
  const code = mCode.value.replace(/\s+/g,'');
  const name = mName.value.trim();
  const qty  = mQty.value;
  const from = mFrom.value.trim() || '—';

  if (!code) { mError.textContent = 'Введите штрихкод'; return; }
  if (!name) { mError.textContent = 'Введите название'; return; }
  if (!validateQty(qty)) { mError.textContent = 'Количество должно быть числом > 0'; return; }

  const res = store.addOperation({ code, name, qty: Number(qty), from, type:'in' });
  if (!res.ok) {
    mError.textContent = 'Ошибка сохранения';
    return;
  }

  closeIntakeModal();
  window.renderList?.(); // перерисовать список
   toast('✅ Сохранено');

  // спрашиваем "продолжить сканирование" ТОЛЬКО если источник = scan
  if (intakeSource === 'scan') {
    openContinueModal();
  }
};

mCancel.onclick = () => {
  closeIntakeModal();
  // если отменил — не продолжаем скан автоматически
};

// continue scan?
contYes.onclick = async () => {
  closeContinueModal();
  await startScanner();
};
contNo.onclick = () => {
  closeContinueModal();
};

// manual add -> тоже через intake modal
manualBtn.onclick = () => {
  const u = store.currentUserObj();
  if (!u || u.role !== 'user') { toast('Только кладовщик может добавлять.'); return; }

  openIntakeModal({ code: '', prefillName: '', lock: false, source: 'manual' }); // 👈 manual
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
      source: 'plus' // 👈 plus
    });
  },
  openManualBlank: () => openIntakeModal({ code: '', prefillName: '', lock: false, source: 'manual' })
};
// export (если нужно из app.js)
window.scannerApi = { startScanner, stopScanner };