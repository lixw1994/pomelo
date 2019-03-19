let Package = require('pomelo-protocol').Package;
module.exports.handle = function (socket, reason) {
    if (typeof reason === 'string') {
        let res = {
            reason: reason
        };
        socket.sendRaw(Package.encode(Package.TYPE_KICK, new Buffer(JSON.stringify(res))));
    }
};
