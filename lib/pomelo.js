/*!
 * Pomelo
 * Copyright(c) 2012 xiechengchao <xiecc@163.com>
 * MIT Licensed
 */
let fs = require('fs');
let path = require('path');
let application = require('./application');
let Package = require('../package');
let Pomelo = module.exports = {};
Pomelo.version = Package.version;
Pomelo.events = require('./util/events');
Pomelo.components = {};
Pomelo.filters = {};
Pomelo.rpcFilters = {};
Pomelo.connectors = {};
Pomelo.connectors.__defineGetter__('sioconnector', load.bind(null, './connectors/sioconnector'));
Pomelo.connectors.__defineGetter__('hybridconnector', load.bind(null, './connectors/hybridconnector'));
Pomelo.connectors.__defineGetter__('udpconnector', load.bind(null, './connectors/udpconnector'));
Pomelo.connectors.__defineGetter__('mqttconnector', load.bind(null, './connectors/mqttconnector'));
Pomelo.pushSchedulers = {};
Pomelo.pushSchedulers.__defineGetter__('direct', load.bind(null, './pushSchedulers/direct'));
Pomelo.pushSchedulers.__defineGetter__('buffer', load.bind(null, './pushSchedulers/buffer'));
let self = this;
Pomelo.createApp = function (opts) {
    let app = application;
    app.init(opts);
    self.app = app;
    return app;
};
Object.defineProperty(Pomelo, 'app', {
    get: function () {
        return self.app;
    }
});
fs.readdirSync(__dirname + '/components').forEach(function (filename) {
    if (!/\.js$/.test(filename)) {
        return;
    }
    let name = path.basename(filename, '.js');
    let _load = load.bind(null, './components/', name);
    Pomelo.components.__defineGetter__(name, _load);
    Pomelo.__defineGetter__(name, _load);
});
fs.readdirSync(__dirname + '/filters/handler').forEach(function (filename) {
    if (!/\.js$/.test(filename)) {
        return;
    }
    let name = path.basename(filename, '.js');
    let _load = load.bind(null, './filters/handler/', name);
    Pomelo.filters.__defineGetter__(name, _load);
    Pomelo.__defineGetter__(name, _load);
});
fs.readdirSync(__dirname + '/filters/rpc').forEach(function (filename) {
    if (!/\.js$/.test(filename)) {
        return;
    }
    let name = path.basename(filename, '.js');
    let _load = load.bind(null, './filters/rpc/', name);
    Pomelo.rpcFilters.__defineGetter__(name, _load);
});
function load(path, name) {
    if (name) {
        return require(path + name);
    }
    return require(path);
}
