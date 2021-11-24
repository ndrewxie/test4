import * as urls from '../urls.mjs';
import {HTMLParser, Node} from '../parser/html_parser.mjs';
import {CSSParser} from '../parser/css_rewriter.mjs';
import {get_hook} from '../hook.mjs';

function strcomp_nows_nocap(a, b) {
    if ((!a) || (!b)) {
        return false;
    }
    return a.trim().toLowerCase() == b.trim().toLowerCase();
}

let rewrite_invariants = ['data:', 'javascript:'];
function encode_uri_base64(input) {
    return encodeURIComponent((Buffer.from(input)).toString('base64'));
}
function rewrite_url(input_url, base_url) {
    let lowered = ('' + input_url).toLowerCase();
    for (let j = 0; j < rewrite_invariants.length; j++) {
        if (lowered.startsWith(rewrite_invariants[j])) {
            return input_url;
        }
    }
    if (lowered.includes('imasdk.googleapis') || lowered.includes('googlesyndication')) {
        return input_url;
    }
    return urls.WEBSITE_URL + '/requestdata?q=' + encode_uri_base64(input_url) + '&baseurl=' + encode_uri_base64(base_url);
}
export class HTMLRewriter {
    constructor(base_url) {
        this.parser = new HTMLParser('');
        this.base_url = base_url;
    }
    rewrite_node(at) {
        let at_node = at.info;
        let parent_node = (at.parent || {}).info;
        if (at_node.type.toLowerCase().trim() == 'meta') {
            let to_censor = ['keywords', 'description'];
            for (let j = 0; j < to_censor.length; j++) {
                if (at_node.has_attribute('name') && strcomp_nows_nocap(at_node.get_attribute_value('name'), to_censor[j])) {
                    at_node.set_attribute_value('content', 'education, math, science');
                }
            }
        }
        if (at_node.has_attribute('src')) {
            at_node.set_attribute_value('src', rewrite_url(at_node.get_attribute_value('src'), this.base_url));
        }
        if (at_node.has_attribute('href')) {
            at_node.set_attribute_value('href', rewrite_url(at_node.get_attribute_value('href'), this.base_url));
        }
        if (at_node.has_attribute('integrity')) {
            at_node.remove_attribute('integrity');
        }
        if (strcomp_nows_nocap(at_node.type, 'text_node') && parent_node) {
            if (strcomp_nows_nocap(parent_node.type, 'title')) {
                at_node.value = (at_node.value || '').toLowerCase().replace('game', '').replace('combat', '').replace('.io', '');
            }
            if (strcomp_nows_nocap(parent_node.type, 'style')) {
                let base_url = this.base_url;
                let rewriter = new CSSParser(at_node.value, function(url) {
                    return rewrite_url(url, base_url);
                });
                at_node.value = rewriter.rewrite();
            }
        }
    }
    process_open(at, parsed) {
        let to_return = '';
        this.rewrite_node(at);
        to_return = at.info.get_open();
        if (at.info.type.toLowerCase().includes('head')) {
            to_return += get_hook(this.base_url);
        }
        return to_return;
    }
    rewrite() {
        let to_return = '';
        let parsed = this.parser.parse();
        let at = undefined;
        while (typeof (at = parsed.at()) != 'undefined') {
            if (at.code == 'open') {
                to_return += this.process_open(at, parsed);
            }
            else if (at.code == 'insert') {
                this.rewrite_node(at);
                to_return += at.info.get_open();
                to_return += at.info.get_close();
            }
            else if (at.code == 'close') {
                to_return += '</' + at.info + '>';
            }
            if (parsed.has_next()) {
                parsed.next();
            }
            else {
                break;
            }
        }
        return to_return;
    }
    write(input) {
        this.parser.write(input);
        return this.rewrite();
    }
    end() {
        this.parser.end();
        return this.rewrite();
    }
}
export class CSSRewriter {
    constructor(base_url) {
        this.base_url = base_url;
        this.acc = '';
    }
    write(input) {
        this.acc += input;
    }
    end() {
        let base_url = this.base_url;
        let rewriter = new CSSParser(this.acc, function(url) {
            return rewrite_url(url, base_url);
        });
        return rewriter.rewrite();
    }
}