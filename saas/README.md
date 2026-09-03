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
