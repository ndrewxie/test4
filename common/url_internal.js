const WEBSITE_BASE_URL = 'test4.ndrewxie.repl.co';
const WEBSITE_URL = 'https://' + WEBSITE_BASE_URL;

const MIN_CANON_LENGTH = 185; // min URL length before canonicalization is triggered
const MAX_CANON_PERCENTAGE = 0.8; // max ratio of lengths for canonicalized over original for canonicalization to happen

function encode_payload(input) {
    return encodeURIComponent(btoa(input));
}
function decode_payload(input) {
    return atob(decodeURIComponent(input));
}
let is_absolute = new RegExp('^(?:[a-zA-Z]+:){1}\/\/');
let is_payload_url = new RegExp('^[a-zA-Z]+:(?!\/\/)');
function rewrite_url(input_url) {
    let lowered = ('' + input_url).toLowerCase();
    if (lowered.includes('imasdk.googleapis') || lowered.includes('googlesyndication')) {
        return input_url;
    }
    
    if (is_payload_url.test(input_url)) {
        return input_url;
    }
    if (is_absolute.test(input_url)) {
        return WEBSITE_URL + '/reqs/' + encode_payload(input_url) + '/';
    }
    return encode_payload(input_url) + '/';
}

// Resolves encoded URL to real URL
// For example: [BASE, REQ, https://discord.com/channels/59382, /assets/script.js]
// Should parse to [BASE, REQ, https://discord.com/assets/script.js]
function parse_url(input_url) {
    let path_name = input_url.split('/').slice(2);

    for (let j = 0; j < path_name.length; j++) {
        path_name[j] = decode_payload(path_name[j]);
    }

    let to_return = path_name[0];
    let original_url_length = to_return.length;
    if (path_name.length > 1) {
        for (let j = 1; j < path_name.length; j++) {
            original_url_length += path_name[j].length + 1; // not *exactly* correct but whatever
            let url_parser = new URL(path_name[j], to_return);
            to_return = url_parser.href;
        }
    }

    let actual_return = {
        parsed: to_return,
        should_redir: false
    }
    if (
        (original_url_length >= MIN_CANON_LENGTH) &&
        (to_return.length / original_url_length <= MAX_CANON_PERCENTAGE)
    ) {
        actual_return.should_redir = true;
    }
    return actual_return;
}

function literal_decode_url(input_url) {
    if (is_payload_url.test(input_url)) {
        return input_url;
    }

    let lowered = ('' + input_url).toLowerCase();
    if (lowered.includes('imasdk.googleapis') || lowered.includes('googlesyndication')) {
        return input_url;
    }

    let absolute_prefix = (WEBSITE_URL + '/reqs/').toLowerCase();
    if (lowered.startsWith(absolute_prefix) && lowered.endsWith('/')) {
        return decode_payload(input_url.substring(absolute_prefix.length, input_url.length-1));
    }
    return decode_payload(input_url.substring(0, input_url.length-1));
}

return {
    WEBSITE_BASE_URL: WEBSITE_BASE_URL,
    WEBSITE_URL: WEBSITE_URL,
    rewrite_url: rewrite_url,
    parse_url: parse_url,
    literal_decode_url: literal_decode_url,
}
