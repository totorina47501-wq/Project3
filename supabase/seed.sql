-- Chemin : supabase/seed.sql
-- Seed reproductible. R1-R8 sont des règles produit, pas huit articles de loi.
-- Les contenus des textes sont des synthèses éditoriales, non des citations.
-- Vérification des références juridiques : 3 novembre 2026.
begin;

insert into public.compliance_rules
  (code, description, severity, source_article, source_url, kind, is_ai_assisted)
values
  ('R1',
   'Vérifier une indication claire de l intention commerciale : publicité, collaboration commerciale ou formulation équivalente adaptée. Un hashtag seul peut nécessiter une analyse contextuelle.',
   'critical', 'Loi n° 2023-451, art. 5-2',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', 'legal', true),
  ('R2',
   'Heuristique produit : signaler une indication commerciale située après les 125 premiers caractères, car elle peut être peu visible sur certaines plateformes.',
   'medium', 'Loi n° 2023-451, art. 5-2 (lisibilité)',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', 'heuristic', false),
  ('R3',
   'Heuristique : vérifier que la divulgation n est pas noyée dans une liste de hashtags en fin de publication.',
   'medium', 'Loi n° 2023-451, art. 5-2 (clarté)',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', 'heuristic', true),
  ('R4',
   'Si un logo ou un placement de produit est détecté, demander une analyse de l intention commerciale ; le logo seul ne prouve pas un partenariat.',
   'medium', 'Loi n° 2023-451, art. 1 et 5-2',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', 'heuristic', true),
  ('R5',
   'En présence d un lien affilié ou d une rémunération potentielle, vérifier la clarté de la divulgation et le contexte de la communication.',
   'high', 'Loi n° 2023-451, art. 1 et 5-2',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', 'legal', true),
  ('R6',
   'Expressions telles que collab, sp ou merci marque : signaler le caractère potentiellement ambigu de la divulgation.',
   'high', 'Loi n° 2023-451, art. 5-2',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', 'heuristic', true),
  ('R7',
   'Heuristique d interface : renforcer la visibilité d une mention commerciale en présence d un code promotionnel. Les majuscules ou le gras ne sont pas une obligation légale générale.',
   'low', 'Loi n° 2023-451, art. 5-2 (clarté)',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', 'heuristic', false),
  ('R8',
   'Intégrité technique : calculer et conserver une empreinte SHA-256 canonique de la preuve initiale.',
   'info', null, null, 'technical', false)
on conflict (code) do update set
  description = excluded.description,
  severity = excluded.severity,
  source_article = excluded.source_article,
  source_url = excluded.source_url,
  kind = excluded.kind,
  is_ai_assisted = excluded.is_ai_assisted,
  rule_version = 'v1.0',
  updated_at = now();

-- Cinq références pertinentes pour le contrôle des publications sponsorisées.
-- L'article 2 est un article modificatif sur d'autres textes ; l'article 5-2
-- est juridiquement essentiel depuis l'ordonnance du 6 novembre 2024.
insert into public.law_documents
  (article_ref, content, source_url, effective_on)
values
  ('L2023-451-ART1',
   'Article 1 : définit l influence commerciale électronique comme une activité exercée à titre onéreux, mobilisant une audience pour promouvoir directement ou indirectement des biens, services ou une cause.',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', '2024-11-08'),
  ('L2023-451-ART3',
   'Article 3 : les règles générales applicables aux publicités et promotions en ligne s appliquent aussi à l influence commerciale, notamment dans les secteurs soumis à des règles spéciales.',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', '2023-06-11'),
  ('L2023-451-ART4',
   'Article 4 : prévoit des restrictions et interdictions portant sur certaines promotions à risque, notamment dans le champ de la santé. La version consolidée a évolué, notamment au 1er juillet 2026.',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', '2026-07-01'),
  ('L2023-451-ART5',
   'Article 5 : impose dans des cas définis des mentions concernant les images retouchées et les images virtuelles générées par intelligence artificielle, et prévoit des exigences pour certaines promotions de formation professionnelle.',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', '2024-11-08'),
  ('L2023-451-ART5-2',
   'Article 5-2 : la communication d influence commerciale doit indiquer clairement, lisiblement et de manière compréhensible son intention commerciale si celle-ci ne ressort pas déjà du contexte. Les mentions publicité, collaboration commerciale ou des équivalents adaptés peuvent être utilisées.',
   'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000047665795/', '2024-11-08')
on conflict (article_ref) do update set
  content = excluded.content,
  source_url = excluded.source_url,
  effective_on = excluded.effective_on,
  checked_at = now(),
  -- Obliger à recalculer les embeddings quand la source évolue.
  embedding = case
    when public.law_documents.content is distinct from excluded.content
    then null
    else public.law_documents.embedding
  end,
  updated_at = now();

commit;
