let utils = require('../../../util/utils');
let logger = require('pomelo-logger').getLogger('forward-log', __filename);
module.exports = function (app) {
    return new Remote(app);
};
let Remote = function (app) {
    this.app = app;
};
Remote.prototype.forwardMessage = function (msg, session, cb) {
    let server = this.app.components.__server__;
    let sessionService = this.app.components.__backendSession__;
    if (!server) {
        logger.error('server component not enable on %s', this.app.serverId);
        utils.invokeCallback(cb, new Error('server component not enable'));
        return;
    }
    if (!sessionService) {
        logger.error('backend session component not enable on %s', this.app.serverId);
        utils.invokeCallback(cb, new Error('backend sesssion component not enable'));
        return;
    }
    let backendSession = sessionService.create(session);
    logger.debug('backend server [%s] handle message: %j', this.app.serverId, msg);
    server.handle(msg, backendSession, function (err, resp, opts) {
        utils.invokeCallback(cb, err, resp, opts);
    });
};
Remote.prototype.forwardMessage2 = function (route, body, aesPassword, compressGzip, session, cb) {
    let server = this.app.components.__server__;
    let sessionService = this.app.components.__backendSession__;
    if (!server) {
        logger.error('server component not enable on %s', this.app.serverId);
        utils.invokeCallback(cb, new Error('server component not enable'));
        return;
    }
    if (!sessionService) {
        logger.error('backend session component not enable on %s', this.app.serverId);
        utils.invokeCallback(cb, new Error('backend sesssion component not enable'));
        return;
    }
    let backendSession = sessionService.create(session);
    let dmsg = {
        route: route,
        body: body,
        compressGzip: compressGzip
    };
    let socket = {
        aesPassword: aesPassword
    };
    let connector = this.app.components.__connector__.connector;
    connector.runDecode(dmsg, socket, function (err, msg) {
        if (err) {
            return cb(err);
        }
        server.handle(msg, backendSession, function (err, resp, opts) {
            utils.invokeCallback(cb, err, resp, opts);
        });
    });
};
