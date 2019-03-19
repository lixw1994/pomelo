let fs = require('fs');
let utils = require('../../util/utils');
let Loader = require('pomelo-loader');
let pathUtil = require('../../util/pathUtil');
let logger = require('pomelo-logger').getLogger('pomelo', __filename);
let forwardLogger = require('pomelo-logger').getLogger('forward-log', __filename);
let Service = function (app, opts) {
    this.app = app;
    this.handlerMap = {};
    if (!!opts.reloadHandlers) {
        watchHandlers(app, this.handlerMap);
    }
    this.enableForwardLog = opts.enableForwardLog || false;
};
module.exports = Service;
Service.prototype.name = 'handler';
Service.prototype.handle = function (routeRecord, msg, session, cb) {
    let handler = this.getHandler(routeRecord);
    if (!handler) {
        logger.error('[handleManager]: fail to find handler for %j', msg.__route__);
        utils.invokeCallback(cb, new Error('fail to find handler for ' + msg.__route__));
        return;
    }
    let start = Date.now();
    let self = this;
    let callback = function (err, resp, opts) {
        if (self.enableForwardLog) {
            let log = {
                route: msg.__route__,
                args: msg,
                time: utils.format(new Date(start)),
                timeUsed: new Date() - start
            };
            forwardLogger.info(JSON.stringify(log));
        }
        utils.invokeCallback(cb, err, resp, opts);
    };
    let method = routeRecord.method;
    if (!Array.isArray(msg)) {
        handler[method](msg, session, callback);
    }
    else {
        msg.push(session);
        msg.push(callback);
        handler[method].apply(handler, msg);
    }
    return;
};
Service.prototype.getHandler = function (routeRecord) {
    let serverType = routeRecord.serverType;
    if (!this.handlerMap[serverType]) {
        loadHandlers(this.app, serverType, this.handlerMap);
    }
    let handlers = this.handlerMap[serverType] || {};
    let handler = handlers[routeRecord.handler];
    if (!handler) {
        logger.warn('could not find handler for routeRecord: %j', routeRecord);
        return null;
    }
    if (typeof handler[routeRecord.method] !== 'function') {
        logger.warn('could not find the method %s in handler: %s', routeRecord.method, routeRecord.handler);
        return null;
    }
    return handler;
};
let loadHandlers = function (app, serverType, handlerMap) {
    let p = pathUtil.getHandlerPath(app.getBase(), serverType);
    if (p) {
        handlerMap[serverType] = Loader.load(p, app);
    }
};
let watchHandlers = function (app, handlerMap) {
    let p = pathUtil.getHandlerPath(app.getBase(), app.serverType);
    if (!!p) {
        fs.watch(p, function (event, name) {
            if (event === 'change') {
                handlerMap[app.serverType] = Loader.load(p, app);
            }
        });
    }
};
let getResp = function (args) {
    let len = args.length;
    if (len == 1) {
        return [];
    }
    if (len == 2) {
        return [args[1]];
    }
    if (len == 3) {
        return [args[1], args[2]];
    }
    if (len == 4) {
        return [args[1], args[2], args[3]];
    }
    let r = new Array(len);
    for (let i = 1; i < len; i++) {
        r[i] = args[i];
    }
    return r;
};
