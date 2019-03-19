let DefaultScheduler = require('../pushSchedulers/direct');
let logger = require('pomelo-logger').getLogger('pomelo', __filename);
module.exports = function (app, opts) {
    return new PushScheduler(app, opts);
};
let PushScheduler = function (app, opts) {
    this.app = app;
    opts = opts || {};
    this.scheduler = getScheduler(this, app, opts);
};
PushScheduler.prototype.name = '__pushScheduler__';
PushScheduler.prototype.afterStart = function (cb) {
    if (this.isSelectable) {
        for (let k in this.scheduler) {
            let sch = this.scheduler[k];
            if (typeof sch.start === 'function') {
                sch.start();
            }
        }
        process.nextTick(cb);
    }
    else if (typeof this.scheduler.start === 'function') {
        this.scheduler.start(cb);
    }
    else {
        process.nextTick(cb);
    }
};
PushScheduler.prototype.stop = function (force, cb) {
    if (this.isSelectable) {
        for (let k in this.scheduler) {
            let sch = this.scheduler[k];
            if (typeof sch.stop === 'function') {
                sch.stop();
            }
        }
        process.nextTick(cb);
    }
    else if (typeof this.scheduler.stop === 'function') {
        this.scheduler.stop(cb);
    }
    else {
        process.nextTick(cb);
    }
};
PushScheduler.prototype.schedule = function (reqId, route, msg, recvs, opts, cb) {
    let self = this;
    if (self.isSelectable) {
        if (typeof self.selector === 'function') {
            self.selector(reqId, route, msg, recvs, opts, function (id) {
                if (self.scheduler[id] && typeof self.scheduler[id].schedule === 'function') {
                    self.scheduler[id].schedule(reqId, route, msg, recvs, opts, cb);
                }
                else {
                    logger.error('invalid pushScheduler id, id: %j', id);
                }
            });
        }
        else {
            logger.error('the selector for pushScheduler is not a function, selector: %j', self.selector);
        }
    }
    else {
        if (typeof self.scheduler.schedule === 'function') {
            self.scheduler.schedule(reqId, route, msg, recvs, opts, cb);
        }
        else {
            logger.error('the scheduler does not have a schedule function, scheduler: %j', self.scheduler);
        }
    }
};
let getScheduler = function (pushSchedulerComp, app, opts) {
    let scheduler = opts.scheduler || DefaultScheduler;
    if (typeof scheduler === 'function') {
        return scheduler(app, opts);
    }
    if (Array.isArray(scheduler)) {
        let res = {};
        scheduler.forEach(function (sch) {
            if (typeof sch.scheduler === 'function') {
                res[sch.id] = sch.scheduler(app, sch.options);
            }
            else {
                res[sch.id] = sch.scheduler;
            }
        });
        pushSchedulerComp.isSelectable = true;
        pushSchedulerComp.selector = opts.selector;
        return res;
    }
    return scheduler;
};
