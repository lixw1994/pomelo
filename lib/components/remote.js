let fs = require('fs');
let pathUtil = require('../util/pathUtil');
let RemoteServer = require('pomelo-rpc').server;
module.exports = function (app, opts) {
    opts = opts || {};
    opts.bufferMsg = opts.bufferMsg || opts.cacheMsg || false;
    opts.interval = opts.interval || 30;
    if (app.enabled('rpcDebugLog')) {
        opts.rpcDebugLog = true;
        opts.rpcLogger = require('pomelo-logger').getLogger('rpc-debug', __filename);
    }
    return new Component(app, opts);
};
let Component = function (app, opts) {
    this.app = app;
    this.opts = opts;
};
let pro = Component.prototype;
pro.name = '__remote__';
pro.start = function (cb) {
    this.opts.port = this.app.getCurServer().port;
    this.remote = genRemote(this.app, this.opts);
    this.remote.start();
    process.nextTick(cb);
};
pro.stop = function (force, cb) {
    this.remote.stop(force);
    process.nextTick(cb);
};
let getRemotePaths = function (app) {
    let paths = [];
    let role;
    if (app.isFrontend()) {
        role = 'frontend';
    }
    else {
        role = 'backend';
    }
    let sysPath = pathUtil.getSysRemotePath(role), serverType = app.getServerType();
    if (fs.existsSync(sysPath)) {
        paths.push(pathUtil.remotePathRecord('sys', serverType, sysPath));
    }
    let userPath = pathUtil.getUserRemotePath(app.getBase(), serverType);
    if (fs.existsSync(userPath)) {
        paths.push(pathUtil.remotePathRecord('user', serverType, userPath));
    }
    return paths;
};
let genRemote = function (app, opts) {
    opts.paths = getRemotePaths(app);
    opts.context = app;
    if (!!opts.rpcServer) {
        return opts.rpcServer.create(opts);
    }
    else {
        return RemoteServer.create(opts);
    }
};
