let crc = require('crc');
let utils = require('../util/utils');
let events = require('../util/events');
let Client = require('pomelo-rpc').client;
let pathUtil = require('../util/pathUtil');
let Constants = require('../util/constants');
let logger = require('pomelo-logger').getLogger('pomelo', __filename);
module.exports = function (app, opts) {
    opts = opts || {};
    opts.bufferMsg = opts.bufferMsg || opts.cacheMsg || false;
    opts.interval = opts.interval || 30;
    opts.router = genRouteFun();
    opts.context = app;
    opts.routeContext = app;
    if (app.enabled('rpcDebugLog')) {
        opts.rpcDebugLog = true;
        opts.rpcLogger = require('pomelo-logger').getLogger('rpc-debug', __filename);
    }
    return new Component(app, opts);
};
let Component = function (app, opts) {
    this.app = app;
    this.opts = opts;
    this.client = genRpcClient(this.app, opts);
    this.app.event.on(events.ADD_SERVERS, this.addServers.bind(this));
    this.app.event.on(events.REMOVE_SERVERS, this.removeServers.bind(this));
    this.app.event.on(events.REPLACE_SERVERS, this.replaceServers.bind(this));
};
let pro = Component.prototype;
pro.name = '__proxy__';
pro.start = function (cb) {
    if (this.opts.enableRpcLog) {
        logger.warn('enableRpcLog is deprecated in 0.8.0, please use app.rpcFilter(pomelo.rpcFilters.rpcLog())');
    }
    let rpcBefores = this.app.get(Constants.KEYWORDS.RPC_BEFORE_FILTER);
    let rpcAfters = this.app.get(Constants.KEYWORDS.RPC_AFTER_FILTER);
    let rpcErrorHandler = this.app.get(Constants.RESERVED.RPC_ERROR_HANDLER);
    if (!!rpcBefores) {
        this.client.before(rpcBefores);
    }
    if (!!rpcAfters) {
        this.client.after(rpcAfters);
    }
    if (!!rpcErrorHandler) {
        this.client.setErrorHandler(rpcErrorHandler);
    }
    process.nextTick(cb);
};
pro.afterStart = function (cb) {
    let self = this;
    this.app.__defineGetter__('rpc', function () {
        return self.client.proxies.user;
    });
    this.app.__defineGetter__('sysrpc', function () {
        return self.client.proxies.sys;
    });
    this.app.set('rpcInvoke', this.client.rpcInvoke.bind(this.client), true);
    this.client.start(cb);
};
pro.addServers = function (servers) {
    if (!servers || !servers.length) {
        return;
    }
    genProxies(this.client, this.app, servers);
    this.client.addServers(servers);
};
pro.removeServers = function (ids) {
    this.client.removeServers(ids);
};
pro.replaceServers = function (servers) {
    if (!servers || !servers.length) {
        return;
    }
    this.client.proxies = {};
    genProxies(this.client, this.app, servers);
    this.client.replaceServers(servers);
};
pro.rpcInvoke = function (serverId, msg, cb) {
    this.client.rpcInvoke(serverId, msg, cb);
};
let genRpcClient = function (app, opts) {
    opts.context = app;
    opts.routeContext = app;
    if (!!opts.rpcClient) {
        return opts.rpcClient.create(opts);
    }
    else {
        return Client.create(opts);
    }
};
let genProxies = function (client, app, sinfos) {
    let item;
    for (let i = 0, l = sinfos.length; i < l; i++) {
        item = sinfos[i];
        if (hasProxy(client, item)) {
            continue;
        }
        client.addProxies(getProxyRecords(app, item));
    }
};
let hasProxy = function (client, sinfo) {
    let proxy = client.proxies;
    return !!proxy.sys && !!proxy.sys[sinfo.serverType];
};
let getProxyRecords = function (app, sinfo) {
    let records = [], appBase = app.getBase(), record;
    if (app.isFrontend(sinfo)) {
        record = pathUtil.getSysRemotePath('frontend');
    }
    else {
        record = pathUtil.getSysRemotePath('backend');
    }
    if (record) {
        records.push(pathUtil.remotePathRecord('sys', sinfo.serverType, record));
    }
    record = pathUtil.getUserRemotePath(appBase, sinfo.serverType);
    if (record) {
        records.push(pathUtil.remotePathRecord('user', sinfo.serverType, record));
    }
    return records;
};
let genRouteFun = function () {
    return function (session, msg, app, cb) {
        let routes = app.get('__routes__');
        if (!routes) {
            defaultRoute(session, msg, app, cb);
            return;
        }
        let type = msg.serverType, route = routes[type] || routes['default'];
        if (route) {
            route(session, msg, app, cb);
        }
        else {
            defaultRoute(session, msg, app, cb);
        }
    };
};
let defaultRoute = function (session, msg, app, cb) {
    let list = app.getServersByType(msg.serverType);
    if (!list || !list.length) {
        cb(new Error('can not find server info for type:' + msg.serverType));
        return;
    }
    let uid = session ? (session.uid || '') : '';
    let index = Math.abs(crc.crc32(uid.toString())) % list.length;
    utils.invokeCallback(cb, null, list[index].id);
};
