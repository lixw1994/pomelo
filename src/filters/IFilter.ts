
import { HandlerCallback } from '../interface/typedefine';
import { ISession } from '../interface/interface';

interface RouteRecord {
    route: string;
    serverType: string;
    handler: string;
    method: string;
}
export type BeforeHandlerFilterFunction = (routeRecord: RouteRecord , msg: any, session: ISession, cb: HandlerCallback) => void;
export type AfterHandlerFilterFunction = (err: Error, routeRecord: RouteRecord , msg: any, session: ISession, resp: any, cb: HandlerCallback) => void;

export interface IHandlerFilter {
    before ?: BeforeHandlerFilterFunction;
    after ?: AfterHandlerFilterFunction;
}

export type BeforeHandlerFilter = BeforeHandlerFilterFunction | IHandlerFilter;
export type AfterHandlerFilter = AfterHandlerFilterFunction | IHandlerFilter;

// rpc filter
export type RpcFilterFunction = (serverId: string, msg: any, opts: any, next: (target?: Error | string, message?: any, options?: any) => void) => void;
export interface IRpcFilter {
    name: string;
    before ?: RpcFilterFunction;
    after ?: RpcFilterFunction;
}
export type RpcFilter = RpcFilterFunction | IRpcFilter;