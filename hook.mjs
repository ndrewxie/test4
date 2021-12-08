import {url_code, urls} from './urls.mjs';

export const get_hook = requested_url => `<script>
(function() {
    if (window.proxy_hook_nonce) {
        return;
    }
    window.proxy_hook_nonce = true;
    
    let url_code_exports = (new Function(\`${url_code}\`))();
    let encode_url = function(input_url) {
        if (!input_url) {
            return input_url;
        }
        return url_code_exports.rewrite_url(input_url);
    }
    let decode_url = function(input_url) {
        if (!input_url) {
            return input_url;
        }
        return url_code_exports.literal_decode_url(input_url);
    }

    window.XMLHttpRequest.prototype.old_open = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function() {
        let args = arguments;
        if (args[1]) {
            args[1] = encode_url(args[1]);
        }
        return this.old_open(...args);
    }

    let attributes = ['href', 'src'];
    let special_proxy_targets = [
        [window.HTMLScriptElement, ['src']]
    ];
    let window_keys = Object.getOwnPropertyNames(window);
    for (let j = 0; j < window_keys.length; j++) {
        let current_node = window[window_keys[j]];
        if (!current_node) { continue; }
        current_node = current_node.prototype;

        let should_rewrite = false;
        let rewrite_attr_list = attributes;

        for (let k = 0; k < special_proxy_targets.length; k++) {
            if (special_proxy_targets[k][0].prototype == current_node) {
                rewrite_attr_list = special_proxy_targets[k][1];
                should_rewrite = true;
                break;
            }
        }

        if (!should_rewrite) {
            while (current_node) {
                current_node = Object.getPrototypeOf(current_node);
                if (current_node == window.Element.prototype) {
                    should_rewrite = true;
                    break;
                }
            }
            current_node = window[window_keys[j]].prototype;
        }
        if (!(should_rewrite && current_node)) {
            continue;
        }
        
        if (!current_node.old_set_attribute) {
            current_node.old_set_attribute = current_node.setAttribute;
            current_node.setAttribute = function() {
                let args = arguments;
                for (let k = 0; k < rewrite_attr_list.length; k++) {
                    if (args[0].toLowerCase() == rewrite_attr_list[k].toLowerCase()) {
                        args[1] = encode_url(args[1]);
                        break;
                    }
                }
                this.old_set_attribute(...args);
            }
        }
        if (!current_node.old_get_attribute) {
            current_node.old_get_attribute = current_node.getAttribute;
            current_node.getAttribute = function() {
                let to_return = this.old_get_attribute(...arguments);
                for (let k = 0; k < rewrite_attr_list.length; k++) {
                    if (arguments[0].toLowerCase() == rewrite_attr_list[k].toLowerCase()) {
                        return decode_url(to_return);
                    }
                }
                return to_return;
            }
        }

        for (let k = 0; k < rewrite_attr_list.length; k++) {
            Object.defineProperty(current_node, rewrite_attr_list[k], {
                set: function(input) {
                    this.old_set_attribute(rewrite_attr_list[k], encode_url(input));
                },
                get: function() {
                    return this.old_get_attribute(rewrite_attr_list[k]);
                },
                configurable: true
            });
        }
    }

    let old_websocket = window.WebSocket;
    window.WebSocket = function() {
        let args = arguments;
        args[0] = 'wss://${urls.WEBSITE_BASE_URL}/?url=' + encodeURIComponent(args[0]);
        return new old_websocket(...args);
    }

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