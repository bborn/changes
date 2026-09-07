import {api} from '../../backend/api.js';
export const onRequest=({request,env})=>api(request,env);
