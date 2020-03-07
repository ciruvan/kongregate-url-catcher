// ==UserScript==
// @name         Kongregate URL Catcher
// @namespace    http://tampermonkey.net/
// @version      0.3.4
// @description  Simple tool that continuously checks your Kongregate chat and lists links posted there
// @author       ciruvan
// @include      https://www.kongregate.com/games/*
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.listValues
// @nocompat     opera
// @updateURL    https://raw.githubusercontent.com/ciruvan/kongregate-url-catcher/master/url-catcher.js
// @downloadURL  https://raw.githubusercontent.com/ciruvan/kongregate-url-catcher/master/url-catcher.js
// ==/UserScript==

// This is a very early version. There's lots of code here that has been disabled because it doesn't really work yet.

let divId = "url-catcher";

class Settings {
    constructor(parentElem) {
        this.parentElem = parentElem;
        this.position = {};
        this.size = {};
        this.initEvents();
        this.load().then(function() {
            this.parentElem.html(this.getHTML());
        }.bind(this));
    }

    initEvents() {
        $(document).on('click', '#btn-save-settings', function() {
            this.save();
        }.bind(this));
    }

    getHTML() {
        let html =
            '<table class="url-catcher-settings">'
            + '<tr><td style="width: 100%;"><label for="setting-clickable">Links clickable in chat</label></td>'
            + '<td style="width: 100px; text-align: center;"><input type="checkbox" name="setting-clickable" id="setting-clickable" ' + (this.clickable ? 'checked' : '') + '></td></tr>'

            + '<tr><td><label for="setting-friends">Ignore links not posted by friends</label></td>'
            + '<td style="text-align: center;"><input type="checkbox" name="setting-friends" id="setting-friends" ' + (this.friends ? 'checked' : '') + '></td></tr>'

            + '<tr><td><label for="setting-position">Window position on load</label></td>'
            + '<td style="text-align: center;"><select name="setting-position" id="setting-position">'
            + '<option value="restore">Restore last</option>'
            + '<option value="left">Left of game</option>'
            + '<option value="right">Right of game</option>'
            + '</select</td></tr>'

            + '<tr><td><label for="setting-size">Restore window size on load</label></td>'
            + '<td style="text-align: center;"><input type="checkbox" name="setting-size" id="setting-size" ' + (this.size.restore ? 'checked' : '') + '></td></tr>'

            + '<tr><td><label for="setting-youtube">Fetch Youtube video titles</label></td>'
            + '<td style="text-align: center;"><input type="checkbox" name="setting-youtube" id="setting-youtube" ' + (this.youtube ? 'checked' : '') + '></td></tr>'

            + '<tr><td><label for="setting-links">Open links in..</label></td>'
            + '<td style="text-align: center;"><select name="setting-links" id="setting-links">'
            + '<option value="tab">New tab</option>'
            + '<option value="window">New window</option>'
            + '</select</td></tr>'

            + '</table>'
            + '<table style="width: 100%;"><tr><td style="text-align: right;"><button class="button" id="btn-save-settings">Save</button></td></tr></table>'
        ;

        return html;
    }

    async save() {
        await GM.setValue('clickable', $('#setting-clickable').checked);
        await GM.setValue('friends', $('#setting-friends').checked);
        await GM.setValue('position', this.position.opt);
        await GM.setValue('positionX', this.position.x);
        await GM.setValue('positionY', this.position.y);
        await GM.setValue('sizeRestore', $('#setting-size').checked);
        await GM.setValue('sizeX', this.size.x);
        await GM.setValue('sizeY', this.size.y);
        await GM.setValue('youtube', $('#setting-youtube').checked);
        console.log(await GM.listValues());
        console.log(await GM.getValue('clickable'));
    }

    load() {
        const myPromise = new Promise(async function(resolve, reject) {
            this.clickable = await GM.getValue('clickable', true);
            this.friends = await GM.getValue('friends', true);
            this.position.opt = await GM.getValue('position', 'right');
            this.position.x = await GM.getValue('positionX', 0);
            this.position.y = await GM.getValue('positionY', 0);
            this.size.restore = await GM.getValue('sizeRestore', false);
            this.size.x = await GM.getValue('sizeX', 0);
            this.size.y = await GM.getValue('sizeY', 0);
            this.youtube = await GM.getValue('youtube', false);
            resolve('loaded');
        }.bind(this));

        return myPromise;
    }
}

class Link {
    constructor(time, user, link, room, isPrivate) {
        this.time = time;
        this.user = user;
        this.link = link;
        this.room = room;
        this.isPrivate = isPrivate;
    }

    getHash() {
        let myString = this.time + this.user + this.link + this.room;
        return calculateHash(myString);
    }

    getHTML() {
        let html =
            '<tr><td>' + this.time + '</td><td class="trunc">' + this.user + '</td><td class="trunc">' + this.room + '</td></tr>'
            + '<tr><td></td><td colspan="2" class="trunc"><a href="' + this.link + '" target="_blank">' + this.link + '</a></td></tr>';

        return html;
    }
}

class LinkList {
    constructor(parentElem) {
        this.parentElem = parentElem;
        this.links = [];
    }

    updateList() {
        this.clear();

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

            const matches = message.matchAll(re_weburl);
            for (const match of matches) {
                // remove non-breaking space
                let url = match[0].replace('&nbsp;', '');
                let link = new Link(time, user, url, room, whisper);
                this.addLink(link);
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
        this.links.forEach(function(item) {
            if (item.hash == hash) {
                return true;
            }
        });

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
        this.links.forEach(function(item) {
            inner.push(item.getHTML());
        });

        let html =
            '<table class="link-table">' + inner.join('') + '</table>';

        return html;
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
                //this.settings = new Settings($('#tab-settings'));
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
            //            + '    <li><a href="#tab-settings">Settings</a></li>' (settings don't work yet)
            + '  </ul>'
            + '  <div id="tab-urls" class="url-catcher-tab">'
            + '  </div>'
            //            + '  <div id="tab-settings" class="url-catcher-tab">'
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
        + 'background-color: #ddd;' + roundedCorners + '; font-size: 0.55rem !important; z-index: 99999;}'
    );
    styles.push('#url-catcher .url-catcher-header {cursor: grab; padding: 3px; font-size: 0.6rem !important; ' + roundedCorners + '}');
    styles.push('#url-catcher #tabs {position: absolute; top: 31px; left: 3px; right: 3px; bottom: 3px;}');
    styles.push('#url-catcher .ui-tabs-panel {padding: 0.3em 0.3em;}');
    styles.push('#url-catcher .link-table {width: 100%; table-layout: fixed; border-collapse: collapse;}');
    styles.push('#url-catcher .link-table td:nth-child(1) {width: 40px;}');
    styles.push('#url-catcher .link-table td:nth-child(2) {width: 90px;}');
    styles.push('#url-catcher .link-table td {padding: 0 3px 3px 3px;}');
    styles.push('#url-catcher .trunc {white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;}');
    styles.push('#url-catcher .link-table tr:nth-child(4n+1), #url-catcher .link-table tr:nth-child(4n+2) {background: #fff;}');
    styles.push('#url-catcher .link-table tr:nth-child(4n+3), #url-catcher .link-table tr:nth-child(4n+4) {background: #eee;}');
    styles.push('#url-catcher .url-catcher-tab {overflow-y: auto; position: absolute; top: 30px; bottom: 0px;}');
    styles.push('#url-catcher .url-catcher-settings {width: 100%; table-layout: fixed; border-collapse: collapse; border-bottom: 1px solid #aaa; margin-bottom: 6px; padding: 0 3px 3px 3px;}');
    styles.push('#url-catcher .url-catcher-settings tr:nth-child(2n+1) {background: #fff;}');
    styles.push('#url-catcher .url-catcher-settings tr:nth-child(2n+2) {background: #eee;}');
    styles.push('#url-catcher .url-catcher-settings input[type="checkbox"] {margin-top: 5px;}');
    styles.push('#url-catcher .url-catcher-settings select {margin: 3px 0 3px 0;}');
    styles.push('#url-catcher .url-catcher-settings option {font-size: 0.55rem;}');
    styles.push('#url-catcher .url-catcher-settings td {padding-left: 3px;}');
    styles.push('#url-catcher .button {padding: 4px; min-width: 80px; font-weight: bold;}');

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

// MAIN ENTRY POINT

$(window).load(function() {
    "use strict";

    const catcher = new URLCatcherApp();
});
