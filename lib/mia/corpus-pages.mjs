// Pagination commune, bornée et sans requête implicite : les callbacks sont injectés.
export const CORPUS_PAGE_SIZE = 30;
export const MAX_CORPUS_ROWS = 1000;
export async function readCorpusPages(readPage, maxRows = MAX_CORPUS_ROWS) {
 const rows=[];let total;
 while(true){
  const {data,count,error}=await readPage(rows.length,CORPUS_PAGE_SIZE);
  if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)throw new Error('Corpus de référence indisponible.');
  if(count>maxRows)throw new Error('Corpus juridique trop volumineux pour cette stratégie de recherche.');
  if(total!==undefined&&total!==count)throw new Error('Corpus modifié pendant la lecture.');
  total=count;
  if(rows.length+data.length>count)throw new Error('Lecture du corpus incohérente.');
  if(!data.length&&rows.length<count)throw new Error('Lecture du corpus incomplète.');
  rows.push(...data);
  if(rows.length===count)return rows;
 }
}
