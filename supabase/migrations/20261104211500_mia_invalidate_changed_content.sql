-- Les embeddings sont invalidés dès que le contenu source change.
-- Les textes inchangés conservent leurs vecteurs ; le cron n'indexe que les manquants.
CREATE OR REPLACE FUNCTION public.invalidate_law_document_embedding()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.embedding := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS law_document_content_invalidates_embedding ON public.law_documents;
CREATE TRIGGER law_document_content_invalidates_embedding
BEFORE UPDATE OF content ON public.law_documents
FOR EACH ROW EXECUTE FUNCTION public.invalidate_law_document_embedding();
REVOKE ALL ON FUNCTION public.invalidate_law_document_embedding() FROM PUBLIC, anon, authenticated;
