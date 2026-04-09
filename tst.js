/**
 * Парсер для pornobriz.com
 * Совместим с Lampa на Android TV
 * Версия: 2.0.0
 */

(function() {
  'use strict';

  // Проверка доступности API
  if (typeof Lampa === 'undefined' && typeof api === 'undefined') {
    console.error('[Pornobriz] Lampa API not available');
    return;
  }

  const API = window.Lampa || window.api || {};
  const TIMEOUT = 10000;
  const BASE_URL = 'https://pornobriz.com';

  // ============================================
  // ОСНОВНОЙ КЛАСС ПАРСЕРА
  // ============================================
  
  const PornoBrizParser = {
    
    name: 'pornobriz',
    title: 'Pornobriz',
    icon: 'https://pornobriz.com/img/logo.png',
    baseUrl: BASE_URL,
    version: '2.0.0',

    // ============================================
    // КАТЕГОРИИ
    // ============================================
    
    categories: [
      { id: '0', title: 'Главная', url: '/' },
      { id: '1', title: 'Рейтинговое', url: '/top/' },
      { id: '2', title: 'Азиатки', url: '/asian/' },
      { id: '3', title: 'Анальный секс', url: '/anal/' },
      { id: '4', title: 'БДСМ', url: '/bdsm/' },
      { id: '5', title: 'Блондинки', url: '/blonde/' },
      { id: '6', title: 'Большая жопа', url: '/big_ass/' },
      { id: '7', title: 'Большие сиськи', url: '/big_tits/' },
      { id: '8', title: 'Большой член', url: '/big_dick/' },
      { id: '9', title: 'Бритая киска', url: '/shaved/' },
      { id: '10', title: 'Брюнетки', url: '/brunette/' },
      { id: '11', title: 'В одежде', url: '/clothes/' },
      { id: '12', title: 'Волосатые киски', url: '/hairy/' },
      { id: '13', title: 'Глотают сперму', url: '/swallow/' },
      { id: '14', title: 'Глубокая глотка', url: '/deepthroat/' },
      { id: '15', title: 'Групповой секс', url: '/group/' },
      { id: '16', title: 'Двойное проникновение', url: '/double_penetration/' },
      { id: '17', title: 'Длинноволосые девушки', url: '/long_hair/' },
      { id: '18', title: 'Дрочат', url: '/wanking/' },
      { id: '19', title: 'Жесткий секс', url: '/hardcore/' },
      { id: '20', title: 'ЖМЖ порно', url: '/ffm/' },
      { id: '21', title: 'Игрушки', url: '/toys/' },
      { id: '22', title: 'Казашки', url: '/kazakh/' },
      { id: '23', title: 'Камшот', url: '/cumshot/' },
      { id: '24', title: 'Кончают в рот', url: '/cum_in_mouth/' },
      { id: '25', title: 'Красивая задница', url: '/perfect_ass/' },
      { id: '26', title: 'Красивое белье', url: '/lingerie/' },
      { id: '27', title: 'Красивые девушки', url: '/beautiful/' },
      { id: '28', title: 'Красивые сиськи', url: '/beautiful_tits/' },
      { id: '29', title: 'Крупным планом', url: '/close_up/' },
      { id: '30', title: 'Кунилингус', url: '/pussy_licking/' },
      { id: '31', title: 'Лесбиянки', url: '/lesbian/' },
      { id: '32', title: 'Любительское порно', url: '/amateur/' },
      { id: '33', title: 'Маленькие девушки', url: '/petite/' },
      { id: '34', title: 'Маленькие сиськи', url: '/small_tits/' },
      { id: '35', title: 'Мамочки', url: '/milf/' },
      { id: '36', title: 'Мастурбация', url: '/masturbation/' },
      { id: '37', title: 'Межрасовое', url: '/interracial/' },
      { id: '38', title: 'МЖМ порно', url: '/mfm/' },
      { id: '39', title: 'Милашки', url: '/cute/' },
      { id: '40', title: 'Минет', url: '/blowjob/' },
      { id: '41', title: 'Молодые', url: '/seks-molodye/' },
      { id: '42', title: 'На природе', url: '/outdoor/' },
      { id: '43', title: 'На публике', url: '/public/' },
      { id: '44', title: 'Наездницы', url: '/riding/' },
      { id: '45', title: 'Негритянки', url: '/ebony/' },
      { id: '46', title: 'Оргазм', url: '/orgasm/' },
      { id: '47', title: 'От первого лица', url: '/pov/' },
      { id: '48', title: 'Писают', url: '/peeing/' },
      { id: '49', title: 'Поцелуи', url: '/kissing/' },
      { id: '50', title: 'Рвотные позывы', url: '/gagging/' },
      { id: '51', title: 'Реальный секс', url: '/reality/' }
    ],

    // ============================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================

    init: function() {
      console.log('[Pornobriz] Parser initialized v' + this.version);
      
      try {
        // Регистрируем парсер в зависимости от версии Lampa
        if (typeof Lampa !== 'undefined' && Lampa.Plugins) {
          Lampa.Plugins.register(this);
        } else if (typeof api !== 'undefined' && api.plugins) {
          api.plugins.register(this);
        }
      } catch (e) {
        console.error('[Pornobriz] Init error:', e);
      }
    },

    // ============================================
    // ПОЛУЧЕНИЕ СПИСКА ВИДЕО
    // ============================================

    getItems: function(params, onSuccess, onError) {
      const self = this;
      const url = params.url || params.categoryUrl || this.baseUrl;

      console.log('[Pornobriz] Getting items from:', url);

      try {
        this._loadPage(url, function(html) {
          try {
            const items = self._parseItems(html);
            console.log('[Pornobriz] Parsed items:', items.length);
            
            if (typeof onSuccess === 'function') {
              onSuccess(items);
            }
          } catch (e) {
            console.error('[Pornobriz] Parse error:', e);
            if (typeof onError === 'function') {
              onError(e);
            }
          }
        }, function(err) {
          console.error('[Pornobriz] Network error:', err);
          if (typeof onError === 'function') {
            onError(err);
          }
        });
      } catch (e) {
        console.error('[Pornobriz] getItems error:', e);
        if (typeof onError === 'function') {
          onError(e);
        }
      }
    },

    // ============================================
    // ЗАГРУЗКА HTML СТРАНИЦЫ
    // ============================================

    _loadPage: function(url, onSuccess, onError) {
      const self = this;
      const fullUrl = url.startsWith('http') ? url : this.baseUrl + url;

      console.log('[Pornobriz] Loading page:', fullUrl);

      // Попытка 1: Используем fetch API (если доступен)
      if (typeof fetch !== 'undefined') {
        fetch(fullUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 9; HTC One M9) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9',
            'Cache-Control': 'no-cache'
          },
          timeout: TIMEOUT,
          mode: 'cors',
          credentials: 'omit'
        })
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(function(html) {
          console.log('[Pornobriz] Page loaded, size:', html.length);
          onSuccess(html);
        })
        .catch(function(e) {
          console.warn('[Pornobriz] Fetch failed, trying XMLHttpRequest:', e);
          self._loadPageXHR(fullUrl, onSuccess, onError);
        });
        return;
      }

      // Попытка 2: XMLHttpRequest
      this._loadPageXHR(fullUrl, onSuccess, onError);
    },

    _loadPageXHR: function(url, onSuccess, onError) {
      const xhr = new XMLHttpRequest();
      
      xhr.timeout = TIMEOUT;
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('[Pornobriz] XHR loaded, size:', xhr.responseText.length);
          onSuccess(xhr.responseText);
        } else {
          console.error('[Pornobriz] XHR status:', xhr.status);
          onError(new Error('HTTP ' + xhr.status));
        }
      };

      xhr.onerror = function() {
        console.error('[Pornobriz] XHR error');
        onError(new Error('Network error'));
      };

      xhr.ontimeout = function() {
        console.error('[Pornobriz] XHR timeout');
        onError(new Error('Request timeout'));
      };

      try {
        xhr.open('GET', url, true);
        xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Linux; Android 9; HTC One M9) AppleWebKit/537.36');
        xhr.setRequestHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
        xhr.setRequestHeader('Cache-Control', 'no-cache');
        xhr.send();
      } catch (e) {
        console.error('[Pornobriz] XHR open error:', e);
        onError(e);
      }
    },

    // ============================================
    // ПАРСИНГ HTML
    // ============================================

    _parseItems: function(html) {
      const items = [];

      if (!html || typeof html !== 'string') {
        console.warn('[Pornobriz] Invalid HTML input');
        return items;
      }

      try {
        // Создаем виртуальный DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        if (!doc) {
          console.warn('[Pornobriz] DOMParser failed');
          return this._parseItemsRegex(html);
        }

        // Ищем все карточки видео
        const selectors = [
          'div[class*="item"]',
          'div[class*="video"]',
          'article',
          'li[class*="thumb"]'
        ];

        let cards = [];
        for (let i = 0; i < selectors.length && cards.length === 0; i++) {
          cards = doc.querySelectorAll(selectors[i]);
          if (cards.length > 0) {
            console.log('[Pornobriz] Found cards with selector:', selectors[i], 'count:', cards.length);
          }
        }

        // Если селекторы не сработали, используем регулярные выражения
        if (cards.length === 0) {
          console.log('[Pornobriz] Selectors failed, using regex');
          return this._parseItemsRegex(html);
        }

        // Парсим каждую карточку
        cards.forEach(function(card, index) {
          try {
            const item = this._parseCard(card);
            if (item && item.url && item.title) {
              items.push(item);
            }
          } catch (e) {
            console.warn('[Pornobriz] Card parse error at index ' + index + ':', e);
          }
        }.bind(this));

      } catch (e) {
        console.error('[Pornobriz] Parse error:', e);
        return this._parseItemsRegex(html);
      }

      return items;
    },

    _parseCard: function(card) {
      const item = {};

      try {
        // Получаем ссылку на видео
        let link = null;
        const linkEl = card.querySelector('a[href*="/video/"]') || card.querySelector('a[href]');
        
        if (linkEl && linkEl.href) {
          link = linkEl.href;
          if (link && !link.startsWith('http')) {
            link = this.baseUrl + (link.startsWith('/') ? link : '/' + link);
          }
        }

        if (!link) {
          return null;
        }

        item.url = link;

        // Получаем название
        let title = null;
        const titleEl = card.querySelector('h2, h3, [class*="title"]');
        if (titleEl && titleEl.textContent) {
          title = titleEl.textContent.trim();
        }
        if (!title && linkEl && linkEl.textContent) {
          title = linkEl.textContent.trim();
        }

        item.title = title || 'Без названия';

        // Получаем миниатюру
        const imgEl = card.querySelector('img[src*="/content/"], img[src*="/preview/"], img');
        if (imgEl && imgEl.src) {
          let poster = imgEl.src;
          if (poster && !poster.startsWith('http')) {
            poster = this.baseUrl + (poster.startsWith('/') ? poster : '/' + poster);
          }
          item.poster = poster;
        } else {
          item.poster = this.icon;
        }

        // Получаем длительность
        const durationEl = card.querySelector('[class*="duration"], span:contains(":"), .time');
        if (durationEl && durationEl.textContent) {
          item.duration = durationEl.textContent.trim();
        }

        // Получаем качество
        const qualityEl = card.querySelector('[class*="quality"], [class*="hd"]');
        if (qualityEl && qualityEl.textContent) {
          item.quality = qualityEl.textContent.trim();
        } else {
          item.quality = 'FULL HD';
        }

      } catch (e) {
        console.warn('[Pornobriz] Card parse error:', e);
        return null;
      }

      return item;
    },

    // ============================================
    // ПАРСИНГ БЕЗ DOM (FALLBACK)
    // ============================================

    _parseItemsRegex: function(html) {
      const items = [];

      if (!html) return items;

      try {
        // Ищем все ссылки на видео
        const videoLinkRegex = /href=["']([^"']*\/video\/[^"']*?)["']/gi;
        const matches = html.matchAll(videoLinkRegex);

        let match;
        const seenUrls = {};

        while ((match = matches.next()) && !match.done) {
          const url = match.value[1];
          
          if (url && !seenUrls[url]) {
            seenUrls[url] = true;

            const item = {
              url: url.startsWith('http') ? url : this.baseUrl + (url.startsWith('/') ? url : '/' + url),
              title: url.split('/').pop().replace(/_/g, ' ').replace(/[^a-zа-яё0-9 ]/gi, ''),
              poster: this.icon,
              quality: 'FULL HD'
            };

            // Пытаемся найти изображение рядом с ссылкой
            const cardStart = Math.max(0, html.lastIndexOf('<', match.index) - 500);
            const cardEnd = html.indexOf('</div>', match.index) + 6;
            const cardHtml = html.substring(cardStart, cardEnd);

            const imgRegex = /src=["']([^"']*(?:content\/screen|preview)[^"']*?)["']/i;
            const imgMatch = cardHtml.match(imgRegex);
            if (imgMatch && imgMatch[1]) {
              let poster = imgMatch[1];
              if (!poster.startsWith('http')) {
                poster = this.baseUrl + (poster.startsWith('/') ? poster : '/' + poster);
              }
              item.poster = poster;
            }

            items.push(item);
          }
        }

        console.log('[Pornobriz] Regex parsed items:', items.length);
      } catch (e) {
        console.error('[Pornobriz] Regex parse error:', e);
      }

      return items;
    },

    // ============================================
    // ПОЛУЧЕНИЕ ПОТОКА ВИДЕО
    // ============================================

    getStream: function(data, onSuccess, onError) {
      const self = this;
      const videoUrl = typeof data === 'string' ? data : (data.url || data);

      console.log('[Pornobriz] Getting stream:', videoUrl);

      this._loadPage(videoUrl, function(html) {
        try {
          const sources = self._findVideoSources(html, videoUrl);
          console.log('[Pornobriz] Found sources:', sources.length);

          if (sources.length > 0) {
            // Возвращаем первый найденный источник
            const source = sources[0];
            if (typeof onSuccess === 'function') {
              onSuccess({
                url: source.url,
                quality: source.quality || '720p',
                type: source.type || 'mp4'
              });
            }
          } else {
            throw new Error('No video sources found');
          }
        } catch (e) {
          console.error('[Pornobriz] Stream error:', e);
          if (typeof onError === 'function') {
            onError(e);
          }
        }
      }, function(err) {
        console.error('[Pornobriz] Load stream error:', err);
        if (typeof onError === 'function') {
          onError(err);
        }
      });
    },

    _findVideoSources: function(html, pageUrl) {
      const sources = [];

      if (!html) return sources;

      try {
        // Способ 1: Поиск в тегах video source
        const videoSourceRegex = /<source[^>]*src=["']([^"']*\.mp4[^"']*)["']/gi;
        let match;

        while ((match = videoSourceRegex.exec(html)) !== null) {
          const url = match[1];
          if (url && !sources.some(s => s.url === url)) {
            sources.push({
              url: url.startsWith('http') ? url : this.baseUrl + (url.startsWith('/') ? url : '/' + url),
              quality: '720p',
              type: 'mp4'
            });
          }
        }

        // Способ 2: Поиск в iframe src
        const iframeRegex = /<iframe[^>]*src=["']([^"']*\.mp4[^"']*)["']/gi;
        while ((match = iframeRegex.exec(html)) !== null) {
          const url = match[1];
          if (url && !sources.some(s => s.url === url)) {
            sources.push({
              url: url.startsWith('http') ? url : this.baseUrl + (url.startsWith('/') ? url : '/' + url),
              quality: '720p',
              type: 'mp4'
            });
          }
        }

        // Способ 3: Поиск в JavaScript переменных
        const jsRegex = /['"]?(?:url|src|video)['"]?\s*:\s*['"]([^'"]*\.mp4[^'"]*)['"]/gi;
        while ((match = jsRegex.exec(html)) !== null) {
          const url = match[1];
          if (url && !sources.some(s => s.url === url)) {
            sources.push({
              url: url.startsWith('http') ? url : this.baseUrl + (url.startsWith('/') ? url : '/' + url),
              quality: '720p',
              type: 'mp4'
            });
          }
        }

        // Способ 4: Поиск любых .mp4 URL
        const allVideoRegex = /https?:\/\/[^\s"'<>]*\.mp4[^\s"'<>]*/gi;
        while ((match = allVideoRegex.exec(html)) !== null) {
          const url = match[0];
          if (!sources.some(s => s.url === url)) {
            sources.push({
              url: url,
              quality: '720p',
              type: 'mp4'
            });
          }
        }

        // Способ 5: Генерируем URL по паттерну, если ничего не найдено
        if (sources.length === 0) {
          const titleMatch = pageUrl.match(/\/video\/([a-z0-9_-]+)\/?$/i);
          if (titleMatch) {
            const previewUrl = this.baseUrl + '/preview/' + titleMatch[1] + '.mp4';
            sources.push({
              url: previewUrl,
              quality: '720p',
              type: 'mp4'
            });
          }
        }

      } catch (e) {
        console.error('[Pornobriz] Source find error:', e);
      }

      return sources;
    },

    // ============================================
    // ПОИСК (НЕ ПОДДЕРЖИВАЕТСЯ)
    // ============================================

    search: function(query, onSuccess, onError) {
      console.log('[Pornobriz] Search not supported');
      if (typeof onError === 'function') {
        onError(new Error('Search is not supported'));
      }
    },

    // ============================================
    // ПОЛУЧЕНИЕ КАТЕГОРИЙ
    // ============================================

    getCategories: function() {
      return this.categories.map(function(cat) {
        return {
          id: cat.id,
          title: cat.title,
          url: cat.url
        };
      });
    }
  };

  // ============================================
  // РЕГИСТРАЦИЯ ПАРСЕРА
  // ============================================

  try {
    // Инициализируем парсер
    PornoBrizParser.init();
    
    // Экспортируем глобально
    if (typeof window !== 'undefined') {
      window.PornoBrizParser = PornoBrizParser;
    }

    console.log('[Pornobriz] Parser loaded successfully');

  } catch (e) {
    console.error('[Pornobriz] Registration error:', e);
  }

})();
