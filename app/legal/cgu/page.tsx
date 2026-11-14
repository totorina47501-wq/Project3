import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND } from '@/lib/branding';

export const metadata: Metadata = {
  title: 'Conditions générales d’utilisation et de vente — MentionCheck (prépublication)',
  robots: { index: false, follow: false },
};

const clauses = [
  {
    "title": "1. Éditeur, portée et version",
    "body": [
      `Le service MentionCheck (https://mentioncheck.app) est proposé par ${BRAND.legalName} (${BRAND.tradeName}), à ${BRAND.legalAddress}. SIRET : ${BRAND.siret}. Contact : ${BRAND.contactEmail}. Les autres mentions de l'éditeur figurent dans les mentions légales.`,
      "Les présentes conditions couvrent la consultation du site, l'utilisation de la démonstration gratuite et, après activation commerciale et acceptation expresse, les abonnements mensuels Solo, Pro et Studio. En cas de vente à un consommateur, les règles impératives du Code de la consommation prévalent sur toute stipulation contraire."
    ]
  },
  {
    "title": "2. Description du service et limites",
    "body": [
      "MentionCheck assiste les créateurs et les équipes dans la vérification de mentions commerciales, l'analyse de contenus, la réécriture, la gestion de leurs archives et, selon l'offre, l'utilisation de Mia ou d'espaces Studio. Les fonctions disponibles dépendent de l'offre, des quotas, des paramètres et des services effectivement activés.",
      "Les scores, recommandations, simulations et modèles de documents sont informatifs : ils ne constituent ni une attestation de conformité, ni un avis juridique individualisé, ni une décision administrative. L'utilisateur conserve la responsabilité de vérifier la licéité de sa publication. Les fonctions IA ou les connexions sociales désactivées ne sont pas promises comme opérationnelles."
    ]
  },
  {
    "title": "3. Création d'un compte et accès",
    "body": [
      "Un compte exige des informations exactes et une adresse électronique valide. L'utilisateur protège ses identifiants, ne partage pas ses accès et signale rapidement tout usage non autorisé. L'accès à des espaces de travail partagés est soumis aux invitations et autorisations qui leur sont associées.",
      "Une suspension proportionnée peut intervenir en cas d'abus, tentative d'accès non autorisé, atteinte aux droits de tiers ou risque grave pour la sécurité, sans préjudice des droits du consommateur et des possibilités de contestation."
    ]
  },
  {
    "title": "4. Offres, quotas et prix",
    "body": [
      "Une offre gratuite sans carte bancaire peut être proposée. Les offres payantes préparées sont Solo (9 € par mois), Pro (19 € par mois) et Studio (49 € par mois). Elles ne constituent pas une vente ouverte tant que la page Tarifs les présente comme indicatives et que les paiements Live restent désactivés.",
      `Selon le régime de franchise en base de TVA déclaré par l'éditeur, les tarifs annoncés sont nets et aucune TVA supplémentaire n'est ajoutée au tarif mensuel affiché. Mention fiscale déclarée : ${BRAND.vatNotice}. L'applicabilité de ce régime dépend de la situation fiscale et du territoire de vente. Avant chaque commande réelle, le prix final applicable, les taxes, la périodicité, le périmètre fonctionnel, les quotas et les éventuelles limitations doivent être affichés clairement sur /tarifs et dans le récapitulatif de commande. Le dépassement des quotas peut entraîner le blocage temporaire de la fonction concernée ; aucun surcoût automatique n'est autorisé sans consentement explicite.`
    ]
  },
  {
    "title": "5. Formation du contrat et paiement",
    "body": [
      "Le contrat payant n'est conclu qu'après présentation des caractéristiques essentielles, du prix total, de la reconduction et des conditions applicables, puis validation explicite d'une commande avec obligation de paiement. Une confirmation durable de la commande et des conditions doit être transmise au client.",
      "Les paiements et la gestion des abonnements sont techniquement prévus via Stripe. MentionCheck ne collecte pas les numéros de carte. Les droits payants ne doivent être accordés qu'après confirmation du paiement ou de l'abonnement actif par les événements sécurisés du fournisseur. Les achats réels ne sont pas ouverts à la date du présent brouillon."
    ]
  },
  {
    "title": "6. Reconduction, changement et résiliation",
    "body": [
      "Les abonnements sont prévus pour une période mensuelle renouvelable, sans engagement annuel imposé. Les changements de formule et leur date d'effet sont présentés avant validation, avec calcul des éventuels ajustements selon les conditions affichées lors de l'opération.",
      "Le client peut demander la résiliation par le portail de gestion de son compte et doit disposer, lorsque la réglementation l'exige, d'un parcours de résiliation en ligne aisément accessible, gratuit, assorti d'un accusé de réception et de la date d'effet. Un canal de secours de contact devra être publié. La fin d'un abonnement n'autorise pas l'effacement immédiat de données dont la conservation est légalement nécessaire."
    ]
  },
  {
    "title": "7. Droit de rétractation des consommateurs",
    "body": [
      "Lorsque le client agit en qualité de consommateur et qu'aucune exception légale ne s'applique, il dispose en principe de 14 jours à compter de la conclusion du contrat de services pour notifier sa rétractation sans justification. Un formulaire type figure à la fin du présent document ; une déclaration non équivoque est également recevable à l'adresse de contact qui sera publiée.",
      "Le démarrage du service pendant ce délai, les éventuelles sommes dues au titre d'une exécution expressément demandée et les exceptions propres aux prestations ou contenus numériques sont appréciés au cas par cas selon les conditions légales et les consentements effectivement recueillis. Aucune renonciation automatique au droit de rétractation n'est imposée. Le remboursement intervient dans les délais et selon les modalités légalement applicables."
    ]
  },
  {
    "title": "8. Garantie et conformité du service numérique",
    "body": [
      "Les consommateurs bénéficient, lorsqu'elles sont applicables, des garanties légales relatives à la fourniture de services ou contenus numériques, notamment la conformité et les mises à jour exigées par la loi. Aucune clause des présentes conditions ne limite les droits impératifs du consommateur.",
      "Une anomalie peut être signalée au support officiel. MentionCheck examine la demande et propose, selon le cas, la mise en conformité, une solution technique, une réduction de prix ou les autres remèdes prévus par les textes applicables."
    ]
  },
  {
    "title": "9. Utilisation licite des contenus",
    "body": [
      "L'utilisateur garantit disposer des droits et autorisations nécessaires sur les textes, images, vidéos, marques, contrats et autres contenus transmis. Il s'interdit d'importer des données de tiers sans base légale, d'utiliser le service pour contourner la loi, de compromettre le système ou d'extraire des informations d'autres comptes.",
      "Les contenus fournis restent ceux de leurs titulaires. L'utilisateur accorde uniquement les droits techniques nécessaires à leur hébergement, analyse, affichage et restitution dans le cadre du service demandé ; aucune cession générale de droits n'est prévue."
    ]
  },
  {
    "title": "10. Intelligence artificielle et tiers",
    "body": [
      "Certaines fonctions peuvent nécessiter l'envoi des seuls éléments utiles à un fournisseur d'IA, lorsque le mode correspondant est explicitement activé. Le mode sans IA ne déclenche pas d'appel facturable au fournisseur OpenAI. Les réponses automatisées peuvent être inexactes, incomplètes ou inadaptées ; une revue humaine demeure nécessaire avant diffusion.",
      "Les connexions avec des plateformes sociales, lorsqu'elles seront disponibles, nécessiteront l'autorisation de l'utilisateur et resteront soumises aux permissions accordées par chaque plateforme. Une déclaration manuelle de compte social n'équivaut pas à une connexion OAuth."
    ]
  },
  {
    "title": "11. Données personnelles et confidentialité",
    "body": [
      "Les données de compte, d'utilisation, les historiques, les médias et les informations de paiement nécessaires sont traités selon la politique de confidentialité accessible sur le site. Les paramètres et exports disponibles ne remplacent pas une demande d'accès, d'effacement ou d'opposition exercée auprès du responsable de traitement.",
      "Les catégories de sous-traitants comprennent notamment Cloudflare, Supabase, Stripe pour les paiements activés et, selon le mode sélectionné, OpenAI. Les durées, la liste contractuelle et les transferts doivent être finalisés et expliqués avant commercialisation."
    ]
  },
  {
    "title": "12. Disponibilité et modifications",
    "body": [
      "Le service peut connaître des opérations de maintenance, interruptions ou indisponibilités de fournisseurs. Aucun niveau de service garanti n'est annoncé dans le présent brouillon. En cas de changement substantiel d'une offre payante, les clients doivent être informés dans les conditions prévues par leur contrat et la loi, avec les droits correspondants.",
      "Les versions des conditions seront datées et accessibles. Les changements n'ont pas d'effet rétroactif sur des droits déjà acquis et n'écartent aucune obligation légale d'information ou de consentement."
    ]
  },
  {
    "title": "13. Responsabilité",
    "body": [
      "Chaque partie répond des manquements qui lui sont imputables selon le droit applicable. MentionCheck ne garantit pas qu'une publication particulière respecte toutes les règles du droit de la publicité ou de l'influence commerciale ; ce service est un outil d'aide.",
      "Aucune stipulation ne prive un consommateur de ses garanties légales, de son droit à réparation légalement reconnu ou de la responsabilité de l'éditeur lorsqu'une limitation est interdite par la loi."
    ]
  },
  {
    "title": "14. Réclamations, médiation et différends",
    "body": [
      `Le support et les réclamations sont reçus à ${BRAND.contactEmail}. Le client peut fournir les informations nécessaires à l'identification de son abonnement sans communiquer ses mots de passe ni ses numéros de carte.`,
      "En cas de litige avec un consommateur, une médiation gratuite doit pouvoir être sollicitée après réclamation écrite préalable et dans les conditions légales. Le médiateur compétent doit être choisi, effectivement conventionné et identifié par ses coordonnées avant l'ouverture des ventes. Les droits d'accès au juge et les règles de compétence protectrices des consommateurs demeurent inchangés."
    ]
  },
  {
    "title": "15. Droit applicable et contact",
    "body": [
      "Le droit français est retenu sous réserve des dispositions impératives applicables aux consommateurs résidant dans d'autres pays, notamment de l'Union européenne. Les coordonnées de contact communiquées par l'éditeur sont publiées dans les mentions légales."
    ]
  }
] as const;
const retractationModele = [
  `À l'attention de : ${BRAND.legalName}, ${BRAND.legalAddress} — ${BRAND.contactEmail}`,
  "Je vous notifie par la présente ma rétractation du contrat de service MentionCheck commandé le : [DATE DE COMMANDE].",
  "Nom du consommateur : [NOM]. Adresse ou courriel : [COORDONNÉES]. Référence de commande : [RÉFÉRENCE].",
  "Date de notification : [DATE]. Signature du consommateur (uniquement en cas d'envoi papier) : [SIGNATURE].",
  "Ce modèle est facultatif pour le consommateur : toute déclaration dénuée d'ambiguïté est admise."
] as const;

export default function Terms() {
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-12 leading-relaxed text-slate-800">
    <Link href="/" className="text-sm font-semibold text-indigo-700 underline">Retour à MentionCheck</Link>
    <header className="space-y-3">
      <h1 className="font-heading text-4xl font-bold">Conditions générales d’utilisation et de vente</h1>
      <p className="text-sm text-slate-600">Document de travail du 12 novembre 2026 — {BRAND.legalName} ({BRAND.tradeName})</p>
    </header>
    <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <strong>Prépublication — contrat non encore approuvé.</strong> L’immatriculation,
      les conditions fiscales, le service client, le médiateur de la consommation et les parcours de paiement, résiliation et
      rétractation doivent être validés avant l’ouverture des ventes. Aucun paiement Live n’est autorisé par cette page.
    </p>
    {clauses.map(section => <section key={section.title} className="space-y-3">
      <h2 className="font-heading text-xl font-bold">{section.title}</h2>
      {section.body.map(paragraph => <p key={paragraph} className="text-sm sm:text-base">{paragraph}</p>)}
    </section>)}
    <section className="space-y-3" aria-labelledby="modele-retractation">
      <h2 id="modele-retractation" className="font-heading text-xl font-bold">Annexe — formulaire type de rétractation</h2>
      {retractationModele.map(paragraph => <p key={paragraph} className="text-sm sm:text-base">{paragraph}</p>)}
    </section>
    <p className="border-t border-slate-200 pt-6 text-sm">
      Consulter également les <Link href="/legal/mentions-legales" className="underline text-indigo-700">mentions légales</Link>
      {' '}et la <Link href="/legal/confidentialite" className="underline text-indigo-700">politique de confidentialité et cookies</Link>.
    </p>
  </main>;
}
