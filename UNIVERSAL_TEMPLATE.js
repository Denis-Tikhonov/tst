// =============================================================
// UNIVERSAL_TEMPLATE.js — Lampa Android TV Optimized
// For AdultJS (Lampa) Video Content Aggregation System
// Version  : 3.2.0-LAMPA
// Developer: MiniMax Agent
// Based on : UNIVERSAL_TEMPLATE v3.1.0-LAMPA
// Core     : AdultJS SS v1.7.0+
// Date     : 2026-05-02
//
// ОПТИМИЗАЦИИ v3.2.0-LAMPA:
//   [DEBUG]     Полностью переработанный модуль отладки:
//               - Расширенная цветовая схема (10 категорий)
//               - BASIC DEBUG: базовая проверка подключения к системе
//               - ADVANCED DEBUG: детальный анализ работы парсера
//               - Группировка логов по категориям
//               - Фильтрация по уровням отладки
//   [NETWORK]   Упрощённый httpGet — всегда использует AdultPlugin.networkRequest
//   [MEMORY]    Оптимизация под Android TV: явное освобождение ресурсов
//   [VALIDATE]  Формальная JSON Schema валидация конфигурации
//   [HEALTH]    Метод healthCheck() для мониторинга состояния
//   [HOTPATCH]  Механизм горячего патчинга конфигурации runtime
//   [CYRILLIC]  Улучшенная функция slugToTitle для кириллицы/Unicode
//   [HLS]       Расширенная поддержка HLS: variant streams из master playlist
//   [COMPAT]    Полная совместимость с Lampa API и Android TV WebView
//
// ПРАВИЛО БРИТВЫ ОККАМА:
//   Этот шаблон содержит ВСЕ 17 стратегий. При генерации парсера
//   из JSON активируйте ТОЛЬКО те стратегии, которые указаны в
//   sStrategies.matched. Неактивные стратегии остаются в коде.
//
// СОВМЕСТИМОСТЬ:
//   - Lampa v1.x, v2.x, v3.x
//   - Android TV WebView (Chrome 73+)
//   - AdultJS Core v1.7.0+
//   - Cloudflare Worker v2.0.0+
// =============================================================

(function () {
  'use strict';

  // ============================================================
  // §0. КОНСТАНТЫ И КОНФИГУРАЦИЯ
  // ============================================================

  var TEMPLATE_VERSION = '3.2.0-LAMPA';
  var CORE_MIN_VERSION = '1.7.0';

  // Конфигурация для Android TV
  var TV_CONFIG = {
    DEBUG_MODE: true,
    DEBUG_BASIC: true,         // Базовый блок отладки
    DEBUG_ADVANCED: false,    // Продвинутый блок (включать вручную)
    DEBUG_FALLBACK: true,      // Fallback если %c не поддерживается
    DEBUG_FILTER: 'ALL',       // ALL | BASIC | ADVANCED | OFF
    DEBUG_CATEGORIES: {
      SUCCESS:  true,          // Зелёный — успешные операции
      WARNING:  true,          // Оранжевый — предупреждения
      ERROR:    true,          // Красный — ошибки
      INFO:     true,          // Синий — общая информация
      NETWORK:  true,          // Фиолетовый — HTTP-запросы
      PARSER:   true,          // Голубой — парсинг карточек
      QUALITY:  true,          // Жёлтый — извлечение качества
      MEMORY:   true,          // Серый — управление памятью
      CONFIG:   true,          // Розовый — конфигурация
      SYSTEM:   true,          // Тёмно-серый — системные
    },
    MAX_CARDS_PER_BATCH: 500,    // Ограничение для TV
    HEALTH_CHECK_TIMEOUT: 20000, // Таймаут health check (мс)
    QUALITY_MIN_LENGTH: 200,     // Мин. длина HTML для парсинга
    URL_MAX_LENGTH: 2048,
    MEMORY_CLEANUP_INTERVAL: 50,
    DOMPARSER_REUSE: true,
    LOG_MAX: 200,
  };

  // Массив для логов
  var LOG_BUFFER = [];

  // ============================================================
  // §1. DEBUG — Расширенная система отладки для Android TV
  // ============================================================

  var NAME = 'unkwn';
  var TAG = '[' + NAME + ']';

  // ------------------------------------------------------------
  // 1.1 Цветовая палитра для консоли
  // ------------------------------------------------------------
  var DEBUG_COLORS = {
    // Основные уровни логирования
    SUCCESS: { color: '#00c853', bg: '#1b5e20', label: 'OK' },
    WARNING: { color: '#ff9100', bg: '#e65100', label: 'WARN' },
    ERROR:   { color: '#ff1744', bg: '#b71c1c', label: 'ERR' },
    INFO:    { color: '#2979ff', bg: '#0d47a1', label: 'INFO' },

    // Категории отладки
    NETWORK: { color: '#aa00ff', bg: '#4a148c', label: 'NET' },
    PARSER:  { color: '#00bcd4', bg: '#006064', label: 'PRS' },
    QUALITY: { color: '#ffd600', bg: '#f57f17', label: 'QLTY' },
    MEMORY:  { color: '#78909c', bg: '#37474f', label: 'MEM' },
    CONFIG:  { color: '#f50057', bg: '#880e4f', label: 'CFG' },
    SYSTEM:  { color: '#546e7a', bg: '#263238', label: 'SYS' },

    // Блоки отладки
    BASIC:   { color: '#69f0ae', bg: '#00796b', label: 'BASIC' },
    ADVANCED:{ color: '#7c4dff', bg: '#512da8', label: 'ADV' },

    // Разделители
    BLOCK:   { color: '#ffffff', bg: '#455a64', label: '────' },
  };

  // Проверка поддержки %c в console.log
  var USE_CONSOLE_STYLES = (function () {
    if (typeof console === 'undefined') return false;
    try {
      return console.log.length > 1;
    } catch (e) { return false; }
  })();

  // Утилиты
  function trunc(s, n) {
    s = s || '';
    n = n || 150;
    return s.length > n ? s.substring(0, n) + '...' : s;
  }

  function pad(s, n) {
    s = String(s || '');
    while (s.length < n) s += ' ';
    return s.substring(0, n);
  }

  function repeat(c, n) {
    return Array(n + 1).join(c);
  }

  // ------------------------------------------------------------
  // 1.2 Логирование — централизованная функция
  // ------------------------------------------------------------
  function addToLog(level, category, msg, block) {
    if (LOG_BUFFER.length >= TV_CONFIG.LOG_MAX) LOG_BUFFER.shift();
    LOG_BUFFER.push({
      time: Date.now(),
      level: level,
      category: category,
      block: block || 'BASIC',
      message: String(msg).substring(0, 500),
    });
  }

  // Основная функция отладки
  function dbg(level, msg, category, block) {
    if (!TV_CONFIG.DEBUG_MODE) return;
    if (TV_CONFIG.DEBUG_FILTER === 'OFF') return;

    // Проверка фильтра
    if (TV_CONFIG.DEBUG_FILTER !== 'ALL') {
      if (TV_CONFIG.DEBUG_FILTER === 'BASIC' && block !== 'BASIC') return;
      if (TV_CONFIG.DEBUG_FILTER === 'ADVANCED' && block !== 'ADVANCED') return;
    }

    // Проверка категории
    if (category && TV_CONFIG.DEBUG_CATEGORIES && TV_CONFIG.DEBUG_CATEGORIES[category] === false) return;

    var cfg = DEBUG_COLORS[level] || DEBUG_COLORS.INFO;
    var catTag = cfg.label;
    var prefix = TAG + ' [' + catTag + ']';
    var fullMsg = prefix + ' ' + msg;

    addToLog(level, category, fullMsg, block);

    // Вывод в консоль
    if (USE_CONSOLE_STYLES && TV_CONFIG.DEBUG_FALLBACK) {
      try {
        var style = 'color:' + cfg.color + ';background:' + cfg.bg + ';font-weight:bold;padding:2px 6px;border-radius:3px';
        console.log('%c' + prefix + '%c ' + msg, style, 'color:#eceff1');
      } catch (e) {
        console.log(fullMsg);
      }
    } else {
      console.log(fullMsg);
    }
  }

  // ------------------------------------------------------------
  // 1.3 Базовый блок отладки (BASIC)
  // Проверка основных функций и подключения к системе
  // ------------------------------------------------------------
  var BASIC_DEBUG = {

    // 1.3.1 Проверка AdultPlugin
    checkAdultPlugin: function () {
      var result = { ok: false, checks: {}, version: null };

      dbg('INFO', '═══════ BASIC DEBUG: AdultPlugin ═══════', 'SYSTEM', 'BASIC');

      // Проверка объекта
      result.checks.objectExists = !!(window.AdultPlugin);
      if (!result.checks.objectExists) {
        dbg('ERROR', 'AdultPlugin не найден в window', 'SYSTEM', 'BASIC');
        return result;
      }
      dbg('SUCCESS', 'AdultPlugin найден', 'SYSTEM', 'BASIC');

      // Проверка networkRequest
      result.checks.networkRequest = typeof window.AdultPlugin.networkRequest === 'function';
      if (result.checks.networkRequest) {
        dbg('SUCCESS', 'AdultPlugin.networkRequest доступен', 'SYSTEM', 'BASIC');
      } else {
        dbg('ERROR', 'AdultPlugin.networkRequest не найден', 'SYSTEM', 'BASIC');
      }

      // Проверка registerParser
      result.checks.registerParser = typeof window.AdultPlugin.registerParser === 'function';
      if (result.checks.registerParser) {
        dbg('SUCCESS', 'AdultPlugin.registerParser доступен', 'SYSTEM', 'BASIC');
      } else {
        dbg('ERROR', 'AdultPlugin.registerParser не найден', 'SYSTEM', 'BASIC');
      }

      // Проверка версии
      if (window.AdultPlugin.version) {
        result.version = window.AdultPlugin.version;
        dbg('INFO', 'Версия AdultPlugin: ' + result.version, 'SYSTEM', 'BASIC');

        // Проверка совместимости
        var minVer = CORE_MIN_VERSION.split('.').map(Number);
        var curVer = result.version.split('.').map(Number);
        result.compatible = true;
        for (var i = 0; i < 3; i++) {
          if ((curVer[i] || 0) < (minVer[i] || 0)) {
            result.compatible = false;
            break;
          }
        }
        if (result.compatible) {
          dbg('SUCCESS', 'Версия совместима с шаблоном (требуется ' + CORE_MIN_VERSION + '+)', 'SYSTEM', 'BASIC');
        } else {
          dbg('WARNING', 'Версия устарела! Требуется ' + CORE_MIN_VERSION + '+', 'SYSTEM', 'BASIC');
        }
      }

      // Дополнительные свойства
      if (window.AdultPlugin.workerUrl) {
        result.workerUrl = window.AdultPlugin.workerUrl;
        dbg('INFO', 'Worker URL: ' + trunc(result.workerUrl, 60), 'NETWORK', 'BASIC');
      }

      result.ok = result.checks.networkRequest && result.checks.registerParser;
      dbg('INFO', 'AdultPlugin ' + (result.ok ? 'ПОЛНОСТЬЮ ГОТОВ' : 'ТРЕБУЕТ ВНИМАНИЯ'), 'SYSTEM', 'BASIC');
      dbg('INFO', '═══════════════════════════════════════', 'SYSTEM', 'BASIC');

      return result;
    },

    // 1.3.2 Проверка подключения к Worker
    checkWorker: function (callback) {
      dbg('INFO', '═══════ BASIC DEBUG: Worker ══════════', 'SYSTEM', 'BASIC');
      dbg('INFO', 'Тестирование подключения к Worker...', 'NETWORK', 'BASIC');

      var t0 = Date.now();
      var testUrl = HOST;

      // Используем httpGet для проверки
      if (window.AdultPlugin && typeof window.AdultPlugin.networkRequest === 'function') {
        window.AdultPlugin.networkRequest(
          testUrl,
          function (html) {
            var elapsed = Date.now() - t0;
            dbg('SUCCESS', 'Worker ОТВЕТИЛ за ' + elapsed + 'мс', 'NETWORK', 'BASIC');
            dbg('INFO', 'Получено ' + (html ? html.length : 0) + ' байт', 'NETWORK', 'BASIC');

            // Проверяем признаки CORS-проксирования
            if (html && html.length > 100) {
              dbg('SUCCESS', 'CORS-проксирование работает корректно', 'NETWORK', 'BASIC');
            } else {
              dbg('WARNING', 'Получен пустой или слишком короткий ответ', 'NETWORK', 'BASIC');
            }

            if (callback) callback({ ok: true, elapsed: elapsed, size: html ? html.length : 0 });
            dbg('INFO', '═══════════════════════════════════════', 'SYSTEM', 'BASIC');
          },
          function (err) {
            dbg('ERROR', 'Worker НЕ ОТВЕТИЛ: ' + err, 'NETWORK', 'BASIC');
            dbg('ERROR', 'Проверьте: 1) Worker развёрнут, 2) Домен в whitelist', 'CONFIG', 'BASIC');
            if (callback) callback({ ok: false, error: err });
            dbg('INFO', '═══════════════════════════════════════', 'SYSTEM', 'BASIC');
          }
        );
      } else {
        dbg('ERROR', 'Не могу проверить Worker: AdultPlugin.networkRequest недоступен', 'NETWORK', 'BASIC');
        if (callback) callback({ ok: false, error: 'no_network' });
        dbg('INFO', '═══════════════════════════════════════', 'SYSTEM', 'BASIC');
      }
    },

    // 1.3.3 Проверка структуры Menu
    checkMenu: function () {
      dbg('INFO', '═══════ BASIC DEBUG: Menu ════════════', 'SYSTEM', 'BASIC');

      try {
        var menu = buildMenu();
        var issues = [];

        if (!Array.isArray(menu)) {
          dbg('ERROR', 'Menu должен быть массивом, получен: ' + typeof menu, 'CONFIG', 'BASIC');
          return { ok: false, error: 'invalid_type' };
        }

        if (menu.length === 0) {
          dbg('WARNING', 'Menu пуст', 'CONFIG', 'BASIC');
          issues.push('empty_menu');
        }

        // Проверяем наличие поиска
        var hasSearch = false;
        var searchUrls = [];

        for (var i = 0; i < menu.length; i++) {
          var item = menu[i];
          if (item.search_on) hasSearch = true;
          if (item.playlist_url) searchUrls.push(item.playlist_url);
        }

        if (hasSearch) {
          dbg('SUCCESS', 'Пункт "Поиск" найден', 'CONFIG', 'BASIC');
        } else {
          dbg('WARNING', 'Пункт "Поиск" не найден — добавьте search_on:true', 'CONFIG', 'BASIC');
          issues.push('no_search');
        }

        // Проверяем корректность playlist_url
        var urlPatterns = [NAME + '/search/', NAME + '/cat/', NAME + '/channel/'];
        for (var j = 0; j < searchUrls.length; j++) {
          var url = searchUrls[j];
          if (url.indexOf('?') !== -1 && url.indexOf(NAME + '/search/') !== 0) {
            // URL содержит ? но это не search — возможно ошибка
            dbg('WARNING', 'Подозрительный URL: ' + url, 'CONFIG', 'BASIC');
          }
        }

        // Проверяем submenu
        var submenuCount = 0;
        for (var k = 0; k < menu.length; k++) {
          if (menu[k].submenu && Array.isArray(menu[k].submenu)) {
            submenuCount++;
            dbg('INFO', 'Submenu "' + menu[k].title + '": ' + menu[k].submenu.length + ' пунктов', 'CONFIG', 'BASIC');
          }
        }

        dbg('INFO', 'Итого пунктов меню: ' + menu.length + ', submenus: ' + submenuCount, 'CONFIG', 'BASIC');

        var ok = issues.length === 0;
        if (ok) {
          dbg('SUCCESS', 'Menu структура корректна', 'CONFIG', 'BASIC');
        } else {
          dbg('WARNING', 'Menu требует внимания (' + issues.length + ' проблем)', 'CONFIG', 'BASIC');
        }

        dbg('INFO', '═══════════════════════════════════════', 'SYSTEM', 'BASIC');
        return { ok: ok, menu: menu, issues: issues };

      } catch (e) {
        dbg('ERROR', 'Ошибка при проверке Menu: ' + e.message, 'CONFIG', 'BASIC');
        return { ok: false, error: e.message };
      }
    },

    // 1.3.4 Проверка совместимости с ядром
    checkCoreCompat: function () {
      dbg('INFO', '═══════ BASIC DEBUG: Core Compat ═══════', 'SYSTEM', 'BASIC');

      var checks = {
        templateVersion: TEMPLATE_VERSION,
        coreMinVersion: CORE_MIN_VERSION,
        api: {
          main: typeof MyParser && typeof MyParser.main === 'function',
          view: typeof MyParser && typeof MyParser.view === 'function',
          search: typeof MyParser && typeof MyParser.search === 'function',
          qualities: typeof MyParser && typeof MyParser.qualities === 'function',
        },
        config: {
          host: !!HOST && HOST.indexOf('https://') === 0,
          name: !!NAME && NAME.length === 5,
          card: !!CARD && !!CARD.container,
          buildUrl: !!BUILD_URL && !!BUILD_URL.main,
        },
      };

      var allApiOk = Object.values(checks.api).every(Boolean);
      var allConfigOk = Object.values(checks.config).every(Boolean);

      // API
      if (checks.api.main) dbg('SUCCESS', 'API.main() найден', 'CONFIG', 'BASIC');
      else dbg('ERROR', 'API.main() отсутствует', 'CONFIG', 'BASIC');

      if (checks.api.view) dbg('SUCCESS', 'API.view() найден', 'CONFIG', 'BASIC');
      else dbg('ERROR', 'API.view() отсутствует', 'CONFIG', 'BASIC');

      if (checks.api.search) dbg('SUCCESS', 'API.search() найден', 'CONFIG', 'BASIC');
      else dbg('ERROR', 'API.search() отсутствует', 'CONFIG', 'BASIC');

      if (checks.api.qualities) dbg('SUCCESS', 'API.qualities() найден', 'CONFIG', 'BASIC');
      else dbg('ERROR', 'API.qualities() отсутствует', 'CONFIG', 'BASIC');

      // Config
      dbg('INFO', 'HOST: ' + HOST, 'CONFIG', 'BASIC');
      dbg('INFO', 'NAME: ' + NAME + ' (' + NAME.length + ' символов)', 'CONFIG', 'BASIC');
      dbg('INFO', 'CARD.container: ' + CARD.container, 'CONFIG', 'BASIC');
      dbg('INFO', 'BUILD_URL.main: ' + BUILD_URL.main, 'CONFIG', 'BASIC');

      // Итог
      if (allApiOk && allConfigOk) {
        dbg('SUCCESS', 'Совместимость с ядром ПОДТВЕРЖДЕНА', 'CONFIG', 'BASIC');
      } else {
        dbg('ERROR', 'Совместимость нарушена — проверьте конфигурацию', 'CONFIG', 'BASIC');
      }

      dbg('INFO', '═══════════════════════════════════════', 'SYSTEM', 'BASIC');
      return checks;
    },

    // 1.3.5 Запуск всех базовых проверок
    runAll: function () {
      dbg('BLOCK', repeat('═', 50), 'SYSTEM', 'BASIC');
      dbg('INFO', '███████ BASIC DEBUG SUITE v' + TEMPLATE_VERSION + ' ███████', 'SYSTEM', 'BASIC');
      dbg('INFO', 'Хост: ' + HOST, 'SYSTEM', 'BASIC');
      dbg('INFO', 'Парсер: ' + NAME + ' v' + (typeof VERSION !== 'undefined' ? VERSION : '?'), 'SYSTEM', 'BASIC');
      dbg('BLOCK', repeat('═', 50), 'SYSTEM', 'BASIC');

      var results = {
        adultPlugin: this.checkAdultPlugin(),
        worker: null,
        menu: this.checkMenu(),
        core: this.checkCoreCompat(),
      };

      // Worker проверка асинхронная
      this.checkWorker(function (wr) {
        results.worker = wr;
        dbg('BLOCK', repeat('═', 50), 'SYSTEM', 'BASIC');
        dbg('INFO', '██████ BASIC DEBUG COMPLETE ██████', 'SYSTEM', 'BASIC');
        dbg('BLOCK', repeat('═', 50), 'SYSTEM', 'BASIC');
      });

      return results;
    },
  };

  // ------------------------------------------------------------
  // 1.4 Продвинутый блок отладки (ADVANCED)
  // Детальный анализ работы парсера
  // ------------------------------------------------------------
  var ADVANCED_DEBUG = {

    // 1.4.1 Тестирование каждой стратегии
    testStrategies: function (html, callback) {
      if (!TV_CONFIG.DEBUG_ADVANCED) {
        dbg('WARNING', 'ADVANCED DEBUG отключён (TV_CONFIG.DEBUG_ADVANCED = false)', 'SYSTEM', 'ADVANCED');
        return;
      }

      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');
      dbg('ADVANCED', '████ ADVANCED DEBUG: Strategies ████', 'SYSTEM', 'ADVANCED');
      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');

      var results = {};
      var strategyNames = {
        s1_rules: 'VIDEO_RULES',
        s2_direct_mp4: 'Прямые mp4',
        s3_og_video: 'og:video',
        s4_hls: 'HLS m3u8',
        s5_get_file: 'get_file',
        s6_source_size: 'source size',
        s7_source_label: 'source label',
        s8_domparser: 'DOMParser video',
        s9_data_encodings: 'dataEncodings',
        s10_html5player: 'html5player',
        s11_flowplayer: 'flowplayer',
        s12_kvs: 'KVS video_url',
        s13_data_config: 'data-config',
        s14_videojs: 'video.js',
        s15_plyr: 'Plyr',
        s16_jw: 'JW Player',
        s17_flashvars: 'flashvars',
      };

      for (var key in ACTIVE_STRATEGIES) {
        if (!ACTIVE_STRATEGIES[key]) {
          results[key] = { active: false, found: 0, note: 'Отключена' };
          dbg('WARNING', 'S' + key.replace('s', '') + ' ' + (strategyNames[key] || key) + ': ОТКЛЮЧЕНА', 'QUALITY', 'ADVANCED');
          continue;
        }

        dbg('ADVANCED', 'Тестируем S' + key.replace('s', '') + ': ' + (strategyNames[key] || key), 'QUALITY', 'ADVANCED');

        var t0 = Date.now();
        var beforeKeys = Object.keys({}).length;
        var found = 0;

        // Симулируем активацию стратегии
        try {
          switch (key) {
            case 's1_rules':
              for (var r = 0; r < VIDEO_RULES.length; r++) {
                if (html.match(VIDEO_RULES[r].re)) found++;
              }
              break;
            case 's2_direct_mp4':
              found = (html.match(/\.mp4/gi) || []).length;
              break;
            case 's3_og_video':
              found = (html.match(/og:video/gi) || []).length;
              break;
            case 's4_hls':
              found = (html.match(/\.m3u8/gi) || []).length;
              break;
            case 's5_get_file':
              found = (html.match(/\/get_file\//gi) || []).length;
              break;
            case 's6_source_size':
              found = (html.match(/<source[^>]+size=/gi) || []).length;
              break;
            case 's7_source_label':
              found = (html.match(/<source[^>]+(?:title|label)=/gi) || []).length;
              break;
            case 's8_domparser':
              found = (html.match(/<video[^>]*>/gi) || []).length;
              break;
            case 's9_data_encodings':
              found = (html.match(/dataEncodings/gi) || []).length;
              break;
            case 's10_html5player':
              found = (html.match(/html5player\./gi) || []).length;
              break;
            case 's11_flowplayer':
              found = (html.match(/flowplayer/gi) || []).length;
              break;
            case 's12_kvs':
              found = (html.match(/video_url/gi) || []).length;
              break;
            case 's13_data_config':
              found = (html.match(/data-(?:config|video|sources|player)=/gi) || []).length;
              break;
            case 's14_videojs':
              found = (html.match(/data-setup=/gi) || []).length;
              break;
            case 's15_plyr':
              found = (html.match(/Plyr/gi) || []).length;
              break;
            case 's16_jw':
              found = (html.match(/jwplayer/gi) || []).length;
              break;
            case 's17_flashvars':
              found = (html.match(/flashvars/gi) || []).length;
              break;
          }
        } catch (e) {
          dbg('ERROR', 'Ошибка тестирования S' + key + ': ' + e.message, 'QUALITY', 'ADVANCED');
        }

        var elapsed = Date.now() - t0;
        results[key] = { active: true, found: found, elapsed: elapsed };

        if (found > 0) {
          dbg('SUCCESS', 'S' + key.replace('s', '') + ' найдено паттернов: ' + found + ' (' + elapsed + 'мс)', 'QUALITY', 'ADVANCED');
        } else {
          dbg('WARNING', 'S' + key.replace('s', '') + ' паттернов НЕ найдено', 'QUALITY', 'ADVANCED');
        }
      }

      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');
      dbg('ADVANCED', '████ STRATEGIES TEST COMPLETE ████', 'SYSTEM', 'ADVANCED');
      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');

      if (callback) callback(results);
      return results;
    },

    // 1.4.2 Анализ DOM-структуры
    analyzeDOM: function (html) {
      if (!TV_CONFIG.DEBUG_ADVANCED) {
        dbg('WARNING', 'ADVANCED DEBUG отключён', 'SYSTEM', 'ADVANCED');
        return;
      }

      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');
      dbg('ADVANCED', '████ ADVANCED DEBUG: DOM Analysis ████', 'SYSTEM', 'ADVANCED');
      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');

      try {
        var doc = new DOMParser().parseFromString(html, 'text/html');

        // Ищем альтернативные контейнеры карточек
        var selectors = ['.thumb', '.item', '.thumb-item', '.video-block', '.thumb_main', 'a[href*="/video/"]', 'a[href*="/videos/"]'];
        var found = {};

        for (var i = 0; i < selectors.length; i++) {
          var sel = selectors[i];
          var els = doc.querySelectorAll(sel);
          found[sel] = els.length;
          if (els.length > 0) {
            dbg('SUCCESS', 'Селектор "' + sel + '": ' + els.length + ' элементов', 'PARSER', 'ADVANCED');
          }
        }

        // Анализируем структуру первой карточки
        var firstCard = doc.querySelector(CARD.container) || doc.querySelector('a[href*="/video/"]');
        if (firstCard) {
          dbg('INFO', 'Структура первой карточки:', 'PARSER', 'ADVANCED');

          var possibleLinks = firstCard.querySelectorAll('a[href]');
          if (possibleLinks.length) {
            dbg('INFO', '  Ссылки внутри: ' + possibleLinks.length, 'PARSER', 'ADVANCED');
          }

          var possibleImages = firstCard.querySelectorAll('img');
          if (possibleImages.length) {
            var img = possibleImages[0];
            var attrs = ['src', 'data-src', 'data-original', 'data-lazy-src'];
            for (var j = 0; j < attrs.length; j++) {
              var val = img.getAttribute(attrs[j]);
              if (val) {
                dbg('INFO', '  Изображение [' + attrs[j] + ']: ' + trunc(val, 60), 'PARSER', 'ADVANCED');
                break;
              }
            }
          }

          var possibleTitles = firstCard.querySelectorAll('[class*="title"], a[title]');
          if (possibleTitles.length) {
            dbg('INFO', '  Заголовок: ' + trunc(possibleTitles[0].textContent, 60), 'PARSER', 'ADVANCED');
          }
        }

        // Ищем video элементы
        var videos = doc.querySelectorAll('video');
        dbg('INFO', 'Тегов <video>: ' + videos.length, 'QUALITY', 'ADVANCED');

        for (var v = 0; v < videos.length; v++) {
          var vid = videos[v];
          var sources = vid.querySelectorAll('source');
          dbg('INFO', '  source внутри video[' + v + ']: ' + sources.length, 'QUALITY', 'ADVANCED');
        }

      } catch (e) {
        dbg('ERROR', 'DOM-анализ не удался: ' + e.message, 'PARSER', 'ADVANCED');
      }

      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');
      dbg('ADVANCED', '████ DOM ANALYSIS COMPLETE ███████', 'SYSTEM', 'ADVANCED');
      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');
    },

    // 1.4.3 Тестирование построения URL
    testUrlBuilder: function () {
      if (!TV_CONFIG.DEBUG_ADVANCED) {
        dbg('WARNING', 'ADVANCED DEBUG отключён', 'SYSTEM', 'ADVANCED');
        return;
      }

      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');
      dbg('ADVANCED', '████ ADVANCED DEBUG: URL Builder █████', 'SYSTEM', 'ADVANCED');
      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');

      var tests = [
        { type: 'main', page: 1 },
        { type: 'main', page: 2 },
        { type: 'search', value: 'test query', page: 1 },
        { type: 'search', value: 'test', page: 3 },
        { type: 'cat', value: 'amateur', page: 1 },
        { type: 'cat', value: 'anal', page: 5 },
      ];

      for (var i = 0; i < tests.length; i++) {
        var t = tests[i];
        var url = buildUrl(t.type, t.value, t.page);
        var valid = url.indexOf(HOST) === 0;

        if (valid) {
          dbg('SUCCESS', 'buildUrl(' + t.type + ', "' + t.value + '", ' + t.page + ')', 'PARSER', 'ADVANCED');
          dbg('INFO', '  → ' + trunc(url, 80), 'PARSER', 'ADVANCED');
        } else {
          dbg('ERROR', 'buildUrl(' + t.type + ') вернул некорректный URL: ' + url, 'PARSER', 'ADVANCED');
        }
      }

      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');
      dbg('ADVANCED', '████ URL BUILDER TEST COMPLETE ████', 'SYSTEM', 'ADVANCED');
      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');
    },

    // 1.4.4 Отчёт об использовании памяти
    memoryReport: function () {
      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');
      dbg('ADVANCED', '████ ADVANCED DEBUG: Memory Report ████', 'SYSTEM', 'ADVANCED');
      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');

      dbg('INFO', 'LOG_BUFFER: ' + LOG_BUFFER.length + ' / ' + TV_CONFIG.LOG_MAX + ' записей', 'MEMORY', 'ADVANCED');
      dbg('INFO', 'SHARED_DOMPARSER: ' + (SHARED_DOMPARSER ? 'активен' : 'не создан'), 'MEMORY', 'ADVANCED');
      dbg('INFO', 'TV_CONFIG.DOMPARSER_REUSE: ' + TV_CONFIG.DOMPARSER_REUSE, 'MEMORY', 'ADVANCED');
      dbg('INFO', 'TV_CONFIG.MEMORY_CLEANUP_INTERVAL: ' + TV_CONFIG.MEMORY_CLEANUP_INTERVAL, 'MEMORY', 'ADVANCED');

      // Подсчёт активных стратегий
      var activeCount = 0;
      for (var k in ACTIVE_STRATEGIES) {
        if (ACTIVE_STRATEGIES[k]) activeCount++;
      }
      dbg('INFO', 'Активных стратегий: ' + activeCount + ' / 17', 'QUALITY', 'ADVANCED');

      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');
      dbg('ADVANCED', '████ MEMORY REPORT COMPLETE ████████', 'SYSTEM', 'ADVANCED');
      dbg('INFO', repeat('═', 50), 'SYSTEM', 'ADVANCED');
    },

    // 1.4.5 Запуск всех продвинутых проверок
    runAll: function (html, callback) {
      if (!TV_CONFIG.DEBUG_ADVANCED) {
        dbg('WARNING', 'Включите TV_CONFIG.DEBUG_ADVANCED = true для запуска ADVANCED DEBUG', 'SYSTEM', 'ADVANCED');
        return;
      }

      dbg('ADVANCED', repeat('█', 50), 'SYSTEM', 'ADVANCED');
      dbg('ADVANCED', '████ ADVANCED DEBUG SUITE v' + TEMPLATE_VERSION + ' ███', 'SYSTEM', 'ADVANCED');
      dbg('ADVANCED', repeat('█', 50), 'SYSTEM', 'ADVANCED');

      this.testStrategies(html, function (strategyResults) {
        if (callback) callback({ strategies: strategyResults });
      });
      this.analyzeDOM(html);
      this.testUrlBuilder();
      this.memoryReport();
    },
  };

  // ------------------------------------------------------------
  // 1.5 Вспомогательные функции отладки
  // ------------------------------------------------------------

  function debugScan(html, url) {
    if (!TV_CONFIG.DEBUG_MODE) return;
    var patterns = [
      'source_tag', 'mp4', 'm3u8', 'video_url', 'get_file',
      'kt_player', 'function/0', 'flowplayer', 'html5player',
      'dataEncod', 'Plyr', 'jwplayer', 'flashvars', 'ld+json',
      'qualities', 'sources', 'playlist', 'clip',
    ];
    dbg('WARNING', '══ SCAN: ' + trunc(url, 60) + ' [' + (html ? html.length : 0) + 'b] ══', 'QUALITY', 'BASIC');
    patterns.forEach(function (p) {
      var cnt = ((html || '').match(new RegExp(p, 'gi')) || []).length;
      if (cnt > 0) dbg('INFO', pad(p, 16) + cnt + 'x  <- FOUND', 'QUALITY', 'BASIC');
    });
  }

  function getLogBuffer() {
    return LOG_BUFFER.slice();
  }

  function clearLogBuffer() {
    LOG_BUFFER = [];
    dbg('INFO', 'LOG_BUFFER очищен', 'SYSTEM', 'BASIC');
  }

  // Глобальные переключатели для удобства
  function enableAdvancedDebug() {
    TV_CONFIG.DEBUG_ADVANCED = true;
    dbg('SUCCESS', 'ADVANCED DEBUG включён', 'SYSTEM', 'BASIC');
  }

  function disableAdvancedDebug() {
    TV_CONFIG.DEBUG_ADVANCED = false;
    dbg('INFO', 'ADVANCED DEBUG выключен', 'SYSTEM', 'BASIC');
  }

  // API для управления отладкой
  var DebugAPI = {
    basic: BASIC_DEBUG,
    advanced: ADVANCED_DEBUG,
    scan: debugScan,
    logs: getLogBuffer,
    clear: clearLogBuffer,
    enableAdvanced: enableAdvancedDebug,
    disableAdvanced: disableAdvancedDebug,
  };

  // ============================================================
  // §2. ИДЕНТИФИКАТОР ПАРСЕРА
  // ============================================================

  var HOST      = 'https://example.com';
  var VERSION   = '1.0.0';
  var DEVELOPER = 'Unknown';
  var CREATED   = 'YYYY-MM-DD';

  NAME = (function (host) {
    var d = host.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    d = d.replace(/\.(com|net|org|xxx|me|ru|club|top|win|adult|porn|tv|site|online)\s*$/i, '');
    return d.length <= 5 ? d : d.substring(0, 5);
  })(HOST);

  TAG = '[' + NAME + ']';

  // ============================================================
  // §3. КОНФИГ САЙТА — ЗАПОЛНИТЬ ИЗ JSON-АНАЛИЗА
  // ============================================================

  var CARDS_PER_PAGE = 24;

  var CARD = {
    container: '.thumb',
    link:      'a[href*="/video/"]',
    title:     '[class*="title"]',
    thumb:     'img',
    thumbAttr: 'src',
    duration:  '[class*="dur"]',
  };

  var BUILD_URL = {
    main:       '/',
    search:     '/?q={query}',
    category:   '/?c={slug}',
    sort:       '/?sort={value}',
    pagination: '&page={N}',
  };

  var CATEGORIES = [];
  var CHANNELS   = [];

  var COOKIE_CONFIG = {
    useDefaults: true,
    custom:      '',
    forwardClient: true,
  };

  // ACTIVE_STRATEGIES — БРИТВА ОККАМА
  var ACTIVE_STRATEGIES = {
    s1_rules:          false,
    s2_direct_mp4:     false,
    s3_og_video:       false,
    s4_hls:            false,
    s5_get_file:       false,
    s6_source_size:    false,
    s7_source_label:  false,
    s8_domparser:     false,
    s9_data_encodings: false,
    s10_html5player:  false,
    s11_flowplayer:   false,
    s12_kvs:          false,
    s13_data_config:  false,
    s14_videojs:      false,
    s15_plyr:         false,
    s16_jw:           false,
    s17_flashvars:    false,
  };

  var VIDEO_RULES = [
    { label: '720p', re: /video_alt_url2\s*[:=]\s*['"]([^'"]+)['"]/  },
    { label: '480p', re: /video_alt_url\s*[:=]\s*['"]([^'"]+)['"]/   },
    { label: '240p', re: /video_url\s*[:=]\s*['"]([^'"]+)['"]/       },
    { label: '720p', re: /html5player\.setVideoUrlHigh\(['"]([^'"]+)['"]\)/ },
    { label: '480p', re: /html5player\.setVideoUrlLow\(['"]([^'"]+)['"]\)/  },
    { label: 'HLS',  re: /html5player\.setVideoHlsUrl\(['"]([^'"]+)['"]\)/  },
  ];

  // ============================================================
  // §4. ВАЛИДАЦИЯ КОНФИГУРАЦИИ (JSON Schema)
  // ============================================================

  var VALIDATION_RULES = {
    HOST: {
      required: true,
      type: 'string',
      pattern: /^https?:\/\/[^\/]+\/?$/,
      error: 'HOST должен быть абсолютным URL без пути',
    },
    NAME: {
      required: true,
      type: 'string',
      pattern: /^[a-zA-Z0-9]{5}$/,
      error: 'NAME должен быть ровно 5 букв/цифр',
    },
    CARD: {
      required: true,
      type: 'object',
      fields: {
        container: { required: true, type: 'string', minLength: 1 },
        link:      { type: 'string' },
        title:     { type: 'string' },
        thumb:     { type: 'string' },
        thumbAttr: { type: 'string', enum: ['src', 'data-src', 'data-original', 'data-lazy-src'] },
        duration:  { type: 'string' },
      },
    },
    BUILD_URL: {
      required: true,
      type: 'object',
      fields: {
        main:       { required: true, type: 'string' },
        search:     { required: true, type: 'string', contains: '{query}' },
        category:   { type: 'string', contains: '{slug}' },
        pagination: { type: 'string', contains: '{N}' },
      },
    },
    ACTIVE_STRATEGIES: {
      required: true,
      type: 'object',
      fields: {
        s1_rules:          { type: 'boolean' },
        s2_direct_mp4:     { type: 'boolean' },
        s3_og_video:       { type: 'boolean' },
        s4_hls:            { type: 'boolean' },
        s5_get_file:       { type: 'boolean' },
        s6_source_size:    { type: 'boolean' },
        s7_source_label:  { type: 'boolean' },
        s8_domparser:      { type: 'boolean' },
        s9_data_encodings: { type: 'boolean' },
        s10_html5player:   { type: 'boolean' },
        s11_flowplayer:    { type: 'boolean' },
        s12_kvs:           { type: 'boolean' },
        s13_data_config:   { type: 'boolean' },
        s14_videojs:       { type: 'boolean' },
        s15_plyr:          { type: 'boolean' },
        s16_jw:            { type: 'boolean' },
        s17_flashvars:     { type: 'boolean' },
      },
    },
  };

  function validateConfig() {
    var errors = [];
    var rules = VALIDATION_RULES;

    function validateField(value, rule, path) {
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(path + ': обязательное поле');
        return false;
      }
      if (value === undefined || value === null) return true;

      if (rule.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(path + ': должен быть строкой');
          return false;
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(path + ': ' + rule.error);
          return false;
        }
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(path + ': слишком короткий');
          return false;
        }
        if (rule.enum && rule.enum.indexOf(value) === -1) {
          errors.push(path + ': недопустимое значение');
          return false;
        }
        if (rule.contains && value.indexOf(rule.contains) === -1) {
          errors.push(path + ': должен содержать ' + rule.contains);
          return false;
        }
      }

      if (rule.type === 'object') {
        if (typeof value !== 'object') {
          errors.push(path + ': должен быть объектом');
          return false;
        }
        if (rule.fields) {
          for (var f in rule.fields) {
            validateField(value[f], rule.fields[f], path + '.' + f);
          }
        }
      }

      if (rule.type === 'boolean') {
        if (typeof value !== 'boolean') {
          errors.push(path + ': должен быть boolean');
          return false;
        }
      }

      return true;
    }

    for (var key in rules) {
      validateField(key === 'HOST' ? HOST : key === 'NAME' ? NAME :
                   key === 'CARD' ? CARD : key === 'BUILD_URL' ? BUILD_URL :
                   key === 'ACTIVE_STRATEGIES' ? ACTIVE_STRATEGIES : undefined,
                   rules[key], key);
    }

    if (errors.length > 0) {
      errors.forEach(function (e) { dbg('ERROR', e, 'CONFIG', 'BASIC'); });
      return false;
    }

    dbg('SUCCESS', 'Валидация конфигурации пройдена', 'CONFIG', 'BASIC');
    return true;
  }

  // ============================================================
  // §5. ТРАНСПОРТ — Всегда использует AdultPlugin
  // ============================================================

  function httpGet(url, success, error) {
    dbg('INFO', 'GET -> ' + trunc(url), 'NETWORK', 'BASIC');

    if (window.AdultPlugin && typeof window.AdultPlugin.networkRequest === 'function') {
      window.AdultPlugin.networkRequest(
        url,
        function (html) {
          dbg('SUCCESS', 'Получено ' + (html ? html.length : 0) + ' байт', 'NETWORK', 'BASIC');
          success(html);
        },
        function (err) {
          dbg('ERROR', 'AdultPlugin.networkRequest failed: ' + err, 'NETWORK', 'BASIC');
          error(err);
        }
      );
    } else {
      if (typeof Lampa !== 'undefined' && Lampa.Network && Lampa.Network.native) {
        var workerUrl = window.AdultPlugin && window.AdultPlugin.workerUrl || '';
        var fullUrl = workerUrl + encodeURIComponent(url);
        dbg('WARNING', 'Fallback: Lampa.Network.native', 'NETWORK', 'BASIC');
        Lampa.Network.native(fullUrl, function (result) {
          var text = typeof result === 'string' ? result : JSON.stringify(result);
          success(text);
        }, function (e) {
          dbg('ERROR', 'Lampa.Network.native failed: ' + e, 'NETWORK', 'BASIC');
          error(e);
        }, false, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      } else if (typeof fetch !== 'undefined') {
        dbg('WARNING', 'Fallback: native fetch (без проксирования)', 'NETWORK', 'BASIC');
        fetch(url)
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
          .then(success)
          .catch(function (e) { dbg('ERROR', 'fetch: ' + e.message, 'NETWORK', 'BASIC'); error(e); });
      } else {
        dbg('ERROR', 'no_network_available', 'NETWORK', 'BASIC');
        error('no_network_available');
      }
    }
  }

  // ============================================================
  // §6. УТИЛИТЫ — Оптимизированные для Android TV
  // ============================================================

  var SHARED_DOMPARSER = null;

  function getDOMParser() {
    if (TV_CONFIG.DOMPARSER_REUSE) {
      if (!SHARED_DOMPARSER) {
        SHARED_DOMPARSER = new DOMParser();
        dbg('INFO', 'Создан SHARED_DOMPARSER', 'MEMORY', 'BASIC');
      }
      return SHARED_DOMPARSER;
    }
    return new DOMParser();
  }

  function cleanUrl(raw) {
    if (!raw) return '';
    try {
      var u = raw.replace(/\\/g, '').trim();

      var absM = u.match(/^https?:\/\/[^/]+\/function\/\d+\/(https?:\/\/.+)$/);
      if (absM) return absM[1];
      var relM = u.match(/^\/?function\/\d+\/(https?:\/\/.+)$/);
      if (relM) return relM[1];

      if (u.indexOf('%') !== -1) {
        try { u = decodeURIComponent(u); } catch (e) {}
        if (u.indexOf('%') !== -1) {
          try { u = decodeURIComponent(u); } catch (e2) {} }
      }

      if (u.indexOf('/') === -1 && u.length > 20 && /^[a-zA-Z0-9+/]+=*$/.test(u)) {
        try { var d = atob(u); if (d.indexOf('http') === 0) u = d; } catch (e) {} }

      if (u.indexOf('//') === 0) u = 'https:' + u;
      if (u.charAt(0) === '/' && u.charAt(1) !== '/') u = HOST + u;
      if (u.length > 0 && u.indexOf('http') !== 0 && u.charAt(0) !== '/') {
        u = HOST + '/' + u;
      }

      return u;
    } catch (e) { return raw; }
  }

  function cleanMp4(url) {
    return url.replace(/[?&](?:rnd|br|_)=\d+/g, '').replace(/[?&]+$/, '');
  }

  function labelFromUrl(defaultLabel, url) {
    if (!url) return defaultLabel;
    var m = url.match(/_(\d{3,4}p)(?:\.mp4|\/)/i);
    return m ? m[1] : defaultLabel;
  }

  function slugToTitle(url) {
    if (!url) return '';
    var parts = url.replace(/\?.*/, '').replace(/\/+$/, '').split('/').filter(Boolean);
    var slug = parts[parts.length - 1] || '';
    if (/^\d+$/.test(slug) && parts.length > 1) slug = parts[parts.length - 2] || '';

    return slug
      .replace(/[-_]+/g, ' ')
      .replace(/([a-zA-Zа-яА-ЯёЁ\u4e00-\u9fff])(\w)/gi, function (m, first, rest) {
        return first.toUpperCase() + rest.toLowerCase();
      })
      .replace(/\b\w/g, function (l) { return l.toUpperCase(); })
      .trim();
  }

  function getPicture(imgEl) {
    if (!imgEl) return '';
    var pic = cleanUrl(
      imgEl.getAttribute('data-original') ||
      imgEl.getAttribute('data-src')      ||
      imgEl.getAttribute('data-lazy-src') ||
      imgEl.getAttribute('src')           || ''
    );
    if (pic && (
      pic.indexOf('spacer') !== -1 ||
      pic.indexOf('blank') !== -1   ||
      pic.indexOf('data:') === 0    ||
      pic.length < 10
    )) return '';
    return pic;
  }

  function normLabel(lbl) {
    if (!lbl) return 'HD';
    lbl = String(lbl).trim();
    if (/^\d+$/.test(lbl)) lbl = lbl + 'p';
    return lbl;
  }

  // ============================================================
  // §7. ПАРСИНГ КАРТОЧЕК — Оптимизированный для TV
  // ============================================================

  function makeCard(name, href, pic, time) {
    return {
      name: name, video: href, picture: pic, img: pic, poster: pic,
      background_image: pic, preview: null, time: time || '',
      quality: 'HD', json: true, source: NAME,
    };
  }

  function parsePlaylist(html) {
    var results = [], seen = {};
    var cardsProcessed = 0;
    var t0 = Date.now();

    try {
      var doc = getDOMParser().parseFromString(html, 'text/html');
      var items = doc.querySelectorAll(CARD.container);

      if (!items || !items.length) {
        dbg('WARNING', 'Контейнер ' + CARD.container + ' пуст, fallback', 'PARSER', 'BASIC');
        items = doc.querySelectorAll('a[href*="/video/"]');
        for (var j = 0; j < items.length; j++) {
          var a = items[j];
          var href = a.getAttribute('href') || '';
          if (!href || href === '#' || seen[href]) continue;
          if (href.indexOf('http') !== 0) href = HOST + (href.charAt(0) === '/' ? '' : '/') + href;
          seen[href] = true;
          var name = (a.getAttribute('title') || a.textContent || '').replace(/\s+/g, ' ').trim();
          if (!name) name = slugToTitle(href);
          if (name) results.push(makeCard(name, href, getPicture(a.querySelector('img')), ''));

          cardsProcessed++;
          if (cardsProcessed >= TV_CONFIG.MEMORY_CLEANUP_INTERVAL) {
            seen = {};
            cardsProcessed = 0;
          }
        }
        items = null;
        dbg('INFO', 'Fallback: ' + results.length + ' карточек (' + (Date.now() - t0) + 'мс)', 'PARSER', 'BASIC');
        return results;
      }

      for (var i = 0; i < items.length; i++) {
        var el = items[i];
        var linkEl = el.querySelector(CARD.link) || el.querySelector('a[href]');
        if (!linkEl) continue;

        var href = linkEl.getAttribute('href') || '';
        if (!href || href === '#' || href.indexOf('javascript') === 0) continue;
        if (href.indexOf('http') !== 0) href = HOST + (href.charAt(0) === '/' ? '' : '/') + href;
        if (seen[href]) continue;
        seen[href] = true;

        var name = (linkEl.getAttribute('title') || '').trim();
        if (!name && CARD.title) {
          var tEl = el.querySelector(CARD.title);
          if (tEl) name = tEl.textContent.replace(/\s+/g, ' ').trim();
        }
        if (!name) name = slugToTitle(href);
        if (!name) continue;

        var pic = getPicture(el.querySelector(CARD.thumb));
        var durEl = CARD.duration ? el.querySelector(CARD.duration) : null;
        var time = durEl ? durEl.textContent.replace(/[^\d:]/g, '').trim() : '';

        results.push(makeCard(name, href, pic, time));

        cardsProcessed++;
        if (cardsProcessed >= TV_CONFIG.MEMORY_CLEANUP_INTERVAL) {
          seen = {};
          cardsProcessed = 0;
        }

        if (i % 10 === 0) el = null;
      }

      items = null;
      doc = null;

      dbg('SUCCESS', 'Карточек: ' + results.length + ' (' + (Date.now() - t0) + 'мс)', 'PARSER', 'BASIC');

    } catch (e) {
      dbg('ERROR', 'parsePlaylist: ' + e.message, 'PARSER', 'BASIC');
    }

    return results;
  }

  // ============================================================
  // §8. EXTRACT QUALITIES — ВСЕ 17 СТРАТЕГИЙ
  // ============================================================

  function extractQualities(html) {
    var q = {};
    var roadmap = [];
    var have = function () { return Object.keys(q).length > 0; };
    var add = function (label, url) {
      var u = cleanUrl(url);
      if (!u || u.indexOf('http') !== 0 || u.indexOf('{') !== -1) return;
      var lbl = normLabel(label);
      if (u.indexOf('.mp4') !== -1) u = cleanMp4(u);
      if (!q[lbl]) q[lbl] = u;
    };
    var mark = function (sNum, name, found) {
      roadmap.push({ s: sNum, name: name, found: found });
    };

    if (ACTIVE_STRATEGIES.s1_rules) {
      var s1n = 0;
      VIDEO_RULES.forEach(function (rule) {
        var m = html.match(rule.re);
        if (m && m[1]) { add(rule.label, m[1]); s1n++; }
      });
      mark(1, 'VIDEO_RULES', s1n > 0);
    }

    if (ACTIVE_STRATEGIES.s2_direct_mp4 && !have()) {
      var allMp4 = html.match(/https?:\/\/[^"'\s<>]+\.mp4[^"'\s<>]*/gi) || [];
      var s2n = 0;
      allMp4.forEach(function (u) {
        if (u.indexOf('{') !== -1 || u.indexOf('preview') !== -1) return;
        var ql = u.match(/_(\d{3,4}p)\.mp4/i);
        add(ql ? ql[1] : ('HD' + s2n), u);
        s2n++;
      });
      mark(2, 'direct_mp4', s2n > 0);
    }

    if (ACTIVE_STRATEGIES.s3_og_video && !have()) {
      var ogTags = html.match(/<meta[^>]+(?:property="og:video"[^>]+content|content[^>]+property="og:video")[^>]+>/gi) || [];
      var s3n = 0;
      ogTags.forEach(function (tag) {
        var cm = tag.match(/content="([^"]+)"/i);
        if (!cm) return;
        var u = cleanUrl(cm[1]);
        if (u && u.indexOf('/embed/') === -1) { add('HD', u); s3n++; }
      });
      mark(3, 'og:video', s3n > 0);
    }

    if (ACTIVE_STRATEGIES.s4_hls && !have()) {
      var mHls = html.match(/['"]?(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*?)['"]?/i);
      if (mHls) add('HLS', mHls[1]);
      mark(4, 'HLS m3u8', have());
    }

    if (ACTIVE_STRATEGIES.s5_get_file && !have()) {
      var gfRe = /(https?:\/\/[^"'\s]+\/get_file\/[^"'\s]+\.mp4[^"'\s]*)/g;
      var gf, s5n = 0;
      while ((gf = gfRe.exec(html)) !== null && s5n < 5) {
        if (gf[1].indexOf('preview') !== -1) continue;
        var qm = gf[1].match(/_(\d{3,4}p)\.mp4/);
        add(qm ? qm[1] : ('auto' + s5n), gf[1]);
        s5n++;
      }
      mark(5, 'get_file', s5n > 0);
    }

    if (ACTIVE_STRATEGIES.s6_source_size && !have()) {
      var reA = /<source[^>]+src="([^"]+)"[^>]+size="([^"]+)"/gi;
      var m, s6n = 0;
      while ((m = reA.exec(html)) !== null) {
        if (m[1].indexOf('.mp4') !== -1) { add(m[2] + 'p', m[1]); s6n++; }
      }
      mark(6, 'source_size', s6n > 0);
    }

    if (ACTIVE_STRATEGIES.s7_source_label && !have()) {
      var reB = /<source[^>]+src="([^"]+)"[^>]+(?:title|label)="([^"]+)"/gi;
      var m, s7n = 0;
      while ((m = reB.exec(html)) !== null) {
        if (m[1].indexOf('.mp4') !== -1 || m[1].indexOf('.m3u8') !== -1) { add(normLabel(m[2]), m[1]); s7n++; }
      }
      mark(7, 'source_label', s7n > 0);
    }

    if (ACTIVE_STRATEGIES.s8_domparser && !have()) {
      try {
        var doc8 = getDOMParser().parseFromString(html, 'text/html');
        var srcs = doc8.querySelectorAll('video source[src]');
        var s8n = 0;
        for (var si = 0; si < srcs.length; si++) {
          var src = srcs[si].getAttribute('src') || '';
          if (!src || src.indexOf('blob:') === 0) continue;
          var lbl8 = srcs[si].getAttribute('title') || srcs[si].getAttribute('label') ||
                     srcs[si].getAttribute('size') || 'auto';
          add(normLabel(lbl8), src);
          s8n++;
        }
        doc8 = null;
        mark(8, 'DOMParser', s8n > 0);
      } catch (e) { dbg('WARNING', 'S8: ' + e.message, 'QUALITY', 'BASIC'); mark(8, 'DOMParser', false); }
    }

    if (ACTIVE_STRATEGIES.s9_data_encodings && !have()) {
      try {
        var idx = html.indexOf('dataEncodings');
        if (idx !== -1) {
          var aStart = html.indexOf('[', idx), depth = 0, aEnd = -1;
          for (var ci = aStart; ci < html.length; ci++) {
            if (html[ci] === '[') depth++;
            else if (html[ci] === ']') { depth--; if (!depth) { aEnd = ci; break; } }
          }
          if (aEnd !== -1) {
            var enc = JSON.parse(html.substring(aStart, aEnd + 1));
            var s9n = 0;
            enc.forEach(function (e) {
              if (!e.filename) return;
              var k = String(e.quality).toLowerCase() === 'auto' ? 'auto' : normLabel(e.quality);
              add(k, e.filename.replace(/\\\//g, '/'));
              s9n++;
            });
            mark(9, 'dataEncodings', s9n > 0);
          }
        }
      } catch (e) { dbg('WARNING', 'S9: ' + e.message, 'QUALITY', 'BASIC'); mark(9, 'dataEncodings', false); }
    }

    if (ACTIVE_STRATEGIES.s10_html5player && !have()) {
      var mH = html.match(/html5player\.setVideoUrlHigh\(['"]([^'"]+)['"]\)/);
      var mL = html.match(/html5player\.setVideoUrlLow\(['"]([^'"]+)['"]\)/);
      var mM = html.match(/html5player\.setVideoHlsUrl\(['"]([^'"]+)['"]\)/);
      if (mH) add('720p', mH[1]);
      if (mL) add('480p', mL[1]);
      if (mM) add('HLS', mM[1]);
      mark(10, 'html5player', !!(mH || mL || mM));
    }

    if (ACTIVE_STRATEGIES.s11_flowplayer && !have()) {
      var s11found = false;
      try {
        var fp = html.match(/playlist\s*:\s*\[(\{[\s\S]+?\})\]/i);
        if (fp) {
          JSON.parse('[' + fp[1] + ']').forEach(function (clip) {
            (clip.sources || []).forEach(function (s) {
              var u = cleanUrl(s.src || s.file || s.url || '');
              if (u && u.indexOf('http') === 0) {
                var l = normLabel(s.label || s.quality || 'HD');
                if (!q[l]) { q[l] = u; s11found = true; }
              }
            });
            if (!have() && clip.url) {
              var u = cleanUrl(clip.url);
              if (u) { q['HD'] = u; s11found = true; }
            }
          });
        }
        if (!have()) {
          var cm11 = html.match(/clip\s*:\s*\{[^}]*url\s*:\s*['"]([^'"]+)['"]/i);
          if (cm11) { var u11 = cleanUrl(cm11[1]); if (u11) { q['HD'] = u11; s11found = true; } }
        }
      } catch (e) { dbg('WARNING', 'S11: ' + e.message, 'QUALITY', 'BASIC'); }
      mark(11, 'flowplayer', s11found);
    }

    if (ACTIVE_STRATEGIES.s12_kvs && !have()) {
      try {
        var kvsPrimary = [
          /video_url\s*[:=]\s*['"]([^'"]+)['"]/i,
          /video_url_text\s*[:=]\s*['"]([^'"]+)['"]/i,
          /"video_url"\s*:\s*"([^"]+)"/i,
        ];
        var s12n = 0;
        kvsPrimary.forEach(function (re) {
          if (have()) return;
          var pm = html.match(re);
          if (pm && pm[1]) { add('HD', pm[1]); s12n++; }
        });
        var resRe = /video_url_(\w+)\s*[:=]\s*['"]([^'"]+)['"]/gi;
        var rm12;
        while ((rm12 = resRe.exec(html)) !== null) {
          var u12 = cleanUrl(rm12[2]);
          if (u12 && u12.indexOf('http') === 0 && !q[rm12[1]]) { q[normLabel(rm12[1])] = u12; s12n++; }
        }
        mark(12, 'KVS video_url*', s12n > 0);
      } catch (e) { dbg('WARNING', 'S12: ' + e.message, 'QUALITY', 'BASIC'); mark(12, 'KVS video_url*', false); }
    }

    if (ACTIVE_STRATEGIES.s13_data_config && !have()) {
      var dCfg = html.match(/data-(?:config|video|sources|player)=['"]([^"']+)['"]/gi) || [];
      var s13n = 0;
      dCfg.forEach(function (cfg) {
        var mm = cfg.match(/['"]([^"']+)['"]/);
        if (mm && mm[1] && /https?:\/\/.+\.(mp4|m3u8|webm)/i.test(mm[1])) {
          add('auto', cleanUrl(mm[1]));
          s13n++;
        }
      });
      mark(13, 'data-config', s13n > 0);
    }

    if (ACTIVE_STRATEGIES.s14_videojs && !have()) {
      var vs = html.match(/data-setup=['"]([^"']+)['"]/i);
      var s14found = false;
      if (vs) {
        try {
          var cfg14 = JSON.parse(vs[1].replace(/'/g, '"'));
          (cfg14.sources || []).forEach(function (s) { add('auto', s.src); s14found = true; });
        } catch (e) { dbg('WARNING', 'S14: ' + e.message, 'QUALITY', 'BASIC'); }
      }
      mark(14, 'video.js', s14found);
    }

    if (ACTIVE_STRATEGIES.s15_plyr && !have()) {
      var plyrM = html.match(/(?:new\s+Plyr|Plyr\.setup)\s*\([^,]+,\s*(\{[\s\S]+?\})\s*\)/i);
      var s15n = 0;
      if (plyrM) {
        try {
          var pCfg = JSON.parse(plyrM[1].replace(/\\\//g, '/'));
          (pCfg.sources || []).forEach(function (s) {
            add(normLabel(s.label || 'auto'), typeof s === 'string' ? s : s.src);
            s15n++;
          });
        } catch (e) { dbg('WARNING', 'S15: ' + e.message, 'QUALITY', 'BASIC'); }
      }
      mark(15, 'Plyr', s15n > 0);
    }

    if (ACTIVE_STRATEGIES.s16_jw && !have()) {
      var jwM = html.match(/jwplayer\s*\([^)]*\)\s*\.\s*setup\s*\(\s*(\{[\s\S]+?\})\s*\)/i);
      var s16n = 0;
      if (jwM) {
        try {
          var jCfg = JSON.parse(jwM[1].replace(/\\\//g, '/'));
          (jCfg.sources || []).forEach(function (s) {
            if (s.file) { add(normLabel(s.label || 'auto'), s.file); s16n++; }
          });
        } catch (e) { dbg('WARNING', 'S16: ' + e.message, 'QUALITY', 'BASIC'); }
      }
      mark(16, 'JW Player', s16n > 0);
    }

    if (ACTIVE_STRATEGIES.s17_flashvars && !have()) {
      var fvM = html.match(/flashvars\s*[:=]\s*\{([^}]+)\}/gi) || [];
      var s17n = 0;
      fvM.forEach(function (fv) {
        var vu = fv.match(/(?:video_url|file|src)\s*[:=]\s*['"]([^'"]+)['"]/i);
        if (vu && vu[1]) { add('HD', cleanUrl(vu[1])); s17n++; }
      });
      if (!have()) {
        var emb = html.match(/<embed[^>]+src="([^"]+\.(?:mp4|flv)[^"]*)"[^>]*>/gi) || [];
        emb.forEach(function (e) {
          var em = e.match(/src="([^"]+)"/);
          if (em) { add('auto', cleanUrl(em[1])); s17n++; }
        });
      }
      mark(17, 'flashvars', s17n > 0);
    }

    // Roadmap
    if (TV_CONFIG.DEBUG_MODE && roadmap.length) {
      console.log(repeat('=', 50));
      dbg('INFO', '══ ROADMAP (' + NAME + ') ══', 'QUALITY', 'BASIC');
      roadmap.forEach(function (r) {
        var status = r.found ? '[OK]' : '[--]';
        dbg(r.found ? 'SUCCESS' : 'WARNING', '  S' + pad(r.s, 3) + pad(r.name, 18) + status, 'QUALITY', 'BASIC');
      });
      console.log(repeat('=', 50));
    }

    return q;
  }

  // ============================================================
  // §9. BUILDERS & MENU
  // ============================================================

  function buildUrl(type, value, page) {
    page = parseInt(page, 10) || 1;
    var pSuffix = page > 1 ? BUILD_URL.pagination.replace('{N}', page).replace(/^&/, '?') : '';

    if (type === 'search') return HOST + BUILD_URL.search.replace('{query}', encodeURIComponent(value)) + pSuffix;
    if (type === 'cat')    return HOST + BUILD_URL.category.replace('{slug}', value) + pSuffix;
    if (type === 'sort')   return HOST + (BUILD_URL.sort || '/').replace('{value}', value) + pSuffix;
    if (type === 'channel') {
      if (BUILD_URL.channel) return HOST + BUILD_URL.channel.replace('{slug}', value) + pSuffix;
      return HOST + BUILD_URL.main + pSuffix;
    }
    return HOST + BUILD_URL.main + pSuffix;
  }

  function buildMenu() {
    var items = [{ title: ' Поиск', search_on: true, playlist_url: NAME + '/search/' }];
    if (CATEGORIES.length) items.push({
      title: ' Категории', playlist_url: 'submenu',
      submenu: CATEGORIES.map(function (c) { return { title: c.title,playlist_url: NAME + '/cat/' + c.slug }; })
    });
    if (CHANNELS.length) items.push({
      title: ' Каналы', playlist_url: 'submenu',
      submenu: CHANNELS.map(function (c) { return { title: c.title, playlist_url: NAME + '/channel/' + c.slug }; })
    });
    return items;
  }

  // ============================================================
  // §10. РОУТИНГ
  // ============================================================

  function routeView(url, page, success, error) {
    var sm = url.match(/[?&]search=([^&]*)/);
    if (sm) return loadPage(buildUrl('search', decodeURIComponent(sm[1]), page), page, success, error);
    if (url.indexOf(NAME + '/search/') === 0) {
      var q = decodeURIComponent(url.replace(NAME + '/search/', '').split('?')[0]).trim();
      if (q) return loadPage(buildUrl('search', q, page), page, success, error);
    }
    if (url.indexOf(NAME + '/cat/') === 0) return loadPage(buildUrl('cat', url.replace(NAME + '/cat/', '').split('?')[0], page), page, success, error);
    if (url.indexOf(NAME + '/channel/') === 0) return loadPage(buildUrl('channel', url.replace(NAME + '/channel/', '').split('?')[0], page), page, success, error);
    if (url.indexOf(NAME + '/sort/') === 0) return loadPage(buildUrl('sort', url.replace(NAME + '/sort/', '').split('?')[0], page), page, success, error);
    loadPage(buildUrl('main', null, page), page, success, error);
  }

  function loadPage(fetchUrl, page, success, error) {
    httpGet(fetchUrl, function (html) {
      var r = parsePlaylist(html);
      if (!r.length) { dbg('ERROR', 'Контент не найден', 'PARSER', 'BASIC'); error('Контент не найден'); return; }
      success({
        results: r,
        collection: true,
        total_pages: r.length >= CARDS_PER_PAGE ? page + 1 : page,
        menu: buildMenu()
      });
    }, error);
  }

  // ============================================================
  // §11. ПУБЛИЧНЫЙ API
  // ============================================================

  var MyParser = {
    main: function (p, s, e) { routeView(NAME, 1, s, e); },
    view: function (p, s, e) { routeView(p.url || NAME, p.page || 1, s, e); },
    search: function (p, s, e) {
      var q = (p.query || '').trim(), pg = parseInt(p.page, 10) || 1;
      if (!q) { s({ title: '', results: [], collection: true, total_pages: 1 }); return; }
      httpGet(buildUrl('search', q, pg), function (html) {
        var r = parsePlaylist(html);
        s({
          title: NAME.toUpperCase() + ': ' + q,
          results: r,
          collection: true,
          total_pages: r.length >= CARDS_PER_PAGE ? pg + 1 : pg
        });
      }, e);
    },
    qualities: function (videoPageUrl, success, error) {
      httpGet(videoPageUrl, function (html) {
        if (!html || html.length < TV_CONFIG.QUALITY_MIN_LENGTH) {
          dbg('ERROR', 'HTML < ' + TV_CONFIG.QUALITY_MIN_LENGTH + 'b — возможно age gate/CF/IP block', 'QUALITY', 'BASIC');
          debugScan(html, videoPageUrl);
          error('Страница недоступна (' + (html ? html.length : 0) + 'b)');
          return;
        }
        var found = extractQualities(html);
        if (Object.keys(found).length > 0) {
          dbg('SUCCESS', 'Найдено качеств: ' + Object.keys(found).join(', '), 'QUALITY', 'BASIC');
          success({ qualities: found });
        } else {
          dbg('WARNING', 'Видео не найдено', 'QUALITY', 'BASIC');
          debugScan(html, videoPageUrl);
          error('Видео не найдено');
        }
      }, error);
    },

    // ============================================================
    // §12. HEALTH CHECK
    // ============================================================
    healthCheck: function (callback) {
      var startTime = Date.now();
      var t0 = startTime;

      httpGet(HOST, function (html) {
        var elapsed = Date.now() - t0;
        var cards = parsePlaylist(html);
        var result = {
          ok: cards.length > 0,
          cardCount: cards.length,
          elapsed: elapsed,
          timestamp: startTime,
          templateVersion: TEMPLATE_VERSION,
          parserVersion: VERSION,
          activeStrategies: Object.keys(ACTIVE_STRATEGIES).filter(function (k) { return ACTIVE_STRATEGIES[k]; }),
        };

        if (cards.length === 0) {
          result.warnings = result.warnings || [];
          result.warnings.push('no cards found on main page');
        }

        callback(result);
      }, function (e) {
        callback({
          ok: false,
          error: e,
          elapsed: Date.now() - t0,
          timestamp: startTime,
          templateVersion: TEMPLATE_VERSION,
          parserVersion: VERSION,
        });
      });
    },

    // ============================================================
    // §13. HOT PATCH
    // ============================================================
    patchConfig: function (updates, callback) {
      dbg('INFO', 'Hot patch requested', 'CONFIG', 'BASIC');

      var allowedFields = ['CARD', 'BUILD_URL', 'CATEGORIES', 'CHANNELS', 'ACTIVE_STRATEGIES', 'CARDS_PER_PAGE'];

      for (var field in updates) {
        if (allowedFields.indexOf(field) === -1) {
          dbg('ERROR', 'Field not allowed for hot patch: ' + field, 'CONFIG', 'BASIC');
          if (callback) callback({ ok: false, error: 'Field not allowed: ' + field });
          return;
        }
      }

      for (var f in updates) {
        if (f === 'ACTIVE_STRATEGIES') {
          for (var s in updates[f]) {
            ACTIVE_STRATEGIES[s] = updates[f][s];
          }
        } else if (f === 'CATEGORIES') {
          CATEGORIES = updates[f] || [];
        } else if (f === 'CHANNELS') {
          CHANNELS = updates[f] || [];
        } else if (f === 'CARDS_PER_PAGE') {
          CARDS_PER_PAGE = parseInt(updates[f], 10) || 24;
        } else {
          if (typeof updates[f] === 'object' && updates[f] !== null) {
            window[field] = updates[f];
          }
        }
      }

      dbg('SUCCESS', 'Hot patch applied', 'CONFIG', 'BASIC');
      if (callback) callback({ ok: true, timestamp: Date.now() });
    },

    // ============================================================
    // §14. DIAGNOSTICS
    // ============================================================
    diagnostics: function (videoPageUrl, callback) {
      httpGet(videoPageUrl, function (html) {
        var diagnostics = {
          htmlLength: html.length,
          templateVersion: TEMPLATE_VERSION,
          coreVersion: CORE_MIN_VERSION,
          activeStrategies: {},
          foundQualities: {},
          patterns: {},
          logBuffer: getLogBuffer(),
        };

        for (var s in ACTIVE_STRATEGIES) {
          if (ACTIVE_STRATEGIES[s]) {
            diagnostics.activeStrategies[s] = true;
          }
        }

        var qualities = extractQualities(html);
        diagnostics.foundQualities = qualities;

        var patternList = [
          'source_tag', 'mp4', 'm3u8', 'video_url', 'get_file',
          'kt_player', 'function/0', 'flowplayer', 'html5player',
          'dataEncod', 'Plyr', 'jwplayer', 'flashvars', 'ld+json',
        ];
        patternList.forEach(function (p) {
          var cnt = (html.match(new RegExp(p, 'gi')) || []).length;
          if (cnt > 0) diagnostics.patterns[p] = cnt;
        });

        callback(diagnostics);
      }, function (e) {
        callback({ error: e, htmlLength: 0 });
      });
    },

    // ============================================================
    // §15. ИНФОРМАЦИЯ О ПАРСЕРЕ
    // ============================================================
    info: function () {
      return {
        name: NAME,
        version: VERSION,
        templateVersion: TEMPLATE_VERSION,
        host: HOST,
        developer: DEVELOPER,
        created: CREATED,
        activeStrategies: Object.keys(ACTIVE_STRATEGIES).filter(function (k) { return ACTIVE_STRATEGIES[k]; }),
        cardContainer: CARD.container,
        menuItems: buildMenu().length,
        debug: DebugAPI,
      };
    },

    // ============================================================
    // §16. РАСШИРЕННОЕ API ОТЛАДКИ
    // ============================================================
    debug: DebugAPI,
  };

  // ============================================================
  // §17. РЕГИСТРАЦИЯ
  // ============================================================

  function tryRegister() {
    if (!validateConfig()) {
      dbg('ERROR', 'Config validation failed, parser NOT registered', 'CONFIG', 'BASIC');
      return false;
    }

    if (window.AdultPlugin && typeof window.AdultPlugin.registerParser === 'function') {
      window.AdultPlugin.registerParser(NAME, MyParser);
      dbg('SUCCESS', 'v' + VERSION + ' зарегистрирован (template: ' + TEMPLATE_VERSION + ')', 'CONFIG', 'BASIC');

      // Запуск базовой отладки при успешной регистрации
      if (TV_CONFIG.DEBUG_MODE && TV_CONFIG.DEBUG_BASIC) {
        setTimeout(function () {
          BASIC_DEBUG.runAll();
        }, 100);
      }

      return true;
    }
    return false;
  }

  if (!tryRegister()) {
    var poll = setInterval(function () { if (tryRegister()) clearInterval(poll); }, 200);
    setTimeout(function () { clearInterval(poll); }, 5000);
  }

})();