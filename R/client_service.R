# ============================================================
# DIAM - Client candidature and audit scope
# ============================================================

diam_clients <- function(con) {
  DBI::dbGetQuery(
    con,
    paste(
      "SELECT c.id, c.name, c.siren, c.city, c.country,",
      "COUNT(DISTINCT d.id) AS documents,",
      "CASE WHEN s.client_id IS NULL THEN 'À définir' ELSE 'Analysé' END AS scope_status",
      "FROM client c LEFT JOIN client_document d",
      "ON d.client_id=c.id AND d.status='ACTIVE'",
      "LEFT JOIN client_scope s ON s.client_id=c.id",
      "GROUP BY c.id ORDER BY c.name"
    )
  )
}

diam_save_client <- function(
    con, name, siren = NULL, address = NULL, postal_code = NULL,
    city = NULL, country = "France"
) {
  stopifnot(nzchar(trimws(name)))
  current <- DBI::dbGetQuery(
    con,
    "SELECT id FROM client WHERE lower(name)=lower(?) LIMIT 1",
    params = list(trimws(name))
  )
  now <- diam_now()
  if (nrow(current)) {
    DBI::dbExecute(
      con,
      paste(
        "UPDATE client SET siren=?, address=?, postal_code=?, city=?,",
        "country=?, updated_at=? WHERE id=?"
      ),
      params = list(
        diam_scalar(siren), diam_scalar(address), diam_scalar(postal_code),
        diam_scalar(city), diam_scalar(country), now, current$id[[1]]
      )
    )
    return(current$id[[1]])
  }
  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO client",
      "(uuid, name, siren, address, postal_code, city, country, created_at, updated_at)",
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ),
    params = list(
      diam_uuid(), trimws(name), diam_scalar(siren), diam_scalar(address),
      diam_scalar(postal_code), diam_scalar(city), diam_scalar(country), now, now
    )
  )
  DBI::dbGetQuery(con, "SELECT last_insert_rowid() AS id")$id[[1]]
}

diam_extract_pdf_text <- function(path) {
  if (!identical(tolower(fs::path_ext(path)), "pdf")) return("")
  if (requireNamespace("pdftools", quietly = TRUE)) {
    return(paste(pdftools::pdf_text(path), collapse = "\n"))
  }
  executable <- Sys.which("pdftotext")
  if (nzchar(executable)) {
    output <- tempfile(fileext = ".txt")
    on.exit(unlink(output), add = TRUE)
    system2(executable, c(shQuote(path), shQuote(output)), stdout = FALSE, stderr = FALSE)
    if (file.exists(output)) {
      return(paste(readLines(output, warn = FALSE, encoding = "UTF-8"), collapse = "\n"))
    }
  }
  ""
}

diam_store_client_document <- function(
    con, client_id, source_file, original_name, document_type, user
) {
  stopifnot(file.exists(source_file))
  bytes <- readBin(source_file, "raw", n = file.info(source_file)$size)
  sha256 <- as.character(openssl::sha256(bytes))
  duplicate <- DBI::dbGetQuery(
    con,
    paste(
      "SELECT id FROM client_document",
      "WHERE client_id=? AND sha256=? AND status='ACTIVE'"
    ),
    params = list(client_id, sha256)
  )
  if (nrow(duplicate)) stop("Ce document est déjà enregistré pour ce client.")
  client_uuid <- DBI::dbGetQuery(
    con, "SELECT uuid FROM client WHERE id=?", params = list(client_id)
  )$uuid[[1]]
  folder <- file.path(app_config$directories$client_documents, client_uuid)
  fs::dir_create(folder, recurse = TRUE)
  stored_name <- paste0(diam_uuid(), ".", tolower(fs::path_ext(original_name)))
  destination <- file.path(folder, stored_name)
  fs::file_copy(source_file, destination)
  text <- diam_extract_pdf_text(destination)
  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO client_document",
      "(uuid, client_id, document_type, original_name, stored_name, mime_type,",
      "file_size, sha256, storage_path, extracted_text, uploaded_by, uploaded_at)",
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ),
    params = list(
      diam_uuid(), client_id, document_type, original_name, stored_name,
      mime::guess_type(original_name), as.numeric(file.info(source_file)$size),
      sha256, destination, text, user, diam_now()
    )
  )
  document_id <- DBI::dbGetQuery(con, "SELECT last_insert_rowid() AS id")$id[[1]]
  list(id = document_id, extracted = nzchar(text), text = text)
}

diam_client_documents <- function(con, client_id) {
  DBI::dbGetQuery(
    con,
    paste(
      "SELECT id, document_type, original_name, file_size,",
      "substr(sha256, 1, 16) || '…' AS sha256, uploaded_by, uploaded_at,",
      "CASE WHEN length(extracted_text)>0 THEN 'Oui' ELSE 'Non' END AS text_extracted",
      "FROM client_document WHERE client_id=? AND status='ACTIVE'",
      "ORDER BY uploaded_at DESC"
    ),
    params = list(client_id)
  )
}

diam_client_document_file <- function(con, client_id, document_id) {
  document <- DBI::dbGetQuery(
    con,
    paste(
      "SELECT id, original_name, storage_path, mime_type, file_size, sha256",
      "FROM client_document",
      "WHERE id=? AND client_id=? AND status='ACTIVE'"
    ),
    params = list(document_id, client_id)
  )
  if (!nrow(document)) stop("Document client introuvable.")
  document
}

diam_has <- function(text, pattern) {
  grepl(pattern, text, ignore.case = TRUE, perl = TRUE)
}

diam_infer_scope <- function(text) {
  normalized <- gsub("[[:space:]]+", " ", text)
  no_mapping <- diam_has(
    normalized,
    "ne propose pas.*mapping|aucune (consolidation|transformation)|n.effectuera aucune.*transformation"
  )
  flows <- unique(unlist(regmatches(
    normalized,
    gregexpr("(?i)flux\\s+(1|2|3|6|8|9|10|11|12|13|14)(?:\\.[1-4])?", normalized, perl = TRUE)
  )))
  flows <- gsub("(?i)flux\\s+", "", flows, perl = TRUE)
  declaration <- regmatches(
    normalized,
    regexpr(
      "(?i)(supporte|prend en charge) les flux\\s+[0-9, .]+",
      normalized, perl = TRUE
    )
  )
  if (length(declaration) && nzchar(declaration)) {
    declared <- unlist(regmatches(
      declaration,
      gregexpr("\\b(1|2|3|6|8|9|10|11|12|13|14)(?:\\.[1-4])?\\b", declaration, perl = TRUE)
    ))
    flows <- c(flows, declared)
  }
  flows <- paste(unique(flows), collapse = ", ")
  profile <- list(
    role_pdpe = diam_has(normalized, "en tant que PDP[eE]|PDP du fournisseur"),
    role_pdpr = diam_has(normalized, "en tant que PDP[rR]|PDP de l.acheteur"),
    e_reporting = diam_has(normalized, "e-reporting|flux 10"),
    peppol = diam_has(normalized, "Peppol|Access Point|SMP"),
    api_only = diam_has(normalized, "full API|exclusivement.*API|aucune interface web"),
    format_conversion = !no_mapping && diam_has(normalized, "conversion|mapping"),
    od_layer = diam_has(normalized, "OD \\+ PDP|Ademico OD|opérateur de dématérialisation"),
    cloud_external = diam_has(normalized, "cloud|AWS|Azure|hébergée?"),
    secnumcloud = diam_has(normalized, "SecNumCloud"),
    white_label = diam_has(normalized, "plateforme agréée en marque blanche|PDP en marque blanche"),
    b2b_domestic = diam_has(normalized, "B2B domestique"),
    b2b_international = diam_has(normalized, "B2B international"),
    b2c = diam_has(normalized, "B2C"),
    payment_data = diam_has(normalized, "données? de paiement|encaissement|flux 10\\.2|flux 10\\.4"),
    supported_flows = flows
  )
  active <- c(
    if (profile$role_pdpe) "PDPe (émission)",
    if (profile$role_pdpr) "PDPr (réception)",
    if (profile$e_reporting) "e-reporting",
    if (profile$peppol) "Peppol/AS4",
    if (profile$api_only) "architecture API",
    if (profile$od_layer) "chaîne OD + PA",
    if (profile$cloud_external) "hébergement cloud",
    if (profile$white_label) "marque blanche",
    if (!profile$format_conversion) "sans conversion de format"
  )
  profile$scope_summary <- if (length(active)) paste(active, collapse = " ; ") else {
    "Périmètre non déterminé automatiquement"
  }
  profile
}

diam_save_scope <- function(
    con, client_id, scope, source_document_id = NULL, analyzed_by = "DIAM"
) {
  if (is.null(source_document_id) || !length(source_document_id)) {
    source_document_id <- NA_integer_
  }
  fields <- c(
    "role_pdpe", "role_pdpr", "e_reporting", "peppol", "api_only",
    "format_conversion", "od_layer", "cloud_external", "secnumcloud",
    "white_label", "b2b_domestic", "b2b_international", "b2c", "payment_data"
  )
  values <- lapply(fields, function(name) as.integer(isTRUE(scope[[name]])))
  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO client_scope",
      "(client_id, source_document_id, role_pdpe, role_pdpr, e_reporting, peppol,",
      "api_only, format_conversion, od_layer, cloud_external, secnumcloud, white_label,",
      "b2b_domestic, b2b_international, b2c, payment_data, supported_flows,",
      "scope_summary, analyzed_at, analyzed_by)",
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      "ON CONFLICT(client_id) DO UPDATE SET",
      "source_document_id=excluded.source_document_id, role_pdpe=excluded.role_pdpe,",
      "role_pdpr=excluded.role_pdpr, e_reporting=excluded.e_reporting,",
      "peppol=excluded.peppol, api_only=excluded.api_only,",
      "format_conversion=excluded.format_conversion, od_layer=excluded.od_layer,",
      "cloud_external=excluded.cloud_external, secnumcloud=excluded.secnumcloud,",
      "white_label=excluded.white_label, b2b_domestic=excluded.b2b_domestic,",
      "b2b_international=excluded.b2b_international, b2c=excluded.b2c,",
      "payment_data=excluded.payment_data, supported_flows=excluded.supported_flows,",
      "scope_summary=excluded.scope_summary, analyzed_at=excluded.analyzed_at,",
      "analyzed_by=excluded.analyzed_by"
    ),
    params = c(
      list(client_id, source_document_id), values,
      list(
        diam_display_value(scope$supported_flows, ""),
        diam_display_value(scope$scope_summary, "Périmètre défini manuellement"),
        diam_now(), analyzed_by
      )
    )
  )
  missions <- DBI::dbGetQuery(
    con, "SELECT id FROM mission WHERE client_id=?", params = list(client_id)
  )
  if (nrow(missions)) {
    for (mission_id in missions$id) {
      diam_apply_scope_to_mission(con, mission_id, client_id, analyzed_by)
    }
  }
  invisible(scope)
}

diam_client_scope <- function(con, client_id) {
  result <- DBI::dbGetQuery(
    con, "SELECT * FROM client_scope WHERE client_id=?", params = list(client_id)
  )
  if (!nrow(result)) return(NULL)
  result
}

diam_analyze_client_document <- function(con, client_id, document_id, user) {
  document <- DBI::dbGetQuery(
    con,
    "SELECT extracted_text FROM client_document WHERE id=? AND client_id=?",
    params = list(document_id, client_id)
  )
  if (!nrow(document)) stop("Document de candidature introuvable.")
  text <- document$extracted_text[[1]]
  if (is.na(text) || !nzchar(text)) {
    stop(
      paste(
        "Le texte du PDF n'a pas pu être extrait automatiquement.",
        "Installez le package R 'pdftools' ou définissez le périmètre manuellement."
      )
    )
  }
  scope <- diam_infer_scope(text)
  diam_save_scope(con, client_id, scope, document_id, user)
  scope
}

diam_scope_questions <- function() {
  data.frame(
    reference = c(
      "SCOPE-OD-1", "SCOPE-PDPE-1", "SCOPE-PDPR-1", "SCOPE-ERPT-1",
      "SCOPE-PEPPOL-1", "SCOPE-API-1", "SCOPE-NOMAP-1", "SCOPE-CLOUD-1"
    ),
    scope_key = c(
      "od_layer", "role_pdpe", "role_pdpr", "e_reporting",
      "peppol", "api_only", "no_format_conversion", "cloud_external"
    ),
    chapter = c(
      "Périmètre déclaré - Architecture", "Périmètre déclaré - Émission",
      "Périmètre déclaré - Réception", "Périmètre déclaré - E-reporting",
      "Périmètre déclaré - Peppol", "Périmètre déclaré - API",
      "Périmètre déclaré - Formats", "Périmètre déclaré - Hébergement"
    ),
    title = c(
      "La séparation entre la couche OD et la PA garantit-elle que tous les contrôles réglementaires sont rejoués par la PA ?",
      "Les processus PDPe couvrent-ils les flux facture, PPF, routage et statuts jusqu'au destinataire ?",
      "Les processus PDPr couvrent-ils annuaire, réception, contrôles, lisible et statuts retournés ?",
      "Les flux d'e-reporting déclarés sont-ils contrôlés, dédupliqués et transmis dans les délais ?",
      "L'Access Point, le SMP, les certificats et les échanges AS4 sont-ils opérés dans le périmètre PA conforme ?",
      "Les API OAuth2, adresses autorisées, webhooks, secrets et journaux assurent-ils la sécurité de bout en bout ?",
      "L'absence de conversion est-elle contractualisée et les formats non conformes sont-ils rejetés sans altération ?",
      "L'architecture cloud respecte-t-elle SecNumCloud, la localisation UE et la maîtrise des flux sortants ?"
    ),
    description = c(
      "Ciblage issu du dossier de candidature : architecture OD + PA.",
      "Ciblage issu du rôle déclaré de PA d'émission.",
      "Ciblage issu du rôle déclaré de PA de réception.",
      "Ciblage issu des flux 10 et activités B2B international/B2C.",
      "Ciblage issu du recours déclaré à Peppol/AS4.",
      "Ciblage issu d'une solution déclarée full API.",
      "Ciblage issu de l'absence déclarée de mapping/conversion.",
      "Ciblage issu d'un hébergement cloud externalisé."
    ),
    requirement = c(
      "La PA demeure responsable des contrôles et ne peut se reposer sur les seuls traitements de l'OD.",
      "La chaîne d'émission doit être complète, idempotente, traçable et conforme aux flux 1/2/6.",
      "La chaîne de réception doit maîtriser annuaire, contrôles, restitution lisible et cycle de vie.",
      "Les fichiers F8/F9/F10 doivent être valides, uniques, périodisés et traçables.",
      "L'interopérabilité Peppol doit utiliser les certificats propres et AS4 dans le périmètre conforme.",
      "Les interfaces M2M doivent appliquer authentification forte, moindre privilège et traçabilité.",
      "La responsabilité du format source doit être claire et la PA doit réaliser tous les contrôles obligatoires.",
      "Les services cloud participant à l'activité PA doivent satisfaire les exigences SecNumCloud et UE."
    ),
    criticality = c("CRITICAL", "CRITICAL", "CRITICAL", "CRITICAL", "HIGH", "CRITICAL", "HIGH", "CRITICAL"),
    verification_method = c(
      "Rejeu d'un flux complet OD vers PA et comparaison des contrôles exécutés.",
      "Tests nominaux et erreurs sur émission, routage, PPF, PA destinataire et statuts.",
      "Tests annuaire, réception UBL/CII/Factur-X, lisible, rejets et retours de statuts.",
      "Tests F10.1 à F10.4, doublons de période, délais et rejets PPF.",
      "Revue AP/SMP/PKI et tests AS4 avec corrélation des traces.",
      "Revue OAuth2, secrets, filtrage IP, webhooks, rotations et journaux.",
      "Tests de formats invalides, preuve d'absence d'altération et revue contractuelle.",
      "Revue d'architecture, attestations, filtrage egress et localisation des opérations."
    ),
    expected_evidence = c(
      "Architecture ; RACI ; matrices de contrôles OD/PA ; logs corrélés ; tests.",
      "Payloads flux 1/2/6 ; CDAR ; annuaire ; journaux ; cas d'erreur.",
      "Flux 11-14 ; factures reçues ; lisibles ; CDAR ; journaux et rejets.",
      "Fichiers F10 ; calendrier TVA ; anti-doublon ; accusés PPF ; alertes.",
      "Certificats AP ; configuration SMP ; messages AS4 ; receipts ; journaux.",
      "Configuration OAuth2 ; vault ; ACL IP ; webhooks ; journaux ; tests de rotation.",
      "Contrats ; documentation client ; rapports de validation ; rejets ; hashes.",
      "Attestation SecNumCloud ; schéma cloud ; règles réseau ; logs IP ; contrats."
    ),
    stringsAsFactors = FALSE
  )
}

diam_target_questionnaire <- function(con, mission_id, client_id) {
  base <- diam_questionnaire_template()
  scope <- diam_client_scope(con, client_id)
  if (is.null(scope)) return(base)
  keep <- rep(TRUE, nrow(base))
  if (!isTRUE(as.logical(scope$e_reporting[[1]]))) {
    keep[base$reference %in% c("DGFiP-4.1", "DGFiP-4.2", "DGFiP-4.3", "DGFiP-5.4")] <- FALSE
  }
  if (!isTRUE(as.logical(scope$cloud_external[[1]]))) {
    keep[base$reference == "DGFiP-A5"] <- FALSE
  }
  if (!isTRUE(as.logical(scope$white_label[[1]]))) {
    keep[base$reference == "DGFiP-A9"] <- FALSE
  }
  base <- base[keep, , drop = FALSE]
  extra <- diam_scope_questions()
  active <- c(
    od_layer = as.logical(scope$od_layer[[1]]),
    role_pdpe = as.logical(scope$role_pdpe[[1]]),
    role_pdpr = as.logical(scope$role_pdpr[[1]]),
    e_reporting = as.logical(scope$e_reporting[[1]]),
    peppol = as.logical(scope$peppol[[1]]),
    api_only = as.logical(scope$api_only[[1]]),
    no_format_conversion = !as.logical(scope$format_conversion[[1]]),
    cloud_external = as.logical(scope$cloud_external[[1]])
  )
  extra <- extra[active[extra$scope_key], setdiff(names(extra), "scope_key"), drop = FALSE]
  rbind(base, extra)
}

diam_apply_scope_to_mission <- function(con, mission_id, client_id, user = "DIAM") {
  target <- diam_target_questionnaire(con, mission_id, client_id)
  current <- DBI::dbGetQuery(
    con,
    paste(
      "SELECT q.id, q.reference FROM question q",
      "LEFT JOIN answer a ON a.question_id=q.id",
      "LEFT JOIN finding f ON f.question_id=q.id",
      "LEFT JOIN question_evidence qe ON qe.question_id=q.id",
      "WHERE q.mission_id=? AND a.id IS NULL AND f.id IS NULL AND qe.id IS NULL"
    ),
    params = list(mission_id)
  )
  removable <- current$id[!current$reference %in% target$reference]
  if (length(removable)) {
    placeholders <- paste(rep("?", length(removable)), collapse = ",")
    DBI::dbExecute(
      con, paste0("DELETE FROM question WHERE id IN (", placeholders, ")"),
      params = as.list(removable)
    )
  }
  existing <- DBI::dbGetQuery(
    con, "SELECT reference FROM question WHERE mission_id=?", params = list(mission_id)
  )$reference
  missing <- target[!target$reference %in% existing, , drop = FALSE]
  if (nrow(missing)) {
    for (i in seq_len(nrow(missing))) {
      diam_add_question(
        con, mission_id, missing$reference[[i]], missing$chapter[[i]],
        missing$title[[i]], missing$criticality[[i]], missing$expected_evidence[[i]],
        missing$description[[i]], missing$requirement[[i]],
        missing$verification_method[[i]]
      )
    }
  }
  diam_update_progress(con, mission_id)
  diam_log(
    con, mission_id, user, "APPLY_CLIENT_SCOPE", "MISSION",
    as.character(mission_id), paste(nrow(target), "contrôles ciblés")
  )
  invisible(nrow(target))
}
