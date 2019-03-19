let Package = require('pomelo-protocol').Package;
let logger = require('pomelo-logger').getLogger('pomelo', __filename);
let Command = function (opts) {
    opts = opts || {};
    this.heartbeat = null;
    this.timeout = null;
    this.disconnectOnTimeout = opts.disconnectOnTimeout;
    if (opts.heartbeat) {
        this.heartbeat = opts.heartbeat * 1000;
        this.timeout = opts.timeout * 1000 || this.heartbeat * 2;
        this.disconnectOnTimeout = true;
    }
    this.timeouts = {};
    this.clients = {};
};
module.exports = Command;
Command.prototype.handle = function (socket) {
    if (!this.heartbeat) {
        return;
    }
    let self = this;
    if (!this.clients[socket.id]) {
        this.clients[socket.id] = 1;
        socket.once('disconnect', clearTimers.bind(null, this, socket.id));
        socket.once('error', clearTimers.bind(null, this, socket.id));
    }
    if (self.disconnectOnTimeout) {
        this.clear(socket.id);
    }
    socket.sendRaw(Package.encode(Package.TYPE_HEARTBEAT));
    if (self.disconnectOnTimeout) {
        self.timeouts[socket.id] = setTimeout(function () {
            logger.info('client %j heartbeat timeout.', socket.id);
            socket.disconnect();
        }, self.timeout);
    }
};
Command.prototype.clear = function (id) {
    let tid = this.timeouts[id];
    if (tid) {
        clearTimeout(tid);
        delete this.timeouts[id];
    }
};
let clearTimers = function (self, id) {
    delete self.clients[id];
    let tid = self.timeouts[id];
    if (tid) {
        clearTimeout(tid);
        delete self.timeouts[id];
    }
};
