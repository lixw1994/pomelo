import { TDick } from "./typedefine";

export interface ISession {
    id: number;
    uid: string;
    frontendId: string;
    settings: TDick<any>;
}
