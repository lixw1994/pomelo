let Master = require('../master/master');
module.exports = function (app, opts) {
    return new Component(app, opts);
};
let Component = function (app, opts) {
    this.master = new Master(app, opts);
};
let pro = Component.prototype;
pro.name = '__master__';
pro.start = function (cb) {
    this.master.start(cb);
};
pro.stop = function (force, cb) {
    this.master.stop(cb);
};
