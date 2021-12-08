import {urls} from '../urls.mjs';
import {HTMLParser, Node} from '../parser/html_parser.mjs';
import {CSSParser} from '../parser/css_rewriter.mjs';
import {get_hook} from '../hook.mjs';
import {parentPort} from 'worker_threads';

function console_log(input) {
    if (parentPort) {
        parentPort.postMessage(['log', input]);
    }
    else {
        console.log(input);
    }
}

function strcomp_nows_nocap(a, b) {
    if ((!a) || (!b)) {
        return false;
    }
    return a.trim().toLowerCase() == b.trim().toLowerCase();
}

export class HTMLRewriter {
    constructor(requested_url) {
        this.parser = new HTMLParser('');
        this.requested_url = requested_url;
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
            let src = at_node.get_attribute_value('src');
            at_node.set_attribute_value('src', urls.rewrite_url(at_node.get_attribute_value('src')));
        }
        if (at_node.has_attribute('href')) {
            at_node.set_attribute_value('href', urls.rewrite_url(at_node.get_attribute_value('href')));
        }
        if (at_node.has_attribute('integrity')) {
            at_node.remove_attribute('integrity');
        }
        if (strcomp_nows_nocap(at_node.type, 'text_node') && parent_node) {
            if (strcomp_nows_nocap(parent_node.type, 'title')) {
                at_node.value = (at_node.value || '').toLowerCase().replace('game', '').replace('combat', '').replace('.io', '');
            }
            if (strcomp_nows_nocap(parent_node.type, 'style')) {
                let rewriter = new CSSParser(at_node.value, function(url) {
                    return urls.rewrite_url(url);
                });
                at_node.value = rewriter.rewrite();
            }
        }
    }
    process_open(at, parsed) {
        let to_return = '';
        this.rewrite_node(at);
        to_return = at.info.get_open();
        if (strcomp_nows_nocap(at.info.type, 'head')) {
            to_return += get_hook(this.requested_url);
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
    constructor(requested_url) {
        this.requested_url = requested_url;
        this.acc = '';
    }
    write(input) {
        this.acc += input;
    }
    end() {
        let requested_url = this.requested_url;
        let rewriter = new CSSParser(this.acc, function(url) {
            return urls.rewrite_url(url);
        });
        return rewriter.rewrite();
    }
}