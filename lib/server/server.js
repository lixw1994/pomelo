let logger = require('pomelo-logger').getLogger('pomelo', __filename);
let fs = require('fs');
let path = require('path');
let pathUtil = require('../util/pathUtil');
let Loader = require('pomelo-loader');
let utils = require('../util/utils');
let schedule = require('pomelo-scheduler');
let events = require('../util/events');
let Constants = require('../util/constants');
let FilterService = require('../common/service/filterService');
let HandlerService = require('../common/service/handlerService');
let ST_INITED = 0;
let ST_STARTED = 1;
let ST_STOPED = 2;
module.exports.create = function (app, opts) {
    return new Server(app, opts);
};
let Server = function (app, opts) {
    this.opts = opts || {};
    this.app = app;
    this.globalFilterService = null;
    this.filterService = null;
    this.handlerService = null;
    this.crons = [];
    this.jobs = {};
    this.state = ST_INITED;
    app.event.on(events.ADD_CRONS, this.addCrons.bind(this));
    app.event.on(events.REMOVE_CRONS, this.removeCrons.bind(this));
};
let pro = Server.prototype;
pro.start = function () {
    if (this.state > ST_INITED) {
        return;
    }
    this.globalFilterService = initFilter(true, this.app);
    this.filterService = initFilter(false, this.app);
    this.handlerService = initHandler(this.app, this.opts);
    this.cronHandlers = loadCronHandlers(this.app);
    loadCrons(this, this.app);
    this.state = ST_STARTED;
};
pro.afterStart = function () {
    scheduleCrons(this, this.crons);
};
pro.stop = function () {
    this.state = ST_STOPED;
};
pro.globalHandle = function (msg, session, cb) {
    if (this.state !== ST_STARTED) {
        utils.invokeCallback(cb, new Error('server not started'));
        return;
    }
    let routeRecord = parseRoute(msg.route);
    if (!routeRecord) {
        utils.invokeCallback(cb, new Error('meet unknown route message %j', msg.route));
        return;
    }
    let self = this;
    let dispatch = function (err, resp, opts) {
        if (err) {
            handleError(true, self, err, msg, session, resp, opts, function (err, resp, opts) {
                response(true, self, err, msg, session, resp, opts, cb);
            });
            return;
        }
        if (self.app.getServerType() !== routeRecord.serverType) {
            doForward(self.app, msg, session, routeRecord, function (err, resp, opts) {
                response(true, self, err, msg, session, resp, opts, cb);
            });
        }
        else {
            doHandle(self, msg, session, routeRecord, function (err, resp, opts) {
                response(true, self, err, msg, session, resp, opts, cb);
            });
        }
    };
    beforeFilter(true, self, msg, session, dispatch);
};
pro.handle = function (msg, session, cb) {
    if (this.state !== ST_STARTED) {
        cb(new Error('server not started'));
        return;
    }
    let routeRecord = parseRoute(msg.route);
    doHandle(this, msg, session, routeRecord, cb);
};
pro.addCrons = function (crons) {
    this.cronHandlers = loadCronHandlers(this.app);
    for (let i = 0, l = crons.length; i < l; i++) {
        let cron = crons[i];
        checkAndAdd(cron, this.crons, this);
    }
    scheduleCrons(this, crons);
};
pro.removeCrons = function (crons) {
    for (let i = 0, l = crons.length; i < l; i++) {
        let cron = crons[i];
        let id = parseInt(cron.id);
        if (!!this.jobs[id]) {
            schedule.cancelJob(this.jobs[id]);
        }
        else {
            logger.warn('cron is not in application: %j', cron);
        }
    }
};
let initFilter = function (isGlobal, app) {
    let service = new FilterService();
    let befores, afters;
    if (isGlobal) {
        befores = app.get(Constants.KEYWORDS.GLOBAL_BEFORE_FILTER);
        afters = app.get(Constants.KEYWORDS.GLOBAL_AFTER_FILTER);
    }
    else {
        befores = app.get(Constants.KEYWORDS.BEFORE_FILTER);
        afters = app.get(Constants.KEYWORDS.AFTER_FILTER);
    }
    let i, l;
    if (befores) {
        for (i = 0, l = befores.length; i < l; i++) {
            service.before(befores[i]);
        }
    }
    if (afters) {
        for (i = 0, l = afters.length; i < l; i++) {
            service.after(afters[i]);
        }
    }
    return service;
};
let initHandler = function (app, opts) {
    return new HandlerService(app, opts);
};
let loadCronHandlers = function (app) {
    let p = pathUtil.getCronPath(app.getBase(), app.getServerType());
    if (p) {
        return Loader.load(p, app);
    }
};
let loadCrons = function (server, app) {
    let env = app.get(Constants.RESERVED.ENV);
    let p = path.join(app.getBase(), Constants.FILEPATH.CRON);
    if (!fs.existsSync(p)) {
        p = path.join(app.getBase(), Constants.FILEPATH.CONFIG_DIR, env, path.basename(Constants.FILEPATH.CRON));
        if (!fs.existsSync(p)) {
            return;
        }
    }
    app.loadConfigBaseApp(Constants.RESERVED.CRONS, Constants.FILEPATH.CRON);
    let crons = app.get(Constants.RESERVED.CRONS);
    for (let serverType in crons) {
        if (app.serverType === serverType) {
            let list = crons[serverType];
            for (let i = 0; i < list.length; i++) {
                if (!list[i].serverId) {
                    checkAndAdd(list[i], server.crons, server);
                }
                else {
                    if (app.serverId === list[i].serverId) {
                        checkAndAdd(list[i], server.crons, server);
                    }
                }
            }
        }
    }
};
let beforeFilter = function (isGlobal, server, msg, session, cb) {
    let fm;
    if (isGlobal) {
        fm = server.globalFilterService;
    }
    else {
        fm = server.filterService;
    }
    if (fm) {
        fm.beforeFilter(msg, session, cb);
    }
    else {
        utils.invokeCallback(cb);
    }
};
let afterFilter = function (isGlobal, server, err, msg, session, resp, opts, cb) {
    let fm;
    if (isGlobal) {
        fm = server.globalFilterService;
    }
    else {
        fm = server.filterService;
    }
    if (fm) {
        if (isGlobal) {
            fm.afterFilter(err, msg, session, resp, function () {
            });
        }
        else {
            fm.afterFilter(err, msg, session, resp, function (err) {
                cb(err, resp, opts);
            });
        }
    }
};
let handleError = function (isGlobal, server, err, msg, session, resp, opts, cb) {
    let handler;
    if (isGlobal) {
        handler = server.app.get(Constants.RESERVED.GLOBAL_ERROR_HANDLER);
    }
    else {
        handler = server.app.get(Constants.RESERVED.ERROR_HANDLER);
    }
    if (!handler) {
        logger.debug('no default error handler to resolve unknown exception. ' + err.stack);
        utils.invokeCallback(cb, err, resp, opts);
    }
    else {
        if (handler.length === 5) {
            handler(err, msg, resp, session, cb);
        }
        else {
            handler(err, msg, resp, session, opts, cb);
        }
    }
};
let response = function (isGlobal, server, err, msg, session, resp, opts, cb) {
    if (isGlobal) {
        cb(err, resp, opts);
        afterFilter(isGlobal, server, err, msg, session, resp, opts, cb);
    }
    else {
        afterFilter(isGlobal, server, err, msg, session, resp, opts, cb);
    }
};
let parseRoute = function (route) {
    if (!route) {
        return null;
    }
    let ts = route.split('.');
    if (ts.length !== 3) {
        return null;
    }
    return {
        route: route,
        serverType: ts[0],
        handler: ts[1],
        method: ts[2]
    };
};
let doForward = function (app, msg, session, routeRecord, cb) {
    let finished = false;
    try {
        app.sysrpc[routeRecord.serverType].msgRemote.forwardMessage(session, msg, session.export(), function (err, resp, opts) {
            if (err) {
                logger.error('fail to process remote message:' + err.stack);
            }
            finished = true;
            utils.invokeCallback(cb, err, resp, opts);
        });
    }
    catch (err) {
        if (!finished) {
            logger.error('fail to forward message:' + err.stack);
            utils.invokeCallback(cb, err);
        }
    }
};
let doHandle = function (server, msg, session, routeRecord, cb) {
    let originMsg = msg;
    msg = msg.body || {};
    msg.__route__ = originMsg.route;
    let self = server;
    let handle = function (err, resp, opts) {
        if (err) {
            handleError(false, self, err, msg, session, resp, opts, function (err, resp, opts) {
                response(false, self, err, msg, session, resp, opts, cb);
            });
            return;
        }
        self.handlerService.handle(routeRecord, msg, session, function (err, resp, opts) {
            if (err) {
                handleError(false, self, err, msg, session, resp, opts, function (err, resp, opts) {
                    response(false, self, err, msg, session, resp, opts, cb);
                });
                return;
            }
            response(false, self, err, msg, session, resp, opts, cb);
        });
    };
    beforeFilter(false, server, msg, session, handle);
};
let scheduleCrons = function (server, crons) {
    let handlers = server.cronHandlers;
    for (let i = 0; i < crons.length; i++) {
        let cronInfo = crons[i];
        let time = cronInfo.time;
        let action = cronInfo.action;
        let jobId = cronInfo.id;
        if (!time || !action || !jobId) {
            logger.error('cron miss necessary parameters: %j', cronInfo);
            continue;
        }
        if (action.indexOf('.') < 0) {
            logger.error('cron action is error format: %j', cronInfo);
            continue;
        }
        let cron = action.split('.')[0];
        let job = action.split('.')[1];
        let handler = handlers[cron];
        if (!handler) {
            logger.error('could not find cron: %j', cronInfo);
            continue;
        }
        if (typeof handler[job] !== 'function') {
            logger.error('could not find cron job: %j, %s', cronInfo, job);
            continue;
        }
        let id = schedule.scheduleJob(time, handler[job].bind(handler));
        server.jobs[jobId] = id;
    }
};
let checkAndAdd = function (cron, crons, server) {
    if (!containCron(cron.id, crons)) {
        server.crons.push(cron);
    }
    else {
        logger.warn('cron is duplicated: %j', cron);
    }
};
let containCron = function (id, crons) {
    for (let i = 0, l = crons.length; i < l; i++) {
        if (id === crons[i].id) {
            return true;
        }
    }
    return false;
};
