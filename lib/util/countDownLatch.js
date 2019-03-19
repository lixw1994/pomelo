let exp = module.exports;
let CountDownLatch = function (count, opts, cb) {
    this.count = count;
    this.cb = cb;
    let self = this;
    if (opts.timeout) {
        this.timerId = setTimeout(function () {
            self.cb(true);
        }, opts.timeout);
    }
};
CountDownLatch.prototype.done = function () {
    if (this.count <= 0) {
        throw new Error('illegal state.');
    }
    this.count--;
    if (this.count === 0) {
        if (this.timerId) {
            clearTimeout(this.timerId);
        }
        this.cb();
    }
};
exp.createCountDownLatch = function (count, opts, cb) {
    if (!count || count <= 0) {
        throw new Error('count should be positive.');
    }
    if (!cb && typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    if (typeof cb !== 'function') {
        throw new Error('cb should be a function.');
    }
    return new CountDownLatch(count, opts, cb);
};
