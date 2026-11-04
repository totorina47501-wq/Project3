import { renderEmail, type EmailInput, type RenderedEmail } from './templates';
type LocalMessage={key:string;recipientId:string;email:RenderedEmail};
type LocalDelivery=LocalMessage&{deliveryId:string};
export type LocalEmailTransport=Readonly<{
  mode:'local-simulation';deliver:(message:LocalMessage)=>Promise<{deliveryId:string}>;deliveries:()=>LocalDelivery[];
}>;
export type SimulatedEmail=LocalMessage&{status:'queued'|'processing'|'failed'|'simulated';attempts:number;deliveryId:string|null;lastError:'SIMULATED_FAILURE'|null};
const localTransports=new WeakSet<object>();
const identifier=/^[A-Za-z0-9_:-]{1,100}$/;
function nonnegative(value:number){if(!Number.isSafeInteger(value)||value<0||value>100)throw new Error('Limite locale invalide.');return value;}
export function createLocalEmailTransport(options:{failuresBeforeRecord?:number;failuresAfterRecord?:number}={}):LocalEmailTransport {
  let before=nonnegative(options.failuresBeforeRecord??0);let after=nonnegative(options.failuresAfterRecord??0);
  const deliveries=new Map<string,LocalDelivery>();
  const transport:LocalEmailTransport=Object.freeze({
    mode:'local-simulation' as const,
    async deliver(message:LocalMessage){
      const existing=deliveries.get(message.key);
      if(existing){
        if(JSON.stringify({recipientId:existing.recipientId,email:existing.email})!==JSON.stringify({recipientId:message.recipientId,email:message.email}))throw new Error('Collision locale.');
        return {deliveryId:existing.deliveryId};
      }
      if(before>0){before--;throw new Error('Échec local simulé avant enregistrement.');}
      const delivery={...structuredClone(message),deliveryId:'local_email_'+(deliveries.size+1)};
      deliveries.set(message.key,delivery);
      if(after>0){after--;throw new Error('Accusé local simulé perdu.');}
      return {deliveryId:delivery.deliveryId};
    },
    deliveries:()=>structuredClone([...deliveries.values()]),
  });
  localTransports.add(transport);return transport;
}
export function createEmailSimulation(transport:LocalEmailTransport,options:{maxAttempts?:number}={}){
  // Le transport injecté provient de la fabrique locale gelée. Ni adaptateur
  // arbitraire ni callback fournisseur ne peuvent être exécutés par cette outbox.
  if(!transport||!localTransports.has(transport))throw new Error('Transport de simulation locale requis.');
  const maxAttempts=options.maxAttempts??3;
  if(nonnegative(maxAttempts)<1)throw new Error('Au moins une tentative requise.');
  const rows=new Map<string,SimulatedEmail>();const inFlight=new Map<string,Promise<SimulatedEmail>>();
  function enqueue(command:{key:string;recipientId:string;input:EmailInput}):SimulatedEmail{
    if(!identifier.test(command.key)||!identifier.test(command.recipientId))throw new Error('Identifiant local requis ; aucune adresse email.');
    const email=renderEmail(command.input);const existing=rows.get(command.key);
    if(existing){
      if(existing.recipientId!==command.recipientId||JSON.stringify(existing.email)!==JSON.stringify(email))throw new Error('Collision d’identifiant message.');
      return structuredClone(existing);
    }
    const row:SimulatedEmail={key:command.key,recipientId:command.recipientId,email,status:'queued',attempts:0,deliveryId:null,lastError:null};
    rows.set(command.key,row);return structuredClone(row);
  }
  function dispatch(key:string):Promise<SimulatedEmail>{
    const concurrent=inFlight.get(key);if(concurrent)return concurrent.then(row=>structuredClone(row));
    const row=rows.get(key);if(!row)return Promise.reject(new Error('Message local absent.'));
    if(row.status==='simulated'||row.attempts>=maxAttempts)return Promise.resolve(structuredClone(row));
    row.status='processing';row.attempts++;
    const pending=(async()=>{
      try{
        const delivered=await transport.deliver({key:row.key,recipientId:row.recipientId,email:structuredClone(row.email)});
        row.status='simulated';row.deliveryId=delivered.deliveryId;row.lastError=null;
      }catch{row.status='failed';row.lastError='SIMULATED_FAILURE';}
      finally{inFlight.delete(key);}
      return structuredClone(row);
    })();
    inFlight.set(key,pending);return pending.then(result=>structuredClone(result));
  }
  return Object.freeze({enqueue,dispatch,get:(key:string)=>{const row=rows.get(key);return row?structuredClone(row):null;}});
}
