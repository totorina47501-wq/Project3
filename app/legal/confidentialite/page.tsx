import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Politique de confidentialité et cookies — MentionCheck (prépublication)',
  robots: { index: false, follow: false },
};

const sections = [
  {
    "title": "Responsable du traitement et contact",
    "body": [
      "Le service MentionCheck est exploité sous le nom déclaré MentionCheckCorp. Son identité juridique exacte, sa forme, son siège et son immatriculation devront être reportés dans les mentions légales après vérification des justificatifs. Tant que ces informations et un contact RGPD contrôlé ne sont pas publiés, cette politique demeure une version de prépublication.",
      "Pour exercer vos droits ou signaler un incident, utilisez le canal officiel de contact qui devra être indiqué dans les mentions légales et accessible depuis les paramètres. N'envoyez pas de données sensibles à un canal non vérifié."
    ]
  },
  {
    "title": "Données traitées",
    "body": [
      "Compte et sécurité : adresse électronique, identifiant utilisateur, préférences, traces de session, événements de sécurité et données techniques nécessaires à la connexion.",
      "Service et contenus : textes soumis à vérification, résultats, corrections et versions acceptées, historique d'analyses, conversations Mia, documents, médias privés et métadonnées (taille, type, empreinte, durée prévue), collaborations et droits d'accès des espaces Studio.",
      "Abonnements et assistance : offre, statut contractuel, données de facturation strictement nécessaires, références de paiements Stripe lorsqu'elles existent, quotas, demandes de support, demandes d'exercice des droits et traces utiles à leur traitement.",
      "Comptes sociaux : les déclarations manuelles de comptes et, uniquement après autorisation explicite et activation de l'intégration, les identifiants techniques d'autorisation OAuth nécessaires à la fonctionnalité, stockés côté serveur."
    ]
  },
  {
    "title": "Finalités et bases juridiques",
    "body": [
      "Exécution du contrat ou mesures précontractuelles : ouverture de compte, authentification, fourniture des vérifications demandées, archives, médias, fonctions de collaboration, suivi des quotas, support lié au service et gestion d'un abonnement.",
      "Respect d'obligations légales : tenue des pièces et écritures de facturation nécessaires, réponse aux demandes légalement requises, gestion des obligations liées à la protection des données et des incidents.",
      "Intérêt légitime, sous réserve de mise en balance et du droit d'opposition : prévention des abus, protection des comptes, dépannage, traçabilité de sécurité strictement nécessaire et amélioration de la fiabilité.",
      "Consentement lorsque requis : fonctions facultatives de réutilisation des contenus acceptés, traceurs non essentiels, prospection électronique et connexions sociales donnant accès à des données de plateformes. Le consentement peut être retiré pour l'avenir sans affecter la licéité des traitements antérieurs."
    ]
  },
  {
    "title": "IA et analyses assistées",
    "body": [
      "Le mode sans IA n'envoie pas les contenus à OpenAI. Lorsque l'utilisateur choisit expressément une fonction IA activée, les données nécessaires à la requête peuvent être transmises au fournisseur de l'API afin de générer une réponse ou une analyse, sous réserve des conditions techniques, contractuelles et de sécurité applicables.",
      "Les contenus utilisés pour des fonctions facultatives de réutilisation interne ne le sont qu'après activation de la préférence correspondante ; cette préférence est désactivée par défaut et peut être révoquée. Aucun entraînement automatique ou exploitation publicitaire des contenus privés n'est revendiqué.",
      "Les recommandations automatisées sont indicatives et ne produisent pas, à elles seules, de décision juridique ou d'effet similaire significatif sur l'utilisateur."
    ]
  },
  {
    "title": "Destinataires et sous-traitants",
    "body": [
      "Les données sont accessibles au personnel ou prestataires habilités dans la stricte mesure nécessaire. L'application s'appuie sur Cloudflare pour l'exécution et la sécurité, sur Supabase pour l'authentification, les bases et le stockage, sur Stripe pour la facturation lorsqu'elle est activée, et sur OpenAI pour les fonctions IA explicitement activées.",
      "Les contrats de sous-traitance, régions d'hébergement et sous-traitants ultérieurs doivent être recensés dans un registre à jour. L'accès à un service tiers ne vaut pas autorisation générale de réutiliser les données. Aucun transfert international hors cadre légal ne doit être affirmé comme couvert sans vérification des garanties applicables."
    ]
  },
  {
    "title": "Durées de conservation",
    "body": [
      "Les données sont conservées pendant la durée nécessaire aux finalités décrites et, pour certaines pièces, selon les obligations légales de preuve, de comptabilité ou de sécurité. Le calendrier précis, par catégorie (compte, contenu, analyse, conversation, média, journaux, factures, sauvegardes), doit être arrêté et publié avant la mise en vente.",
      "Les fichiers médias possèdent des dates logiques d'expiration mais leur purge physique automatique n'est pas encore certifiée en production. Les sauvegardes et données chez les sous-traitants peuvent être soumises à leurs propres cycles de rétention documentés. L'expiration d'un abonnement n'entraîne pas à elle seule l'effacement immédiat de toutes les pièces légalement conservées."
    ]
  },
  {
    "title": "Sécurité et accès",
    "body": [
      "Des mécanismes d'authentification, d'autorisation, de séparation des comptes, de stockage privé et de journalisation de sécurité sont prévus. Les droits de base de données sont limités selon les rôles, avec contrôle d'accès et procédures de sauvegarde.",
      "Aucune infrastructure ne garantit le risque zéro. En cas de violation de données, le responsable du traitement évalue l'incident, prend les mesures nécessaires et effectue les notifications réglementaires lorsque les seuils légaux sont atteints. Les identifiants secrets, mots de passe et informations de carte ne doivent jamais être envoyés dans les demandes de support."
    ]
  },
  {
    "title": "Vos droits",
    "body": [
      "Selon le traitement et les conditions prévues par la réglementation, vous pouvez demander l'accès, la rectification, l'effacement, la limitation, la portabilité ou vous opposer à certains traitements. Vous pouvez retirer un consentement à tout moment. Vous pouvez adresser une réclamation à la CNIL (www.cnil.fr) si vous estimez vos droits méconnus.",
      "Les paramètres du compte permettent déjà certaines opérations et l'export de données structurées, sans inclure nécessairement les octets des fichiers privés. La demande d'effacement et son aperçu ne constituent pas à eux seuls la preuve d'une suppression totale des données SQL, Storage, Auth, prestataires et sauvegardes. La procédure de traitement complète reste à certifier."
    ]
  },
  {
    "title": "Informations provenant de tiers et espaces partagés",
    "body": [
      "Si vous importez des contenus, vous devez disposer des autorisations et fondements requis pour transmettre les données qu'ils peuvent contenir. Lorsque vous partagez des ressources avec un espace Studio, seules les personnes habilitées dans cet espace peuvent y accéder selon les rôles configurés.",
      "Les plateformes sociales conservent leur propre politique de confidentialité. Toute future connexion OAuth affichera sa portée et requerra une autorisation spécifique ; les fonctions OAuth des autres réseaux ne sont pas déclarées actives en production."
    ]
  },
  {
    "title": "Enfants et données particulières",
    "body": [
      "Le service s'adresse à un public professionnel ou à des utilisateurs disposant de la capacité juridique ou des autorisations nécessaires. Il n'est pas conçu pour collecter délibérément des données d'enfants.",
      "Veuillez éviter d'inclure des données de santé, des informations financières confidentielles ou d'autres catégories particulières de données personnelles si elles ne sont pas indispensables à la finalité demandée et légalement autorisées."
    ]
  },
  {
    "title": "Cookies, traceurs et consentement",
    "body": [
      "Les traceurs nécessaires à la connexion et à la sécurité peuvent fonctionner sans consentement lorsqu'ils sont strictement indispensables au service. Les statistiques de fréquentation Google Analytics 4 (GA4) ne sont pas considérées ici comme exemptées : elles exigent un choix préalable explicite.",
      "En cas d'acceptation, le navigateur peut charger le conteneur Google Tag Manager GTM-P83X0PBJ contenant une seule balise Google Analytics vers la mesure G-JKXWT2NBWT. La finalité annoncée est de compter les visites et de comprendre l'utilisation du site ; elle ne consiste pas à collecter les contenus privés, les e-mails ou les informations de paiement. La fonctionnalité GTM « Autoriser l'utilisation de données fournies par les utilisateurs » a été désactivée dans la version 3 publiée le 12 novembre 2026, selon les captures de l'exploitant. La configuration reste à recontrôler en cas de nouvelle version du conteneur.",
      "Sans acceptation, le composant MentionCheck ne charge pas la balise GTM. Accepter et refuser sont proposés au même niveau, sans limiter l'accès au service. Le choix est conservé localement dans le navigateur sous mentioncheck.analytics-consent.v2, avec une date ; il cesse d'être pris en compte après 180 jours. Les anciens choix dépourvus de date demandent une nouvelle décision. Le choix peut être modifié depuis « Gérer les cookies » sur cette page ; en cas de retrait, les cookies Analytics accessibles au site sont supprimés et la page est rechargée pour arrêter les mesures futures. Ce retrait ne supprime pas rétroactivement les données déjà reçues par Google.",
      "Sur un site qui accepte la mesure, Google Analytics peut déposer les cookies _ga et _ga_<identifiant>, utilisés respectivement pour distinguer les visiteurs et conserver l'état de session. Selon la documentation Google, leur durée de vie par défaut est de deux ans, sauf remplacement dans les paramètres GA4. Les durées effectives de la propriété MentionCheck et la politique de renouvellement des cookies restent à vérifier et limiter au nécessaire avant activation commerciale ; la recommandation CNIL de treize mois concerne notamment les mesures d'audience exemptées et ne signifie pas que cette intégration GA4 bénéficie d'une exemption.",
      "Les données envoyées à GA4 peuvent inclure les pages consultées, des paramètres de navigation, le navigateur et des informations techniques susceptibles de relever des données personnelles. Google permet de choisir une durée de conservation des données utilisateur et d'événements, notamment deux ou quatorze mois pour une propriété GA4 standard. Le réglage effectif de la propriété MentionCheck n'est pas encore attesté ; aucune durée Google réelle ne doit être annoncée comme vérifiée avant sa consultation.",
      "Google peut traiter des données à l'international, notamment dans le cadre de ses services mondiaux. Les entités contractantes, accords de sous-traitance, garanties de transfert et éventuelles certifications d'adéquation applicables doivent être contrôlés et documentés avant l'ouverture commerciale. Le simple recueil du consentement aux cookies n'est pas une preuve de conformité des transferts de données."
    ]
  },
  {
    "title": "Mises à jour de la politique",
    "body": [
      "La présente politique doit être datée et rendue facilement accessible avant la collecte et toute souscription. Les modifications substantielles des finalités, destinataires, durées ou droits donneront lieu à une information adaptée et, lorsqu'il est requis, à un nouveau consentement. La version approuvée remplacera cette prépublication."
    ]
  }
] as const;

export default function Confidentialite() {
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-12 leading-relaxed text-slate-800">
    <Link href="/" className="text-sm font-semibold text-indigo-700 underline">Retour à MentionCheck</Link>
    <header className="space-y-3">
      <h1 className="font-heading text-4xl font-bold">Politique de confidentialité et cookies</h1>
      <p className="text-sm text-slate-600">Document de travail du 12 novembre 2026 — service MentionCheck / éditeur déclaré MentionCheckCorp</p>
    </header>
    <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <strong>Prépublication : politique non encore approuvée.</strong> Avant commercialisation, confirmer l’identité et les
      coordonnées du responsable, le contact RGPD, les durées de conservation réelles, les contrats de sous-traitance,
      les transferts et l’effectivité de l’effacement des données. Aucune suppression totale n’est garantie par cette version.
    </p>
    {sections.map(section => <section key={section.title} className="space-y-3">
      <h2 className="font-heading text-xl font-bold">{section.title}</h2>
      {section.body.map(paragraph => <p key={paragraph} className="text-sm sm:text-base">{paragraph}</p>)}
    </section>)}
    <section className="space-y-2 text-sm" aria-label="Références cookies et statistiques">
      <h2 className="font-heading text-xl font-bold">Références et documentation des traceurs</h2>
      <p><a href="https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ" className="text-indigo-700 underline">CNIL — questions-réponses sur les cookies et le consentement</a>.</p>
      <p><a href="https://support.google.com/analytics/answer/11397207?hl=fr" className="text-indigo-700 underline">Google — cookies GA4 et durées par défaut</a>.</p>
      <p><a href="https://support.google.com/analytics/answer/7667196?hl=fr" className="text-indigo-700 underline">Google — conservation des données GA4</a>.</p>
      <p><a href="https://www.cnil.fr/fr/mesure-daudience-et-transferts-de-donnees-comment-mettre-son-outil-de-mesure-daudience-en-conformite" className="text-indigo-700 underline">CNIL — transferts internationaux et mesure d'audience</a>.</p>
    </section>
    <p className="border-t border-slate-200 pt-6 text-sm">
      Pour connaître l’identité déclarée et les informations d’hébergement, consulter les
      {' '}<Link href="/legal/mentions-legales" className="underline text-indigo-700">mentions légales</Link>.
      Les engagements contractuels se trouvent dans les
      {' '}<Link href="/legal/cgu" className="underline text-indigo-700">conditions d’utilisation et de vente</Link>.
    </p>
  </main>;
}
