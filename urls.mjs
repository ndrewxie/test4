import {readFileSync} from 'fs';

export const url_code = readFileSync('./common/url_internal.js').toString();
export const urls = (new Function(url_code))();
export function decode_base64_uri(input) {
    return atob(decodeURIComponent(input));
}