// Harness local uniquement : db est injecté (par exemple PGlite), aucun client distant.
export function createLocalSqlMediaQueue(db){
 const boolean=async(sql,args)=>{const {rows}=await db.query(sql,args);return rows[0]?.accepted===true;};
 return {
  async claim(workerId){
   const {rows}=await db.query('select * from public.media_job_claim($1::uuid)',[workerId]);
   const row=rows[0];return row?.id?{id:row.id,leaseToken:row.lease_token,job:row.payload}:null;
  },
  complete:(id,token,result)=>boolean('select public.media_job_finish($1::uuid,$2::uuid,$3::jsonb) as accepted',[id,token,JSON.stringify(result)]),
  fail:(id,token,code)=>boolean('select public.media_job_fail($1::uuid,$2::uuid,$3::text) as accepted',[id,token,code]),
  async isCancelled(id,token){
   const {rows}=await db.query("select (status = 'processing' and lease_token = $2::uuid and lease_until > now()) as active from public.media_processing_jobs where id = $1::uuid",[id,token]);
   return rows[0]?.active!==true;
  },
 };
}
