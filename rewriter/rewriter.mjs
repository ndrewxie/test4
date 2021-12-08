import {Worker} from 'worker_threads';

let REWRITER_LINK = './rewriter/rewrite_worker.mjs';
let NUM_WORKERS = 8;
let MAX_WORKER_TIME = 45000;

let rewriter_pool = [];
function new_rewriter() {
    let rewriter = new Worker(REWRITER_LINK, {
        synchronizedStdio: false
    });
    let curr_element = {
        rewriter: rewriter,
        user: undefined,
        task_start: undefined
    };
    rewriter.on('message', message => {
        if (!curr_element.user) {
            return;
        }
        if (message instanceof Array) {
            if (message[0] == 'end') {
                curr_element.user.on_end();
                curr_element.user.remove_worker();
                curr_element.user = undefined;
                curr_element.task_start = undefined;
                process_queue();
            }
            else if (message[0] == 'log') {
                console.log('(' + curr_element.user.worker_id + '): ' + message[1]);
            }
        }
        else {
            curr_element.user.on_result(message);
        }
    });
    rewriter.on('error', e => {
        console.log(e.message);
        if (curr_element.user && curr_element.user.on_error) {
            curr_element.user.on_error();
        }
        process_queue();
    });
    return curr_element;
}
for (let j = 0; j < NUM_WORKERS; j++) {
    rewriter_pool.push(new_rewriter());
}

let task_queue = [];
export class ContentRewriter {
    constructor(type, request_url, on_result, on_end, on_error) {
        this.type = type;
        this.request_url = request_url;

        this.worker_id = undefined;
        this.on_result = on_result;
        this.on_end = on_end;
        this.on_error = on_error;

        this.write_queue = [];
        this.is_stopped = false;
        task_queue.push(this);
        process_queue();
    }
    give_worker(id) {
        this.worker_id = id;
        rewriter_pool[this.worker_id].rewriter.postMessage(['switchtype', this.type, this.request_url]);
        while (this.write_queue.length > 0) {
            let shifted = this.write_queue.shift();
            this.write(shifted);
        }
        if (this.end_before_assign) {
            this.end();
        }
    }
    remove_worker() {
        this.worker_id = undefined;
        this.is_stopped = true;
    }
    write(input) {
        if (this.is_stopped) {
            console.log("Attempted to write to dead worker");
            return;
        }
        if (typeof this.worker_id != 'undefined') {
            let array = new Uint8Array(input);
            rewriter_pool[this.worker_id].rewriter.postMessage(array, [array.buffer]);
        }
        else {
            this.write_queue.push(input);
        }
    }
    end() {
        if (this.is_stopped) {
            console.log("Attemped to end dead worker " + this.worker_id);
            return;
        }
        if (typeof this.worker_id != 'undefined') {
            rewriter_pool[this.worker_id].rewriter.postMessage(['end']);
        }
        else {
            this.end_before_assign = true;
        }
    }
}
function process_queue() {
    for (let j = 0; j < rewriter_pool.length; j++) {
        let rewriter = rewriter_pool[j];
        let curr_time = Date.now();
        if (rewriter.task_start && (curr_time - rewriter.task_start > MAX_WORKER_TIME)) {
            console.log("Killing worker " + j + " because of time");
            if (rewriter.user && rewriter.user.on_error) {
                rewriter.user.on_error();
            }
            rewriter.user.remove_worker();
            rewriter.rewriter.terminate().then(() => console.log("Worker killed because of time"));
            rewriter_pool[j] = new_rewriter();
        }
    }
    for (let j = 0; j < rewriter_pool.length; j++) {
        let rewriter = rewriter_pool[j];
        if (task_queue.length <= 0) {
            break;
        }
        if (!rewriter.user) {
            rewriter.task_start = Date.now();
            rewriter.user = task_queue.shift();
            rewriter.user.give_worker(j);
        }
    }
}
setInterval(process_queue, 1000);