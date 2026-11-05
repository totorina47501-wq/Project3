// Point d'entrée OpenNext personnalisé : mêmes routes, un seul objet média interne.
import {DurableObject} from 'cloudflare:workers';
import handler from '../.open-next/worker.js';
import {CloudflareMediaController} from '../lib/media/cloudflare-controller.ts';
export * from '../.open-next/worker.js';
export class MediaRunner extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.controller=new CloudflareMediaController(ctx,env);}
 fetch(request){return this.controller.fetch(request);}
 alarm(){return this.controller.alarm();}
}
export default handler;
