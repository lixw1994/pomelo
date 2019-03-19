let utils = require('../../../util/utils');
module.exports = function (app) {
    return new Remote(app);
};
let Remote = function (app) {
    this.app = app;
};
Remote.prototype.bind = function (sid, uid, cb) {
    this.app.get('sessionService').bind(sid, uid, cb);
};
Remote.prototype.unbind = function (sid, uid, cb) {
    this.app.get('sessionService').unbind(sid, uid, cb);
};
Remote.prototype.push = function (sid, key, value, cb) {
    this.app.get('sessionService').import(sid, key, value, cb);
};
Remote.prototype.pushAll = function (sid, settings, cb) {
    this.app.get('sessionService').importAll(sid, settings, cb);
};
Remote.prototype.getBackendSessionBySid = function (sid, cb) {
    let session = this.app.get('sessionService').get(sid);
    if (!session) {
        utils.invokeCallback(cb);
        return;
    }
    utils.invokeCallback(cb, null, session.toFrontendSession().export());
};
Remote.prototype.getBackendSessionsByUid = function (uid, cb) {
    let sessions = this.app.get('sessionService').getByUid(uid);
    if (!sessions) {
        utils.invokeCallback(cb);
        return;
    }
    let res = [];
    for (let i = 0, l = sessions.length; i < l; i++) {
        res.push(sessions[i].toFrontendSession().export());
    }
    utils.invokeCallback(cb, null, res);
};
Remote.prototype.kickBySid = function (sid, reason, cb) {
    this.app.get('sessionService').kickBySessionId(sid, reason, cb);
};
Remote.prototype.kickByUid = function (uid, reason, cb) {
    this.app.get('sessionService').kick(uid, reason, cb);
};
