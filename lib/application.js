/*!
 * Pomelo -- proto
 * Copyright(c) 2012 xiechengchao <xiecc@163.com>
 * MIT Licensed
 */
let utils = require('./util/utils');
let logger = require('pomelo-logger').getLogger('pomelo', __filename);
let EventEmitter = require('events').EventEmitter;
let events = require('./util/events');
let appUtil = require('./util/appUtil');
let Constants = require('./util/constants');
let appManager = require('./common/manager/appManager');
let fs = require('fs');
let path = require('path');
let Application = module.exports = {};
let STATE_INITED = 1;
let STATE_START = 2;
let STATE_STARTED = 3;
let STATE_STOPED = 4;
Application.init = function (opts) {
    opts = opts || {};
    this.loaded = [];
    this.components = {};
    this.settings = {};
    let base = opts.base || path.dirname(require.main.filename);
    this.set(Constants.RESERVED.BASE, base, true);
    this.event = new EventEmitter();
    this.serverId = null;
    this.serverType = null;
    this.curServer = null;
    this.startTime = null;
    this.master = null;
    this.servers = {};
    this.serverTypeMaps = {};
    this.serverTypes = [];
    this.lifecycleCbs = {};
    this.clusterSeq = {};
    appUtil.defaultConfiguration(this);
    this.state = STATE_INITED;
    logger.info('application inited: %j', this.getServerId());
};
Application.getBase = function () {
    return this.get(Constants.RESERVED.BASE);
};
Application.require = function (ph) {
    return require(path.join(Application.getBase(), ph));
};
Application.configureLogger = function (logger) {
    if (process.env.POMELO_LOGGER !== 'off') {
        let base = this.getBase();
        let env = this.get(Constants.RESERVED.ENV);
        let originPath = path.join(base, Constants.FILEPATH.LOG);
        let presentPath = path.join(base, Constants.FILEPATH.CONFIG_DIR, env, path.basename(Constants.FILEPATH.LOG));
        if (fs.existsSync(originPath)) {
            logger.configure(originPath, { serverId: this.serverId, base: base });
        }
        else if (fs.existsSync(presentPath)) {
            logger.configure(presentPath, { serverId: this.serverId, base: base });
        }
        else {
            logger.error('logger file path configuration is error.');
        }
    }
};
Application.filter = function (filter) {
    this.before(filter);
    this.after(filter);
};
Application.before = function (bf) {
    addFilter(this, Constants.KEYWORDS.BEFORE_FILTER, bf);
};
Application.after = function (af) {
    addFilter(this, Constants.KEYWORDS.AFTER_FILTER, af);
};
Application.globalFilter = function (filter) {
    this.globalBefore(filter);
    this.globalAfter(filter);
};
Application.globalBefore = function (bf) {
    addFilter(this, Constants.KEYWORDS.GLOBAL_BEFORE_FILTER, bf);
};
Application.globalAfter = function (af) {
    addFilter(this, Constants.KEYWORDS.GLOBAL_AFTER_FILTER, af);
};
Application.rpcBefore = function (bf) {
    addFilter(this, Constants.KEYWORDS.RPC_BEFORE_FILTER, bf);
};
Application.rpcAfter = function (af) {
    addFilter(this, Constants.KEYWORDS.RPC_AFTER_FILTER, af);
};
Application.rpcFilter = function (filter) {
    this.rpcBefore(filter);
    this.rpcAfter(filter);
};
Application.load = function (name, component, opts) {
    if (typeof name !== 'string') {
        opts = component;
        component = name;
        name = null;
        if (typeof component.name === 'string') {
            name = component.name;
        }
    }
    if (typeof component === 'function') {
        component = component(this, opts);
    }
    if (!name && typeof component.name === 'string') {
        name = component.name;
    }
    if (name && this.components[name]) {
        logger.warn('ignore duplicate component: %j', name);
        return;
    }
    this.loaded.push(component);
    if (name) {
        this.components[name] = component;
    }
    return this;
};
Application.loadConfigBaseApp = function (key, val, reload) {
    let self = this;
    let env = this.get(Constants.RESERVED.ENV);
    let originPath = path.join(Application.getBase(), val);
    let presentPath = path.join(Application.getBase(), Constants.FILEPATH.CONFIG_DIR, env, path.basename(val));
    let realPath;
    if (fs.existsSync(originPath)) {
        realPath = originPath;
        let file = require(originPath);
        if (file[env]) {
            file = file[env];
        }
        this.set(key, file);
    }
    else if (fs.existsSync(presentPath)) {
        realPath = presentPath;
        let pfile = require(presentPath);
        this.set(key, pfile);
    }
    else {
        logger.error('invalid configuration with file path: %s', key);
    }
    if (!!realPath && !!reload) {
        fs.watch(realPath, function (event, filename) {
            if (event === 'change') {
                delete require.cache[require.resolve(realPath)];
                self.loadConfigBaseApp(key, val);
            }
        });
    }
};
Application.loadConfig = function (key, val) {
    let env = this.get(Constants.RESERVED.ENV);
    val = require(val);
    if (val[env]) {
        val = val[env];
    }
    this.set(key, val);
};
Application.route = function (serverType, routeFunc) {
    let routes = this.get(Constants.KEYWORDS.ROUTE);
    if (!routes) {
        routes = {};
        this.set(Constants.KEYWORDS.ROUTE, routes);
    }
    routes[serverType] = routeFunc;
    return this;
};
Application.beforeStopHook = function (fun) {
    logger.warn('this method was deprecated in pomelo 0.8');
    if (!!fun && typeof fun === 'function') {
        this.set(Constants.KEYWORDS.BEFORE_STOP_HOOK, fun);
    }
};
Application.start = function (cb) {
    this.startTime = Date.now();
    if (this.state > STATE_INITED) {
        utils.invokeCallback(cb, new Error('application has already start.'));
        return;
    }
    let self = this;
    appUtil.startByType(self, function () {
        appUtil.loadDefaultComponents(self);
        let startUp = function () {
            appUtil.optComponents(self.loaded, Constants.RESERVED.START, function (err) {
                self.state = STATE_START;
                if (err) {
                    utils.invokeCallback(cb, err);
                }
                else {
                    logger.info('%j enter after start...', self.getServerId());
                    self.afterStart(cb);
                }
            });
        };
        let beforeFun = self.lifecycleCbs[Constants.LIFECYCLE.BEFORE_STARTUP];
        if (!!beforeFun) {
            beforeFun.call(null, self, startUp);
        }
        else {
            startUp();
        }
    });
};
Application.afterStart = function (cb) {
    if (this.state !== STATE_START) {
        utils.invokeCallback(cb, new Error('application is not running now.'));
        return;
    }
    let afterFun = this.lifecycleCbs[Constants.LIFECYCLE.AFTER_STARTUP];
    let self = this;
    appUtil.optComponents(this.loaded, Constants.RESERVED.AFTER_START, function (err) {
        self.state = STATE_STARTED;
        let id = self.getServerId();
        if (!err) {
            logger.info('%j finish start', id);
        }
        if (!!afterFun) {
            afterFun.call(null, self, function () {
                utils.invokeCallback(cb, err);
            });
        }
        else {
            utils.invokeCallback(cb, err);
        }
        let usedTime = Date.now() - self.startTime;
        logger.info('%j startup in %s ms', id, usedTime);
        self.event.emit(events.START_SERVER, id);
    });
};
Application.stop = function (force) {
    if (this.state > STATE_STARTED) {
        logger.warn('[pomelo application] application is not running now.');
        return;
    }
    this.state = STATE_STOPED;
    let self = this;
    this.stopTimer = setTimeout(function () {
        process.exit(0);
    }, Constants.TIME.TIME_WAIT_STOP);
    let cancelShutDownTimer = function () {
        if (!!self.stopTimer) {
            clearTimeout(self.stopTimer);
        }
    };
    let shutDown = function () {
        appUtil.stopComps(self.loaded, 0, force, function () {
            cancelShutDownTimer();
            if (force) {
                process.exit(0);
            }
        });
    };
    let fun = this.get(Constants.KEYWORDS.BEFORE_STOP_HOOK);
    let stopFun = this.lifecycleCbs[Constants.LIFECYCLE.BEFORE_SHUTDOWN];
    if (!!stopFun) {
        stopFun.call(null, this, shutDown, cancelShutDownTimer);
    }
    else if (!!fun) {
        utils.invokeCallback(fun, self, shutDown, cancelShutDownTimer);
    }
    else {
        shutDown();
    }
};
Application.set = function (setting, val, attach) {
    if (arguments.length === 1) {
        return this.settings[setting];
    }
    this.settings[setting] = val;
    if (attach) {
        this[setting] = val;
    }
    return this;
};
Application.get = function (setting) {
    return this.settings[setting];
};
Application.enabled = function (setting) {
    return !!this.get(setting);
};
Application.disabled = function (setting) {
    return !this.get(setting);
};
Application.enable = function (setting) {
    return this.set(setting, true);
};
Application.disable = function (setting) {
    return this.set(setting, false);
};
Application.configure = function (env, type, fn) {
    let args = [].slice.call(arguments);
    fn = args.pop();
    env = type = Constants.RESERVED.ALL;
    if (args.length > 0) {
        env = args[0];
    }
    if (args.length > 1) {
        type = args[1];
    }
    if (env === Constants.RESERVED.ALL || contains(this.settings.env, env)) {
        if (type === Constants.RESERVED.ALL || contains(this.settings.serverType, type)) {
            fn.call(this);
        }
    }
    return this;
};
Application.registerAdmin = function (moduleId, module, opts) {
    let modules = this.get(Constants.KEYWORDS.MODULE);
    if (!modules) {
        modules = {};
        this.set(Constants.KEYWORDS.MODULE, modules);
    }
    if (typeof moduleId !== 'string') {
        opts = module;
        module = moduleId;
        if (module) {
            moduleId = module.moduleId;
        }
    }
    if (!moduleId) {
        return;
    }
    modules[moduleId] = {
        moduleId: moduleId,
        module: module,
        opts: opts
    };
};
Application.use = function (plugin, opts) {
    if (!plugin.components) {
        logger.error('invalid components, no components exist');
        return;
    }
    let self = this;
    opts = opts || {};
    let dir = path.dirname(plugin.components);
    if (!fs.existsSync(plugin.components)) {
        logger.error('fail to find components, find path: %s', plugin.components);
        return;
    }
    fs.readdirSync(plugin.components).forEach(function (filename) {
        if (!/\.js$/.test(filename)) {
            return;
        }
        let name = path.basename(filename, '.js');
        let param = opts[name] || {};
        let absolutePath = path.join(dir, Constants.DIR.COMPONENT, filename);
        if (!fs.existsSync(absolutePath)) {
            logger.error('component %s not exist at %s', name, absolutePath);
        }
        else {
            self.load(require(absolutePath), param);
        }
    });
    if (!plugin.events) {
        return;
    }
    else {
        if (!fs.existsSync(plugin.events)) {
            logger.error('fail to find events, find path: %s', plugin.events);
            return;
        }
        fs.readdirSync(plugin.events).forEach(function (filename) {
            if (!/\.js$/.test(filename)) {
                return;
            }
            let absolutePath = path.join(dir, Constants.DIR.EVENT, filename);
            if (!fs.existsSync(absolutePath)) {
                logger.error('events %s not exist at %s', filename, absolutePath);
            }
            else {
                bindEvents(require(absolutePath), self);
            }
        });
    }
};
Application.transaction = function (name, conditions, handlers, retry) {
    appManager.transaction(name, conditions, handlers, retry);
};
Application.getMaster = function () {
    return this.master;
};
Application.getCurServer = function () {
    return this.curServer;
};
Application.getServerId = function () {
    return this.serverId;
};
Application.getServerType = function () {
    return this.serverType;
};
Application.getServers = function () {
    return this.servers;
};
Application.getServersFromConfig = function () {
    return this.get(Constants.KEYWORDS.SERVER_MAP);
};
Application.getServerTypes = function () {
    return this.serverTypes;
};
Application.getServerById = function (serverId) {
    return this.servers[serverId];
};
Application.getServerFromConfig = function (serverId) {
    return this.get(Constants.KEYWORDS.SERVER_MAP)[serverId];
};
Application.getServersByType = function (serverType) {
    return this.serverTypeMaps[serverType];
};
Application.isFrontend = function (server) {
    server = server || this.getCurServer();
    return !!server && server.frontend === 'true';
};
Application.isBackend = function (server) {
    server = server || this.getCurServer();
    return !!server && !server.frontend;
};
Application.isMaster = function () {
    return this.serverType === Constants.RESERVED.MASTER;
};
Application.addServers = function (servers) {
    if (!servers || !servers.length) {
        return;
    }
    let item, slist;
    for (let i = 0, l = servers.length; i < l; i++) {
        item = servers[i];
        this.servers[item.id] = item;
        slist = this.serverTypeMaps[item.serverType];
        if (!slist) {
            this.serverTypeMaps[item.serverType] = slist = [];
        }
        replaceServer(slist, item);
        if (this.serverTypes.indexOf(item.serverType) < 0) {
            this.serverTypes.push(item.serverType);
        }
    }
    this.event.emit(events.ADD_SERVERS, servers);
};
Application.removeServers = function (ids) {
    if (!ids || !ids.length) {
        return;
    }
    let id, item, slist;
    for (let i = 0, l = ids.length; i < l; i++) {
        id = ids[i];
        item = this.servers[id];
        if (!item) {
            continue;
        }
        delete this.servers[id];
        slist = this.serverTypeMaps[item.serverType];
        removeServer(slist, id);
    }
    this.event.emit(events.REMOVE_SERVERS, ids);
};
Application.replaceServers = function (servers) {
    if (!servers) {
        return;
    }
    this.servers = servers;
    this.serverTypeMaps = {};
    this.serverTypes = [];
    let serverArray = [];
    for (let id in servers) {
        let server = servers[id];
        let serverType = server[Constants.RESERVED.SERVER_TYPE];
        let slist = this.serverTypeMaps[serverType];
        if (!slist) {
            this.serverTypeMaps[serverType] = slist = [];
        }
        this.serverTypeMaps[serverType].push(server);
        if (this.serverTypes.indexOf(serverType) < 0) {
            this.serverTypes.push(serverType);
        }
        serverArray.push(server);
    }
    this.event.emit(events.REPLACE_SERVERS, serverArray);
};
Application.addCrons = function (crons) {
    if (!crons || !crons.length) {
        logger.warn('crons is not defined.');
        return;
    }
    this.event.emit(events.ADD_CRONS, crons);
};
Application.removeCrons = function (crons) {
    if (!crons || !crons.length) {
        logger.warn('ids is not defined.');
        return;
    }
    this.event.emit(events.REMOVE_CRONS, crons);
};
let replaceServer = function (slist, serverInfo) {
    for (let i = 0, l = slist.length; i < l; i++) {
        if (slist[i].id === serverInfo.id) {
            slist[i] = serverInfo;
            return;
        }
    }
    slist.push(serverInfo);
};
let removeServer = function (slist, id) {
    if (!slist || !slist.length) {
        return;
    }
    for (let i = 0, l = slist.length; i < l; i++) {
        if (slist[i].id === id) {
            slist.splice(i, 1);
            return;
        }
    }
};
let contains = function (str, settings) {
    if (!settings) {
        return false;
    }
    let ts = settings.split("|");
    for (let i = 0, l = ts.length; i < l; i++) {
        if (str === ts[i]) {
            return true;
        }
    }
    return false;
};
let bindEvents = function (Event, app) {
    let emethods = new Event(app);
    for (let m in emethods) {
        if (typeof emethods[m] === 'function') {
            app.event.on(m, emethods[m].bind(emethods));
        }
    }
};
let addFilter = function (app, type, filter) {
    let filters = app.get(type);
    if (!filters) {
        filters = [];
        app.set(type, filters);
    }
    filters.push(filter);
};
