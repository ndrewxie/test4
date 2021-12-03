import * as fs from 'fs';
import * as ws from 'ws';
import * as http from 'http';
import * as https from 'https';
import * as urls from './urls.mjs';
import {ContentRewriter} from './rewriter/rewriter.mjs';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
let redirect_codes = [301, 302, 303, 307, 308];
function unencode_base64_uri(input) {
    return (Buffer.from(decodeURIComponent(input), 'base64')).toString('utf8');
}
function encode_base64_uri(input) {
    return encodeURIComponent((Buffer.from(input)).toString('base64'));
}

function make_request(location, options, res, base_url) {
    let req = https.request(location, options,
        get_res => process_res(get_res, res, location, base_url, options)
    );
    req.on('error', e => {
        console.log('Failed in make_request: ' + e.message + ': ');
        console.log(options.method + ': ' + location);
        res.statusCode = 404;
        res.end();
    });
    req.end();
}
function process_res(get_res, res, actual_request_url, base_url, options) {
    try {
        if (redirect_codes.includes(get_res.statusCode)) {
            let actual_redirect_url = new URL(get_res.headers['location'], base_url);
            let redirect_payload = encode_base64_uri(actual_redirect_url.href);
            res.writeHead(get_res.statusCode, {
                'Location': urls.WEBSITE_URL + '/requestdata?q=' + redirect_payload + '&baseurl=' + redirect_payload
            });
            res.end();
            return;
        }
        let content_type = get_res.headers['content-type'];
        if (content_type) {
            res.setHeader('Content-Type', content_type);
        }
        res.writeHead(get_res.statusCode);
        let transformer = undefined;
        let transformer_type = undefined;
        if (content_type) {
            let content_type_lower = content_type.toLowerCase();
            if (content_type_lower.includes('html')) {
                transformer_type = 'html';
            }
            else if (content_type_lower.includes('css')) {
                //transformer_type = 'css';
            }
            if (transformer_type) {
                transformer = new ContentRewriter(
                    transformer_type, 
                    base_url, 
                    function(chunk) { 
                        res.write(chunk); 
                    }, 
                    function() {
                        res.end();
                    }, 
                    function() {
                        console.log("ERROR"); 
                        res.statusCode = 404; 
                        res.end();
                    }
                );
            }
        }
        if (typeof transformer != 'undefined') {
            let id = transformer.worker_id;
            let acc = '';
            get_res.on('data', chunk => {
                if (transformer_type == 'html') {
                    acc += chunk.toString();
                }
                transformer.write(chunk);
            });
            get_res.on('close', () => {
                if ((transformer_type == 'html') && (acc.length > 10)) {
                    fs.writeFile('log.html', acc, function(err) {
                        if (err) {
                            throw err;
                        }
                    });
                }
                transformer.end();
            });
        }
        else {
            get_res.on('data', chunk => {
                res.write(chunk);
            });
            get_res.on('close', () => {
                res.end();
            });
        }
    } catch(e) {
        console.log("failed: " + e.message);
        console.log(actual_request_url);
        res.statusCode = 404;
        res.end();
    }
}

let proxy_skip_headers = [
    'host',
    'referer',
    'origin',
    'accept-encoding',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-replit-user-id',
    'x-replit-user-name',
    'x-replit-user-roles'
]
function get_headers(input, request_url, base_url) {
    let to_return = {};
    for (const key in input) {
        let to_copy = true;
        for (let j = 0; j < proxy_skip_headers.length; j++) {
            if (key.toLowerCase() == proxy_skip_headers[j].toLowerCase()) {
                to_copy = false;
                break;
            }
        }
        if (to_copy) {
            to_return[key] = input[key];
        }
    }
    to_return['referer'] = base_url.href;
    return to_return;
}

let static_server = http.createServer(function (req, res) {
    if (req.url.includes('/requestdata')) {
        try {
            let parsed_request = new URL(urls.WEBSITE_URL + req.url);
            let requested_url = unencode_base64_uri(parsed_request.searchParams.get('q'));
            let base_url = unencode_base64_uri(parsed_request.searchParams.get('baseurl'));
            let actual_request_url = new URL(requested_url, base_url);

            let headers = get_headers(req.headers, actual_request_url, new URL(base_url));
            let options = {
                port: 443,
                headers: headers,
                method: req.method
            };

            make_request(actual_request_url.href, options, res, base_url);
        } catch(e) {
            console.log("FAILED ON " + req.url);
            res.writeHead(404);
            res.end();
        }
    }
    else {
        let requested_path = (req.url == '/') ? '/index.html' : req.url;
        fs.readFile('./client' + requested_path, (err, data) => {
            if (!err) {
                res.writeHead(200);
                res.write(data.toString());
                res.end();
            }
            else {
                console.log("ERROR ON " + req.url);
                res.writeHead(404);
                res.end();
            }
        });
    }
});
let websocket_server = new ws.WebSocketServer({
    server: static_server
});
websocket_server.on('connection', function (client, req) {
    try {
        let to_parse = new URL(urls.WEBSITE_URL + req.url);
        let requested_url = decodeURIComponent(to_parse.searchParams.get('url'));
        let headers = {};
        if (req.headers['user-agent']) {
            headers['user-agent'] = req.headers['user-agent'];
        }
        let server = new ws.WebSocket(requested_url, {
            rejectUnauthorized: false,
            followRedirects: true,
            headers: headers
        });
        server.on('message', function(msg, is_binary) {
            client.send(msg, {
                binary: is_binary
            });
        });
        server.on('open', function() {
            client.on('message', function(msg, is_binary) {
                server.send(msg, {
                    binary: is_binary
                });
            });
            client.on('close', function() {
                server.close();
            });
            client.on('pong', function(payload) {
                server.pong(payload);
            });
        });
        server.on('ping', function(payload) {
            client.ping(payload);
        });
        server.on('error', function(e) {
            console.log("WS SERVER ERROR: ");
            console.log(e.message);
            console.log(e.stack);
        });
    }
    catch(e) {
        console.log("WS ERROR");
    }
});
static_server.listen(8080);