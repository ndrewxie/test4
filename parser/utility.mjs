import assert from 'assert';

function string_eq_nocase(a, b) {
    return a.toLowerCase().trim() == b.toLowerCase().trim();
}

export function is_whitespace(input) {
    if (typeof input == 'undefined') {
        return false;
    }
    return input.trim() == '';
}

export function is_newline(input) {
    if (typeof input == 'undefined') {
        return false;
    }
    return (input == '\n') || (input == '\r') || (input == '\u2028') || (input == '\u2029');
}

export class TextStream {
    constructor(input, is_streaming = false) {
        this.input = input;
        this.index = 0;
        this.save_queue = [];
        this.is_streaming = is_streaming;
        this.is_poisoned = false;
    }
    write(input) {
        this.input += input;
        this.is_poisoned = false;
    }
    restore_return(val) {
        this.restore();
        return val;
    }
    pop_return(val) {
        this.pop_save();
        return val;
    }
    remainder(is_debug=false) {
        if (this.is_streaming && !is_debug) {
            throw new Error("Cannot access remainder on stream");
        }
        return this.input.substring(this.index);
    }
    context() {
        return this.input.substring(Math.max(0, this.index - 100), Math.min(this.input.length, this.index + 100));
    }
    get_char(indx) {
        if (indx >= this.input.length) {
            this.is_poisoned = true;
        }
        return this.input[indx];
    }
    at() {
        return this.get_char(this.index);
    }
    is_empty() {
        return this.index >= this.input.length;
    }
    has_next() {
        if (this.index + 1 >= this.input.length) {
            this.is_poisoned = true;
        }
        return this.index + 1 <= this.input.length;
    }
    next() {
        if (this.has_next()) {
            this.index += 1;
            return true;
        }
        return false;
    }
    mark() {
        return this.index;
    }
    seek(index) {
        this.index = index;
    }
    save() {
        this.save_queue.push({
            index: this.index
        });
    }
    restore() {
        let last = this.save_queue.pop();
        this.index = last.index;
    }
    pop_save() {
        this.save_queue.pop();
    }
    starts_with(to_match, ignore_case=false) {
        let actual_match = ignore_case ? to_match.toLowerCase() : to_match;
        for (let j = 0; j < actual_match.length; j++) {
            let a = this.get_char(this.index + j);
            if (a && ignore_case) {
                a = a.toLowerCase();
            }
            if (a != actual_match[j]) {
                return false;
            }
        }
        return true;
    }
    skip_whitespace() {
        let acc = '';
        do {
            let at = undefined;
            if (is_whitespace(at = this.at())) {
                acc += at;
                this.next();
            }
            else {
                break;
            }
        } while (this.has_next());
        return acc;
    }
    expect_pattern(input, ignore_case = false) {
        this.save();
        for (let j = 0; j < input.length; j++) {
            this.skip_whitespace();
            let inputj = input[j];
            if (!this.starts_with(inputj, ignore_case)) {
                return this.restore_return(false);
            }
            for (let k = 0; k < inputj.length; k++) {
                this.next();
            }
        }
        return this.pop_return(true);
    }
    expect_until_criterion(stop) {
        let found = undefined;
        let at = undefined;
        while (typeof (at = this.at()) != 'undefined') {
            if (stop(at)) {
                return found;
            }
            found = (found || '') + at;
            if (this.has_next()) {
                this.next();
            }
            else {
                break;
            }
        }
        return found;
    }
    expect_word() {
        return this.expect_until_criterion(is_whitespace);
    }
    expect_until(delim, ignore_case=false) {
        let actual_delim = ignore_case ? delim.toLowerCase() : delim;
        return this.expect_until_criterion(function(input) {
            if (ignore_case) {
                return input.toLowerCase() == actual_delim;
            }
            else {
                return input == actual_delim;
            }
        });
    }
    expect_duplet(start, end, ignore_case=false, can_escape=true) {
        this.save();
        let start_expect = this.expect_pattern([start], ignore_case);
        if (!start_expect) {
            return this.restore_return(undefined);
        }
        let at = undefined;
        let acc = '';
        let search = undefined;
        let is_escaped = false;
        while (
            (typeof (at = this.at()) != 'undefined') && 
            (
                is_escaped || 
                !(search = this.expect_pattern([end], ignore_case))
            )
        ) {
            if (is_escaped) {
                if (can_escape && (at == '\\')) {
                    acc += '\\';
                }
                else {
                    acc += '\\';
                    acc += at;
                }
                is_escaped = false;
            }
            else if (can_escape && (at == '\\')) {
                is_escaped = !is_escaped;
            }
            else {
                acc += at;
            }
            if (this.has_next()) {
                this.next();
            }
        }
        if (is_escaped) {
            acc += '\\';
        }
        if (search) {
            return this.pop_return(acc);
        }
        return this.restore_return(undefined);
    }
}

export class MutationList {
    constructor() {
        this.index = 0;
        this.nodes = [];
        this.parent_stack = [];
    }
    add_open(type, info) {
        this.nodes.push({
            code: 'open', 
            type: type, 
            info: info,
            parent: this.parent_stack[this.parent_stack.length-1]
        });
        this.parent_stack.push(this.nodes[this.nodes.length-1]);
    }
    add_close(type, info) {
        this.nodes.push({
            code: 'close', 
            type: type, 
            info: info
        });
        let ps_len = this.parent_stack.length;
        if (ps_len > 0) {
            if (this.parent_stack[ps_len - 1].type == type) {
                this.parent_stack.pop();
            }
        }
    }
    add_insert(type, info) {
        this.nodes.push({
            code: 'insert', 
            type: type, 
            info: info,
            parent: this.parent_stack[this.parent_stack.length-1]
        });
    }
    has_next() {
        if (this.index + 1 < this.nodes.length) {
            return true;
        }
        return false;
    }
    next() {
        if (this.has_next()) {
            this.index += 1;
        }
    }
    get_val(indx) {
        return this.nodes[indx];
    }
    at() {
        return this.nodes[this.index];
    }
    skip_children() {
        throw new Error("Doesn't work");
        if (this.has_next()) {
            let target = this.index;
            this.next();
            let at = undefined;
            while (typeof (at = this.at()) != 'undefined') {
                if ((typeof at.parent != 'undefined') && (at.parent == target) && this.has_next()) {
                    this.next();
                }
                else {
                    break;
                }
            }
        }
    }
}

/*
***************
* BEGIN TESTS *
***************
*/
(function() {
    let text_stream_a = new TextStream('    <div>');
    text_stream_a.save();
    assert(text_stream_a.remainder() == '    <div>');
    text_stream_a.skip_whitespace();
    assert(text_stream_a.remainder() == '<div>');
    text_stream_a.next();
    assert(text_stream_a.remainder() == 'div>');
    let mark1 = text_stream_a.mark();
    text_stream_a.next();
    text_stream_a.seek(mark1);
    assert(text_stream_a.remainder() == 'div>');
    text_stream_a.restore();
    assert(text_stream_a.remainder() == '    <div>');

    let text_stream_b = new TextStream(' ');
    text_stream_b.skip_whitespace();
    assert(text_stream_b.remainder() == '');
})();
(function() {
    let text_stream_a = new TextStream(' < !--');
    text_stream_a.expect_pattern(['<', '!', '-', '-']);
    assert(text_stream_a.remainder().length == 0);
    let text_stream_b = new TextStream(' < div   >');
    text_stream_b.expect_pattern(['<', '!', '-', '-']);
    assert(text_stream_b.remainder() == ' < div   >');
    text_stream_b.expect_pattern('<div>');
    assert(text_stream_b.remainder().length == 0);
})();
(function() {
    let text_stream_a = new TextStream('"asd\'fggg"');
    assert(text_stream_a.expect_duplet('"', '"') == 'asd\'fggg');
    let text_stream_b = new TextStream('"asdf\\"fffff"');
    assert(text_stream_b.expect_duplet('"', '"') == 'asdf\\"fffff');
})();