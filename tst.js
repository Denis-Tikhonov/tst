(function () {
    'use strict';

    /**
     * Модуль Pornobriz для AdultJS
     */
    var source = function () {
        this.name = 'Pornobriz';
        this.title = 'Pornobriz';
        this.link = 'https://pornobriz.com';
        this.icon = 'https://pornobriz.com/img/logo.png';
        this.network = new Lampa.Reguest(); // Используем сетевой класс Lampa

        // Создаем список категорий для меню AdultJS
        this.menu = [
            { title: 'Главная', url: 'https://pornobriz.com/' },
            { title: 'Топ рейтинга', url: 'https://pornobriz.com/top/' },
            { title: 'Азиатки', url: 'https://pornobriz.com/asian/' },
            { title: 'Анальный секс', url: 'https://pornobriz.com/anal/' },
            { title: 'БДСМ', url: 'https://pornobriz.com/bdsm/' },
            { title: 'Блондинки', url: 'https://pornobriz.com/blonde/' },
            { title: 'Милфы', url: 'https://pornobriz.com/milf/' },
            { title: 'Молодые', url: 'https://pornobriz.com/seks-molodye/' },
            { title: 'Лесбиянки', url: 'https://pornobriz.com/lesbian/' }
        ];

        /**
         * Метод получения списка видео (Каталог)
         */
        this.list = function (params, onSuccess, onError) {
            var url = params.url || 'https://pornobriz.com/';
            
            this.network.silent(url, function (html) {
                try {
                    var items = [];
                    // Используем регулярки вместо DOMParser для скорости и стабильности на TV
                    var cardRegex = /<div class="item">([\s\S]*?)<\/div><\/div>/g;
                    var match;

                    while ((match = cardRegex.exec(html)) !== null) {
                        var cardHtml = match[1];
                        
                        var linkMatch = cardHtml.match(/href="([^"]*\/video\/[^"]*)"/);
                        var titleMatch = cardHtml.match(/title="([^"]*)"/);
                        var imgMatch = cardHtml.match(/src="([^"]*(?:content\/screen|preview)[^"]*)"/);
                        var durMatch = cardHtml.match(/<span class="duration">([^<]*)<\/span>/);

                        if (linkMatch && titleMatch) {
                            items.push({
                                title: titleMatch[1],
                                url: linkMatch[1].indexOf('http') === 0 ? linkMatch[1] : 'https://pornobriz.com' + linkMatch[1],
                                img: imgMatch ? (imgMatch[1].indexOf('http') === 0 ? imgMatch[1] : 'https://pornobriz.com' + imgMatch[1]) : '',
                                quantity: '720p',
                                duration: durMatch ? durMatch[1] : ''
                            });
                        }
                    }
                    onSuccess(items);
                } catch (e) {
                    onError();
                }
            }, onError);
        };

        /**
         * Метод получения прямой ссылки на видео
         */
        this.video = function (params, onSuccess, onError) {
            this.network.silent(params.url, function (html) {
                try {
                    // Ищем прямую ссылку на .mp4
                    var videoMatch = html.match(/src="([^"]*preview[^"]*\.mp4)"/) || 
                                     html.match(/['"]url['"]?\s*:\s*['"]([^'"]*\.mp4[^'"]*)['"]/);
                    
                    if (videoMatch) {
                        var videoUrl = videoMatch[1];
                        if (videoUrl.indexOf('http') !== 0) videoUrl = 'https://pornobriz.com' + videoUrl;
                        
                        onSuccess({
                            path: videoUrl
                        });
                    } else {
                        // Резервный метод генерации ссылки по ID
                        var idMatch = params.url.match(/\/video\/([a-z0-9_-]+)\/?/);
                        if (idMatch) {
                            onSuccess({
                                path: 'https://pornobriz.com/preview/' + idMatch[1] + '.mp4'
                            });
                        } else {
                            onError();
                        }
                    }
                } catch (e) {
                    onError();
                }
            }, onError);
        };

        /**
         * Поиск (сайт Pornobriz плохо поддерживает поиск через GET, оставляем заглушку)
         */
        this.search = function (params, onSuccess, onError) {
            onSuccess([]);
        };
    };

    // Регистрация в AdultJS
    if (window.adult_sources) {
        window.adult_sources.push(new source());
    } else {
        // Если AdultJS еще не загружен, подождем или создадим массив
        window.adult_sources = [new source()];
    }
})();
