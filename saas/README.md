# DIAM SaaS

Application SaaS distincte de D2F Enterprise Platform pour piloter des audits de
conformité de plateformes agréées.

## Architecture

- Cloudflare Worker : API serveur, jamais de clé Supabase dans le navigateur.
- Cloudflare Assets : interface web DIAM SaaS.
- Supabase Postgres : missions, questionnaire, réponses, preuves, constats,
  non-conformités, actions, rapports et journal d'audit.
- Supabase Storage : `diam-documents` pour les documents qualité/techniques et
  `diam-evidence` pour les preuves d'audit.
- OpenAI Responses API optionnelle côté Worker : analyse structurée des
  documents et propositions d'écarts. L'IA ne décide pas : l'auditeur valide.

Note facturation : l'analyse IA automatisée utilise l'API OpenAI côté SaaS.
La facturation API est séparée d'un abonnement ChatGPT Pro/Plus. Si le compte
API n'a plus de crédits, les dépôts documentaires restent possibles mais
l'analyse IA renvoie un message explicite de quota.

## Référentiel et méthode

Baseline intégrée au 2026-09-02 :

- guide pratique DGFiP de l'audit de conformité v1.3, version stabilisée du
  27/03/2026 ;
- référentiel D2FC002 PDP Integrity v3.2 Label PA ;
- informations impots.gouv.fr relatives aux plateformes agréées, au démarrage
  du 01/09/2026, aux spécifications externes et aux exigences e-invoicing /
  e-reporting transaction / e-reporting paiement ;
- note sécurité/lancement : preuves cybersécurité post-démarrage, transparence,
  chaîne d'alerte, simulations de résilience.

La logique suit une approche d'assurance de type ISO/ISAE 3000 :

1. compréhension du périmètre et de l'objet audité ;
2. référentiel de critères explicite ;
3. collecte d'éléments probants suffisants et appropriés ;
4. analyse des écarts potentiels ;
5. revue humaine et jugement professionnel ;
6. traçabilité des réponses, preuves, constats et traitements ;
7. rapport final avec opinion et evidence book.

## Installation Supabase

1. Créer un projet Supabase distinct de D2F Enterprise Platform.
2. Exécuter `supabase/migrations/202609020001_diam_saas.sql`.
3. Vérifier la création des buckets privés `diam-documents` et `diam-evidence`.

Pour une base déjà initialisée, exécuter aussi les migrations d'évolution :

- `supabase/migrations/202609020002_archive_connector.sql`
- `supabase/migrations/202609020003_ai_audit_traceability.sql`
- `supabase/migrations/202609020004_client_reply_portal.sql`

## Configuration Cloudflare

### Déploiement depuis le dashboard Cloudflare

Si Cloudflare est connecté au dépôt GitHub `D2FCompliant/DIAM`, utiliser :

- Root directory : `/`
- Build command : vide / `None`
- Deploy command : `npx wrangler deploy`

Le fichier racine `wrangler.toml` pointe vers le Worker
`saas/worker/index.mjs` et sert directement les assets `saas/public`.

### Déploiement local depuis le dossier SaaS

```bash
cd saas
npm install
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put DIAM_OWNER_EMAIL
wrangler secret put OPENAI_API_KEY
wrangler secret put OPENAI_MODEL
npm run deploy:cloudflare
```

Le projet Supabase configuré dans `wrangler.toml` est :

```text
https://wyvdcuhqewvvcqmdhtqt.supabase.co
```

Pour un environnement de développement seulement, si les politiques Supabase
l'autorisent, le Worker accepte aussi :

```bash
wrangler secret put SUPABASE_PUBLISHABLE_KEY
```

La clé `SUPABASE_SERVICE_ROLE_KEY` reste le mode recommandé côté Worker, car
elle reste côté serveur Cloudflare et évite d'exposer les droits d'écriture dans
le navigateur.

`OPENAI_MODEL` peut être omis ; le Worker utilise alors `gpt-5`.

## Publication marketplace D2F Compliant

DIAM expose une fiche marketplace publique, versionnée et sans secret :

```text
https://diam.d2fcompliant.workers.dev/.well-known/d2f-marketplace-app.json
https://diam.d2fcompliant.workers.dev/api/marketplace/app
```

D2F Business Suite peut indexer ce manifeste pour afficher DIAM dans le
marketplace D2F Compliant. Le manifeste contient l'identité applicative, la
version DIAM, les programmes d'audit disponibles, les capacités, les endpoints
publics et l'état de configuration des intégrations, sans exposer de clé API,
service role Supabase, OpenAI ou SAE.

## Raccordement SAE / LAE Stratow

DIAM conserve Supabase comme base opérationnelle, mais les éléments probants
doivent être figés dans un SAE/LAE lorsque l'archivage probatoire est requis :

- preuves versées par l'auditeur ;
- documents de candidature, qualité, sécurité et techniques ;
- rapports DGFiP générés par DIAM.

Le Worker prépare un dépôt SAE avec :

- fichier ou rapport JSON ;
- SHA-256 ;
- identifiant tenant et mission ;
- type d'objet : `EVIDENCE`, `DOCUMENT` ou `REPORT` ;
- nom d'origine, taille, MIME type ;
- reçu SAE conservé en base.

Variables Cloudflare :

```bash
SAE_PROVIDER=STRATOW_SYLOW
SAE_ENABLED=true
wrangler secret put SAE_ENDPOINT
wrangler secret put SAE_API_KEY
```

Tant que `SAE_ENABLED=false`, DIAM continue à fonctionner et marque les objets
en `archive_status = DISABLED`. Dès que le SAE est activé, DIAM tente le dépôt
automatique et conserve `archive_id`, `archive_receipt` et `archived_at`.

À demander à Stratow/SYLOW avant passage production :

1. endpoint de dépôt API ;
2. méthode d'authentification ;
3. format exact des métadonnées attendues ;
4. champ retourné pour l'identifiant d'archive ;
5. format de l'accusé de dépôt / preuve d'horodatage ;
6. règles de classement : plan de classement, durées, sort final ;
7. taille maximale par dépôt et stratégie de reprise.

## Chaîne probatoire d'audit

DIAM matérialise la chaîne :

`Contrôle DGFiP → Critère → Preuve attendue → Preuve collectée + SHA-256 → Analyse assistée → Écart potentiel / preuve insuffisante / information requise → Décision humaine → Constat → Réponse client → Preuve de correction → Clôture → Rapport DGFiP`.

L'écran `Espace client` permet à l'audité de répondre aux constats ouverts et de
verser une preuve de correction. La réponse est horodatée, liée au constat, et
la preuve suit le même circuit de hashage et d'archivage SAE.

## Test local

```bash
cd saas
npm run build
npm test
```

Sans Supabase configuré, le frontend se charge mais les appels API renvoient un
message explicite de configuration manquante.

## Version 1.5.0 — Rapport PA structuré et cycles de vie (2026-10-03)

Le modèle PA reprend la présentation du rapport D2F Compliant fourni pour cette
évolution : couverture, synthèse, périmètre, méthode, résultats par domaine,
contradictoire, chapitre 6 consacré aux cycles de vie, intégrité, conclusion,
annexes A (contrôles), B (bordereau SHA-256), C (tests détaillés).
Les chiffres et constats proviennent de la mission ; aucune conclusion de
l'exemple fourni n'est utilisée comme résultat réel. La typographie Aptos,
le bleu #18324A et l'or #C7A15B reprennent sa présentation.

### Conduire un nouvel audit PA

1. Créer / ouvrir la mission et documenter le périmètre et les références.
2. Déposer les pièces sources via le contrôle sélectionné : messages, payloads,
   journaux, résultats de validation et rapprochements.
3. Ouvrir **Cycles de vie**. Déclarer la version du référentiel, son localisateur,
   le périmètre, les 14 statuts et les exclusions. Documenter les cas applicables
   de la campagne de 53 tests : 14 statuts, 6 parcours, 13 tests négatifs,
   13 axes transverses, 1 rapprochement d'encaissement et 6 motifs de rejet.
4. Renseigner les observations réelles et sélectionner les pièces de la mission.
   L'empreinte du payload est reprise de la pièce déposée, jamais saisie librement.
5. Enregistrer la matrice. Chaque version est une preuve JSON immuable au sens
   applicatif (aucun écrasement), liée à DGFiP-3.9 ; l'archivage probant dépend
   toujours du connecteur SAE réellement configuré. L'export/import JSON permet
   de préparer la campagne hors ligne ; l'import reste un brouillon à enregistrer.
6. Générer le rapport. Les résultats, la matrice et le bordereau sont figés dans
   `diam_reports.payload`. Relire le dernier rapport permet de retrouver ce
   snapshot. Télécharger le HTML autonome ou imprimer/exporter en PDF.
7. Effectuer la revue professionnelle et signer la version finale avant envoi.

Un résultat PASS n'est retenu que si ses champs probatoires et ses rattachements
sont complets. DIAM ne réalise pas les tests de la PA : il structure les travaux
et vérifie la complétude du dossier. La pertinence et l'authenticité des pièces
restent à apprécier par l'auditeur. Les statuts facultatifs déclarés implémentés
ne peuvent pas être exclus par une simple mention « non applicable ». Les quatre
capacités obligatoires doivent faire l'objet de scénarios adaptés, sans supposer
que les quatre événements se produisent sur chaque facture.

Un dossier incomplet, absent ou dont l'empreinte ne correspond plus au dépôt
empêche de restituer DGFiP-3.9 comme conforme. La réponse précédemment enregistrée
n'est pas effacée : `recorded_reponse_statut` la conserve dans la restitution.
Les missions SC et libres sans DGFiP-3.9 gardent leur modèle antérieur.
Les statuts et scénarios sont une grille de travail ; l'auditeur doit préciser
l'édition applicable de XP Z12-012 et les règles de transition de son périmètre.
Source de cadrage : https://www.impots.gouv.fr/specifications-externes-b2b

### Stockage et traçabilité

Aucune nouvelle table, migration ou système de tickets. Les routes
`GET/POST /api/lifecycle` utilisent les autorisations tenant/mission existantes,
`diam_evidences`, le bucket privé `diam-evidence`, `diam_audit_events` et le
connecteur SAE existant. Les événements `LIFECYCLE_DOSSIER_SAVED` et
`STRUCTURED_REPORT_GENERATED` conservent les références de version, empreinte,
objet et acteur. La dernière matrice est relue et son SHA-256 vérifié ; le rapport
ne prétend pas avoir relu tous les autres fichiers. Un contrôle optimiste sur la
version chargée empêche l'enregistrement d'une version déjà périmée ; des dépôts
strictement simultanés restent deux pièces distinctes, à réconcilier par l'auditeur.

Le dépôt DIAM ne contient pas de module Support/ticket, ni d'API d'écriture dans
le Support de Gestion : son intégration Gestion est la lecture des clients.
Aucun ticket parallèle n'est créé. La demande est tracée par le commit, cette
note de version et les événements d'audit DIAM ; le rattachement à un dossier
Support Gestion demeure à faire via son mécanisme autorisé lorsqu'il est accessible.

### Validation et exploitation

Utiliser Node 22. Commandes : `npm ci`, `npm test`, `npm run build`, puis
`npx wrangler deploy --dry-run --config wrangler.toml` depuis `saas/`.
Le déploiement DIAM vise le Worker `diam` et
https://diam.d2fcompliant.workers.dev ; ce service est distinct de D2F Gestion.
Déployer le commit testé avec `--var DIAM_BUILD_COMMIT:<SHA complet>` pour exposer
sa référence dans `/api/health`. Les variables existantes sont conservées par
`keep_vars = true`. Aucune migration de base n'est requise.

Avant cette évolution, DIAM servait la version 1.4.4, commit source
`6c873e22e8897cb8dd36152842f2c5bc0d3fb7b7`, version Cloudflare active
`daa7e915-095f-459b-b6f1-521069f4c193`. Le retour arrière Cloudflare vers cette
version conserve les nouvelles pièces et les snapshots JSON ; l'ancienne UI
ne les présente pas sous la nouvelle forme. Vérifier `/api/health` après rollback.

Limite préexistante : `npm audit` signale quatre entrées high dans l'outillage de
build (wrangler, miniflare, sharp, undici). Cette évolution ne change pas ces
dépendances ; leur mise à niveau nécessite une validation distincte.

### Correctif 1.5.1 — période auditée et rédaction (2026-10-03)

La fiche mission expose désormais les dates de début et de fin inclusive de la
période auditée, dans le champ `audit_period` existant. Le rapport restitue les
dates en clair, en tenant compte de la borne supérieure exclusive PostgreSQL.
Les anciens clients qui omettent ces champs conservent la période existante.
Les nouvelles matrices demandent une déclaration explicite de prise en charge
pour les 14 statuts ; les messages de complétude emploient des libellés français.
Validation de production 1.5.0 : matrice de démonstration EVD-2026-AA581E7D et
rapport RAP-2026-739DEB46 ; aucun audit réel ni test de PA réalisé par ces essais.


## 1.6.0 — 2026-10-03 : couverture Cyber et rapport PA

Demande : aligner DIAM sur le dossier DIAM-DEMO-2026-001, rapport v1.4,
avec neuf chapitres et la terminologie des matrices jointes.

- Onglet Cybersécurité : 17 domaines repris littéralement de la matrice,
  applicabilité justifiée, source vérifiée, périmètre, procédure, observation,
  pièces, revue, action, responsable, échéance et contre-test.
- Versions JSON conservées dans le stockage de preuves existant, SHA-256 relu,
  accès par mission et protection contre les enregistrements obsolètes.
- Les contrôles liés à un domaine insuffisamment démontré sont non évalués
  dans la chaîne et le rapport sans écraser la réponse historique.
- Bouton d’ouverture des écarts des deux matrices : regroupement par contrôle
  dans les constats existants. Numéros et anciennes décisions conservés ;
  état précédent journalisé avant modification. Les écarts ne sont jamais
  clôturés automatiquement. Une relance sur les mêmes versions est sans doublon.
- Rapport : cycles de vie chapitre 5, Cyber chapitre 6, contradictoire chapitre 7,
  intégrité chapitre 8, conclusion chapitre 9. Annexe C Cyber et annexe D tests.
- Le certificat ISO/IEC 27001 ne remplace pas les preuves opérationnelles.
  Références du modèle à vérifier pour chaque mission ; aucune obligation nouvelle
  n’est réputée vérifiée par la simple reprise de la matrice.

Validation : tests métier et API (autorisation, snapshots, idempotence,
constats historiques, exclusions et preuves), build Node 22 et Worker dry-run.
Aucune migration de base. Tables diam_evidences, diam_findings et
 diam_audit_events réutilisées. L’intégration Gestion disponible est en lecture
(audit-clients:read), pas une API Support : aucun ticket Support Gestion créé.
La trace des modifications de mission figure dans diam_audit_events.

Limites : la revue professionnelle et les tests opérationnels restent nécessaires.
Le stockage de fichiers et leur hash ne constituent pas une qualification SAE.
La protection de version est optimiste ; deux écritures strictement simultanées
peuvent encore créer deux versions, toutes deux conservées. Une réconciliation
interrompue conserve ses événements et les constats déjà traités ; relancer pour
les autres. Aucune donnée client ni ancien rapport n’est supprimé.

Déploiement : Node 22, npm test, npm run build, Wrangler depuis saas ; vérifier
le commit servi sur https://diam.d2fcompliant.workers.dev/api/health.
Le déploiement Git automatique peut entrer en concurrence avec Wrangler :
attendre sa fin puis publier le même commit testé avec DIAM_BUILD_COMMIT.
Rollback connu : version 1.5.1, commit 431b301661adf583662d630e86bf73959c8c15bc,
Cloudflare 5587de4b-efc7-4d30-894a-87219b9487f9 ; aucune migration à inverser.

## 1.7.0 — 2026-11-08 : préparation croisée du dossier

Le nouvel onglet **Préparation d’audit** exploite les documents de la mission
existante et les références transverses. Il croise les pièces en un programme
opérationnel : déclarations localisées, clarifications, demandes de pièces,
tests à conduire, propositions d’écarts et périmètre à valider. Chaque ligne
renvoie aux pages des documents et au contrôle existant. Les termes des
catalogues Cycles de vie et Cybersécurité sont conservés, ainsi que le rapport
PA en neuf chapitres. Aucun résultat IA ne modifie automatiquement une réponse,
un constat, une matrice, une preuve ou une opinion d’audit.

### Utilisation sur une mission existante

1. Ouvrir la mission du client ; ne pas dupliquer la mission exemple DGFiP.
2. Déposer les pièces client dans **Documents & IA** avec un type de mission,
   et les référentiels contrôlés comme documents transverses.
3. Dans **Préparation d’audit**, sélectionner les documents et confirmer leur
   rôle « Document client » ou « Référentiel / critère ».
4. Préparer successivement le socle, les cycles de vie et la cybersécurité.
   Les résultats s’actualisent toutes les 15 secondes tant que la mission reste active.
   Après fermeture, reprendre le traitement depuis l’historique.
5. Filtrer les actions, vérifier les extraits utiles, puis ouvrir le contrôle
   concerné pour la revue contradictoire et l’enregistrement de l’auditeur.
   Les exigences hors catalogue restent visibles dans une rubrique séparée.
6. Exporter le programme JSON avec les identités et empreintes des documents.
   Réaliser les tests et lier les preuves dans les écrans existants avant de
   produire le rapport DGFiP. Le dossier exemple reste un modèle documentaire.

### Exploitation et limites

- Node **22** ; commandes : `npm ci`, `npm test`, `npm run build` dans `saas`.
- API authentifiée : `POST /api/dossier-reviews`, `GET /api/dossier-reviews?mission_id=…`,
  `GET /api/dossier-reviews/:id?mission_id=…`. `phase` = CORE / CYBER / LIFECYCLE ;
  `documents` = liste `{id,role}`. Une analyse FAILED se relance explicitement
  avec `retry_of` ; les clics répétés sur le même dossier réutilisent le résultat.
- Maximum 20 fichiers / 45 Mio par lot, à traiter par domaines pour les gros
  fonds. Ce n’est pas un moteur d’indexation exhaustive de 20 000 pages.
  Une limite de contexte, de crédit, de lecture ou de couverture doit rester
  explicite. Les références et pages proposées nécessitent une revue humaine.
- Empreintes vérifiées avant transmission ; fichiers des autres missions exclus.
  Lecteur documentaire authentifié, cloisonné, avec vérification SHA-256.
- Traitement Responses en arrière-plan avec le modèle déjà configuré (gpt-5).
  Résultats et manifeste conservés dans **diam_audit_events**, sans nouvelle table.
  Les données suivent la politique API du compte configuré ; le mode background
  nécessite le stockage de la réponse fournisseur et n’est pas compatible ZDR.
  Copies de fichiers supprimées après sauvegarde du résultat ; expiration de
  secours après 24 h. Les échecs de suppression sont journalisés séparément.
  Une interruption pendant l’envoi initial peut laisser REQUESTED : investiguer
  l’événement avant toute relance manuelle, sans déclarer l’analyse terminée.
- Absence de clé API = erreur réelle ; aucune suggestion fictive de configuration.
  Les erreurs de crédits restent lisibles. L’analyse unitaire vérifie désormais
  que le fichier appartient à la mission et correspond à l’empreinte enregistrée.
- Pas de migration. Traçabilité opérationnelle : événements DOSSIER_REVIEW_*.
  Aucun module Support modifiable n’existe dans ce dépôt ; ne pas créer un système
  parallèle. Référence de livraison : branche feature/diam-dossier-review et commit.
- Production DIAM : https://diam.d2fcompliant.workers.dev ; ne pas confondre avec
  D2F Gestion. Le déploiement conserve les variables d’environnement existantes.
  Retour arrière applicatif : v1.6.0, commit ee0e3dc8d06aae47bd41590da9329fd997aae155 ;
  les événements ajoutés restent compatibles et ne doivent pas être effacés.

Contrats fournisseur vérifiés :
[traitement en arrière-plan](https://developers.openai.com/api/docs/guides/background),
[fichiers en entrée](https://developers.openai.com/api/docs/guides/file-inputs),
[expiration des fichiers](https://developers.openai.com/api/reference/resources/files/methods/create).

### Parcours guidé et administration des référentiels

- Présentation alignée sur https://d2fcompliant.org/fr/ : fond clair, accents
  bleu/vert, cartes numérotées et navigation guidée. « Tous les écrans » conserve
  l’accès aux écrans métier existants. Les libellés du rapport ne changent pas.
- « Conduire mon audit » ouvre une mission existante et présente les étapes de
  cadrage, documents, préparation, contrôles, cycles de vie, Cyber, constats et
  rapport. Les deux matrices PA ne sont affichées que pour le programme PA.
  Les compteurs reflètent les enregistrements, jamais une certification déduite.
- Administration : chargement direct des référentiels, titre exact, édition,
  origine, périmètre, programme PA/SC/personnalisé (ISO notamment), état de revue.
  Une nouvelle édition reste un nouveau document ; aucun historique n’est réécrit.
- Les sources transverses ne sont pas automatiquement applicables à tous les
  audits. La sélection reste explicite. Les référentiels doivent être VALIDATED
  par un administrateur avant préparation croisée, avec empreinte identique.
  L’IA propose des tests et ne peut ni valider une source ni modifier son libellé.
- Les audits ISO utilisent le programme personnalisé existant : l’administrateur
  renseigne les contrôles validés. Aucun catalogue ISO n’est inventé ou déclaré
  exhaustif à partir du seul nom d’une norme.
- API `/api/reference-library` : lecture authentifiée, écriture administrateur.
  Revue conservée dans `diam_audit_events` (REFERENCE_LIBRARY_REVIEWED), sans
  migration. La bibliothèque et l’historique affichent au plus les 1 000 derniers
  événements de référence : une ancienne revue non chargée reste « À vérifier ».
- Protection : cookies HttpOnly/Secure/SameSite=Strict existants, authentification
  obligatoire hors localhost même si le drapeau de développement est activé,
  HSTS, CSP same-origin, interdiction d’iframe et absence d’envoi de référent.
  Les tests ne remplacent pas un audit de sécurité indépendant complet.

Validation de cette livraison : Node 22.23.3, tests Node et compilation Worker ;
contrôle navigateur isolé de la navigation, des sélections, des citations,
des filtres, du changement de mission, de l’administration et du démarrage avec
CSP. Les jeux de contrôle navigateur sont fictifs, distincts des pièces INTESA.
Le contexte de mission et le périmètre client sont figés dans chaque préparation.
Une préparation terminée peut être réactualisée explicitement ; l’ancienne version
reste dans le journal. L’ouverture répétée ne relance pas automatiquement l’IA.

## 1.7.1 — 2026-11-08 : protections des pages servies par Cloudflare

La vérification en ligne de 1.7.0 a confirmé les API privées protégées (401),
mais identifié que le routage statique par défaut contournait le Worker pour
HTML/CSS/JavaScript. Les en-têtes CSP, HSTS et anti-iframe n’atteignaient donc
pas l’interface. `assets.run_worker_first = true` dans les deux configurations
applique maintenant le même traitement aux pages et aux API. Aucun changement
métier ni migration. Régression vérifiée via le serveur local Wrangler et sur
l’URL DIAM, en plus des tests Node. Origine : 842c1a799b2352657ece96b8ef128fb53ef899e5.

Routage conforme à la [documentation Cloudflare](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

## 1.7.2 — 2026-11-08 : changement de mission et fiche affichée

Symptôme utilisateur reproduit dans un navigateur : ouvrir la seconde mission
changeait l’identifiant actif mais conservait le client et le titre de la première
fiche. `openMission` ne rappelait pas `fillMissionForm`. L’ouverture synchronise
maintenant tous les champs (y compris le programme personnalisé), vide les
sélections précédentes et ignore les réponses asynchrones d’une ancienne mission.
Le sélecteur de pilotage utilise le même chemin d’ouverture. Aucun audit ni client
n’est modifié par cette correction d’affichage. Pas de migration.
Validation : scénario navigateur à deux missions reproduit en échec avant la
correction, puis passant ; tests de non-régression versionnés dans
`tests/mission-selection.test.mjs`.
