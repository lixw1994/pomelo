let Service = function (app) {
    this.serverId = app.getServerId();
    this.connCount = 0;
    this.loginedCount = 0;
    this.logined = {};
};
module.exports = Service;
let pro = Service.prototype;
pro.addLoginedUser = function (uid, info) {
    if (!this.logined[uid]) {
        this.loginedCount++;
    }
    info.uid = uid;
    this.logined[uid] = info;
};
pro.updateUserInfo = function (uid, info) {
    let user = this.logined[uid];
    if (!user) {
        return;
    }
    for (let p in info) {
        if (info.hasOwnProperty(p) && typeof info[p] !== 'function') {
            user[p] = info[p];
        }
    }
};
pro.increaseConnectionCount = function () {
    this.connCount++;
};
pro.removeLoginedUser = function (uid) {
    if (!!this.logined[uid]) {
        this.loginedCount--;
    }
    delete this.logined[uid];
};
pro.decreaseConnectionCount = function (uid) {
    if (this.connCount) {
        this.connCount--;
    }
    if (!!uid) {
        this.removeLoginedUser(uid);
    }
};
pro.getStatisticsInfo = function () {
    let list = [];
    for (let uid in this.logined) {
        list.push(this.logined[uid]);
    }
    return { serverId: this.serverId, totalConnCount: this.connCount, loginedCount: this.loginedCount, loginedList: list };
};
