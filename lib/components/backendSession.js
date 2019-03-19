let BackendSessionService = require('../common/service/backendSessionService');
module.exports = function (app) {
    let service = new BackendSessionService(app);
    service.name = '__backendSession__';
    app.set('backendSessionService', service, true);
    app.set('localSessionService', service, true);
    return service;
};
