import assert from 'assert';
import {TextStream, MutationList, is_whitespace} from './utility.mjs';

const CHILDLESS_ELEMENTS = ['script', 'style'];
const VOID_ELEMENTS = ['!doctype', 'area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
const ALLOWABLE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-_!';
const BANNED_ATTR_WORD_VALUE_CHARS = '"\'=<>`';
const BANNED_ATTR_NAME_CHARS = '/<>"\'=';

function is_valid_tag(name) {
    if (typeof name == 'undefined') {
        return false;
    }
    if (name.length <= 0) {
        return false;
    }
    let acc = name.toLowerCase();
    acc = acc.trim();
    for (let j = 0; j < ALLOWABLE_CHARS.length; j++) {
        while (acc.includes(ALLOWABLE_CHARS[j])) {
            acc = acc.replace(ALLOWABLE_CHARS[j], '');
        }
    }
    return acc.length <= 0;
}

export class Node {
    constructor(type) {
        this.type = type;
        this.attributes = [];
        this.value = '';
        this.is_self_closing = false;
        this.parent = undefined;
        this.children = [];
    }
    append_child(child) {
        this.children.push(child);
        child.parent = this;
    }
    prepend_child(child) {
        this.children.unshift(child);
        child.parent = this;
    }
    add_attribute(name, value) {
        this.attributes.push([name, value]);
    }
    add_attribute_flag(name) {
        this.attributes.push([name]);
    }
    get_attribute_value(name) {
        for (let j = 0; j < this.attributes.length; j++) {
            if ((this.attributes[j][0].toLowerCase() == name.toLowerCase()) && (this.attributes[j].length > 1)) {
                return this.attributes[j][1];
            }
        }
    }
    set_attribute_value(name, value) {
        for (let j = 0; j < this.attributes.length; j++) {
            if (this.attributes[j][0].toLowerCase() == name.toLowerCase()) {
                this.attributes[j][1] = value;
                return;
            }
        }
        this.add_attribute(name, value);
    }
    has_attribute(name) {
        for (let j = 0; j < this.attributes.length; j++) {
            if (this.attributes[j][0].toLowerCase() == name.toLowerCase()) {
                return true;
            }
        }
        return false;
    }
    remove_attribute(name) {
        for (let j = this.attributes.length - 1; j >= 0; j--) {
            if (this.attributes[j][0].toLowerCase() == name.toLowerCase()) {
                this.attributes.splice(j, 1);
            }
        }
    }
    set_value(val) {
        this.value = val;
    }
    get_value(val) {
        return this.value;
    }
    get_open() {
        if (this.type == 'text_node') {
            return this.value;
        }
        else if (this.type == 'comment') {
            return '<!--' + this.value + '-->';
        }
        let acc = '<';
        acc += this.type;
        acc += ' ';
        for (let j = 0; j < this.attributes.length; j++) {
            let attribute = this.attributes[j];
            if (attribute.length == 1) {
                acc += attribute[0];
            }
            else if (attribute.length == 2) {
                while (attribute[1].includes('"')) {
                    attribute[1] = attribute[1].replace('"', '&quot;');
                }
                acc += attribute[0] + '="' + attribute[1] + '"';
            }
            acc += ' ';
        }
        acc += '>';
        return acc;
    }
    get_close() {
        if ((!this.is_self_closing) && (this.type != 'text_node')) {
            return '</' + this.type + '>';
        }
        return '';
    }
    reconstitute() {
        let acc = '';
        acc += this.get_open();
        if (!this.is_self_closing) {
            for (let j = 0; j < this.children.length; j++) {
                acc += this.children[j].reconstitute();
            }
        }
        acc += this.get_close();
        return acc;
    }
}

export class HTMLParser {
    constructor(input) {
        this.input = new TextStream(input, true);
        this.nodes = [];
        this.acc = '';
    }
    write(input) {
        this.input.write(input);
        //this.input.write(this.acc + input);
        //this.acc = '';
    }
    end() {
        this.input.is_poisoned = false;
    }
    expect_comment() {
        this.input.save();
        let comment_start = this.input.expect_pattern('<!--');
        if (!comment_start) {
            return this.input.restore_return(undefined);
        }
        let at = undefined;
        let acc = '';
        let is_found = false;
        while (at = this.input.at()) {
            let comment_end = this.input.expect_pattern('-->');
            if (comment_end) {
                is_found = true;
                break;
            }
            acc += at;
            if (this.input.has_next()) {
                this.input.next();
            }
        }
        if (is_found) {
            let to_return = new Node('comment');
            to_return.value = acc;
            return this.input.pop_return(to_return);
        }
        return this.input.restore_return(undefined);
    }
    expect_tag_open() {
        let reader = this.input;
        reader.save();
        let before_tag_whitespace = reader.skip_whitespace();
        let tag_open = reader.expect_pattern('<');
        if (!tag_open) {
            return reader.restore_return(undefined);
        }
        let tag_name = reader.expect_until_criterion(function(input) {
            return !ALLOWABLE_CHARS.includes(input.toLowerCase());
        });
        if (!is_valid_tag(tag_name)) {
            return reader.restore_return(undefined);
        }
        let to_return = new Node(tag_name);
        if (VOID_ELEMENTS.includes(tag_name.toLowerCase())) {
            to_return.is_self_closing = true;
        }
        while (reader.has_next()) {
            reader.skip_whitespace();
            let end_pattern = reader.expect_pattern('/>');
            if (end_pattern) {
                to_return.is_self_closing = true;
            }
            else {
                end_pattern = reader.expect_pattern('>');
            }
            if (end_pattern) {
                let actual_return = [to_return];
                if (before_tag_whitespace.length > 0) {
                    let whitespace_tag = new Node('text_node');
                    whitespace_tag.value = before_tag_whitespace;
                    actual_return.unshift(whitespace_tag);
                }
                return reader.pop_return(actual_return);
            }
            let attrib_name = reader.expect_until_criterion(function(input) {
                return BANNED_ATTR_NAME_CHARS.includes(input) || is_whitespace(input);
            });
            if (!attrib_name) {
                return reader.restore_return(undefined);
            }
            // If key-value pair
            if (reader.at() == '=') {
                reader.next();
                reader.skip_whitespace();
                let expect_quoted = reader.expect_duplet('"', '"');
                if (typeof expect_quoted == 'undefined') {
                    expect_quoted = reader.expect_duplet('\'', '\'');
                }
                if (typeof expect_quoted != 'undefined') {
                    to_return.add_attribute(attrib_name, expect_quoted);
                }
                else {
                    let attrib_value = reader.expect_until_criterion(function(input) {
                        return BANNED_ATTR_WORD_VALUE_CHARS.includes(input) || is_whitespace(input);
                    });
                    if (!attrib_value) {
                        return reader.restore_return(undefined);
                    }
                    to_return.add_attribute(attrib_name, attrib_value);
                }
            }
            // If just key
            else {
                to_return.add_attribute_flag(attrib_name);
            }
        }
        return reader.restore_return(undefined);
    }
    expect_tag_close() {
        this.input.save();
        if (!this.input.expect_pattern('</')) {
            return this.input.restore_return(undefined);
        }
        let tag_name = this.input.expect_until('>');
        if (!tag_name) {
            return this.input.restore_return(undefined);
        }
        if (this.input.expect_pattern('>')) {
            let to_return = tag_name.trim();
            if (!is_valid_tag(to_return)) {
                return this.input.restore_return(undefined);
            }
            return this.input.pop_return(to_return);
        }
        return this.input.restore_return(undefined);
    }
    parse() {
        let new_nodes = new MutationList();
        let at = undefined;
        while (at = this.input.at()) {
            let comment_expect = this.parse_comment(new_nodes);
            if (comment_expect == 'continue') {
                continue;
            }
            else if (comment_expect == 'return') {
                return new_nodes;
            }

            let tag_close_expect = this.parse_tag_close(new_nodes);
            if (tag_close_expect == 'continue') {
                continue;
            }
            else if (tag_close_expect == 'return') {
                return new_nodes;
            }

            let tag_open_expect = this.parse_tag_open(new_nodes);
            if (tag_open_expect == 'continue') {
                continue;
            }
            else if (tag_open_expect == 'return') {
                return new_nodes;
            }
            
            this.acc += at;
            if (this.input.has_next()) {
                this.input.next();
            }
        }
        return new_nodes;
    }
    parse_action(input) {
        if (input) {
            return 'continue';
        }
        else {
            if (this.input.is_poisoned) {
                return 'return';
            }
            else {
                return 'fallthrough';
            }
        }
    }
    parse_comment(new_nodes) {
        let comment_expect = this.expect_comment();
        if (comment_expect) {
            new_nodes.add_insert('comment', comment_expect);
            return this.parse_action(true);
        }
        return this.parse_action(false);
    }
    parse_tag_open(new_nodes) {
        let tag_expect = this.expect_tag_open();
        if (tag_expect) {
            if (this.acc.length > 0) {
                let text_node = new Node('text_node');
                text_node.value = this.acc;
                new_nodes.add_insert('text_node', text_node);
                this.acc = '';   
            }
            for (let j = 0; j < tag_expect.length; j++) {
                let tag_type = tag_expect[j].type.toLowerCase();
                if (VOID_ELEMENTS.includes(tag_type) || (tag_type == 'text_node')) {
                    new_nodes.add_insert(tag_expect[j].type, tag_expect[j]);
                }
                else {
                    new_nodes.add_open(tag_expect[j].type, tag_expect[j]);
                }
            }
            return this.parse_action(true);
        }
        return this.parse_action(false);
    }
    parse_tag_close(new_nodes) {
        let close_expect = this.expect_tag_close();
        if (close_expect) {
            if (this.acc.length > 0) {
                let text_node = new Node('text_node');
                text_node.value = this.acc;
                new_nodes.add_insert('text_node', text_node);
                this.acc = '';
            }
            new_nodes.add_close(close_expect, close_expect);
            return this.parse_action(true);
        }
        return this.parse_action(false);
    }
}

(function() {
    let parser_a = new HTMLParser('<!-- this is a comment-->fff');
    assert(parser_a.expect_comment().value == ' this is a comment');
    assert(parser_a.input.remainder(true) == 'fff');
})();
(function() {
    let parser_b = new HTMLParser('<div data-action="focus->s-popover#show">');
    let tag_open_b = parser_b.expect_tag_open();
    assert(tag_open_b.length == 1);
    assert(tag_open_b[0].get_attribute_value('data-action') == 'focus->s-popover#show');
    let parser_a = new HTMLParser('<div id="lmao" class="bruh das" disabled></div    >fff');
    let tag_open_a = parser_a.expect_tag_open();
    assert(tag_open_a.length == 1);
    let div_expected = tag_open_a[0];
    assert(div_expected.type == 'div');
    assert(div_expected.has_attribute('disabled'));
    assert(div_expected.get_attribute_value('id') == 'lmao');
    assert(div_expected.get_attribute_value('class') == 'bruh das');
    assert(parser_a.expect_tag_close() == 'div');
    assert(parser_a.expect_tag_open() == undefined);
})();
(function() {
    let parser_c = new HTMLParser('<script>if (a<b) {console.log(\'>\');}</script>');
    let parsed = parser_c.parse();
    assert(parsed.nodes.length == 3);
})();