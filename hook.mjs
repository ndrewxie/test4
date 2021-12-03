import * as urls from './urls.mjs';
export const get_hook = base_url => `<script>
(function() {
    if (window.proxy_hook_nonce) {
        return;
    }
    window.proxy_hook_nonce = true;
    function encode_url(input_url) {
        let rewrite_invariants = ['data:', 'javascript:'];
        let lowered = ('' + input_url).toLowerCase();
        for (let j = 0; j < rewrite_invariants.length; j++) {
            if (lowered.startsWith(rewrite_invariants[j])) {
                return input_url;           
            }
        }
        if (lowered.includes('imasdk.googleapis') || lowered.includes('googlesyndication')) {
            return input_url;
        }
        if (encodeURIComponent(btoa(input_url)).includes('mFtcDtzPWUyMDc0ODk4ZTVmYmYwMThkZTIwMjU1MjUyNmZlMWZlZGFmYWMxMjY')) {
            alert(input_url);
        }
        return '${urls.WEBSITE_URL}' + '/requestdata?q=' + encodeURIComponent(btoa(input_url)) + '&baseurl=' + encodeURIComponent(btoa('${base_url}'));
    }
    window.XMLHttpRequest.prototype.old_open = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function() {
        let args = arguments;
        if (args[1]) {
            args[1] = encode_url(args[1]);
        }
        return this.old_open(...args);
    }

    let proxy_list = [
        [window.Image, ['src']],
        [window.HTMLImageElement, ['src', 'href']],
        [window.HTMLVideoElement, ['src']],
        [window.HTMLScriptElement, ['src']],
        [window.Image, ['src']],
        [window.HTMLLinkElement, ['href']],
        [window.HTMLAnchorElement, ['href']],
        [window.HTMLIFrameElement, ['src']]
    ];
    for (let j = 0; j < proxy_list.length; j++) {
        let target = proxy_list[j][0];
        let attributes = proxy_list[j][1];
        if (!target.prototype.old_set_attribute) {
            target.prototype.old_set_attribute = target.prototype.setAttribute;
            target.prototype.setAttribute = function() {
                let args = arguments;
                for (let k = 0; k < attributes.length; k++) {
                    if (args[0].toLowerCase() == attributes[k].toLowerCase()) {
                        args[1] = encode_url(args[1]);
                        break;
                    }
                }
                this.old_set_attribute(...args);
            }
            for (let k = 0; k < attributes.length; k++) {
                Object.defineProperty(target.prototype, attributes[k], {
                    set: function(input) {
                        this.old_set_attribute(attributes[k], encode_url(input));
                    }
                });
            }
        }
    }

    let old_websocket = window.WebSocket;
    window.WebSocket = function() {
        let args = arguments;
        args[0] = 'wss://${urls.WEBSITE_BASE_URL}?url=' + encodeURIComponent(args[0]);
        return new old_websocket(...args);
    }

    /*
    let old_request = window.Request;
    window.Request = function() {
        let args = arguments;
        if (typeof args[0] === 'string' || args[0] instanceof String) {
            alert(args[0]);
            args[0] = encode_url(args[0]);
        }
        return new old_request(...args);
    }
    */

    window.navigator.serviceWorker.old_sw_register = window.navigator.serviceWorker.register;
    window.navigator.serviceWorker.register = function() {
        let args = arguments;
        args[0] = encode_url(args[0]);
        return this.old_sw_register(...args);
    }

    function hook_iframe_ws(input) {
        if ((!input) || (!input.tagName)) {
            return;
        }
        if (input.tagName.toLowerCase() != 'iframe') {
            return;
        }
        if (!input.contentWindow) {
            return;
        }
        input.contentWindow.WebSocket = WebSocket;
    }
    window.Element.prototype.old_appendchild = window.Element.prototype.appendChild;
    window.Element.prototype.appendChild = function() {
        let to_return = this.old_appendchild(...arguments);
        hook_iframe_ws(arguments[0]);
        return to_return;
    }
    window.Element.prototype.old_prepend = window.Element.prototype.prepend;
    window.Element.prototype.prepend = function() {
        this.old_prepend(...arguments);
        hook_iframe_ws(arguments[0]);
    }

    let old_fetch = window.fetch;
    window.fetch = function() {
        let args = arguments;
        if (typeof args[0] == 'string' || args[0] instanceof String) {
            args[0] = encode_url(args[0]);
        }
        else if (args[0] instanceof URL) {
            alert("IS URL " + args[0].href);
            args[0] = encode_url(args[0].href);
        }
        return old_fetch(...args);
    }

    /*
    window.onerror = function(message, url, lineNumber) {
        alert("ERROR: " + message);
        return true;
    };
    */
})();
</script>`;