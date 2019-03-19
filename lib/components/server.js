let Server = require('../server/server');
module.exports = function (app, opts) {
    return new Component(app, opts);
};
let Component = function (app, opts) {
    this.server = Server.create(app, opts);
};
let pro = Component.prototype;
pro.name = '__server__';
pro.start = function (cb) {
    this.server.start();
    process.nextTick(cb);
};
pro.afterStart = function (cb) {
    this.server.afterStart();
    process.nextTick(cb);
};
pro.stop = function (force, cb) {
    this.server.stop();
    process.nextTick(cb);
};
pro.handle = function (msg, session, cb) {
    this.server.handle(msg, session, cb);
};
pro.globalHandle = function (msg, session, cb) {
    this.server.globalHandle(msg, session, cb);
};
