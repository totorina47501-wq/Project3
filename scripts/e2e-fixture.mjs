// Frontière HTTP de test locale. Ce module n'est jamais importé par l'application.
import { createServer } from 'node:http';
import { createStatefulFixture, FIXTURE_SERVICE_KEY } from './e2e-stateful.mjs';
export { FIXTURE_SERVICE_KEY };

export const FIXTURE_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const FIXTURE_EMAIL = 'createur@example.test';
const CREATED_AT = '2026-11-01T12:00:00.000Z';
const user = {
  id: FIXTURE_USER_ID,
  aud: 'authenticated', role: 'authenticated', email: FIXTURE_EMAIL,
  email_confirmed_at: CREATED_AT, confirmed_at: CREATED_AT,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {}, identities: [], created_at: CREATED_AT, updated_at: CREATED_AT,
  is_anonymous: false,
};

export function createFixtureSession(identity = user) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      sub: identity.id, aud: 'authenticated', role: 'authenticated',
      exp: expiresAt, iat: expiresAt - 3600, email: identity.email,
    })}.offline-fixture`,
    token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    refresh_token: 'offline-fixture-refresh-token', user: identity,
  };
}

// Même frontière locale, avec état SQL seulement pour les scénarios explicites.
export function createFixtureApp() {
  const users = new Map([[FIXTURE_USER_ID,user]]);
  const stateful = createStatefulFixture({users,sessionFor:createFixtureSession});
  function identityFor(request) {
    const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
    if(!token?.endsWith('.offline-fixture'))return null;
    try {
      const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
      return claims.exp>Date.now()/1000?users.get(claims.sub)??null:null;
    }catch{return null;}
  }
  return {
    close:()=>stateful.close(),
    async handle(request) {
      const url=new URL(request.url), identity=identityFor(request);
      if(url.pathname==='/health')return Response.json({fixture:true});
      if(url.pathname==='/auth/v1/user')return identity?Response.json(identity):Response.json({code:'bad_jwt',msg:'Session locale requise.'},{status:401});
      if(url.pathname==='/auth/v1/logout')return Response.json({});
      if(url.pathname==='/auth/v1/token'&&request.method==='POST') {
        let input;try{input=await request.json();}catch{return Response.json({error:'JSON invalide.'},{status:400});}
        const found=[...users.values()].find(item=>item.email===input.email);
        if(input.refresh_token==='offline-fixture-refresh-token')return Response.json(createFixtureSession());
        if(found&&input.password==='Fixture-local-2026!')return Response.json(createFixtureSession(found));
        return Response.json({code:'invalid_credentials',msg:'Identifiants de fixture invalides.'},{status:400});
      }
      // L'ancien compte de fixture reste statique : ses tests ne modifient pas SQL.
      if(url.pathname.startsWith('/rest/v1/')&&identity?.id===FIXTURE_USER_ID) {
        if(!['GET','HEAD'].includes(request.method))return Response.json({message:'Les mutations sont simulées à leur frontière dans les tests.'},{status:405});
        const table=url.pathname.slice('/rest/v1/'.length);
        const data=table==='users'?[{id:FIXTURE_USER_ID,email:FIXTURE_EMAIL,plan:'studio',ai_training_opt_in:false,created_at:CREATED_AT,updated_at:CREATED_AT}]:table==='user_preferences'?[{user_id:FIXTURE_USER_ID,rewrite_tone:'naturel'}]:[];
        const headers={'Content-Range':data.length?`0-${data.length-1}/${data.length}`:'*/0','Cache-Control':'no-store'};
        const single=request.headers.get('accept')?.includes('application/vnd.pgrst.object+json');
        if(single&&data.length!==1)return Response.json({code:'PGRST116',message:'Aucun objet unique dans la fixture.'},{status:406,headers});
        if(request.method==='HEAD')return new Response(null,{headers});
        return Response.json(single?data[0]:data,{headers});
      }
      const handled=await stateful.handle(request,identity);
      return handled??Response.json({message:'Endpoint absent de la fixture locale.'},{status:404});
    },
  };
}
export function createFixtureServer() {
  const app=createFixtureApp();
  const server=createServer(async(request,response)=>{
    try {
      const chunks=[];let size=0;
      for await(const chunk of request){size+=chunk.length;if(size>1048576){response.writeHead(413);response.end();return;}chunks.push(chunk);}
      const target=new Request('http://127.0.0.1:54329'+(request.url??'/'),{method:request.method,headers:request.headers,
        ...(!['GET','HEAD'].includes(request.method??'GET')?{body:Buffer.concat(chunks)}:{})});
      const result=await app.handle(target);
      response.writeHead(result.status,Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    }catch{response.writeHead(500,{'Content-Type':'application/json'});response.end(JSON.stringify({message:'Fixture locale indisponible.'}));}
  });
  server.once('close',()=>{void app.close();});
  return server;
}
