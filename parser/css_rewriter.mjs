import {TextStream, is_whitespace} from './utility.mjs';
import * as fs from 'fs';

// ignores case, skips trailing whitespace
function string_ends_with(input, search) {
    let actual_search = search.toLowerCase();
    let index = input.length - 1;
    while ((index >= 0) && is_whitespace(input[index])) {
        if (index > 0) {
            index -= 1;
        }
    }
    let search_start = index - actual_search.length + 1;
    if (search_start < 0) {
        return false;
    }
    for (let j = 0; j < actual_search.length; j++) {
        if (input[search_start + j].toLowerCase() != actual_search[j]) {
            return false;
        }
    }
    return true;
}

export class CSSParser {
    constructor(input, rewriter) {
        this.input = new TextStream(input);
        this.rewriter = rewriter;
    }
    rewrite_url(url) {
        let reader = new TextStream(url);
        let duplet = '\'';
        let link = reader.expect_duplet('\'', '\'');
        if (typeof link == 'undefined') {
            duplet = '"';
            link = reader.expect_duplet('"', '"');
        }
        if (typeof link == 'undefined') {
            duplet = '';
            link = reader.expect_word();
        }
        return duplet + this.rewriter(link) + duplet + reader.remainder();
    }
    rewrite() {
        let to_return = '';
        let reader = this.input;

        let paren_level = 0;
        let in_url = false;
        let url_start_plevel = undefined;
        let url_buffer = '';

        let at = undefined;

        let num_reps = 0;
        while (at = reader.at()) {
            num_reps += 1;
            if ((at == '"') || (at == '\'')) {
                let expect_quoted = reader.expect_duplet(at, at);
                if (in_url) {
                    url_buffer += at + expect_quoted + at;
                }
                else {
                    let quote_content = expect_quoted;
                    if (string_ends_with(to_return, '@import')) {
                        quote_content = this.rewrite_url(quote_content);
                    }
                    to_return += at + quote_content + at;
                }
                continue;
            }
            let comment_expect = reader.expect_duplet('/*', '*/', true, false);
            if (typeof comment_expect == 'undefined') {
                comment_expect = reader.expect_duplet('//', '\n');
            }
            if (typeof comment_expect != 'undefined') {
                continue;
            }
            if ((!is_whitespace(at)) && reader.expect_pattern(['url', '('])) {
                in_url = true;
                url_start_plevel = paren_level;
                paren_level += 1;
                to_return += 'url(';
                url_buffer = '';
                continue;
            }
            if (at == '(') {
                paren_level += 1;
            }
            if (at == ')') {
                paren_level -= 1;
                if (in_url && (paren_level == url_start_plevel)) {
                    to_return += this.rewrite_url(url_buffer);
                    in_url = false;
                }
            }
            if (in_url) {
                url_buffer += at;
            }
            else {
                to_return += at;
            }
            if (reader.has_next()) {
                reader.next();
            }
        }
        return to_return;
    }
}

(function() {
    return;
    let rewriter_a = new CSSParser(`
        @import "navigation.css";
        @import url("navigation.css");
        #sampleDiv {
            background-image: url('../assets/logo.png');
            background-color: #FFFFDD;
            font-family: Arial;
        }
        .sampleClass {
            background-image: url(../assets/class.png);
        }
        .sampleClassTwo {
            background-image: url(../assets/camera.png prefetch);
        }
        #sampleDivTwo {
            background-image: url(../img/test.png param(--color var(--primary-color)));
        }
    `, function(input) {
        return "<rewrite>" + input + "</rewrite>";
    });
    console.log(rewriter_a.rewrite());
})();