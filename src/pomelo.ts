/*!
 * Pomelo
 * Copyright(c) 2012 xiechengchao <xiecc@163.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as application from './application';
import { evnets } from './util/events';
import { TDick } from './interface/typedefine';
import { IComponent } from './components/IComponent';
import { IConnector } from './connectors/IConnector';
import { IHandlerFilter, IRpcFilter } from './filters/IFilter';
import { IPushScheduler } from './pushSchedulers/IPushScheduler';

export class CPomelo {
    app: any;

    version: string = '0.0.1';

    events = evnets;

    components: TDick<IComponent> = {};

    connectors: TDick<IConnector> = {};

    filters: TDick<IHandlerFilter> = {};

    rpcFilters: TDick<IRpcFilter> = {};

    pushSchedulers: TDick<IPushScheduler> = {};
    constructor() {
        this.loadComponents();
        this.loadFilters();
        this.loadRpcFilters();
        this.loadConnectors();
        this.loadPushSchedulers();
    }

    createApp = function (opts) {
        this.app = application;
        this.app.init(opts);
        return this.app;
    };

    private loadComponents() {
        fs.readdirSync(__dirname + '/components').forEach((filename) => {
            if (!/\.js$/.test(filename)) {
                return;
            }
            let name = path.basename(filename, '.js');
            let _load = load.bind(null, './components/', name);
            Object.defineProperty(this.components, name, { get: _load });
            Object.defineProperty(this, name, { get: _load });
        });
    }

    private loadFilters() {
        fs.readdirSync(__dirname + '/filters/handler').forEach((filename) => {
            if (!/\.js$/.test(filename)) {
                return;
            }
            let name = path.basename(filename, '.js');
            let _load = load.bind(null, './filters/handler/', name);
            Object.defineProperty(this.filters, name, { get: _load });
            Object.defineProperty(this, name, { get: _load });
        });
    }

    private loadRpcFilters() {
        fs.readdirSync(__dirname + '/filters/rpc').forEach(function (filename) {
            if (!/\.js$/.test(filename)) {
                return;
            }
            let name = path.basename(filename, '.js');
            let _load = load.bind(null, './filters/rpc/', name);
            Object.defineProperty(this.rpcFilters, name, { get: _load });
        });
    }

    private loadConnectors() {
        fs.readdirSync(__dirname + '/connectors').forEach(function (filename) {
            if (filename.includes('connector.js')) {
                let name = path.basename(filename, '.js');
                let _load = load.bind(null, './connectors/', name);
                Object.defineProperty(this.rpcFilters, name, { get: _load });
            }
        });
    }

    private loadPushSchedulers() {
        Object.defineProperty(this.pushSchedulers, 'direct', { get: load.bind(null, './pushSchedulers/direct') });
        Object.defineProperty(this.pushSchedulers, 'buffer', { get: load.bind(null, './pushSchedulers/buffer') });
    }
}

function loadSync(path, name) {
    if (name) {
        return require(path + name);
    }
    return require(path);
}

async function load<T>(path: string, name: string = '') {
    let loadRes: T = await import(`${path}${name}`);
    return loadRes;
}

export default new CPomelo();
