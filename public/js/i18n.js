// public/js/i18n.js
const LANG_KEY = 'ui.lang';

const dict = {
  uk: {
    // basics
    app_title: 'Structum',
    brand_title: '📦 Облік матеріалів',

    // status
    online: '🟢 Онлайн',
    offline: '🔴 Офлайн',
    loading: 'Завантаження…',
    nothing_found: 'Нічого не знайдено',

    // auth
    login_title: '🔑 Вхід',
    login_login: 'Логін',
    login_password: 'Пароль',
    login_btn: 'Увійти',
    logout_btn: 'Вийти',

    // controls
    search_placeholder: 'Пошук по товарах…',
    camera_btn: 'Камера',
    finish_btn: 'Завершити',
    manual_add_btn: 'Додати вручну',

    // list
    list_title: 'Список',

    // transfers
    transfers_btn: 'Передачі',

    // modals common
    save_btn: 'Зберегти',
    cancel_btn: 'Скасувати',
    close_btn: 'Закрити',
    yes_btn: 'Так',
    no_btn: 'Ні',

    // intake
    intake_title: 'Прихід',
    barcode_label: 'Штрихкод',
    barcode_hint: 'Можна вставити цифри. Пробіли будуть видалені.',
    name_label: 'Назва',
    qty_label: 'Кількість',
    unit_label: 'Одиниця',
    unit_choose: '— оберіть —',
    unit_other: 'Інше…',
    from_label: 'Від кого',

    // continue
    saved_title: 'Збережено',
    continue_scan: 'Продовжити сканування?',

    // history/writeoff/rename
    history_title: 'Історія',
    writeoff_title: 'Списання',
    writeoff_btn: 'Списати',
    rename_title: 'Перейменувати',
    new_name_label: 'Нова назва',
    to_label: 'Кому / куди',

    // transfer
    transfer_title: 'Передати товар',
    where_label: 'Куди',
    damaged_label: 'Пошкоджено / зламано',
    comment_label: 'Коментар',
    send_btn: 'Відправити',
    incoming_title: 'Вхідні передачі',
    transfer_comment_title: 'Коментар передачі',

    // password
    pwd_title: 'Зміна пароля',
    pwd_subtitle: 'Це обов’язковий крок при першому вході.',
    old_pwd_label: 'Старий пароль',
    new_pwd_label: 'Новий пароль',
    repeat_pwd_label: 'Повторіть пароль',

    // admin
    admin_panel: 'Адмін-панель',
    admin_object_label: 'Обʼєкт для перегляду:',
    report_btn: 'Звіт',
    admin_objects_title: 'Обʼєкти (склади)',
    admin_users_title: 'Користувачі',
    admin_add_object: 'Обʼєкт',
    admin_add_user: 'Користувач',
    new_object_title: 'Новий обʼєкт',
    new_user_title: 'Новий користувач',
    login_label: 'Логін',
    object_label: 'Обʼєкт',
    temp_pwd_label: 'Тимчасовий пароль',
    first_login_pwd_note: 'Після першого входу користувач буде зобов’язаний змінити пароль.',

    // confirm/report
    confirm_title: 'Підтвердження',
    report_title: 'Звіт',
    from_date_label: 'З дати',
    to_date_label: 'По дату',
    mode_label: 'Режим',
    mode_all: 'По всіх товарах',
    mode_one: 'По одному товару',
    ops_type_label: 'Тип операцій',
    ops_all: 'Всі',
    ops_in: 'Тільки прихід',
    ops_out: 'Тільки витрата',
    item_label: 'Товар',
    build_btn: 'Сформувати',
    create_btn: 'Створити',

    // splash
    splash_starting: 'Запуск застосунку…',
    soon_default: 'Скоро буде ✅',
close: 'Закрити',

// rename
current_name: 'Поточна:',
item_not_found: 'Товар не знайдено',
name_empty: 'Назва не може бути порожньою',
name_changed: '✅ Назву змінено',

// history modal
history_header: '📜 Історія — {name}',
from_short: 'З',
to_short: 'По',
show_btn: 'Показати',
choose_dates: 'Оберіть дати',
date_end_less: 'Кінцева дата менша за початкову',
no_ops_period: 'Немає операцій за вибраний період',
history_load_error: 'Помилка завантаження історії',
error: 'Помилка',
incoming_label: 'Прихід',
outgoing_label: 'Витрата',
damaged_title: 'Пошкоджено',
open_comment_title: 'Відкрити коментар',

// transfer info modal
transfer_details_title: '💬 Деталі передачі',
qty_short: 'К-сть',
from_where: 'Звідки',
to_where: 'Куди',
when: 'Коли',
status: 'Статус',
damaged_bold: 'Пошкоджено',
comment: 'Коментар',
no_comment: 'Коментаря немає',
load_error: 'Помилка завантаження',

// push confirm
notifications_title: 'Сповіщення',
notifications_text: 'Дозволити сповіщення про передачі? Тоді ви побачите їх навіть на заблокованому екрані.',
allow_btn: 'Дозволити',
notifications_denied: 'Сповіщення не дозволені',
notifications_enabled: '✅ Сповіщення увімкнені',

// writeoff
available: 'доступно: {n}',
qty_must_be_gt0: 'Кількість має бути числом > 0',
not_enough_balance: 'Недостатньо залишку',
written_off: '✅ Списано',

// transfer create/errors
no_access: 'Немає доступу',
choose_object: 'Оберіть обʼєкт',
qty_gt0: 'Кількість має бути > 0',
not_enough: 'Недостатньо залишку',
same_object: 'Не можна передати на той самий обʼєкт',
transfer_created: '📤 Передачу створено',

// incoming/outgoing modal
incoming_head: '📥 Вхідні (очікують)',
outgoing_head: '📤 Вихідні (очікують підтвердження)',
no_incoming: 'Немає вхідних передач',
no_outgoing: 'Немає вихідних очікувань',
accept_btn: '✅ Прийняти',
reject_btn: '✖ Відхилити',
accepted: '✅ Прийнято',
rejected: '⛔ Відхилено',
status_waiting: 'очікує',

// badge title
badge_title: 'Вхідні: {nIn}, Вихідні: {nOut}',

// admin confirm/delete
warehouse: 'Склад',
delete_warehouse_q: 'Видалити склад?',
delete_warehouse_text: 'Склад "{name}" буде деактивовано (і всі користувачі цього складу теж). Продовжити?',
delete_sure: 'Точно видалити?',
delete_warehouse_confirm: 'Підтвердьте видалення складу "{name}".',
delete_user_q: 'Видалити користувача?',
delete_user_text: 'Користувач буде деактивований і не зможе увійти. Продовжити?',
delete_user_confirm: 'Підтвердьте видалення користувача.',
delete_btn: 'Видалити',
yes: 'Так',
warehouse_deleted: '✅ Склад видалено',
user_deleted: '✅ Користувача видалено',
cannot_delete_self: 'Не можна видалити себе',

// admin lists/messages
users_load_error: 'Помилка завантаження користувачів',
no_users: 'Користувачів немає',
warehouses_none: 'Складів немає',

// add object/user validations
enter_name: 'Введіть назву',
warehouse_exists: 'Такий склад уже існує',
name_required: 'Назва обовʼязкова',
warehouse_created: '✅ Склад створено',
choose_warehouse: 'Оберіть склад',
login_taken: 'Логін уже зайнятий',
warehouse_not_found: 'Склад не знайдено',
weak_password: 'Надто простий пароль',
user_created_note: '✅ Користувача створено (попросить зміну пароля)',

// confirm modal defaults
confirm_default: 'Підтвердження',
ok: 'Ок',

// password
pwd_changed: '✅ Пароль змінено',
pwd_min4: 'Пароль мінімум 4 символи',
pwd_not_match: 'Паролі не збігаються',
account_inactive: 'Акаунт деактивовано',
enter_old_pwd: 'Введіть старий пароль',
old_pwd_wrong: 'Старий пароль невірний',

// login
login_error: '❌ Помилка входу: {status} {error}',
logged_out: 'Ви вийшли',

// splash
check_session: 'Перевіряємо сесію…',
loading_data: 'Завантажуємо дані…',

// afterLogin admin UI
all_warehouses: 'Всі склади',
change_pwd_btn: '🔑 Змінити пароль',

// offline queue toast
offline_queue_toast: '⏳ Офлайн-черга: {n} дій (відправиться при появі мережі)',
camera_only_user: 'Немає доступу до камери (тільки для комірника).',
camera_active: '📷 Камера активна',
camera_lib_missing: '❌ Бібліотека камери не завантажилась',
camera_start_failed: '❌ Не вдалося запустити камеру',

// intake validate / errors
enter_barcode: 'Введіть штрихкод',
enter_name2: 'Введіть назву',
unit_required: 'Оберіть одиницю вимірювання',

// intake save
save_error: 'Помилка збереження: {err}',
queued_toast: '⏳ Додано в офлайн-чергу',

// manual add permission
only_storekeeper: 'Тільки комірник може додавати.',
transfer_rejected_toast: '⛔ {to} відмовився прийняти: {name} ×{qty}. Баланс не змінився.',
transfer_accepted_toast: '✅ {to} прийняв: {name} ×{qty}.',
writeoff_default_to: 'Списання',
writeoff_error: 'Помилка списання: {err}',
confirm_title: "Підтвердження",
ok: "Ок",
yes: "Так",
delete: "Видалити",

confirm_delete_warehouse_title: "Видалити склад?",
confirm_delete_warehouse_text: "Склад \"{name}\" буде деактивирований (і всі користувачі цтого склада також). Продовжити?",
confirm_delete_warehouse_title2: "Точно видалити?",
confirm_delete_warehouse_text2: "Підтвердіть видалення складу \"{name}\".",

warehouse_deleted_toast: "✅ Склад видалений",
warehouse_created_toast: "✅ Склад створений",

confirm_delete_user_title: "Видалити користувача?",
confirm_delete_user_text: "Користувач буде деактивирований і не зможе увійти. Продовжити?",
confirm_delete_user_title2: "Точно видалити?",
confirm_delete_user_text2: "Підтвердіть видалення користувача.",

cannot_delete_self: "Неможна видалити себе",
user_deleted_toast: "✅ Користувач видалений",

users_load_error: "Помилка завантаження користувачів",
no_users: "Користувачів немає",

enter_warehouse_name: "Введіть назву",
warehouse_exists: "Такий склад вже існує",
name_required: "Назва обов'язково",

choose_warehouse: "Оберіть склад",
choose_warehouse_error: "Оберіть склад",

enter_login: "Введіть логін",
pwd_min_4: "Пароль мінімум 4 символи",
login_taken: "Логин вже зайнятий",
warehouse_not_found: "Склад не знайдено",
pwd_too_simple: "Занадто простой пароль",

user_created_toast: "✅ Користувач створений (запитає зміну паролю)"
  },

  ru: {
    app_title: 'Structum',
    brand_title: '📦 Учёт материалов',

    online: '🟢 Online',
    offline: '🔴 Offline',
    loading: 'Загрузка…',
    nothing_found: 'Ничего не найдено',

    login_title: '🔑 Вход',
    login_login: 'Логин',
    login_password: 'Пароль',
    login_btn: 'Войти',
    logout_btn: 'Выйти',

    search_placeholder: 'Поиск по товарам…',
    camera_btn: 'Камера',
    finish_btn: 'Завершить',
    manual_add_btn: 'Добавить вручную',

    list_title: 'Список',

    transfers_btn: 'Передачи',

    save_btn: 'Сохранить',
    cancel_btn: 'Отмена',
    close_btn: 'Закрыть',
    yes_btn: 'Да',
    no_btn: 'Нет',

    intake_title: 'Приход',
    barcode_label: 'Штрихкод',
    barcode_hint: 'Можно вставить цифры. Пробелы будут удалены.',
    name_label: 'Название',
    qty_label: 'Количество',
    unit_label: 'Единица',
    unit_choose: '— выберите —',
    unit_other: 'Другое…',
    from_label: 'От кого',

    saved_title: 'Сохранено',
    continue_scan: 'Продолжить сканирование?',

    history_title: 'История',
    writeoff_title: 'Списание',
    writeoff_btn: 'Списать',
    rename_title: 'Переименовать',
    new_name_label: 'Новое название',
    to_label: 'Кому / куда',

    transfer_title: 'Передать товар',
    where_label: 'Куда',
    damaged_label: 'Повреждено / поломано',
    comment_label: 'Комментарий',
    send_btn: 'Отправить',
    incoming_title: 'Входящие передачи',
    transfer_comment_title: 'Комментарий передачи',

    pwd_title: 'Смена пароля',
    pwd_subtitle: 'Это обязательный шаг при первом входе.',
    old_pwd_label: 'Старый пароль',
    new_pwd_label: 'Новый пароль',
    repeat_pwd_label: 'Повторите пароль',

    admin_panel: 'Админ-панель',
    admin_object_label: 'Объект для просмотра:',
    report_btn: 'Отчёт',
    admin_objects_title: 'Объекты (склады)',
    admin_users_title: 'Пользователи',
    admin_add_object: 'Объект',
    admin_add_user: 'Пользователь',
    new_object_title: 'Новый объект',
    new_user_title: 'Новый пользователь',
    login_label: 'Логин',
    object_label: 'Объект',
    temp_pwd_label: 'Временный пароль',
    first_login_pwd_note: 'После первого входа пользователь будет обязан сменить пароль.',

    confirm_title: 'Подтверждение',
    report_title: 'Отчёт',
    from_date_label: 'С даты',
    to_date_label: 'По дату',
    mode_label: 'Режим',
    mode_all: 'По всем товарам',
    mode_one: 'По одному товару',
    ops_type_label: 'Тип операций',
    ops_all: 'Все',
    ops_in: 'Только приход',
    ops_out: 'Только расход',
    item_label: 'Товар',
    build_btn: 'Сформировать',
    create_btn: 'Создать',

    splash_starting: 'Запуск приложения…',
    soon_default: 'Скоро будет ✅',
close: 'Закрыть',

current_name: 'Текущее:',
item_not_found: 'Товар не найден',
name_empty: 'Название не может быть пустым',
name_changed: '✅ Название изменено',

history_header: '📜 История — {name}',
from_short: 'С',
to_short: 'По',
show_btn: 'Показать',
choose_dates: 'Выберите даты',
date_end_less: 'Конечная дата меньше начальной',
no_ops_period: 'Нет операций за выбранный период',
history_load_error: 'Ошибка загрузки истории',
error: 'Ошибка',
incoming_label: 'Приход',
outgoing_label: 'Расход',
damaged_title: 'Повреждено',
open_comment_title: 'Открыть комментарий',

transfer_details_title: '💬 Детали передачи',
qty_short: 'Кол-во',
from_where: 'Откуда',
to_where: 'Куда',
when: 'Когда',
status: 'Статус',
damaged_bold: 'Повреждено',
comment: 'Комментарий',
no_comment: 'Комментария нет',
load_error: 'Ошибка загрузки',

notifications_title: 'Уведомления',
notifications_text: 'Разрешить уведомления о передачах? Тогда вы увидите их даже на заблокированном экране.',
allow_btn: 'Разрешить',
notifications_denied: 'Уведомления не разрешены',
notifications_enabled: '✅ Уведомления включены',

available: 'доступно: {n}',
qty_must_be_gt0: 'Количество должно быть числом > 0',
not_enough_balance: 'Недостаточно остатка',
written_off: '✅ Списано',

no_access: 'Нет доступа',
choose_object: 'Выберите объект',
qty_gt0: 'Количество должно быть > 0',
not_enough: 'Недостаточно остатка',
same_object: 'Нельзя передать на тот же объект',
transfer_created: '📤 Передача создана',

incoming_head: '📥 Входящие (ожидают)',
outgoing_head: '📤 Исходящие (ожидают подтверждения)',
no_incoming: 'Нет входящих передач',
no_outgoing: 'Нет исходящих ожиданий',
accept_btn: '✅ Принять',
reject_btn: '✖ Отклонить',
accepted: '✅ Принято',
rejected: '⛔ Отклонено',
status_waiting: 'ожидает',

badge_title: 'Входящие: {nIn}, Исходящие: {nOut}',

warehouse: 'Склад',
delete_warehouse_q: 'Удалить склад?',
delete_warehouse_text: 'Склад "{name}" будет деактивирован (и все пользователи этого склада тоже). Продолжить?',
delete_sure: 'Точно удалить?',
delete_warehouse_confirm: 'Подтвердите удаление склада "{name}".',
delete_user_q: 'Удалить пользователя?',
delete_user_text: 'Пользователь будет деактивирован и не сможет войти. Продолжить?',
delete_user_confirm: 'Подтвердите удаление пользователя.',
delete_btn: 'Удалить',
yes: 'Да',
warehouse_deleted: '✅ Склад удалён',
user_deleted: '✅ Пользователь удалён',
cannot_delete_self: 'Нельзя удалить себя',

users_load_error: 'Ошибка загрузки пользователей',
no_users: 'Пользователей нет',
warehouses_none: 'Складов нет',

enter_name: 'Введите название',
warehouse_exists: 'Такой склад уже существует',
name_required: 'Название обязательно',
warehouse_created: '✅ Склад создан',
choose_warehouse: 'Выберите склад',
login_taken: 'Логин уже занят',
warehouse_not_found: 'Склад не найден',
weak_password: 'Слишком простой пароль',
user_created_note: '✅ Пользователь создан (попросит смену пароля)',

confirm_default: 'Подтверждение',
ok: 'Ок',

pwd_changed: '✅ Пароль изменён',
pwd_min4: 'Пароль минимум 4 символа',
pwd_not_match: 'Пароли не совпадают',
account_inactive: 'Аккаунт деактивирован',
enter_old_pwd: 'Введите старый пароль',
old_pwd_wrong: 'Старый пароль неверный',

login_error: '❌ Ошибка входа: {status} {error}',
logged_out: 'Вы вышли',

check_session: 'Проверяем сессию…',
loading_data: 'Загружаем данные…',

all_warehouses: 'Все склады',
change_pwd_btn: '🔑 Сменить пароль',

offline_queue_toast: '⏳ Офлайн-очередь: {n} действий (отправится при появлении сети)',
camera_only_user: 'Нет доступа к камере (только для кладовщика).',
camera_active: '📷 Камера активна',
camera_lib_missing: '❌ Библиотека камеры не загрузилась',
camera_start_failed: '❌ Не удалось запустить камеру',

enter_barcode: 'Введите штрихкод',
enter_name2: 'Введите название',
unit_required: 'Выберите единицу измерения',

save_error: 'Ошибка сохранения: {err}',
queued_toast: '⏳ Добавлено в офлайн-очередь',

only_storekeeper: 'Только кладовщик может добавлять.',
transfer_rejected_toast: '⛔ {to} отказался принять: {name} ×{qty}. Баланс не изменился.',
transfer_accepted_toast: '✅ {to} принял: {name} ×{qty}.',
writeoff_default_to: 'Списание',
writeoff_error: 'Ошибка списания: {err}',
warehouse_fallback: "Склад",

confirm_title: "Подтверждение",
ok: "Ок",
yes: "Да",
delete: "Удалить",

confirm_delete_warehouse_title: "Удалить склад?",
confirm_delete_warehouse_text: "Склад \"{name}\" будет деактивирован (и все пользователи этого склада тоже). Продолжить?",
confirm_delete_warehouse_title2: "Точно удалить?",
confirm_delete_warehouse_text2: "Подтвердите удаление склада \"{name}\".",

warehouse_deleted_toast: "✅ Склад удалён",
warehouse_created_toast: "✅ Склад создан",

confirm_delete_user_title: "Удалить пользователя?",
confirm_delete_user_text: "Пользователь будет деактивирован и не сможет войти. Продолжить?",
confirm_delete_user_title2: "Точно удалить?",
confirm_delete_user_text2: "Подтвердите удаление пользователя.",

cannot_delete_self: "Нельзя удалить себя",
user_deleted_toast: "✅ Пользователь удалён",

users_load_error: "Ошибка загрузки пользователей",
no_users: "Пользователей нет",

enter_warehouse_name: "Введите название",
warehouse_exists: "Такой склад уже существует",
name_required: "Название обязательно",

choose_warehouse: "Выберите склад",
choose_warehouse_error: "Выберите склад",

enter_login: "Введите логин",
pwd_min_4: "Пароль минимум 4 символа",
login_taken: "Логин уже занят",
warehouse_not_found: "Склад не найден",
pwd_too_simple: "Слишком простой пароль",

user_created_toast: "✅ Пользователь создан (попросит смену пароля)"
  }
};

export function getLang() {
  const v = localStorage.getItem(LANG_KEY);
  return v === 'ru' || v === 'uk' ? v : 'uk';
}

export function t(key, vars) {
  const lang = getLang();
  let s = dict[lang]?.[key] ?? dict.uk?.[key] ?? key;
  if (vars && typeof s === 'string') {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export function applyLang(lang = getLang()) {
  document.documentElement.lang = lang;
  document.documentElement.setAttribute('translate', 'no');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (!k) return;
    el.textContent = t(k);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const k = el.getAttribute('data-i18n-placeholder');
    if (!k) return;
    el.setAttribute('placeholder', t(k));
  });

  document.title = t('app_title');
}

export function setLang(lang) {
  const next = (lang === 'ru' || lang === 'uk') ? lang : 'uk';
  localStorage.setItem(LANG_KEY, next);
  applyLang(next);
}

export function initLangSwitch() {
  const wrap = document.getElementById('langSwitch');
  if (!wrap) return;

  wrap.innerHTML = `
    <button type="button" class="lang-btn" data-lang="uk">UA</button>
    <button type="button" class="lang-btn" data-lang="ru">RU</button>
  `;

  function sync() {
    const cur = getLang();
    wrap.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-lang') === cur);
    });
  }

  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;
    setLang(btn.getAttribute('data-lang'));
    sync();
  });

  sync();
}

export function initI18n() {
  applyLang(getLang());
  initLangSwitch();
}