let to_request = window.location.href;

let parser = new URL(window.location.href);
let host = parser.host.toLowerCase();
if (host.includes('blocked.com') || host.includes('default.ws')) {
    to_request = parser.searchParams.get('url');
    if (!to_request.startsWith('https://') && !(to_request.startsWith('http://'))) {
        to_request = 'https://' + to_request;
    }
}

let actual_url = 'https://proxy-2.ndrewxie.repl.co/requestdata?q=' + encodeURIComponent(to_request) + '&baseurl=' + encodeURIComponent(to_request);
window.location.href = actual_url;