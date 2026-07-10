# ============================================================
# DIAM - Operational evidence guidance for auditors
# ============================================================

diam_guidance_value <- function(value, fallback = "") {
  if (is.null(value) || !length(value) || is.na(value[[1]])) return(fallback)
  value <- trimws(as.character(value[[1]]))
  if (nzchar(value)) value else fallback
}

diam_split_evidence_items <- function(value) {
  value <- trimws(diam_guidance_value(value, ""))
  if (!nzchar(value)) return(character())
  items <- unlist(strsplit(value, "\\s*;\\s*|\\s*,\\s*(?=[A-ZÉÈÀÂÎÔÛÇ0-9])", perl = TRUE))
  items <- trimws(items)
  unique(items[nzchar(items)])
}

diam_evidence_action <- function(item) {
  normalized <- tolower(iconv(item, to = "ASCII//TRANSLIT"))
  prefix <- "Obtenir et verser"
  if (grepl("log|journal|trace|siem|horodat|utc|ip", normalized)) {
    prefix <- "Extraire sur la période auditée"
  } else if (grepl("test|rapport|validation|xsd|schematron|scan|rejeu|comparaison", normalized)) {
    prefix <- "Réaliser ou récupérer"
  } else if (grepl("config|architecture|schema|cartographie|matrice|modele", normalized)) {
    prefix <- "Collecter la version applicable de"
  } else if (grepl("contrat|clause|accord|pouvoir|kyb|kyc|certificat|attestation", normalized)) {
    prefix <- "Obtenir le document signé/valide"
  } else if (grepl("payload|flux|message|fichier|facture|echantillon|export", normalized)) {
    prefix <- "Prélever un échantillon horodaté de"
  } else if (grepl("procedure|politique|raci|documentation", normalized)) {
    prefix <- "Vérifier la version approuvée de"
  }
  paste(prefix, item)
}

diam_question_evidence_guidance <- function(question) {
  expected <- diam_split_evidence_items(question$expected_evidence)
  method <- diam_guidance_value(question$verification_method, "")
  requirement <- diam_guidance_value(question$requirement, "")
  criticality <- diam_guidance_value(question$criticality, "")
  sample_size <- if (criticality %in% c("CRITICAL", "HIGH")) {
    "Échantillon recommandé : au moins 5 cas représentatifs, dont 1 nominal, 1 rejet/anomalie, 1 reprise ou incident si applicable. Adapter à la volumétrie et justifier tout échantillon réduit."
  } else {
    "Échantillon recommandé : au moins 3 cas représentatifs ou 1 cas complet si le contrôle est purement documentaire."
  }
  if (!length(expected)) {
    expected <- "Éléments probants démontrant l'exigence DGFiP"
  }
  list(
    to_collect = vapply(expected, diam_evidence_action, character(1)),
    tests = c(
      paste("Appliquer la méthode prévue :", method),
      "Rapprocher les preuves collectées avec les flux, configurations ou procédures réellement en production.",
      "Tracer dans l'analyse les références exactes des fichiers versés : nom, date, période, environnement, empreinte ou identifiant de log."
    ),
    sampling = sample_size,
    decision = c(
      paste("Conforme : les preuves couvrent l'exigence DGFiP suivante —", requirement),
      "Conforme sous réserves : preuve partielle, écart mineur, couverture insuffisante ou remédiation déjà engagée et probante.",
      "Non conforme : preuve absente, test en échec, impossibilité de rattacher la preuve au périmètre audité ou écart réglementaire substantiel."
    )
  )
}
