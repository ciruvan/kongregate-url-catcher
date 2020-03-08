// ==UserScript==
// @name         Kongregate URL Catcher
// @namespace    http://tampermonkey.net/
// @version      0.5.3
// @description  Simple tool that continuously checks your Kongregate chat and lists links posted there.
// @author       ciruvan
// @include      https://www.kongregate.com/games/*
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @nocompat     opera
// @updateURL    https://raw.githubusercontent.com/ciruvan/kongregate-url-catcher/master/url-catcher.js
// @downloadURL  https://raw.githubusercontent.com/ciruvan/kongregate-url-catcher/master/url-catcher.js
// ==/UserScript==

// Idea and additional testing by EisernerBrotkrum.

let divId = "url-catcher";
let settings = {};

class Settings {
    constructor(parentElem) {
        this.parentElem = parentElem;
        this.position = {};
        this.size = {};
        this.initEvents();
        this.load();
        this.parentElem.html(this.getHTML());
    }

    initEvents() {
        $(document).on('click', '#btn-save-settings', function() {
            this.save();
            $('#settings-saved-label').fadeIn(150, function(){
                $(this).delay(800).fadeOut();
            });
        }.bind(this));
    }

    getHTML() {
        let html =
            '<table class="url-catcher-settings">'

            + '<tr><td style="width: 100%;" class="trunc"><label for="setting-youtube">Try to fetch Youtube video titles</label></td>'
            + '<td style="width: 80px; text-align: center;"><input type="checkbox" name="setting-youtube" id="setting-youtube" ' + (this.youtube ? 'checked' : '') + '></td></tr>'

            + '<tr><td colspan="2" style="width: 100%; text-align: center;">'
            + '<input type="text" name="setting-youtube-apikey" id="setting-youtube-apikey" placeholder="Your YT API key" spellcheck="false" size="40" value="' + (this.youtubeApiKey ? this.youtubeApiKey : '') + '"></input></td></tr>'

            + '<tr><td style="width: 100%;" class="trunc"><label for="setting-clickable">Links clickable in chat</label></td>'
            + '<td style="width: 80px; text-align: center;"><input type="checkbox" name="setting-clickable" id="setting-clickable" ' + (this.clickable ? 'checked' : '') + '></td></tr>'

            //+ '<tr><td><label for="setting-friends">Ignore links not posted by friends</label></td>'
            //+ '<td style="text-align: center;"><input type="checkbox" name="setting-friends" id="setting-friends" ' + (this.friends ? 'checked' : '') + '></td></tr>'

            //+ '<tr><td><label for="setting-position">Window position on load</label></td>'
            //+ '<td style="text-align: center;"><select name="setting-position" id="setting-position">'
            //+ '<option value="restore">Restore last</option>'
            //+ '<option value="left">Left of game</option>'
            //+ '<option value="right">Right of game</option>'
            //+ '</select</td></tr>'

            //+ '<tr><td><label for="setting-size">Restore window size on load</label></td>'
            //+ '<td style="text-align: center;"><input type="checkbox" name="setting-size" id="setting-size" ' + (this.size.restore ? 'checked' : '') + '></td></tr>'

            + '</table>'
            + '<table style="width: 100%;"><tr><td style="width: 100%; text-align: right; padding-right: 10px;"><span id="settings-saved-label" style="display: none;">Saved!</span>'
            + '</td><td style="width: 140px; text-align: right;"><button class="button" id="btn-save-settings">Save</button></td></tr></table>'
        ;

        return html;
    }

    save() {
        GM_setValue('clickable', $('#setting-clickable').is(":checked"));
        GM_setValue('friends', $('#setting-friends').is(":checked"));
        GM_setValue('position', this.position.opt);
        GM_setValue('positionX', this.position.x);
        GM_setValue('positionY', this.position.y);
        GM_setValue('sizeRestore', $('#setting-size').is(":checked"));
        GM_setValue('sizeX', this.size.x);
        GM_setValue('sizeY', this.size.y);
        GM_setValue('youtube', $('#setting-youtube').is(":checked"));
        GM_setValue('youtubeApiKey', $('#setting-youtube-apikey').val());
        this.load();
    }

    load() {
        this.clickable = GM_getValue('clickable', true);
        this.friends = GM_getValue('friends', true);
        this.position.opt = GM_getValue('position', 'right');
        this.position.x = GM_getValue('positionX', 0);
        this.position.y = GM_getValue('positionY', 0);
        this.size.restore = GM_getValue('sizeRestore', false);
        this.size.x = GM_getValue('sizeX', 0);
        this.size.y = GM_getValue('sizeY', 0);
        this.youtube = GM_getValue('youtube', false);
        this.youtubeApiKey = GM_getValue('youtubeApiKey', false);
    }
}

class Link {
    constructor(time, user, link, room, isPrivate) {
        this.time = time;
        this.user = user;
        this.link = link;
        this.room = room;
        this.isPrivate = isPrivate;
        this.youtubeTitle = false;
    }

    getHash() {
        let myString = this.time + this.user + this.link + this.room;
        return calculateHash(myString);
    }

    getHTML(isEven) {
        let html =
            '<tr class="' + (isEven ? 'is-even' : 'is-odd') + '"><td>' + this.time + '</td><td class="trunc">' + this.user + '</td><td class="trunc">' + this.room + '</td></tr>'
            + '<tr class="' + (isEven ? 'is-even' : 'is-odd') + '"><td></td><td colspan="2" class="trunc"><a href="' + this.link + '" target="_blank">' + this.link + '</a></td></tr>';

        if (this.youtubeID() && settings.youtube && settings.youtubeApiKey) {
            let text = (this.youtubeTitle ? '[yt] ' + this.youtubeTitle : 'Fetching title..');

            html += '<tr class="' + (isEven ? 'is-even' : 'is-odd') + '"><td></td><td colspan="2" class="trunc youtube-title" id="link-' + this.getHash() + '">' + text + '</td></tr>';
            this.fetchYoutubeTitle();
        }

        return html;
    }

    youtubeID() {
        let regEx = /^http(?:s?):\/\/(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-\_]*)(&(amp;)?[\w\?=]*)?/g;
        let arr = regEx.exec(this.link);

        if (arr) {
            return arr[1];
        }
        return false;
    }

    fetchYoutubeTitle() {
        if (!this.youtubeTitle) {
            getYoutubeTitle(this.youtubeID(), settings.youtubeApiKey, function(error, title) {
                if (error) {
                    $('#link-' + this.getHash()).html('[yt] API error :(');
                } else {
                    this.youtubeTitle = title;
                    $('#link-' + this.getHash()).html('[yt] ' + title);
                }
            }.bind(this));
        }
    }
}

class LinkList {
    constructor(parentElem) {
        this.parentElem = parentElem;
        this.links = [];
    }

    updateList() {
        $('.chat_message_window .chat-message').each(function(index, elem) {
            let room = $('#chat_window_header .room_name').html();
            let whisper = false;

            if ($(elem).find('p').hasClass('whisper')) {
                room = 'whisper';
                whisper = true;
            };

            let timestamp = $(elem).find('.timestamp').html();
            let regEx = /\s-\s(.*[P|A]M)$/g;
            let arr = regEx.exec(timestamp);
            let time = arr[1];

            let user = $(elem).find('.username span').html();
            let message = $(elem).find('.message').html();

            const matches = message.replace('&nbsp;', '').matchAll(re_weburl);
            for (const match of matches) {
                // remove non-breaking space
                let url = match[0].replace('&nbsp;', '').replace('</a>', '').replace('"', '');
                let link = new Link(time, user, url, room, whisper);

                console.log('URL: ' + url);
                if (!this.contains(link.getHash())) {
                    if (settings.clickable && !message.includes('</a>')) {
                        $(elem).find('.message').html(message.replace('&nbsp;', '').replace(url, '<a href="' + url + '" target="_blank">' + url + '</a>'));
                    }

                    this.addLink(link);
                }
            }
        }.bind(this));

        this.parentElem.html(this.getHTML());

        // scroll URL tab down if necessary.
        let tableheight = parseInt(this.parentElem.find('.link-table').height());
        let divheight = parseInt(this.parentElem.height());

        if (tableheight > divheight) {
            $(this.parentElem).animate({scrollTop: tableheight});
        }
    }

    contains(hash) {
        for (let i = 0; i < this.links.length; i++) {
            if (this.links[i].getHash() === hash) {
                return true;
            }
        }

        return false;
    }

    addLink(link) {
        this.links.push(link);
    }

    clear() {
        this.links = [];
    }

    getHTML() {
        let inner = [];
        this.links.forEach(function(item, index) {
            inner.push(item.getHTML(index % 2 === 1));
        });

        return '<table class="link-table">' + inner.join('') + '</table>';
    }
}

class URLCatcherApp {
    constructor() {
        // Wait some time until Kong displays messages, then initialize everything
        setTimeout(function() {
            if (gameExists()) {
                initStyles();
                this.initApp();
                this.linkList = new LinkList($('#tab-urls'));
                settings = new Settings($('#tab-settings'));
            }
        }.bind(this), 500);
    }

    initApp() {
        let $div = $('<div />', {
            id: divId,
            html: this.getInitialContent()
        }).appendTo('body');

        $div.resizable();
        $div.draggable();
        $('#tabs').tabs();

        let observable = document.getElementById('chat_rooms_container');

        observable.addEventListener('DOMSubtreeModified', function(ev) {
            if (ev.target.classList.contains('chat_message_window')) {
                this.linkList.updateList();
            }
        }.bind(this), false);
    }

    getInitialContent() {
        let html =
            '<div><h4 class="ui-widget-header url-catcher-header">' + GM_info.script.name + ' v' + GM_info.script.version + '</h3>'
            + '<div id="tabs">'
            + '  <ul>'
            + '    <li><a href="#tab-urls">URLs</a></li>'
            + '    <li><a href="#tab-settings">Settings</a></li>'
            + '  </ul>'
            + '  <div id="tab-urls" class="url-catcher-tab">'
            + '  </div>'
            + '  <div id="tab-settings" class="url-catcher-tab">'
            + '  </div>'
            + '</div>'
            + '</div>';

        return html;
    }
}

// GLOBAL HELPER FUNCTIONS

function addGlobalStyles(css) {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) {
        return;
    }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
}

// Here be dragons. Or at least some annoying goblins.
function initStyles() {
    let position = $('#maingame').offset();
    let top = position.top;
    let left = position.left + $('#maingame').outerWidth() + 20;
    let height = $('#maingame').height();

    let styles = [];
    let roundedCorners = '-moz-border-radius: 4px; -webkit-border-radius: 4px; border-radius: 4px; -khtml-border-radius: 4px;'

    styles.push('#url-catcher {min-width: 155px; min-height: 200px; width: 300px; height: ' + height
        + 'px; padding: 0.5em; position: absolute; top: ' + top + 'px; left: ' + left + 'px; border: 1px solid; '
        + 'background-color: #ddd;' + roundedCorners + '; font-size: 0.56rem !important; z-index: 99999;}'
    );
    styles.push('#url-catcher .url-catcher-header {cursor: grab; padding: 3px; font-size: 0.6rem !important; ' + roundedCorners + '}');
    styles.push('#url-catcher #tabs {position: absolute; top: 31px; left: 3px; right: 3px; bottom: 3px;}');
    styles.push('#url-catcher .ui-tabs-panel {padding: 0.3em 0.3em;}');
    styles.push('#url-catcher .link-table {width: 100%; table-layout: fixed; border-collapse: collapse;}');
    styles.push('#url-catcher .link-table td:nth-child(1) {width: 40px;}');
    styles.push('#url-catcher .link-table td:nth-child(2) {width: 90px;}');
    styles.push('#url-catcher .link-table td {padding: 0 3px 3px 3px;}');
    styles.push('#url-catcher .link-table .youtube-title {font-style: italic;}');
    styles.push('#url-catcher .trunc {white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;}');
    styles.push('#url-catcher .link-table tr.is-odd {background: #fff;}');
    styles.push('#url-catcher .link-table tr.is-even {background: #eee;}');
    styles.push('#url-catcher .url-catcher-tab {overflow-y: auto; position: absolute; top: 30px; bottom: 0px;}');
    styles.push('#url-catcher .url-catcher-settings {width: 100%; table-layout: fixed; border-collapse: collapse; border-bottom: 1px solid #aaa; margin-bottom: 6px; padding: 0 3px 3px 3px;}');
    styles.push('#url-catcher .url-catcher-settings tr:nth-child(2n+1) {background: #fff;}');
    styles.push('#url-catcher .url-catcher-settings tr:nth-child(2n+2) {background: #eee;}');
    styles.push('#url-catcher .url-catcher-settings input[type="checkbox"] {margin-top: 5px;}');
    styles.push('#url-catcher .url-catcher-settings select {margin: 3px 0 3px 0;}');
    styles.push('#url-catcher .url-catcher-settings option {font-size: 0.56rem;}');
    styles.push('#url-catcher .url-catcher-settings td {padding-left: 3px;}');
    styles.push('#url-catcher .url-catcher-settings #setting-youtube-apikey {font-size: 0.56rem; height: 7px; margin: 3px 0 2px 0; text-align: center;}');
    styles.push('#url-catcher .button {padding: 4px; min-width: 80px; font-weight: bold;}');
    styles.push('#url-catcher #settings-saved-label {color: green;}');

    addGlobalStyles(styles.join("\n"));

    $('head').append(
        '<link href="//ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.min.css"'
        + ' rel="stylesheet" type="text/css">'
    );
}

function calculateHash(myString) {
    let hash = 0, i, chr;

    if (myString.length === 0) return hash;
    for (i = 0; i < myString.length; i++) {
        chr   = myString.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0;
    }

    return hash;
};

function gameExists() {
    return ($('#maingame').length && $('#chat_window').length);
}

// Regular Expression for URL validation
//
// Author: Diego Perini
// Created: 2010/12/05
// Updated: 2018/09/12
// License: MIT
//
// Copyright (c) 2010-2018 Diego Perini (http://www.iport.it)
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
let re_weburl = new RegExp(
    // protocol identifier (optional)
    // short syntax // still required
    "(?:(?:(?:https?|ftp):)?\\/\\/)" +
    // user:pass BasicAuth (optional)
    "(?:\\S+(?::\\S*)?@)?" +
    "(?:" +
    // IP address exclusion
    // private & local networks
    "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
    "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
    "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
    // IP address dotted notation octets
    // excludes loopback network 0.0.0.0
    // excludes reserved space >= 224.0.0.0
    // excludes network & broadcast addresses
    // (first & last IP address of each class)
    "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
    "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
    "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
    "|" +
    // host & domain names, may end with dot
    // can be replaced by a shortest alternative
    // (?![-_])(?:[-\\w\\u00a1-\\uffff]{0,63}[^-_]\\.)+
    "(?:" +
    "(?:" +
    "[a-z0-9\\u00a1-\\uffff]" +
    "[a-z0-9\\u00a1-\\uffff_-]{0,62}" +
    ")?" +
    "[a-z0-9\\u00a1-\\uffff]\\." +
    ")+" +
    // TLD identifier name, may end with dot
    "(?:[a-z\\u00a1-\\uffff]{2,}\\.?)" +
    ")" +
    // port number (optional)
    "(?::\\d{2,5})?" +
    // resource path (optional)
    "(?:[/?#]\\S*)?", "g"
);

function getYoutubeTitle(id, key, cb) {
    let url = 'https://www.googleapis.com/youtube/v3/videos?key=' + encodeURIComponent(key) + '&part=snippet&id=' + encodeURIComponent(id);

    let xhr = new XMLHttpRequest();
    xhr.open('get', url);

    xhr.onload = function () {
        try { var json = JSON.parse(xhr.responseText); } catch (err) { return cb(err); }
        if (json.error) return cb(json.error);
        if (json.items.length === 0) return cb(new Error('Not found'));
        cb(null, json.items[0].snippet.title);
    };
    xhr.onerror = function () {
        cb(new Error('Error contacting the YouTube API'));
    };
    xhr.onabort = function () {
        cb(new Error('Aborted'));
    };

    xhr.send();
}

// MAIN ENTRY POINT

$(window).load(function() {
    "use strict";

    const catcher = new URLCatcherApp();
});
