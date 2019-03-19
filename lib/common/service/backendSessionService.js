let utils = require('../../util/utils');
let EXPORTED_FIELDS = ['id', 'frontendId', 'uid', 'settings'];
let BackendSessionService = function (app) {
    this.app = app;
};
module.exports = BackendSessionService;
BackendSessionService.prototype.create = function (opts) {
    if (!opts) {
        throw new Error('opts should not be empty.');
    }
    return new BackendSession(opts, this);
};
BackendSessionService.prototype.get = function (frontendId, sid, cb) {
    let namespace = 'sys';
    let service = 'sessionRemote';
    let method = 'getBackendSessionBySid';
    let args = [sid];
    rpcInvoke(this.app, frontendId, namespace, service, method, args, BackendSessionCB.bind(null, this, cb));
};
BackendSessionService.prototype.getByUid = function (frontendId, uid, cb) {
    let namespace = 'sys';
    let service = 'sessionRemote';
    let method = 'getBackendSessionsByUid';
    let args = [uid];
    rpcInvoke(this.app, frontendId, namespace, service, method, args, BackendSessionCB.bind(null, this, cb));
};
BackendSessionService.prototype.kickBySid = function (frontendId, sid, reason, cb) {
    let namespace = 'sys';
    let service = 'sessionRemote';
    let method = 'kickBySid';
    let args = [sid];
    if (typeof reason === 'function') {
        cb = reason;
    }
    else {
        args.push(reason);
    }
    rpcInvoke(this.app, frontendId, namespace, service, method, args, cb);
};
BackendSessionService.prototype.kickByUid = function (frontendId, uid, reason, cb) {
    let namespace = 'sys';
    let service = 'sessionRemote';
    let method = 'kickByUid';
    let args = [uid];
    if (typeof reason === 'function') {
        cb = reason;
    }
    else {
        args.push(reason);
    }
    rpcInvoke(this.app, frontendId, namespace, service, method, args, cb);
};
BackendSessionService.prototype.bind = function (frontendId, sid, uid, cb) {
    let namespace = 'sys';
    let service = 'sessionRemote';
    let method = 'bind';
    let args = [sid, uid];
    rpcInvoke(this.app, frontendId, namespace, service, method, args, cb);
};
BackendSessionService.prototype.unbind = function (frontendId, sid, uid, cb) {
    let namespace = 'sys';
    let service = 'sessionRemote';
    let method = 'unbind';
    let args = [sid, uid];
    rpcInvoke(this.app, frontendId, namespace, service, method, args, cb);
};
BackendSessionService.prototype.push = function (frontendId, sid, key, value, cb) {
    let namespace = 'sys';
    let service = 'sessionRemote';
    let method = 'push';
    let args = [sid, key, value];
    rpcInvoke(this.app, frontendId, namespace, service, method, args, cb);
};
BackendSessionService.prototype.pushAll = function (frontendId, sid, settings, cb) {
    let namespace = 'sys';
    let service = 'sessionRemote';
    let method = 'pushAll';
    let args = [sid, settings];
    rpcInvoke(this.app, frontendId, namespace, service, method, args, cb);
};
let rpcInvoke = function (app, sid, namespace, service, method, args, cb) {
    app.rpcInvoke(sid, { namespace: namespace, service: service, method: method, args: args }, cb);
};
let BackendSession = function (opts, service) {
    for (let f in opts) {
        this[f] = opts[f];
    }
    this.__sessionService__ = service;
};
BackendSession.prototype.bind = function (uid, cb) {
    let self = this;
    this.__sessionService__.bind(this.frontendId, this.id, uid, function (err) {
        if (!err) {
            self.uid = uid;
        }
        utils.invokeCallback(cb, err);
    });
};
BackendSession.prototype.unbind = function (uid, cb) {
    let self = this;
    this.__sessionService__.unbind(this.frontendId, this.id, uid, function (err) {
        if (!err) {
            self.uid = null;
        }
        utils.invokeCallback(cb, err);
    });
};
BackendSession.prototype.set = function (key, value) {
    this.settings[key] = value;
};
BackendSession.prototype.get = function (key) {
    return this.settings[key];
};
BackendSession.prototype.push = function (key, cb) {
    this.__sessionService__.push(this.frontendId, this.id, key, this.get(key), cb);
};
BackendSession.prototype.pushAll = function (cb) {
    this.__sessionService__.pushAll(this.frontendId, this.id, this.settings, cb);
};
BackendSession.prototype.export = function () {
    let res = {};
    EXPORTED_FIELDS.forEach(function (field) {
        res[field] = this[field];
    });
    return res;
};
let BackendSessionCB = function (service, cb, err, sinfo) {
    if (err) {
        utils.invokeCallback(cb, err);
        return;
    }
    if (!sinfo) {
        utils.invokeCallback(cb);
        return;
    }
    let sessions = [];
    if (Array.isArray(sinfo)) {
        for (let i = 0, k = sinfo.length; i < k; i++) {
            sessions.push(service.create(sinfo[i]));
        }
    }
    else {
        sessions = service.create(sinfo);
    }
    utils.invokeCallback(cb, null, sessions);
};
