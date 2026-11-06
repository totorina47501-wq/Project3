export const CORPUS_PAGE_SIZE: number;
export const MAX_CORPUS_ROWS: number;
export function readCorpusPages<T>(readPage:(offset:number,size:number)=>PromiseLike<{data:T[]|null;count:number|null;error:unknown}>,maxRows?:number):Promise<T[]>;
