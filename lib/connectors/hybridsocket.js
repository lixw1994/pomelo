let util = require('util');
let EventEmitter = require('events').EventEmitter;
let handler = require('./common/handler');
let protocol = require('pomelo-protocol');
let logger = require('pomelo-logger').getLogger('pomelo', __filename);
let Package = protocol.Package;
let ST_INITED = 0;
let ST_WAIT_ACK = 1;
let ST_WORKING = 2;
let ST_CLOSED = 3;
let Socket = function (id, socket) {
    EventEmitter.call(this);
    this.id = id;
    this.socket = socket;
    if (!socket._socket) {
        this.remoteAddress = {
            ip: socket.address().address,
            port: socket.address().port
        };
    }
    else {
        this.remoteAddress = {
            ip: socket._socket.remoteAddress,
            port: socket._socket.remotePort
        };
    }
    let self = this;
    socket.once('close', this.emit.bind(this, 'disconnect'));
    socket.on('error', this.emit.bind(this, 'error'));
    socket.on('message', function (msg) {
        if (msg) {
            msg = Package.decode(msg);
            handler(self, msg);
        }
    });
    this.state = ST_INITED;
};
util.inherits(Socket, EventEmitter);
module.exports = Socket;
Socket.prototype.sendRaw = function (msg) {
    if (this.state !== ST_WORKING) {
        return;
    }
    let self = this;
    this.socket.send(msg, { binary: true }, function (err) {
        if (!!err) {
            logger.error('websocket send binary data failed: %j', err.stack);
            return;
        }
    });
};
Socket.prototype.send = function (msg) {
    if (msg instanceof String) {
        msg = new Buffer(msg);
    }
    else if (!(msg instanceof Buffer)) {
        msg = new Buffer(JSON.stringify(msg));
    }
    this.sendRaw(Package.encode(Package.TYPE_DATA, msg));
};
Socket.prototype.sendBatch = function (msgs) {
    let rs = [];
    for (let i = 0; i < msgs.length; i++) {
        let src = Package.encode(Package.TYPE_DATA, msgs[i]);
        rs.push(src);
    }
    this.sendRaw(Buffer.concat(rs));
};
Socket.prototype.sendForce = function (msg) {
    if (this.state === ST_CLOSED) {
        return;
    }
    this.socket.send(msg, { binary: true });
};
Socket.prototype.handshakeResponse = function (resp) {
    if (this.state !== ST_INITED) {
        return;
    }
    this.socket.send(resp, { binary: true });
    this.state = ST_WAIT_ACK;
};
Socket.prototype.disconnect = function () {
    if (this.state === ST_CLOSED) {
        return;
    }
    this.state = ST_CLOSED;
    this.socket.emit('close');
    this.socket.close();
};
