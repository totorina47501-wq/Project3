export const MAX_INDEX_BATCH:number;
export const LAW_EMBEDDING_MODEL:string;
export interface IndexableLawDocument { id:string; article_ref:string; content:string; source_url:string; }
export interface IndexedLawMetadata { article_ref:string; embedding_model:string; }
export function planLawIndex<T extends IndexableLawDocument>(rows:T[],indexRows:IndexedLawMetadata[]):{
 total:number;indexed:number;pending:T[];batch:T[];
};
