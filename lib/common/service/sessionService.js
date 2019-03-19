let EventEmitter = require('events').EventEmitter;
let util = require('util');
let logger = require('pomelo-logger').getLogger('pomelo', __filename);
let utils = require('../../util/utils');
let FRONTEND_SESSION_FIELDS = ['id', 'frontendId', 'uid', '__sessionService__'];
let EXPORTED_SESSION_FIELDS = ['id', 'frontendId', 'uid', 'settings'];
let ST_INITED = 0;
let ST_CLOSED = 1;
let SessionService = function (opts) {
    opts = opts || {};
    this.singleSession = opts.singleSession;
    this.sessions = {};
    this.uidMap = {};
};
module.exports = SessionService;
SessionService.prototype.create = function (sid, frontendId, socket) {
    let session = new Session(sid, frontendId, socket, this);
    this.sessions[session.id] = session;
    return session;
};
SessionService.prototype.bind = function (sid, uid, cb) {
    let session = this.sessions[sid];
    if (!session) {
        process.nextTick(function () {
            cb(new Error('session does not exist, sid: ' + sid));
        });
        return;
    }
    if (session.uid) {
        if (session.uid === uid) {
            cb();
            return;
        }
        process.nextTick(function () {
            cb(new Error('session has already bind with ' + session.uid));
        });
        return;
    }
    let sessions = this.uidMap[uid];
    if (!!this.singleSession && !!sessions) {
        process.nextTick(function () {
            cb(new Error('singleSession is enabled, and session has already bind with uid: ' + uid));
        });
        return;
    }
    if (!sessions) {
        sessions = this.uidMap[uid] = [];
    }
    for (let i = 0, l = sessions.length; i < l; i++) {
        if (sessions[i].id === session.id) {
            process.nextTick(cb);
            return;
        }
    }
    sessions.push(session);
    session.bind(uid);
    if (cb) {
        process.nextTick(cb);
    }
};
SessionService.prototype.unbind = function (sid, uid, cb) {
    let session = this.sessions[sid];
    if (!session) {
        process.nextTick(function () {
            cb(new Error('session does not exist, sid: ' + sid));
        });
        return;
    }
    if (!session.uid || session.uid !== uid) {
        process.nextTick(function () {
            cb(new Error('session has not bind with ' + session.uid));
        });
        return;
    }
    let sessions = this.uidMap[uid], sess;
    if (sessions) {
        for (let i = 0, l = sessions.length; i < l; i++) {
            sess = sessions[i];
            if (sess.id === sid) {
                sessions.splice(i, 1);
                break;
            }
        }
        if (sessions.length === 0) {
            delete this.uidMap[uid];
        }
    }
    session.unbind(uid);
    if (cb) {
        process.nextTick(cb);
    }
};
SessionService.prototype.get = function (sid) {
    return this.sessions[sid];
};
SessionService.prototype.getByUid = function (uid) {
    return this.uidMap[uid];
};
SessionService.prototype.remove = function (sid) {
    let session = this.sessions[sid];
    if (session) {
        let uid = session.uid;
        delete this.sessions[session.id];
        let sessions = this.uidMap[uid];
        if (!sessions) {
            return;
        }
        for (let i = 0, l = sessions.length; i < l; i++) {
            if (sessions[i].id === sid) {
                sessions.splice(i, 1);
                if (sessions.length === 0) {
                    delete this.uidMap[uid];
                }
                break;
            }
        }
    }
};
SessionService.prototype.import = function (sid, key, value, cb) {
    let session = this.sessions[sid];
    if (!session) {
        utils.invokeCallback(cb, new Error('session does not exist, sid: ' + sid));
        return;
    }
    session.set(key, value);
    utils.invokeCallback(cb);
};
SessionService.prototype.importAll = function (sid, settings, cb) {
    let session = this.sessions[sid];
    if (!session) {
        utils.invokeCallback(cb, new Error('session does not exist, sid: ' + sid));
        return;
    }
    for (let f in settings) {
        session.set(f, settings[f]);
    }
    utils.invokeCallback(cb);
};
SessionService.prototype.kick = function (uid, reason, cb) {
    if (typeof reason === 'function') {
        cb = reason;
        reason = 'kick';
    }
    let sessions = this.getByUid(uid);
    if (sessions) {
        let sids = [];
        let self = this;
        sessions.forEach(function (session) {
            sids.push(session.id);
        });
        sids.forEach(function (sid) {
            self.sessions[sid].closed(reason);
        });
        process.nextTick(function () {
            utils.invokeCallback(cb);
        });
    }
    else {
        process.nextTick(function () {
            utils.invokeCallback(cb);
        });
    }
};
SessionService.prototype.kickBySessionId = function (sid, reason, cb) {
    if (typeof reason === 'function') {
        cb = reason;
        reason = 'kick';
    }
    let session = this.get(sid);
    if (session) {
        session.closed(reason);
        process.nextTick(function () {
            utils.invokeCallback(cb);
        });
    }
    else {
        process.nextTick(function () {
            utils.invokeCallback(cb);
        });
    }
};
SessionService.prototype.getClientAddressBySessionId = function (sid) {
    let session = this.get(sid);
    if (session) {
        let socket = session.__socket__;
        return socket.remoteAddress;
    }
    else {
        return null;
    }
};
SessionService.prototype.sendMessage = function (sid, msg) {
    let session = this.get(sid);
    if (!session) {
        logger.debug('Fail to send message for non-existing session, sid: ' + sid + ' msg: ' + msg);
        return false;
    }
    return send(this, session, msg);
};
SessionService.prototype.sendMessageByUid = function (uid, msg) {
    let sessions = this.getByUid(uid);
    if (!sessions) {
        logger.debug('fail to send message by uid for non-existing session. uid: %j', uid);
        return false;
    }
    for (let i = 0, l = sessions.length; i < l; i++) {
        send(this, sessions[i], msg);
    }
    return true;
};
SessionService.prototype.forEachSession = function (cb) {
    for (let sid in this.sessions) {
        cb(this.sessions[sid]);
    }
};
SessionService.prototype.forEachBindedSession = function (cb) {
    let i, l, sessions;
    for (let uid in this.uidMap) {
        sessions = this.uidMap[uid];
        for (i = 0, l = sessions.length; i < l; i++) {
            cb(sessions[i]);
        }
    }
};
SessionService.prototype.getSessionsCount = function () {
    return utils.size(this.sessions);
};
let send = function (service, session, msg) {
    session.send(msg);
    return true;
};
let Session = function (sid, frontendId, socket, service) {
    EventEmitter.call(this);
    this.id = sid;
    this.frontendId = frontendId;
    this.uid = null;
    this.settings = {};
    this.__socket__ = socket;
    this.__sessionService__ = service;
    this.__state__ = ST_INITED;
};
util.inherits(Session, EventEmitter);
Session.prototype.toFrontendSession = function () {
    return new FrontendSession(this);
};
Session.prototype.bind = function (uid) {
    this.uid = uid;
    this.emit('bind', uid);
};
Session.prototype.unbind = function (uid) {
    this.uid = null;
    this.emit('unbind', uid);
};
Session.prototype.set = function (key, value) {
    if (utils.isObject(key)) {
        for (let i in key) {
            this.settings[i] = key[i];
        }
    }
    else {
        this.settings[key] = value;
    }
};
Session.prototype.remove = function (key) {
    delete this[key];
};
Session.prototype.get = function (key) {
    return this.settings[key];
};
Session.prototype.send = function (msg) {
    this.__socket__.send(msg);
};
Session.prototype.sendBatch = function (msgs) {
    this.__socket__.sendBatch(msgs);
};
Session.prototype.closed = function (reason) {
    logger.debug('session on [%s] is closed with session id: %s', this.frontendId, this.id);
    if (this.__state__ === ST_CLOSED) {
        return;
    }
    this.__state__ = ST_CLOSED;
    this.__sessionService__.remove(this.id);
    this.emit('closed', this.toFrontendSession(), reason);
    this.__socket__.emit('closing', reason);
    let self = this;
    process.nextTick(function () {
        self.__socket__.disconnect();
    });
};
let FrontendSession = function (session) {
    EventEmitter.call(this);
    clone(session, this, FRONTEND_SESSION_FIELDS);
    this.settings = dclone(session.settings);
    this.__session__ = session;
};
util.inherits(FrontendSession, EventEmitter);
FrontendSession.prototype.bind = function (uid, cb) {
    let self = this;
    this.__sessionService__.bind(this.id, uid, function (err) {
        if (!err) {
            self.uid = uid;
        }
        utils.invokeCallback(cb, err);
    });
};
FrontendSession.prototype.unbind = function (uid, cb) {
    let self = this;
    this.__sessionService__.unbind(this.id, uid, function (err) {
        if (!err) {
            self.uid = null;
        }
        utils.invokeCallback(cb, err);
    });
};
FrontendSession.prototype.set = function (key, value) {
    this.settings[key] = value;
};
FrontendSession.prototype.get = function (key) {
    return this.settings[key];
};
FrontendSession.prototype.push = function (key, cb) {
    this.__sessionService__.import(this.id, key, this.get(key), cb);
};
FrontendSession.prototype.pushAll = function (cb) {
    this.__sessionService__.importAll(this.id, this.settings, cb);
};
FrontendSession.prototype.on = function (event, listener) {
    EventEmitter.prototype.on.call(this, event, listener);
    this.__session__.on(event, listener);
};
FrontendSession.prototype.export = function () {
    let res = {};
    clone(this, res, EXPORTED_SESSION_FIELDS);
    return res;
};
let clone = function (src, dest, includes) {
    let f;
    for (let i = 0, l = includes.length; i < l; i++) {
        f = includes[i];
        dest[f] = src[f];
    }
};
let dclone = function (src) {
    let res = {};
    for (let f in src) {
        res[f] = src[f];
    }
    return res;
};
