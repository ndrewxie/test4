import {Buffer} from 'buffer';
import {parentPort} from 'worker_threads';
import * as rewriters from './rewriters.mjs';

function console_log(input) {
    if (parentPort) {
        parentPort.postMessage(['log', input]);
    }
    else {
        console.log(input);
    }
}

let rewriter = undefined;
let type = undefined;
parentPort.on('message', message => {
    if ((message instanceof Array) && (message[0] == 'switchtype')) {
        type = message[1];
        if (message[1] == 'html') {
            rewriter = new rewriters.HTMLRewriter(message[2]);
        }
        else if (message[1] == 'css') {
            rewriter = new rewriters.CSSRewriter(message[2]);
        }
        return;
    }
    if (!rewriter) {
        return;
    }
    if (message instanceof Array) {
        if (message[0] == 'end') {
            let to_post = rewriter.end();
            if (to_post) {
                parentPort.postMessage(to_post);
            }
            parentPort.postMessage(['end']);
            rewriter = undefined;
        }
    }
    else {
        let input_buffer = Buffer.from(message.buffer);
        let to_post = rewriter.write(input_buffer.toString());
        if (to_post) {
            parentPort.postMessage(to_post);
        }
    }
});