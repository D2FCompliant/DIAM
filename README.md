# DIAM

**DGFiP Integrity Audit Manager** est une application R/Shiny de gestion des
missions d'audit de conformité.

## Parcours couvert

DIAM permet de gérer le parcours complet :

1. création et pilotage d'une mission ;
2. constitution du questionnaire d'audit ;
3. évaluation de conformité et calcul automatique de la progression ;
4. versement de preuves avec empreinte SHA-256 et détection des doublons ;
5. rédaction des constats ;
6. déclaration des non-conformités ;
7. suivi du plan d'action ;
8. export du rapport et de l'Evidence Book ;
9. consultation du journal d'audit.

## Rapport et certificat

L'onglet **Rapport & journal** produit :

- un rapport Word ou PDF reprenant la mission, l'opinion, les 33 contrôles,
  les réponses de l'auditeur, les preuves rattachées, les constats,
  non-conformités et actions ;
- un certificat Word ou PDF fondé sur le résultat consolidé de l'audit ;
- un registre CSV des preuves.

L'opinion est calculée de manière déterministe :

- **Audit incomplet** tant que tous les contrôles ne sont pas évalués ;
- **Non conforme** en présence d'une non-conformité sur un contrôle critique ;
- **Conforme sous réserves** si un écart, une conformité partielle ou une
  non-conformité ouverte subsiste ;
- **Conforme** lorsque tous les contrôles sont achevés sans écart ouvert.

Une preuve peut être rattachée à un contrôle lors de son versement. Le rapport
DGFiP présente ensuite ce lien ainsi que l'empreinte SHA-256 de la preuve.

Chaque nouvelle mission reçoit automatiquement un questionnaire de 33 contrôles.
Le guide pratique DGFiP v1.3 constitue l'autorité de référence ; PDP Integrity
v3.2 apporte les méthodes de vérification, les preuves attendues et les
correspondances techniques EX-6.x à EX-23.x.

## Lancer l'application

Depuis la racine du dépôt :

```r
install.packages(c(
  "shiny", "bslib", "DBI", "RSQLite", "DT", "openssl",
  "uuid", "fs", "mime"
))
shiny::runApp()
```

La base SQLite est créée automatiquement dans `data/diam.sqlite`. Les preuves
sont copiées sous `evidence/<uuid-mission>/originals/`.

## Vérification

```sh
R CMD build .
R CMD check --no-manual DIAM_0.1.0.tar.gz
```

Le test d'intégration couvre le chemin mission → question → réponse → constat
→ non-conformité → action corrective.

## Sécurité et exploitation

Cette version est un MVP local mono-organisation. Avant une mise en production,
prévoir l'authentification, la gestion des rôles, le chiffrement au repos, les
sauvegardes, une politique de conservation et une validation formelle des
exports.
