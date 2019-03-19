let util = require('util');
let EventEmitter = require('events').EventEmitter;
let httpServer = require('http').createServer();
let SioSocket = require('./siosocket');
let PKG_ID_BYTES = 4;
let PKG_ROUTE_LENGTH_BYTES = 1;
let PKG_HEAD_BYTES = PKG_ID_BYTES + PKG_ROUTE_LENGTH_BYTES;
let curId = 1;
let Connector = function (port, host, opts) {
    if (!(this instanceof Connector)) {
        return new Connector(port, host, opts);
    }
    EventEmitter.call(this);
    this.port = port;
    this.host = host;
    this.opts = opts;
    this.heartbeats = opts.heartbeats || true;
    this.closeTimeout = opts.closeTimeout || 60;
    this.heartbeatTimeout = opts.heartbeatTimeout || 60;
    this.heartbeatInterval = opts.heartbeatInterval || 25;
};
util.inherits(Connector, EventEmitter);
module.exports = Connector;
Connector.prototype.start = function (cb) {
    let self = this;
    let opts = {};
    if (!!this.opts) {
        opts = this.opts;
    }
    else {
        opts = {
            transports: [
                'websocket', 'polling-xhr', 'polling-jsonp', 'polling'
            ]
        };
    }
    let sio = require('socket.io')(httpServer, opts);
    let port = this.port;
    httpServer.listen(port, function () {
        console.log('sio Server listening at port %d', port);
    });
    sio.set('resource', '/socket.io');
    sio.set('transports', this.opts.transports);
    sio.set('heartbeat timeout', this.heartbeatTimeout);
    sio.set('heartbeat interval', this.heartbeatInterval);
    sio.on('connection', function (socket) {
        let siosocket = new SioSocket(curId++, socket);
        self.emit('connection', siosocket);
        siosocket.on('closing', function (reason) {
            siosocket.send({ route: 'onKick', reason: reason });
        });
    });
    process.nextTick(cb);
};
Connector.prototype.stop = function (force, cb) {
    this.wsocket.server.close();
    process.nextTick(cb);
};
Connector.encode = Connector.prototype.encode = function (reqId, route, msg) {
    if (reqId) {
        return composeResponse(reqId, route, msg);
    }
    else {
        return composePush(route, msg);
    }
};
Connector.decode = Connector.prototype.decode = function (msg) {
    let index = 0;
    let id = parseIntField(msg, index, PKG_ID_BYTES);
    index += PKG_ID_BYTES;
    let routeLen = parseIntField(msg, index, PKG_ROUTE_LENGTH_BYTES);
    let route = msg.substr(PKG_HEAD_BYTES, routeLen);
    let body = msg.substr(PKG_HEAD_BYTES + routeLen);
    return {
        id: id,
        route: route,
        body: JSON.parse(body)
    };
};
let composeResponse = function (msgId, route, msgBody) {
    return {
        id: msgId,
        body: msgBody
    };
};
let composePush = function (route, msgBody) {
    return JSON.stringify({ route: route, body: msgBody });
};
let parseIntField = function (str, offset, len) {
    let res = 0;
    for (let i = 0; i < len; i++) {
        if (i > 0) {
            res <<= 8;
        }
        res |= str.charCodeAt(offset + i) & 0xff;
    }
    return res;
};
