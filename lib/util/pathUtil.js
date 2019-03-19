let fs = require('fs');
let path = require('path');
let Constants = require('./constants');
let exp = module.exports;
exp.getSysRemotePath = function (role) {
    let p = path.join(__dirname, '/../common/remote/', role);
    return fs.existsSync(p) ? p : null;
};
exp.getUserRemotePath = function (appBase, serverType) {
    let p = path.join(appBase, '/app/servers/', serverType, Constants.DIR.REMOTE);
    return fs.existsSync(p) ? p : null;
};
exp.getCronPath = function (appBase, serverType) {
    let p = path.join(appBase, '/app/servers/', serverType, Constants.DIR.CRON);
    return fs.existsSync(p) ? p : null;
};
exp.listUserRemoteDir = function (appBase) {
    let base = path.join(appBase, '/app/servers/');
    let files = fs.readdirSync(base);
    return files.filter(function (fn) {
        if (fn.charAt(0) === '.') {
            return false;
        }
        return fs.statSync(path.join(base, fn)).isDirectory();
    });
};
exp.remotePathRecord = function (namespace, serverType, path) {
    return { namespace: namespace, serverType: serverType, path: path };
};
exp.getHandlerPath = function (appBase, serverType) {
    let p = path.join(appBase, '/app/servers/', serverType, Constants.DIR.HANDLER);
    return fs.existsSync(p) ? p : null;
};
exp.getScriptPath = function (appBase) {
    return path.join(appBase, Constants.DIR.SCRIPT);
};
exp.getLogPath = function (appBase) {
    return path.join(appBase, Constants.DIR.LOG);
};
