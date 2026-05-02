/**
 * Site Structure Analyzer v7.0.0
 * Phase 1: Analyzer + Network Layer
 * GitHub Pages / Netlify compatible (HTTPS, no server)
 */
(function (global) {
  'use strict';

  const VERSION = '7.0.0';

  // ═══════════════════════════════════════════════════════════════
  // STRATEGY DEFINITIONS
  // ═══════════════════════════════════════════════════════════════
  const STRATEGY_DEFS = [
    { id:'S1',  name:'VIDEO_RULES',    block:1, desc:'video_url / video_alt_url / setVideoUrlHigh / file:mp4' },
    { id:'S2',  name:'direct_mp4',     block:1, desc:'Direct https://...mp4 URLs in page' },
    { id:'S3',  name:'og_video',       block:1, desc:'<meta property="og:video">' },
    { id:'S4',  name:'HLS_m3u8',       block:1, desc:'.m3u8 playlist URL' },
    { id:'S5',  name:'get_file',       block:1, desc:'/get_file/{id}/{hash}/ pattern' },
    { id:'S6',  name:'source_size',    block:1, desc:'<source src size="480">' },
    { id:'S7',  name:'source_label',   block:1, desc:'<source src label="480p">' },
    { id:'S8',  name:'DOMParser_src',  block:2, desc:'<video><source src> via DOMParser' },
    { id:'S9',  name:'dataEncodings',  block:2, desc:'dataEncodings / sources JSON array' },
    { id:'S10', name:'html5player',    block:2, desc:'html5player.setVideoUrl() calls' },
    { id:'S11', name:'flowplayer',     block:2, desc:'Flowplayer playlist/clip config' },
    { id:'S12', name:'KVS_multi_url',  block:2, desc:'video_url_720p, video_url_480p (URL only)' },
    { id:'S13', name:'data_config',    block:2, desc:'data-config / data-video attribute' },
    { id:'S14', name:'videojs',        block:2, desc:'Video.js data-setup' },
    { id:'S15', name:'Plyr',           block:2, desc:'Plyr.js player' },
    { id:'S16', name:'JW_Player',      block:2, desc:'jwplayer().setup()' },
    { id:'S17', name:'Flashvars',      block:2, desc:'flashvars object' },
    { id:'S18', name:'JSON_LD',        block:3, desc:'application/ld+json schema.org' },
    { id:'S19', name:'DASH_mpd',       block:3, desc:'.mpd manifest' },
    { id:'S20', name:'CF_Stream',      block:3, desc:'Cloudflare Stream embed' },
    { id:'S21', name:'redirect',       block:3, desc:'window.location → video URL' },
    { id:'S22', name:'ts_segments',    block:3, desc:'.ts segment files' },
    { id:'S23', name:'PostMessage',    block:3, desc:'postMessage video URL' },
    { id:'S24', name:'JWT_decode',     block:3, desc:'JWT token with video URL' },
    { id:'S25', name:'JS_object',      block:3, desc:'var x = {src:"...mp4"}' },
    { id:'S26', name:'MediaSource',    block:4, desc:'MediaSource API — headless only' },
    { id:'S27', name:'Lazy_video',     block:4, desc:'data-src lazy video — headless only' },
    { id:'S28', name:'API_endpoint',   block:4, desc:'/api/...video endpoint — headless only' },
  ];

  // ═══════════════════════════════════════════════════════════════
  // SELECTORS
  // ═══════════════════════════════════════════════════════════════
  const RANKED_CARD_SELECTORS = [
    '.video-block', '.video-item', 'div.thumb_main', '.thumb',
    '.thumb-item', '.item', 'article.video', '.video-thumb',
    '.video', '.video-card', '.video_block', '.clip',
    '.gallery-item', 'article.post', '.card', '[data-video-id]',
    '[data-id]', '.mozaique .thumb-block', '.list-videos .video-item',
    '[class*="video-"]',
  ];
  const TITLE_SELECTORS = [
    '.title', '.name', '.video-title', 'a[title]',
    '[class*="title"]', '[class*="tit"]', '[class*="nam"]', 'h3', 'h4', 'h2',
  ];
  const DURATION_SELECTORS = [
    '.duration', '.time', '[class*="duration"]', '[class*="dur"]',
    '[class*="time"]', 'span.length', 'span.runtime',
  ];
  const THUMB_ATTRS = ['src', 'data-src', 'data-original', 'data-lazy', 'data-thumb', 'data-image'];

  // ═══════════════════════════════════════════════════════════════
  // NETWORK LAYER
  // ═══════════════════════════════════════════════════════════════
  const NetworkLayer = (() => {
    const PUBLIC_PROXIES = [
      url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
      url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    ];

    let _log = [];

    function log(level, msg) {
      const entry = { t: Date.now(), level, msg };
      _log.push(entry);
      if (_log.length > 200) _log.shift();
    }

    function getWorkerUrl() {
      const el = document.getElementById('workerUrl');
      return (el && el.value.trim()) || 'https://zonaproxy.777b737.workers.dev';
    }

    function getTransportMode() {
      const el = document.getElementById('transportMode');
      return (el && el.value) || 'auto';
    }

    function updateCorsIndicator(status) {
      const el = document.getElementById('corsIndicator');
      if (!el) return;
      const map = { ok:'🟢 CORS OK', worker:'🟡 Worker', proxy:'🟠 Public proxy', fail:'🔴 Fail' };
      el.textContent = map[status] || status;
      el.className = 'cors-indicator cors-' + status;
    }

    async function fDirect(url) {
      const r = await fetch(url, {
        headers: { 'Accept': 'text/html,*/*', 'Accept-Language': 'en-US,en;q=0.9' },
        credentials: 'omit',
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { html: await r.text(), finalUrl: r.url, transport: 'direct' };
    }

    async function fWorker(url) {
      const wUrl = getWorkerUrl();
      if (!wUrl) throw new Error('No Worker URL');
      const r = await fetch(`${wUrl}?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`Worker HTTP ${r.status}`);
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await r.json();
        return { html: j.contents || j.html || JSON.stringify(j), finalUrl: j.status?.url || url, transport: 'worker' };
      }
      return { html: await r.text(), finalUrl: url, transport: 'worker' };
    }

    async function fPublicProxy(url, idx) {
      const builder = PUBLIC_PROXIES[idx];
      if (!builder) throw new Error('No more proxies');
      const proxyUrl = builder(url);
      const r = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`Proxy[${idx}] HTTP ${r.status}`);
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await r.json();
        return { html: j.contents || j.html || JSON.stringify(j), finalUrl: url, transport: 'proxy' };
      }
      return { html: await r.text(), finalUrl: url, transport: 'proxy' };
    }

    async function fetchPage(url) {
      const mode = getTransportMode();
      _log = _log.filter(e => Date.now() - e.t < 600000);

      // Direct only mode
      if (mode === '' || mode === 'direct-test') {
        try {
          const res = await fDirect(url);
          updateCorsIndicator('ok');
          log('ok', `Direct OK: ${url}`);
          return res;
        } catch (e) {
          log('err', `Direct FAIL: ${e.message}`);
          updateCorsIndicator('fail');
          throw e;
        }
      }

      // Fixed proxy URL
      if (mode && mode !== 'auto') {
        try {
          const r = await fetch(`${mode}?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15000) });
          const html = await r.text();
          updateCorsIndicator('worker');
          return { html, finalUrl: url, transport: 'custom-proxy' };
        } catch (e) {
          log('err', `Custom proxy FAIL: ${e.message}`);
          throw e;
        }
      }

      // Auto cascade
      const steps = [
        () => fDirect(url).then(r => { updateCorsIndicator('ok'); return r; }),
        () => fWorker(url).then(r => { updateCorsIndicator('worker'); return r; }),
        ...PUBLIC_PROXIES.map((_, i) => () => fPublicProxy(url, i).then(r => { updateCorsIndicator('proxy'); return r; })),
      ];

      let lastErr;
      for (const step of steps) {
        try {
          const res = await step();
          log('ok', `${res.transport} OK: ${url}`);
          return res;
        } catch (e) {
          log('warn', `${e.message}`);
          lastErr = e;
        }
      }
      updateCorsIndicator('fail');
      throw new Error(`All transports failed: ${lastErr?.message}`);
    }

    return { fetchPage, getWorkerUrl, getLog: () => [..._log] };
  })();

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════
  function absoluteUrl(href, base) {
    if (!href) return null;
    try { return new URL(href, base).href; } catch { return null; }
  }

  function extractUrls(text, base) {
    const rx = /https?:\/\/[^\s"'<>)\]]+/g;
    return [...new Set((text.match(rx) || []).map(u => u.replace(/[,;]+$/, '')))];
  }

  function isVideoUrl(u) {
    return /\.(mp4|m3u8|webm|ogv|mov|mpd|ts)(\?|$)/i.test(u) || /\/(video|media|stream)\//i.test(u);
  }

  function isRealUrl(s) {
    return /^https?:\/\//i.test(s);
  }

  // ═══════════════════════════════════════════════════════════════
  // STRATEGY DETECTION (S1 – S28)
  // ═══════════════════════════════════════════════════════════════
  function detectAllStrategies(html, allJS, base) {
    const combined = html + '\n' + allJS.join('\n');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const results = [];
    const debugReport = {};

    for (const def of STRATEGY_DEFS) {
      const r = _detectOne(def, html, combined, doc, allJS, base, debugReport);
      results.push(r);
    }

    const deadStrategies = results
      .filter(r => r.confidence === 'inferred' || (r.foundUrls.length === 0 && r.patternFound))
      .map(r => ({
        id: r.id,
        name: r.name,
        evidence: r.deadReason || 'no-url-found',
        suggestion: _deadSuggestion(r.id),
      }));

    return { strategies: results.filter(r => r.confidence !== 'inferred' || r.block < 4), deadStrategies, debugReport };
  }

  function _detectOne(def, html, combined, doc, allJS, base, debugReport) {
    const base_result = { ...def, confidence: 'inferred', foundUrls: [], patternFound: false };

    try {
      switch (def.id) {
        case 'S1': return _S1(base_result, combined, base, debugReport);
        case 'S2': return _S2(base_result, combined, base, debugReport);
        case 'S3': return _S3(base_result, doc, debugReport);
        case 'S4': return _S4(base_result, combined, base, debugReport);
        case 'S5': return _S5(base_result, combined, base, debugReport);
        case 'S6': return _S6(base_result, doc, base, debugReport);
        case 'S7': return _S7(base_result, doc, base, debugReport);
        case 'S8': return _S8(base_result, doc, base, debugReport);
        case 'S9': return _S9(base_result, combined, base, debugReport);
        case 'S10': return _S10(base_result, combined, base, debugReport);
        case 'S11': return _S11(base_result, combined, base, debugReport);
        case 'S12': return _S12(base_result, combined, base, debugReport);
        case 'S13': return _S13(base_result, doc, combined, base, debugReport);
        case 'S14': return _S14(base_result, doc, combined, debugReport);
        case 'S15': return _S15(base_result, combined, debugReport);
        case 'S16': return _S16(base_result, combined, base, debugReport);
        case 'S17': return _S17(base_result, combined, base, debugReport);
        case 'S18': return _S18(base_result, doc, base, debugReport);
        case 'S19': return _S19(base_result, combined, base, debugReport);
        case 'S20': return _S20(base_result, doc, combined, debugReport);
        case 'S21': return _S21(base_result, combined, base, debugReport);
        case 'S22': return _S22(base_result, combined, base, debugReport);
        case 'S23': return _S23(base_result, combined, debugReport);
        case 'S24': return _S24(base_result, combined, base, debugReport);
        case 'S25': return _S25(base_result, combined, base, debugReport);
        case 'S26': case 'S27': case 'S28': return _headlessOnly(base_result, debugReport);
        default: return base_result;
      }
    } catch (e) {
      return { ...base_result, error: e.message };
    }
  }

  function _confirm(r, urls) {
    r.foundUrls = [...new Set(urls.filter(Boolean))];
    r.confidence = r.foundUrls.length ? 'confirmed' : 'detected';
    r.patternFound = true;
    return r;
  }

  function _S1(r, combined, base, dbg) {
    const rxs = [
      /video_url\s*[=:]\s*["']([^"']{10,}\.mp4[^"']*)/gi,
      /video_alt_url\s*[=:]\s*["']([^"']{10,}\.mp4[^"']*)/gi,
      /setVideoUrl(?:High)?\s*\(\s*["']([^"']{10,})/gi,
      /['"]file['"]\s*:\s*["']([^"']{10,}\.mp4[^"']*)/gi,
    ];
    const urls = [];
    for (const rx of rxs) { let m; while ((m = rx.exec(combined))) urls.push(absoluteUrl(m[1], base)); }
    dbg.video_url = urls.length;
    return urls.length ? _confirm(r, urls) : { ...r, patternFound: /video_url|setVideoUrl/i.test(combined) };
  }

  function _S2(r, combined, base, dbg) {
    const rx = /https?:\/\/[^\s"'<>)\]]+\.mp4[^\s"'<>)\]]*/gi;
    const urls = [...new Set((combined.match(rx) || []).map(u => u.replace(/[,"']+$/, '')))];
    dbg.mp4 = urls.length;
    return urls.length ? _confirm(r, urls) : r;
  }

  function _S3(r, doc, dbg) {
    const meta = doc.querySelector('meta[property="og:video"], meta[property="og:video:url"]');
    const url = meta?.getAttribute('content');
    dbg.og_video = url ? 1 : 0;
    return url ? _confirm(r, [url]) : r;
  }

  function _S4(r, combined, base, dbg) {
    const rx = /https?:\/\/[^\s"'<>)\]]+\.m3u8[^\s"'<>)\]]*/gi;
    const urls = [...new Set((combined.match(rx) || []).map(u => u.replace(/[,"']+$/, '')))];
    dbg.m3u8 = urls.length;
    return urls.length ? _confirm(r, urls) : r;
  }

  function _S5(r, combined, base, dbg) {
    const rx = /\/get_file\/(\d+)\/([a-z0-9]+)\//gi;
    const matches = [...combined.matchAll(rx)];
    dbg.get_file = matches.length;
    if (!matches.length) return r;
    const urls = matches.map(m => absoluteUrl(m[0].split('?')[0], base));
    return _confirm(r, urls.filter(Boolean));
  }

  function _S6(r, doc, base, dbg) {
    const sources = [...doc.querySelectorAll('source[size]')];
    dbg.source_size = sources.length;
    if (!sources.length) return r;
    const urls = sources.map(s => absoluteUrl(s.getAttribute('src'), base)).filter(Boolean);
    const details = { qualities: sources.map(s => ({ src: s.getAttribute('src'), size: s.getAttribute('size') })) };
    return _confirm({ ...r, details }, urls);
  }

  function _S7(r, doc, base, dbg) {
    const sources = [...doc.querySelectorAll('source[label]')];
    dbg.source_label = sources.length;
    if (!sources.length) return r;
    const urls = sources.map(s => absoluteUrl(s.getAttribute('src'), base)).filter(Boolean);
    const details = { qualities: sources.map(s => ({ src: s.getAttribute('src'), label: s.getAttribute('label') })) };
    return _confirm({ ...r, details }, urls);
  }

  function _S8(r, doc, base, dbg) {
    const sources = [...doc.querySelectorAll('video source[src]')];
    dbg.source_tag = sources.length;
    if (!sources.length) return r;
    const urls = sources.map(s => absoluteUrl(s.getAttribute('src'), base)).filter(Boolean);
    return _confirm(r, urls);
  }

  function _S9(r, combined, base, dbg) {
    const rxs = [
      /dataEncodings\s*[=:]\s*(\[[^\]]{20,}\])/gi,
      /["']sources["']\s*:\s*(\[[^\]]{20,}\])/gi,
      /sources\s*=\s*(\[[^\]]{20,}\])/gi,
    ];
    const urls = [];
    for (const rx of rxs) {
      let m;
      while ((m = rx.exec(combined))) {
        try {
          const arr = JSON.parse(m[1]);
          if (Array.isArray(arr)) {
            arr.forEach(item => {
              const src = item.src || item.file || item.url;
              if (src && isRealUrl(src)) urls.push(src);
            });
          }
        } catch { /* not valid JSON */ }
      }
    }
    dbg.dataEncodings = urls.length;
    return urls.length ? _confirm(r, urls) : { ...r, patternFound: /dataEncodings|sources\s*[:=]\s*\[/i.test(combined) };
  }

  function _S10(r, combined, base, dbg) {
    const rx = /html5player\.setVideoUrl(?:High)?\s*\(\s*["']([^"']+)/gi;
    const urls = [];
    let m;
    while ((m = rx.exec(combined))) urls.push(absoluteUrl(m[1], base));
    dbg.html5player = urls.length;
    return urls.length ? _confirm(r, urls) : { ...r, patternFound: /html5player/i.test(combined) };
  }

  function _S11(r, combined, base, dbg) {
    const count = (combined.match(/flowplayer\s*\(/gi) || []).length;
    dbg.flowplayer = count;
    if (!count) return r;
    const rx = /(?:clip|playlist)\s*:\s*\{[^}]*url\s*:\s*["']([^"']+)/gi;
    const urls = [];
    let m;
    while ((m = rx.exec(combined))) urls.push(absoluteUrl(m[1], base));
    // confirmed only if >= 3 flowplayer markers
    if (count >= 3 && urls.length) return _confirm(r, urls);
    return { ...r, patternFound: true, confidence: 'detected', foundUrls: urls };
  }

  function _S12(r, combined, base, dbg) {
    // CRITICAL: only confirmed if value is a real URL, not text
    const rx = /video_url_(\d+p?)\s*=\s*["']([^"']+)/gi;
    const urls = [];
    const qualities = {};
    let m;
    while ((m = rx.exec(combined))) {
      const val = m[2];
      if (isRealUrl(val) || val.startsWith('function/')) {
        urls.push(absoluteUrl(val, base) || val);
        qualities[m[1]] = val;
      }
    }
    dbg.kvs_multi = urls.length;
    if (urls.length) return _confirm({ ...r, details: { qualities } }, urls);
    const patternFound = /video_url_\d+p?\s*=/i.test(combined);
    return { ...r, patternFound, confidence: patternFound ? 'detected' : 'inferred',
             deadReason: patternFound ? 'pattern-found-no-url' : 'no-pattern' };
  }

  function _S13(r, doc, combined, base, dbg) {
    const els = [...doc.querySelectorAll('[data-config],[data-video],[data-setup-data]')];
    dbg.data_config = els.length;
    if (!els.length) return r;
    const urls = [];
    els.forEach(el => {
      const raw = el.dataset.config || el.dataset.video || el.dataset.setupData;
      if (!raw) return;
      try {
        const obj = JSON.parse(raw);
        const src = obj.src || obj.file || obj.url || obj.sources?.[0]?.src;
        if (src) urls.push(absoluteUrl(src, base));
      } catch { const u = extractUrls(raw, base).filter(isVideoUrl); urls.push(...u); }
    });
    return urls.length ? _confirm(r, urls) : { ...r, patternFound: true, confidence: 'detected' };
  }

  function _S14(r, doc, combined, dbg) {
    const els = [...doc.querySelectorAll('[data-setup]')];
    const vjsCount = (combined.match(/videojs\s*\(/gi) || []).length;
    dbg.videojs = els.length + vjsCount;
    if (!els.length && !vjsCount) return r;
    const urls = [];
    els.forEach(el => {
      try {
        const cfg = JSON.parse(el.getAttribute('data-setup'));
        const src = cfg.sources?.[0]?.src;
        if (src) urls.push(src);
      } catch {}
    });
    return _confirm(r, urls);
  }

  function _S15(r, combined, dbg) {
    const found = /new\s+Plyr\s*\(|Plyr\.setup\s*\(/i.test(combined);
    dbg.plyr = found ? 1 : 0;
    return found ? { ...r, patternFound: true, confidence: 'detected' } : r;
  }

  function _S16(r, combined, base, dbg) {
    const rx = /jwplayer\s*\([^)]*\)\s*\.setup\s*\(\s*(\{[\s\S]{10,?}\})\s*\)/gi;
    dbg.jwplayer = (combined.match(/jwplayer\s*\(/gi) || []).length;
    const urls = [];
    let m;
    while ((m = rx.exec(combined))) {
      try {
        const cfg = JSON.parse(m[1]);
        const src = cfg.file || cfg.playlist?.[0]?.file;
        if (src) urls.push(absoluteUrl(src, base));
      } catch {}
    }
    return urls.length ? _confirm(r, urls)
      : dbg.jwplayer ? { ...r, patternFound: true, confidence: 'detected' } : r;
  }

  function _S17(r, combined, base, dbg) {
    const rx = /flashvars\s*[=:]\s*\{([^}]{20,})\}/gi;
    dbg.flashvars = (combined.match(/flashvars/gi) || []).length;
    const urls = [];
    let m;
    while ((m = rx.exec(combined))) {
      const inner = m[1];
      const fileRx = /(?:file|src|video)\s*:\s*["']([^"']+)/gi;
      let fm;
      while ((fm = fileRx.exec(inner))) {
        const u = absoluteUrl(fm[1], base);
        if (u && isVideoUrl(u)) urls.push(u);
      }
    }
    return urls.length ? _confirm(r, urls)
      : dbg.flashvars ? { ...r, patternFound: true, confidence: 'detected' } : r;
  }

  function _S18(r, doc, base, dbg) {
    const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];
    dbg.json_ld = scripts.length;
    if (!scripts.length) return r;
    const urls = [];
    scripts.forEach(s => {
      try {
        const obj = JSON.parse(s.textContent);
        const items = Array.isArray(obj) ? obj : [obj];
        items.forEach(item => {
          const u = item.contentUrl || item.embedUrl || item.url;
          if (u && isVideoUrl(u)) urls.push(absoluteUrl(u, base));
        });
      } catch {}
    });
    return urls.length ? _confirm(r, urls) : { ...r, patternFound: true, confidence: 'detected' };
  }

  function _S19(r, combined, base, dbg) {
    const rx = /https?:\/\/[^\s"'<>)\]]+\.mpd[^\s"'<>)\]]*/gi;
    const urls = (combined.match(rx) || []).map(u => u.replace(/[,"']+$/, ''));
    dbg.mpd = urls.length;
    return urls.length ? _confirm(r, urls) : r;
  }

  function _S20(r, doc, combined, dbg) {
    const frames = [...doc.querySelectorAll('iframe[src*="cloudflarestream"]')];
    const inCode = /cloudflarestream\.com|stream\.cloudflare\.com/i.test(combined);
    dbg.cf_stream = frames.length + (inCode ? 1 : 0);
    const urls = frames.map(f => f.getAttribute('src')).filter(Boolean);
    return (frames.length || inCode) ? _confirm(r, urls) : r;
  }

  function _S21(r, combined, base, dbg) {
    // CRITICAL: only if redirect URL contains video indicators
    const rx = /window\.location(?:\.href)?\s*=\s*["']([^"']{10,})/gi;
    dbg.redirect = (combined.match(/window\.location/gi) || []).length;
    const urls = [];
    let m;
    while ((m = rx.exec(combined))) {
      const u = absoluteUrl(m[1], base);
      if (u && isVideoUrl(u)) urls.push(u);
    }
    return urls.length ? _confirm(r, urls)
      : dbg.redirect ? { ...r, patternFound: true, confidence: 'detected',
                         deadReason: 'redirect-not-to-video' } : r;
  }

  function _S22(r, combined, base, dbg) {
    const rx = /https?:\/\/[^\s"'<>)\]]+\.ts[^\s"'<>)\]]*/gi;
    const urls = [...new Set((combined.match(rx) || []).map(u => u.replace(/[,"']+$/, '')))];
    dbg.ts_segments = urls.length;
    return urls.length ? _confirm(r, urls) : r;
  }

  function _S23(r, combined, dbg) {
    const found = /postMessage\s*\(/i.test(combined);
    dbg.postmessage = found ? 1 : 0;
    return found ? { ...r, patternFound: true, confidence: 'detected' } : r;
  }

  function _S24(r, combined, base, dbg) {
    const rx = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
    const tokens = (combined.match(rx) || []);
    dbg.jwt = tokens.length;
    if (!tokens.length) return r;
    const urls = [];
    tokens.forEach(t => {
      try {
        const payload = JSON.parse(atob(t.split('.')[1]));
        const src = payload.url || payload.src || payload.video_url;
        if (src && isRealUrl(src)) urls.push(src);
      } catch {}
    });
    return _confirm(r, urls);
  }

  function _S25(r, combined, base, dbg) {
    const rx = /(?:var|let|const)\s+\w+\s*=\s*\{[^}]*["']?src["']?\s*:\s*["']([^"']{10,}\.(?:mp4|m3u8|webm))/gi;
    const urls = [];
    let m;
    while ((m = rx.exec(combined))) urls.push(absoluteUrl(m[1], base));
    dbg.js_object = urls.length;
    return urls.length ? _confirm(r, urls) : r;
  }

  function _headlessOnly(r, dbg) {
    dbg[r.name.toLowerCase()] = 0;
    return { ...r, confidence: 'inferred', deadReason: 'headless-only', foundUrls: [] };
  }

  function _deadSuggestion(id) {
    const map = {
      S5: 'Use WORKER_VERDICT follow-redirect to resolve /get_file/ chain',
      S11: 'Check if flowplayer version is newer — may use different config structure',
      S12: 'Verify KVS engine — may use function/0/ encoding (tryKtDecode)',
      S21: 'Redirect is not to video URL — check if page redirects to embed iframe',
      S26: 'Requires headless browser — not supported in this environment',
      S27: 'Requires headless browser — not supported in this environment',
      S28: 'Requires headless browser — not supported in this environment',
    };
    return map[id] || 'Try alternative strategies from same block';
  }

  // ═══════════════════════════════════════════════════════════════
  // KVS ENGINE DETECTION
  // ═══════════════════════════════════════════════════════════════
  function detectKvsEngine(html, allJS) {
    const combined = html + '\n' + allJS.join('\n');
    const markers = {
      video_url_var:      /\bvideo_url\s*=/i.test(combined),
      video_url_multi:    /video_url_\d+p?\s*=/i.test(combined),
      get_file_pattern:   /\/get_file\/\d+\/[a-z0-9]+\//i.test(combined),
      license_code:       /license_code\s*[=:]\s*["'][^"']{3,}/i.test(combined),
      function_prefix:    /["']function\/[01]\//.test(combined),
      kvs_comment:        /KVS|Kernel Video Sharing/i.test(combined),
      kvs_class:          /class="[^"]*kvs[^"]*"/i.test(html),
    };
    const hits = Object.values(markers).filter(Boolean).length;
    const licenseMatch = combined.match(/license_code\s*[=:]\s*["']([^"']{3,})/i);

    return {
      isKvs: hits >= 2,
      confidence: hits >= 4 ? 0.95 : hits >= 2 ? 0.7 : 0.2,
      markers,
      markerCount: hits,
      licenseCode: licenseMatch ? licenseMatch[1] : null,
    };
  }

  function tryKtDecode(encodedUrl, licenseCode) {
    if (!encodedUrl || !encodedUrl.includes('function/')) return null;
    const m = encodedUrl.match(/function\/([01])\/(.+)/);
    if (!m) return null;
    const method = parseInt(m[1]);
    const encoded = m[2];

    // If already an HTTP URL — no decode needed
    if (encoded.startsWith('http')) return { url: encoded, method: 'plain', decoded: true };

    if (!licenseCode) return { url: null, method: 'no-license', decoded: false };

    try {
      // method0: forward shift, method1: reverse shift
      for (const chunkSize of [1, 2]) {
        const decoded = _ktDecodeMethod(encoded, licenseCode, method === 1, chunkSize);
        if (decoded && isRealUrl(decoded)) {
          return { url: decoded, method: `method${method}_chunk${chunkSize}`, decoded: true };
        }
      }
    } catch {}
    return { url: null, method: 'decode-failed', decoded: false };
  }

  function _ktDecodeMethod(encoded, licenseCode, reverse, chunkSize) {
    const chars = encoded.split('');
    const key = licenseCode.split('');
    let result = '';
    for (let i = 0; i < chars.length; i++) {
      const keyChar = key[i % key.length].charCodeAt(0);
      const charCode = chars[i].charCodeAt(0);
      const shift = reverse ? -keyChar : keyChar;
      result += String.fromCharCode(((charCode - shift + 256) % 256));
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // CARD DETECTION
  // ═══════════════════════════════════════════════════════════════
  function detectCards(doc, base) {
    let bestSelector = null, bestCount = 0, bestCards = [];

    for (const sel of RANKED_CARD_SELECTORS) {
      const els = [...doc.querySelectorAll(sel)];
      if (els.length > bestCount) {
        bestCount = els.length;
        bestSelector = sel;
        bestCards = els;
      }
    }

    if (!bestSelector || bestCount < 2) return {
      container: null, link: null, title: null, thumb: null,
      thumbAttr: null, duration: null, totalFound: 0,
      validationWarnings: [{ code: 'NO_CARDS', severity: 'critical' }],
      sampleCards: [],
    };

    // Detect sub-selectors from first card
    const first = bestCards[0];
    const linkEl = first.querySelector('a[href]');
    const titleEl = TITLE_SELECTORS.map(s => first.querySelector(s)).find(Boolean);
    const durationEl = DURATION_SELECTORS.map(s => first.querySelector(s)).find(Boolean);
    const imgEl = first.querySelector('img');

    let thumbAttr = null, thumbSel = 'img';
    if (imgEl) {
      for (const attr of THUMB_ATTRS) {
        if (imgEl.getAttribute(attr)) { thumbAttr = attr; break; }
      }
    }

    // Build relative selectors
    const linkSel  = linkEl  ? _relSelector(first, linkEl)  : null;
    const titleSel = titleEl ? _relSelector(first, titleEl) : null;
    const durSel   = durationEl ? _relSelector(first, durationEl) : null;

    const sampleCards = bestCards.slice(0, 5).map(card => {
      const a = card.querySelector('a[href]');
      const img = card.querySelector('img');
      const t = TITLE_SELECTORS.map(s => card.querySelector(s)).find(Boolean);
      const d = DURATION_SELECTORS.map(s => card.querySelector(s)).find(Boolean);
      return {
        link: a ? absoluteUrl(a.getAttribute('href'), base) : null,
        title: t?.textContent?.trim() || a?.getAttribute('title') || null,
        thumb: img ? (img.getAttribute(thumbAttr) || img.getAttribute('src')) : null,
        duration: d?.textContent?.trim() || null,
      };
    });

    const warnings = [];
    if (bestCount < 3) warnings.push({ code: 'FEW_CARDS', severity: 'high' });
    const noLink = sampleCards.filter(c => !c.link).length;
    if (noLink > sampleCards.length * 0.5) warnings.push({ code: 'MISSING_LINKS', severity: 'high' });

    return {
      container: bestSelector,
      link: linkSel,
      title: titleSel,
      thumb: `${bestSelector} img`,
      thumbAttr: thumbAttr || 'src',
      duration: durSel,
      totalFound: bestCount,
      validationWarnings: warnings,
      sampleCards,
    };
  }

  function _relSelector(parent, child) {
    if (child === parent) return null;
    const tag = child.tagName.toLowerCase();
    const cls = [...child.classList].slice(0, 2).map(c => '.' + c).join('');
    const attr = child.hasAttribute('href') ? '[href]' : '';
    return `${tag}${cls}${attr}` || tag;
  }

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIES + SEARCH + BUILD URL
  // ═══════════════════════════════════════════════════════════════
  function detectCategories(doc, base) {
    const selectors = [
      'nav a[href]', '.categories a', '.cats a', '.nav-links a',
      '.menu a[href*="/cat"]', 'a[href*="/category/"]', 'a[href*="/tag/"]',
      '.sidebar a', 'footer a[href*="/"]',
    ];
    const categories = new Map();
    for (const sel of selectors) {
      doc.querySelectorAll(sel).forEach(a => {
        const href = a.getAttribute('href');
        const title = a.textContent.trim();
        if (!href || !title || title.length < 2 || title.length > 40) return;
        const url = absoluteUrl(href, base);
        if (!url) return;
        const slug = href.replace(/.*\/([^/?]+)\/?(\?.*)?$/, '$1');
        if (slug && !categories.has(slug)) {
          categories.set(slug, { title, slug, url });
        }
      });
      if (categories.size > 5) break;
    }
    return [...categories.values()].slice(0, 50);
  }

  function detectSearch(doc, html, base) {
    // Detect search input
    const input = doc.querySelector('input[type="search"], input[name="q"], input[name="s"], input[name="search"]');
    const form  = input?.closest('form');
    const action = form?.getAttribute('action');
    const paramName = input?.getAttribute('name') || 'q';

    // Test for slug-based search (/search/query/)
    const slugTest = html.includes(`/${paramName}/`) || /search\/[^?&"'<>\s]{3,}/.test(html);
    const type = slugTest ? 'slug' : 'param';
    const pattern = type === 'slug'
      ? (action || '/search/') + '{query}/'
      : (action || '/?') + (action?.includes('?') ? '&' : '?') + paramName + '={query}';

    return { paramName, pattern, type, formAction: action };
  }

  function detectBuildUrl(doc, html, base, categories) {
    const search = detectSearch(doc, html, base);

    // Detect pagination
    let pagination = '?page={N}';
    const pageLinks = [...doc.querySelectorAll('a[href*="page"]')];
    if (pageLinks.length) {
      const href = pageLinks[0].getAttribute('href');
      if (/\/page\/\d+/.test(href)) pagination = '/page/{N}/';
      else if (/[?&]page=\d+/.test(href)) pagination = (href.includes('?page') ? '?page={N}' : '&page={N}');
    }

    // Detect category URL pattern
    let categoryPattern = '/?c={slug}';
    if (categories.length) {
      const u = new URL(categories[0].url);
      categoryPattern = u.pathname.replace(categories[0].slug, '{slug}');
    }

    return {
      main: new URL(base).pathname || '/',
      search: search.pattern,
      category: categoryPattern,
      pagination,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PROTECTION DETECTION
  // ═══════════════════════════════════════════════════════════════
  function detectProtection(html, doc) {
    const cf = /cf-ray|__cf_bm|cf_clearance|challenge-form|cloudflare/i.test(html);
    const ageGateEl = doc.querySelector('#age_check, .age-gate, [class*="age-gate"], [id*="age"]');
    const ageCookie = /(?:age_verified|mature|over18|adult_confirm)\s*[=:]/i.exec(html);

    return {
      cloudflare: cf,
      ageGate: ageGateEl || ageCookie ? {
        type: ageGateEl ? 'dom-element' : 'cookie-flag',
        cookieName: ageCookie ? ageCookie[0].split(/[=:]/)[0].trim() : 'age_verified',
      } : null,
      refererProtected: /referer|hotlink/i.test(html),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CDN PATTERN + MIRRORS
  // ═══════════════════════════════════════════════════════════════
  function detectCdnPattern(domains) {
    const groups = new Map();
    for (const d of domains) {
      const m = d.match(/^([a-z]+)(\d+)\.(.+)$/);
      if (m) {
        const key = `${m[1]}{N}.${m[3]}`;
        if (!groups.has(key)) groups.set(key, { prefix: m[1], tld: m[3], found: [] });
        groups.get(key).found.push(parseInt(m[2]));
      }
    }
    const results = [];
    groups.forEach((v, template) => {
      if (v.found.length >= 2) {
        const min = Math.min(...v.found), max = Math.max(...v.found);
        results.push({ template, range: [min, max], found: v.found });
      }
    });
    return results[0] || null;
  }

  function detectMirrors(html, doc, base) {
    const baseHost = new URL(base).hostname;
    const mirrors = new Set();

    // Numeric variations: site1.com → site2.com
    const numRx = new RegExp(baseHost.replace(/\d+/, '(\\d+)'), 'g');
    let m;
    while ((m = numRx.exec(html))) {
      const mirror = baseHost.replace(/\d+/, m[1]);
      if (mirror !== baseHost) mirrors.add(mirror);
    }

    // Explicit mirror links
    doc.querySelectorAll('a[href*="mirror"], a[href*="альтернатив"], a[href*="alternative"]').forEach(a => {
      try { mirrors.add(new URL(a.href).hostname); } catch {}
    });

    // Same name different TLD
    const baseName = baseHost.split('.').slice(0, -1).join('.');
    const tlds = ['com', 'net', 'org', 'me', 'to', 'cc', 'tv', 'xxx'];
    tlds.forEach(tld => {
      const mirror = `${baseName}.${tld}`;
      if (mirror !== baseHost && html.includes(mirror)) mirrors.add(mirror);
    });

    mirrors.delete(baseHost);
    return { mirrors: [...mirrors], totalFound: mirrors.size };
  }

  // ═══════════════════════════════════════════════════════════════
  // WORKER VERDICT
  // ═══════════════════════════════════════════════════════════════
  function assessWorkerNecessity(protection, redirectChain, kvsEngine) {
    const reasons = [];
    let mode = 'none';

    if (protection.cloudflare) {
      return { required: true, mode: 'impossible', reasons: ['Cloudflare JS Challenge detected'], summary: 'Site uses JS challenge — headless browser required' };
    }
    if (protection.ageGate) {
      reasons.push('Age gate requires cookie bypass');
      mode = 'cors-proxy';
    }
    if (kvsEngine.isKvs && kvsEngine.markers.get_file_pattern) {
      reasons.push('KVS /get_file/ requires redirect follow');
      mode = 'follow-redirect';
    }
    if (kvsEngine.isKvs && kvsEngine.markers.function_prefix) {
      reasons.push('KVS function/N/ encoded URL requires page load to resolve');
      mode = 'resolve-page';
    }
    if (protection.refererProtected) {
      reasons.push('Referer header control needed for CDN access');
      if (mode === 'none') mode = 'cors-proxy';
    }

    const required = mode !== 'none';
    const summary = required
      ? `Worker needed: ${mode} (${reasons.length} reason${reasons.length > 1 ? 's' : ''})`
      : 'Direct fetch should work';

    return { required, mode, reasons, summary };
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN ANALYZE FUNCTION
  // ═══════════════════════════════════════════════════════════════
  async function analyze(catalogUrl, videoUrl, options = {}) {
    const onProgress = options.onProgress || (() => {});
    const result = {
      _meta: { mode: videoUrl ? 'catalog+video' : 'catalog', tool: VERSION, timestamp: Date.now() },
      _analysisHistory: [],
    };

    // ── Step 1: Fetch catalog ──
    onProgress(10, 'Загрузка каталога...');
    const { html: catHtml, finalUrl: catFinalUrl, transport } = await NetworkLayer.fetchPage(catalogUrl);
    const catDoc = new DOMParser().parseFromString(catHtml, 'text/html');

    result.HOST = new URL(catFinalUrl).origin;
    result.NAME = new URL(catFinalUrl).hostname.replace(/^www\./, '').replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/g, '_');
    result.SITE_NAME = new URL(catFinalUrl).hostname;
    result._transport = transport;
    result._analysisHistory.push({ type: 'catalog', url: catFinalUrl, time: new Date().toISOString() });

    // ── Step 2: Cards ──
    onProgress(25, 'Определение карточек...');
    result.CARD = detectCards(catDoc, catFinalUrl);

    // ── Step 3: Categories + Build URL ──
    onProgress(35, 'Анализ навигации...');
    result.CATEGORIES = detectCategories(catDoc, catFinalUrl);
    result.SEARCH = detectSearch(catDoc, catHtml, catFinalUrl);
    result.BUILD_URL = detectBuildUrl(catDoc, catHtml, catFinalUrl, result.CATEGORIES);

    // ── Step 4: Protection ──
    onProgress(45, 'Проверка защиты...');
    result.PROTECTION = detectProtection(catHtml, catDoc);

    // ── Step 5: Mirrors ──
    result.MIRRORS = detectMirrors(catHtml, catDoc, catFinalUrl);

    // ── Step 6: Video page analysis (if provided) ──
    if (videoUrl) {
      onProgress(55, 'Загрузка страницы видео...');
      const { html: vidHtml, finalUrl: vidFinalUrl } = await NetworkLayer.fetchPage(videoUrl);
      result._analysisHistory.push({ type: 'video', url: vidFinalUrl, time: new Date().toISOString() });

      // Fetch external JS files referenced on video page
      onProgress(65, 'Анализ JS файлов...');
      const vidDoc = new DOMParser().parseFromString(vidHtml, 'text/html');
      const extJS = await _fetchExternalJS(vidDoc, vidFinalUrl);

      // Detect strategies
      onProgress(75, 'Определение стратегий...');
      const { strategies, deadStrategies, debugReport } = detectAllStrategies(vidHtml, extJS, vidFinalUrl);

      result.STRATEGIES = strategies.filter(s => s.confidence !== 'inferred' || s.block < 4);
      result.DEAD_STRATEGIES = deadStrategies;
      result.DEBUG_REPORT = debugReport;
      result.ACTIVE_STRATEGIES = Object.fromEntries(strategies.map(s => [s.id, s.confidence === 'confirmed']));
      result.strategyOrder = strategies.filter(s => s.confidence === 'confirmed').map(s => s.id);
      const confirmed = strategies.filter(s => s.confidence === 'confirmed').length;
      const detected  = strategies.filter(s => s.confidence === 'detected').length;
      result.strategySummary = {
        total: strategies.length,
        confirmed,
        detected,
        recommendedBlock: confirmed ? Math.min(...strategies.filter(s => s.confidence === 'confirmed').map(s => s.block)) : 2,
      };

      // KVS
      onProgress(85, 'Анализ KVS...');
      result.KVS_ENGINE = detectKvsEngine(vidHtml, extJS);
      if (result.KVS_ENGINE.licenseCode) {
        const allVideoUrls = strategies.flatMap(s => s.foundUrls).filter(u => u && u.includes('function/'));
        if (allVideoUrls.length) {
          result.KT_DECODE = tryKtDecode(allVideoUrls[0], result.KVS_ENGINE.licenseCode) || {};
        }
      }

      // CDN domains from found URLs
      const allUrls = strategies.flatMap(s => s.foundUrls).filter(Boolean);
      const cdnDomains = [...new Set(allUrls.map(u => { try { return new URL(u).hostname; } catch { return null; } }).filter(Boolean))];
      result.CDN_REDIRECT = { domain: cdnDomains[0] || null, resumable: false, size: null };
      result.WORKER_WHITELIST = { required: cdnDomains, cdnPatterns: [] };
      const cdnPattern = detectCdnPattern(cdnDomains);
      if (cdnPattern) {
        result.CDN_REDIRECT.pattern = cdnPattern.template;
        result.WORKER_WHITELIST.cdnPatterns = [cdnPattern.template];
      }

      result.REDIRECT = {
        requiresFollow: result.KVS_ENGINE.markers.get_file_pattern,
        getFilePattern: result.KVS_ENGINE.markers.get_file_pattern,
        resolved: [],
      };
    } else {
      result.STRATEGIES = [];
      result.DEAD_STRATEGIES = [];
      result.DEBUG_REPORT = {};
      result.ACTIVE_STRATEGIES = {};
      result.strategyOrder = [];
      result.strategySummary = { total: 0, confirmed: 0, detected: 0, recommendedBlock: 1 };
      result.KVS_ENGINE = { isKvs: false, confidence: 0, markers: {}, markerCount: 0, licenseCode: null };
      result.REDIRECT = { requiresFollow: false, getFilePattern: false, resolved: [] };
      result.CDN_REDIRECT = { domain: null, resumable: false, size: null };
      result.WORKER_WHITELIST = { required: [], cdnPatterns: [] };
    }

    // ── Step 7: Worker verdict ──
    onProgress(92, 'Оценка Worker...');
    result.WORKER_VERDICT = assessWorkerNecessity(result.PROTECTION, result.REDIRECT, result.KVS_ENGINE);

    // ── Step 8: Template integration helpers ──
    result.templateIntegration = _buildTemplateIntegration(result);

    onProgress(100, 'Готово');
    return result;
  }

  async function _fetchExternalJS(doc, base) {
    const scripts = [...doc.querySelectorAll('script[src]')]
      .map(s => absoluteUrl(s.getAttribute('src'), base))
      .filter(u => u && /video|player|jwplayer|flowplayer|html5|plyr/i.test(u))
      .slice(0, 3);

    const results = await Promise.allSettled(scripts.map(async url => {
      const { html } = await NetworkLayer.fetchPage(url);
      return html;
    }));
    return results.filter(r => r.status === 'fulfilled').map(r => r.value);
  }

  function _buildTemplateIntegration(data) {
    const menuJson = JSON.stringify({
      title: data.SITE_NAME,
      url: data.HOST,
      parser: data.NAME,
    }, null, 2);

    const domainMap = `'${data.SITE_NAME}': '${data.NAME}'`;

    const workerWhitelist = data.WORKER_WHITELIST.required.map(d => `'${d}'`).join(', ');

    return { menuJson, domainMap, workerWhitelist };
  }

  // ═══════════════════════════════════════════════════════════════
  // ARCHITECTURE RENDERER (genArch)
  // ═══════════════════════════════════════════════════════════════
  function genArch(data) {
    const blocks = [];

    // ── Cards block ──
    const cardWarn = data.CARD.validationWarnings || [];
    const cardStatus = cardWarn.some(w => w.severity === 'critical') ? 'err'
                     : cardWarn.some(w => w.severity === 'high') ? 'warn' : 'ok';
    blocks.push(`
      <div class="arch-block">
        <div class="arch-header">
          <span class="arch-icon">🃏</span>
          <span class="arch-title">Карточки видео</span>
          <span class="arch-badge badge-${cardStatus}">${data.CARD.totalFound} найдено</span>
        </div>
        ${cardWarn.length ? `<div class="hint-block ${cardStatus === 'err' ? 'error' : ''}">
          ${cardWarn.map(w => `<div class="hint-line">⚠️ ${w.code} (${w.severity})</div>`).join('')}
          ${cardStatus === 'err' ? `<div class="hint-action">
            <span>Попробуйте другой URL:</span>
            <input id="altUrl" placeholder="/videos/ · /most-popular/ · /latest-updates/" class="hint-input">
            <button onclick="SiteAnalyzer._retryWithUrl()" class="btn-sm">↺ Попробовать</button>
          </div>` : ''}
        </div>` : ''}
        <div class="kv-grid">
          ${_kv('Контейнер', `<code>${data.CARD.container || '—'}</code>`)}
          ${_kv('Ссылка', `<code>${data.CARD.link || '—'}</code>`)}
          ${_kv('Заголовок', `<code>${data.CARD.title || '—'}</code>`)}
          ${_kv('Превью', `<code>${data.CARD.thumb || '—'}</code> <small>[${data.CARD.thumbAttr}]</small>`)}
          ${_kv('Длительность', `<code>${data.CARD.duration || '—'}</code>`)}
        </div>
        ${data.CARD.sampleCards?.length ? `
          <div class="sample-cards">
            ${data.CARD.sampleCards.slice(0, 3).map(c => `
              <div class="sample-card">
                ${c.thumb ? `<img src="${_esc(c.thumb)}" class="sample-thumb" loading="lazy" onerror="this.style.display='none'">` : '<div class="sample-thumb-placeholder">🎬</div>'}
                <div class="sample-info">
                  <div class="sample-title">${_esc(c.title || '—')}</div>
                  <div class="sample-meta">${_esc(c.duration || '')}${c.link ? ` · <a href="${_esc(c.link)}" target="_blank" class="sample-link">↗</a>` : ''}</div>
                </div>
              </div>`).join('')}
          </div>` : ''}
      </div>`);

    // ── Categories block ──
    blocks.push(`
      <div class="arch-block">
        <div class="arch-header">
          <span class="arch-icon">📂</span>
          <span class="arch-title">Категории</span>
          <span class="arch-badge badge-${data.CATEGORIES.length ? 'ok' : 'warn'}">${data.CATEGORIES.length}</span>
        </div>
        ${!data.CATEGORIES.length ? `<div class="hint-block">
          <span>Категории не найдены. Загрузите страницу категорий:</span>
          <input id="catUrl" placeholder="${data.HOST}/categories/" class="hint-input">
          <button onclick="SiteAnalyzer._loadCategories()" class="btn-sm">📂 Загрузить</button>
        </div>` : `
        <div class="cat-list">
          ${data.CATEGORIES.slice(0, 20).map(c => `<span class="cat-tag">${_esc(c.title)}</span>`).join('')}
          ${data.CATEGORIES.length > 20 ? `<span class="cat-tag cat-more">+${data.CATEGORIES.length - 20}</span>` : ''}
        </div>`}
      </div>`);

    // ── Search + Build URL ──
    blocks.push(`
      <div class="arch-block">
        <div class="arch-header"><span class="arch-icon">🔍</span><span class="arch-title">Поиск и URL</span></div>
        <div class="kv-grid">
          ${_kv('Поиск', `<code>${_esc(data.SEARCH?.pattern || '—')}</code> <span class="badge badge-${data.SEARCH?.type === 'slug' ? 'warn' : 'ok'}">${data.SEARCH?.type || '—'}</span>`)}
          ${_kv('Главная', `<code>${_esc(data.BUILD_URL?.main || '/')}</code>`)}
          ${_kv('Категория', `<code>${_esc(data.BUILD_URL?.category || '—')}</code>`)}
          ${_kv('Пагинация', `<code>${_esc(data.BUILD_URL?.pagination || '—')}</code>`)}
        </div>
      </div>`);

    // ── Strategies ──
    if (data.STRATEGIES?.length) {
      const strats = data.STRATEGIES.filter(s => s.confidence !== 'inferred');
      blocks.push(`
        <div class="arch-block">
          <div class="arch-header">
            <span class="arch-icon">🎯</span>
            <span class="arch-title">Стратегии (S1–S25)</span>
            <span class="arch-badge badge-ok">${data.strategySummary.confirmed} confirmed</span>
            ${data.strategySummary.detected ? `<span class="arch-badge badge-warn">${data.strategySummary.detected} detected</span>` : ''}
          </div>
          <table class="strat-table">
            <thead><tr><th>ID</th><th>Название</th><th>Block</th><th>Статус</th><th>URLs</th></tr></thead>
            <tbody>
              ${strats.map(s => `
                <tr class="strat-${s.confidence}">
                  <td><code>${s.id}</code></td>
                  <td>${s.name}</td>
                  <td><span class="block-badge">B${s.block}</span></td>
                  <td><span class="conf-badge conf-${s.confidence}">${s.confidence}</span></td>
                  <td>${s.foundUrls.length ? `<span class="url-count">${s.foundUrls.length} URL</span>` : '—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${data.DEAD_STRATEGIES?.length ? `
            <details class="dead-details">
              <summary>💀 Мёртвые стратегии (${data.DEAD_STRATEGIES.length})</summary>
              ${data.DEAD_STRATEGIES.map(d => `<div class="dead-item"><code>${d.id}</code> — ${_esc(d.evidence)} · <small>${_esc(d.suggestion)}</small></div>`).join('')}
            </details>` : ''}
        </div>`);
    }

    // ── KVS Engine ──
    if (data.KVS_ENGINE?.markerCount > 0) {
      const kvs = data.KVS_ENGINE;
      blocks.push(`
        <div class="arch-block">
          <div class="arch-header">
            <span class="arch-icon">🔧</span>
            <span class="arch-title">KVS Engine</span>
            <span class="arch-badge badge-${kvs.isKvs ? 'ok' : 'warn'}">${kvs.isKvs ? 'Detected' : 'Unlikely'} (${Math.round(kvs.confidence * 100)}%)</span>
          </div>
          <div class="kvs-markers">
            ${Object.entries(kvs.markers).map(([k, v]) => `<span class="kvs-marker ${v ? 'on' : 'off'}">${k.replace(/_/g, ' ')}</span>`).join('')}
          </div>
          ${kvs.licenseCode ? `<div class="kv-grid">${_kv('license_code', `<code>${_esc(kvs.licenseCode)}</code>`)}</div>` : ''}
        </div>`);
    }

    // ── Protection ──
    blocks.push(`
      <div class="arch-block">
        <div class="arch-header"><span class="arch-icon">🛡️</span><span class="arch-title">Защита</span></div>
        <div class="kvs-markers">
          <span class="kvs-marker ${data.PROTECTION?.cloudflare ? 'on err' : 'off'}">Cloudflare</span>
          <span class="kvs-marker ${data.PROTECTION?.ageGate ? 'on' : 'off'}">Age Gate</span>
          <span class="kvs-marker ${data.PROTECTION?.refererProtected ? 'on' : 'off'}">Referer Lock</span>
        </div>
        ${data.PROTECTION?.cloudflare ? `<div class="hint-block error">⚠️ JS Challenge: парсинг невозможен без headless браузера</div>` : ''}
      </div>`);

    // ── Worker Verdict ──
    const vrd = data.WORKER_VERDICT;
    blocks.push(`
      <div class="arch-block">
        <div class="arch-header">
          <span class="arch-icon">⚖️</span>
          <span class="arch-title">Worker Verdict</span>
          <span class="arch-badge badge-${vrd?.required ? (vrd.mode === 'impossible' ? 'err' : 'warn') : 'ok'}">${vrd?.mode || 'none'}</span>
        </div>
        <div class="kv-grid">${_kv('Нужен Worker', vrd?.required ? '✅ Да' : '❌ Нет')}</div>
        ${vrd?.reasons?.length ? `<ul class="verdict-reasons">${vrd.reasons.map(r => `<li>${_esc(r)}</li>`).join('')}</ul>` : ''}
        <div class="verdict-summary">${_esc(vrd?.summary || '')}</div>
      </div>`);

    // ── Mirrors ──
    if (data.MIRRORS?.totalFound) {
      blocks.push(`
        <div class="arch-block">
          <div class="arch-header"><span class="arch-icon">🪞</span><span class="arch-title">Зеркала (${data.MIRRORS.totalFound})</span></div>
          <div class="cat-list">${data.MIRRORS.mirrors.map(m => `<span class="cat-tag">${_esc(m)}</span>`).join('')}</div>
        </div>`);
    }

    // ── Summary ──
    blocks.push(`
      <div class="arch-block arch-summary">
        <div class="arch-header"><span class="arch-icon">📊</span><span class="arch-title">Итог</span></div>
        <table class="summary-table">
          <tr><td>HOST</td><td><code>${_esc(data.HOST)}</code></td></tr>
          <tr><td>NAME</td><td><code>${_esc(data.NAME)}</code></td></tr>
          <tr><td>Транспорт</td><td><code>${_esc(data._transport || '—')}</code></td></tr>
          <tr><td>Карточек</td><td>${data.CARD.totalFound}</td></tr>
          <tr><td>Категорий</td><td>${data.CATEGORIES.length}</td></tr>
          <tr><td>Стратегий confirmed</td><td>${data.strategySummary?.confirmed || 0}</td></tr>
          <tr><td>KVS</td><td>${data.KVS_ENGINE?.isKvs ? '✅' : '—'}</td></tr>
          <tr><td>Worker needed</td><td>${data.WORKER_VERDICT?.required ? '✅ ' + data.WORKER_VERDICT.mode : '—'}</td></tr>
        </table>
        <div class="fixture-bar">
          <button onclick="SiteAnalyzer.saveFixture()" class="btn-sm">💾 Сохранить фикстуру</button>
          <button onclick="SiteAnalyzer.exportFixtures()" class="btn-sm">📤 Экспорт fixtures.json</button>
          <span class="fixture-count">Фикстур: <b id="fixtureCount">0</b></span>
        </div>
      </div>`);

    return blocks.join('');
  }

  function _kv(k, v) {
    return `<div class="kv-row"><span class="kv-key">${k}</span><span class="kv-val">${v}</span></div>`;
  }

  function _esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ═══════════════════════════════════════════════════════════════
  // FIXTURE REPORTER
  // ═══════════════════════════════════════════════════════════════
  let _lastAnalysis = null;
  let _lastRawHtml = null;

  function saveFixture() {
    if (!_lastAnalysis) return;
    const all = _loadFixtures();
    const fix = {
      id: Date.now(),
      label: _lastAnalysis.HOST,
      savedAt: new Date().toISOString(),
      htmlSnippet: _lastRawHtml ? _lastRawHtml.slice(0, 2000) : '',
      isEdgeCase: false,
      notes: '',
      expected: {
        strategies: (_lastAnalysis.STRATEGIES || []).map(s => ({ id: s.id, confidence: s.confidence })),
        cardSelector: _lastAnalysis.CARD?.container,
        totalCards: _lastAnalysis.CARD?.totalFound,
        workerMode: _lastAnalysis.WORKER_VERDICT?.mode,
        kvsEngine: _lastAnalysis.KVS_ENGINE?.isKvs,
      },
    };
    all.push(fix);
    localStorage.setItem('analyzer_fixtures', JSON.stringify(all.slice(-100)));
    document.getElementById('fixtureCount').textContent = all.length;
    _showToast('💾 Фикстура сохранена');
  }

  function exportFixtures() {
    const all = _loadFixtures();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fixtures_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  function _loadFixtures() {
    try { return JSON.parse(localStorage.getItem('analyzer_fixtures') || '[]'); } catch { return []; }
  }

  function _showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  // ── Retry helpers called from arch UI ──
  function _retryWithUrl() {
    const url = document.getElementById('altUrl')?.value?.trim();
    if (url) document.getElementById('mainUrl').value = url, triggerAnalyze();
  }

  function _loadCategories() {
    const url = document.getElementById('catUrl')?.value?.trim();
    if (url) document.getElementById('videoUrl').value = url, triggerAnalyze();
  }

  function triggerAnalyze() {
    document.getElementById('btnAnalyze')?.click();
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════
  global.SiteAnalyzer = {
    analyze,
    genArch,
    NetworkLayer,
    detectAllStrategies,
    detectCards,
    detectKvsEngine,
    tryKtDecode,
    detectCdnPattern,
    detectMirrors,
    assessWorkerNecessity,
    saveFixture,
    exportFixtures,
    _retryWithUrl,
    _loadCategories,
    STRATEGY_DEFS,
    VERSION,
    _setLastAnalysis(data, html) { _lastAnalysis = data; _lastRawHtml = html; },
  };

})(window);
