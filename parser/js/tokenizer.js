import {TextStream, is_whitespace, is_newline} from '../utility.mjs';

export class Token {
    constructor(type, data) {
        this.type = type;
        this.data = data;
    }
}

export class JSTokenizer {
    constructor(input) {
        this.input = new TextStream(input);
    }
    next() {
        
    }
    expect_newline() {
        let newline_expected = this.input.expect_until_criterion(function(input) {
            return !is_newline(input);
        });
        return newline_expected;
    }
}