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
  }
};

export function getLang() {
  const v = localStorage.getItem(LANG_KEY);
  return v === 'ru' || v === 'uk' ? v : 'uk';
}

export function t(key) {
  const lang = getLang();
  return dict[lang]?.[key] ?? dict.uk?.[key] ?? key;
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