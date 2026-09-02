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

## Configuration Cloudflare

```bash
cd saas
npm install
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put DIAM_OWNER_EMAIL
wrangler secret put OPENAI_API_KEY
wrangler secret put OPENAI_MODEL
npm run deploy:cloudflare
```

`OPENAI_MODEL` peut être omis ; le Worker utilise alors `gpt-5`.

## Test local

```bash
cd saas
npm run build
npm test
```

Sans Supabase configuré, le frontend se charge mais les appels API renvoient un
message explicite de configuration manquante.
