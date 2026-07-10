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

## Fiche client et dossier de candidature

L'onglet **Clients & candidature** permet :

- de créer et compléter la fiche d'une organisation auditée ;
- de conserver ses dossiers de candidature et compléments DGFiP avec empreinte
  SHA-256 ;
- d'extraire le texte des PDF avec `pdftools` ;
- de détecter les rôles PDPe/PDPr, l'e-reporting, Peppol, l'architecture API,
  la présence d'une couche OD, l'hébergement cloud, SecNumCloud, la marque
  blanche, les formats et les flux déclarés ;
- de confirmer ou corriger manuellement le périmètre détecté ;
- de synchroniser les missions du client avec un questionnaire ciblé.

Les contrôles déjà évalués ou liés à une preuve/à un constat sont conservés lors
d'un changement de périmètre. Seuls les contrôles non commencés devenus hors
périmètre peuvent être retirés.

Chaque nouvelle mission reçoit automatiquement un questionnaire de 33 contrôles.
Le guide pratique DGFiP v1.3 constitue l'autorité de référence ; PDP Integrity
v3.2 apporte les méthodes de vérification, les preuves attendues et les
correspondances techniques EX-6.x à EX-23.x.

Dans l'onglet **Questionnaire**, la sélection d'un contrôle affiche désormais
un guide auditeur opérationnel : pièces et traces à demander, tests à réaliser,
échantillonnage recommandé et règle de conclusion conforme / conforme sous
réserves / non conforme.

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
