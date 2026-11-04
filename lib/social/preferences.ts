import { toneSchema } from '@/lib/ai/schemas';
import type { RewriteTone } from './model';
import type { SupabaseClient } from '@supabase/supabase-js';
// Une ancienne base sans table de préférences conserve la tonalité historique.
// Le client reste celui déjà autorisé par l'appelant, jamais un nouvel accès IA.
export async function readRewriteTone(client:SupabaseClient,userId:string):Promise<RewriteTone>{
  try {
    const {data,error}=await client.from('user_preferences').select('rewrite_tone').eq('user_id',userId).maybeSingle();
    if(error)return 'naturel';
    const parsed=toneSchema.safeParse((data as {rewrite_tone?:unknown}|null)?.rewrite_tone);
    return parsed.success?parsed.data:'naturel';
  }catch{return 'naturel';}
}
