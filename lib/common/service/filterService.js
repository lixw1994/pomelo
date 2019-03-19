let logger = require('pomelo-logger').getLogger('pomelo', __filename);
let Service = function () {
    this.befores = [];
    this.afters = [];
};
module.exports = Service;
Service.prototype.name = 'filter';
Service.prototype.before = function (filter) {
    this.befores.push(filter);
};
Service.prototype.after = function (filter) {
    this.afters.unshift(filter);
};
Service.prototype.beforeFilter = function (msg, session, cb) {
    let index = 0, self = this;
    let next = function (err, resp, opts) {
        if (err || index >= self.befores.length) {
            cb(err, resp, opts);
            return;
        }
        let handler = self.befores[index++];
        if (typeof handler === 'function') {
            handler(msg, session, next);
        }
        else if (typeof handler.before === 'function') {
            handler.before(msg, session, next);
        }
        else {
            logger.error('meet invalid before filter, handler or handler.before should be function.');
            next(new Error('invalid before filter.'));
        }
    };
    next();
};
Service.prototype.afterFilter = function (err, msg, session, resp, cb) {
    let index = 0, self = this;
    function next(err) {
        if (index >= self.afters.length) {
            cb(err);
            return;
        }
        let handler = self.afters[index++];
        if (typeof handler === 'function') {
            handler(err, msg, session, resp, next);
        }
        else if (typeof handler.after === 'function') {
            handler.after(err, msg, session, resp, next);
        }
        else {
            logger.error('meet invalid after filter, handler or handler.after should be function.');
            next(new Error('invalid after filter.'));
        }
    }
    next(err);
};
