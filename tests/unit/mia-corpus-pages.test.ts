import {expect,it} from 'vitest';
import {readCorpusPages} from '../../lib/mia/corpus-pages.mjs';
it('refuse 1001 lignes avant de les charger',async()=>{
 await expect(readCorpusPages(async()=>({data:[],count:1001,error:null}))).rejects.toThrow('trop volumineux');
});
it('suit le nombre réellement reçu même si la plateforme réduit les pages',async()=>{
 const offsets:number[]=[];
 const rows=await readCorpusPages(async(offset)=>{offsets.push(offset);return {data:Array.from({length:Math.min(2,5-offset)},(_,i)=>offset+i),count:5,error:null};});
 expect(offsets).toEqual([0,2,4]);expect(rows).toEqual([0,1,2,3,4]);
});
it('refuse une pagination tronquée, un total divergent ou négatif',async()=>{
 for(const count of [-1,2])await expect(readCorpusPages(async()=>({data:[],count,error:null}))).rejects.toThrow();
});
