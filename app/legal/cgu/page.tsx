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
      `Selon le régime de franchise en base de TVA déclaré par l'éditeur, les tarifs annoncés sont nets et aucune TVA supplémentaire n'est ajoutée au tarif mensuel affiché. Mention fiscale déclarée : ${BRAND.vatNotice}. L'applicabilité de ce régime dépend de la situation fiscale et du territoire de vente. Avant chaque commande réelle, le prix final applicable, les taxes, la périodicité, le périmètre fonctionnel, les quotas et les éventuelles limitations doivent être affichés clairement sur /tarifs et dans le récapitulatif de commande. Le dépassement des quotas peut entraîner le blocage temporaire de la fonction concernée ; aucun surcoût automatique n'est autorisé sans consentement explicite.`,
      "Les montants annoncés sont des prix mensuels en euros nets selon la franchise en base de TVA déclarée par l'éditeur pour les opérations auxquelles elle s'applique : Solo 9 €, Pro 19 € et Studio 49 €. Aucun dépassement ne déclenche de prélèvement automatique. Une facturation à un client situé hors de France ou soumis à un régime fiscal particulier ne peut être ouverte sans analyse préalable des règles de territorialité et d'imposition applicables.",
      "Le récapitulatif avant paiement doit identifier clairement l'offre choisie, le prix total exigible, la facturation mensuelle, la reconduction automatique, les services et quotas effectivement disponibles et les modalités de résiliation. Les fonctionnalités IA ne peuvent être vendues comme disponibles si leur exploitation en production est suspendue."
    ]
  },
  {
    "title": "5. Formation du contrat et paiement",
    "body": [
      "Le contrat payant n'est conclu qu'après présentation des caractéristiques essentielles, du prix total, de la reconduction et des conditions applicables, puis validation explicite d'une commande avec obligation de paiement. Une confirmation durable de la commande et des conditions doit être transmise au client.",
      "Les paiements et la gestion des abonnements sont techniquement prévus via Stripe. MentionCheck ne collecte pas les numéros de carte. Les droits payants ne doivent être accordés qu'après confirmation du paiement ou de l'abonnement actif par les événements sécurisés du fournisseur. Les achats réels ne sont pas ouverts à la date du présent brouillon.",
      "La case d'acceptation des conditions générales au moment de l'achat doit être présentée sans consentement précoché et Stripe recueille l'accord lorsque le mode Live sera autorisé. L'exploitant devra fournir une confirmation sur support durable du contrat, du prix, de sa périodicité et des conditions acceptées ; la seule existence d'un webhook ne vaut pas preuve de remise de cette confirmation.",
      "Les moyens de paiement effectivement acceptés et les éventuelles authentifications bancaires sont présentés par Stripe au paiement. Aucun abonnement n'est activé avant la confirmation sécurisée de son statut par le fournisseur."
    ]
  },
  {
    "title": "6. Reconduction, changement et résiliation",
    "body": [
      "Les abonnements Solo, Pro et Studio sont mensuels et reconduits automatiquement à chaque échéance, sans durée minimale annuelle. Le prix mensuel du forfait choisi est prélevé à chaque renouvellement, sauf résiliation valable ou autre situation prévue au contrat. Toute évolution de prix ou changement d'offre doit être porté à la connaissance de l'abonné en temps utile et conformément aux droits applicables.",
      "Le titulaire peut gérer son abonnement et demander sa résiliation en ligne depuis son compte, rubrique Paramètres, via le portail de facturation Stripe lorsque le service est disponible. La résiliation demandée pour la fin de la période payée évite les renouvellements suivants ; sa date d'effet doit être confirmée. En cas de perte d'accès ou de dysfonctionnement, une demande peut être adressée à l'email de contact publié dans les mentions légales. La résiliation est gratuite et n'entraîne pas, à elle seule, le remboursement de la période entamée, sauf droits légaux, rétractation applicable ou inexécution du service.",
      "Le client consommateur doit pouvoir résilier électroniquement selon les modalités imposées par le droit applicable ; la présence d'un lien vers le portail Stripe doit être vérifiée en production avant toute vente. En cas de non-paiement, les accès peuvent être limités selon les conditions annoncées, sans effacement immédiat des données légalement conservées."
    ]
  },
  {
    "title": "7. Droit de rétractation des consommateurs",
    "body": [
      "Lorsque le client agit en qualité de consommateur et qu'aucune exception légale ne s'applique, il dispose en principe de 14 jours à compter de la conclusion du contrat de services pour notifier sa rétractation sans justification. Un formulaire type figure à la fin du présent document ; une déclaration non équivoque est également recevable à l'adresse de contact qui sera publiée.",
      "Le démarrage du service pendant ce délai, les éventuelles sommes dues au titre d'une exécution expressément demandée et les exceptions propres aux prestations ou contenus numériques sont appréciés au cas par cas selon les conditions légales et les consentements effectivement recueillis. Aucune renonciation automatique au droit de rétractation n'est imposée. Le remboursement intervient dans les délais et selon les modalités légalement applicables.",
      "Le consommateur peut notifier sa rétractation par une déclaration non équivoque à l'adresse électronique de contact figurant dans les mentions légales, en indiquant, dans la mesure du possible, la référence de son abonnement ; le formulaire type ci-dessous peut également être utilisé. La notification effectuée avant la fin du délai applicable suffit à respecter celui-ci. L'éditeur doit en accuser réception et traiter la demande dans les conditions légales.",
      "Lorsque la rétractation ouvre droit à remboursement, le paiement doit être remboursé sans retard excessif et au plus tard dans le délai légal, en principe quatorze jours après la notification, par le même moyen de paiement sauf accord contraire et absence de frais pour le consommateur. Une somme proportionnelle à un service déjà exécuté n'est envisageable que lorsque les conditions légales de demande expresse d'exécution anticipée et d'information sont réunies. Aucune renonciation automatique n'est imposée."
    ]
  },
  {
    "title": "8. Garantie et conformité du service numérique",
    "body": [
      "Les consommateurs bénéficient, lorsqu'elles sont applicables, des garanties légales relatives à la fourniture de services ou contenus numériques, notamment la conformité et les mises à jour exigées par la loi. Aucune clause des présentes conditions ne limite les droits impératifs du consommateur.",
      "Une anomalie peut être signalée au support officiel. MentionCheck examine la demande et propose, selon le cas, la mise en conformité, une solution technique, une réduction de prix ou les autres remèdes prévus par les textes applicables.",
      "En cas de défaut de fourniture, de dysfonctionnement ou de non-conformité, le client peut transmettre une réclamation au support publié dans les mentions légales. Les réponses, remèdes, éventuelles réductions du prix ou remboursements dépendent des faits et des garanties légales ; la présente clause ne supprime aucun droit du consommateur."
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
      "Une réclamation écrite préalable peut être adressée à l'éditeur via le contact officiel. Le consommateur a droit, dans les conditions prévues par la loi, à un dispositif de médiation de la consommation gratuit pour lui. À la date de cette prépublication, aucun médiateur effectivement conventionné n'a été communiqué : aucun organisme ni numéro de convention ne sont inventés. Le nom, l'adresse et le site du médiateur choisi doivent être publiés ici après convention effective, et avant toute vente aux consommateurs. Les droits d'accès au juge et les règles protectrices de compétence demeurent inchangés."
    ]
  },
  {
    "title": "15. Droit applicable et contact",
    "body": [
      "Le droit français est retenu sous réserve des dispositions impératives applicables aux consommateurs résidant dans d'autres pays, notamment de l'Union européenne. Les coordonnées de contact communiquées par l'éditeur sont publiées dans les mentions légales.",
      "Version de préparation du 14 novembre 2026. Avant le premier paiement réel, les conditions effectivement approuvées devront être datées, rendues accessibles avant la souscription et remises ou conservables sur un support durable. Les modifications postérieures ne suppriment pas les droits nés des versions déjà acceptées."
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
      <p className="text-sm text-slate-600">Version de préparation du 14 novembre 2026 — {BRAND.legalName} ({BRAND.tradeName})</p>
    </header>
    <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <strong>Prépublication — contrat non encore approuvé.</strong> Les clauses tarifaires et les droits des consommateurs sont préparés, mais la convention avec un médiateur de la consommation, la portée fiscale des ventes hors de France, la confirmation contractuelle durable et les parcours de paiement/résiliation ne sont pas encore certifiés. Les abonnements réels restent fermés.
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
