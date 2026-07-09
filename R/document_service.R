# ============================================================
# DIAM - Report and certificate generation
# ============================================================

diam_audit_result <- function(con, mission_id) {
  counts <- DBI::dbGetQuery(
    con,
    paste(
      "SELECT COUNT(*) AS total,",
      "SUM(CASE WHEN q.status='COMPLETED' THEN 1 ELSE 0 END) AS completed,",
      "SUM(CASE WHEN a.compliance_status='COMPLIANT' THEN 1 ELSE 0 END) AS compliant,",
      "SUM(CASE WHEN a.compliance_status='PARTIALLY_COMPLIANT' THEN 1 ELSE 0 END) AS partial,",
      "SUM(CASE WHEN a.compliance_status='NON_COMPLIANT' THEN 1 ELSE 0 END) AS non_compliant,",
      "SUM(CASE WHEN a.compliance_status='NON_COMPLIANT'",
      "AND q.criticality='CRITICAL' THEN 1 ELSE 0 END) AS critical_nc",
      "FROM question q LEFT JOIN answer a ON a.question_id=q.id",
      "WHERE q.mission_id=?"
    ),
    params = list(mission_id)
  )
  n <- function(value) if (is.na(value)) 0L else as.integer(value)
  total <- n(counts$total[[1]])
  completed <- n(counts$completed[[1]])
  critical_nc <- n(counts$critical_nc[[1]])
  non_compliant <- n(counts$non_compliant[[1]])
  partial <- n(counts$partial[[1]])
  open_nc <- DBI::dbGetQuery(
    con,
    paste(
      "SELECT COUNT(*) AS n FROM non_conformity nc",
      "JOIN finding f ON f.id=nc.finding_id",
      "JOIN question q ON q.id=f.question_id",
      "WHERE q.mission_id=? AND nc.status='OPEN'"
    ),
    params = list(mission_id)
  )$n[[1]]
  evidences <- DBI::dbGetQuery(
    con,
    "SELECT COUNT(*) AS n FROM evidence WHERE mission_id=? AND status='ACTIVE'",
    params = list(mission_id)
  )$n[[1]]

  if (total == 0 || completed < total) {
    opinion <- "AUDIT INCOMPLET"
    reason <- "L'opinion ne peut être émise avant l'évaluation de tous les contrôles."
  } else if (critical_nc > 0) {
    opinion <- "NON CONFORME"
    reason <- "Au moins une non-conformité affecte un contrôle critique."
  } else if (non_compliant > 0 || partial > 0 || open_nc > 0) {
    opinion <- "CONFORME SOUS RÉSERVES"
    reason <- "Des écarts, réserves ou actions correctives restent ouverts."
  } else {
    opinion <- "CONFORME"
    reason <- "Tous les contrôles sont achevés sans écart ouvert."
  }

  list(
    opinion = opinion, reason = reason, total = total, completed = completed,
    compliant = n(counts$compliant[[1]]), partial = partial,
    non_compliant = non_compliant, critical_nc = critical_nc,
    open_nc = as.integer(open_nc), evidences = as.integer(evidences),
    final = total > 0 && completed == total
  )
}

diam_display_value <- function(value, fallback = "Non renseigné") {
  if (is.null(value) || !length(value) || is.na(value[[1]]) ||
      !nzchar(trimws(as.character(value[[1]])))) {
    return(fallback)
  }
  as.character(value[[1]])
}

diam_report_data <- function(con, mission_id) {
  mission <- DBI::dbGetQuery(
    con,
    paste(
      "SELECT m.*, c.name AS client, c.address, c.postal_code, c.city, c.country,",
      "r.code AS referential, r.version AS referential_version",
      "FROM mission m JOIN client c ON c.id=m.client_id",
      "JOIN referential r ON r.id=m.referential_id WHERE m.id=?"
    ),
    params = list(mission_id)
  )
  if (!nrow(mission)) stop("Mission introuvable.")
  controls <- DBI::dbGetQuery(
    con,
    paste(
      "SELECT q.id, q.reference, q.chapter, q.title, q.description, q.requirement,",
      "q.criticality, q.verification_method, q.expected_evidence, q.status,",
      "COALESCE(a.compliance_status, 'NOT_STARTED') AS compliance_status,",
      "COALESCE(a.answer, '') AS answer, COALESCE(a.comment, '') AS comment,",
      "COALESCE(group_concat(DISTINCT e.evidence_number || ' - ' || e.original_name), '') AS evidences",
      "FROM question q LEFT JOIN answer a ON a.question_id=q.id",
      "LEFT JOIN question_evidence qe ON qe.question_id=q.id",
      "LEFT JOIN evidence e ON e.id=qe.evidence_id AND e.status='ACTIVE'",
      "WHERE q.mission_id=? GROUP BY q.id ORDER BY q.reference"
    ),
    params = list(mission_id)
  )
  list(
    mission = mission,
    result = diam_audit_result(con, mission_id),
    controls = controls,
    evidences = diam_evidences(con, mission_id),
    findings = diam_findings(con, mission_id),
    non_conformities = diam_non_conformities(con, mission_id),
    actions = diam_actions(con, mission_id),
    history = diam_history(con, mission_id)
  )
}

diam_doc_styles <- function(doc) {
  officer::styles_info(doc)
  doc
}

diam_add_title <- function(doc, text, size = 26, color = "0B2545") {
  if (!startsWith(color, "#")) color <- paste0("#", color)
  officer::body_add_fpar(
    doc,
    officer::fpar(
      officer::ftext(
        text,
        officer::fp_text(
          font.family = "Arial", font.size = size, bold = TRUE, color = color
        )
      ),
      fp_p = officer::fp_par(text.align = "center", padding.bottom = 8)
    )
  )
}

diam_add_label <- function(doc, label, value) {
  officer::body_add_fpar(
    doc,
    officer::fpar(
      officer::ftext(
        paste0(label, " : "),
        officer::fp_text(font.family = "Arial", bold = TRUE, color = "#0B2545")
      ),
      officer::ftext(
        ifelse(is.na(value) || !nzchar(as.character(value)), "Non renseigné", value),
        officer::fp_text(font.family = "Arial")
      ),
      fp_p = officer::fp_par(padding.bottom = 3)
    )
  )
}

diam_status_label <- function(status) {
  switch(
    status,
    COMPLIANT = "Conforme",
    PARTIALLY_COMPLIANT = "Partiellement conforme",
    NON_COMPLIANT = "Non conforme",
    NOT_APPLICABLE = "Non applicable",
    "Non évalué"
  )
}

diam_make_table <- function(data, widths = NULL) {
  table <- flextable::flextable(data)
  table <- flextable::theme_vanilla(table)
  table <- flextable::font(table, fontname = "Arial", part = "all")
  table <- flextable::fontsize(table, size = 9, part = "body")
  table <- flextable::fontsize(table, size = 9.5, part = "header")
  table <- flextable::bg(table, bg = "#0B2545", part = "header")
  table <- flextable::color(table, color = "#FFFFFF", part = "header")
  table <- flextable::bold(table, bold = TRUE, part = "header")
  table <- flextable::valign(table, valign = "center", part = "all")
  table <- flextable::padding(table, padding = 5, part = "all")
  table <- flextable::set_table_properties(table, layout = "fixed", width = 1)
  if (!is.null(widths)) {
    table <- flextable::width(table, width = widths)
  } else {
    table <- flextable::autofit(table)
  }
  table
}

diam_generate_report_docx <- function(con, mission_id, generated_by = "DIAM") {
  data <- diam_report_data(con, mission_id)
  mission <- data$mission[1, ]
  result <- data$result
  folder <- file.path(app_config$directories$reports, mission$uuid)
  fs::dir_create(folder, recurse = TRUE)
  number <- diam_next_number(con, "report_number", "RAP")
  path <- file.path(folder, paste0(number, ".docx"))

  doc <- officer::read_docx()
  section <- officer::prop_section(
    page_size = officer::page_size(orient = "portrait", width = 8.27, height = 11.69),
    page_margins = officer::page_mar(top = 0.8, bottom = 0.75, left = 0.8, right = 0.8)
  )
  doc <- officer::body_set_default_section(doc, section)
  doc <- diam_add_title(doc, "RAPPORT D'AUDIT DE CONFORMITÉ")
  doc <- officer::body_add_fpar(
    doc,
    officer::fpar(
      officer::ftext(
        "Plateforme agréée - Facturation électronique",
        officer::fp_text(
          font.family = "Arial", font.size = 14, color = "#5A6573"
        )
      ),
      fp_p = officer::fp_par(text.align = "center", padding.bottom = 12)
    )
  )
  doc <- diam_add_label(doc, "Organisation auditée", mission$client)
  doc <- diam_add_label(doc, "Mission", paste(mission$number, mission$title))
  doc <- diam_add_label(doc, "Référentiel", "Guide pratique DGFiP v1.3 / PDP Integrity v3.2")
  doc <- diam_add_label(doc, "Périmètre", mission$scope)
  doc <- diam_add_label(doc, "Période couverte", paste(
    diam_display_value(mission$audit_period_start, "Non renseignée"), "au",
    diam_display_value(mission$audit_period_end, "Non renseignée")
  ))
  doc <- diam_add_label(doc, "Date d'émission", format(Sys.Date(), "%d/%m/%Y"))
  doc <- diam_add_label(doc, "Établi par", generated_by)
  doc <- officer::body_add_break(doc)

  doc <- officer::body_add_par(doc, "1. Opinion d'audit", style = "heading 1")
  doc <- diam_add_title(doc, result$opinion, size = 18, color = switch(
    result$opinion,
    "CONFORME" = "237A3B",
    "CONFORME SOUS RÉSERVES" = "A66A00",
    "NON CONFORME" = "A11B1B",
    "5A6573"
  ))
  doc <- officer::body_add_par(doc, result$reason, style = "Normal")
  summary <- data.frame(
    Indicateur = c(
      "Contrôles achevés", "Conformes", "Partiellement conformes",
      "Non conformes", "Preuves", "Non-conformités ouvertes"
    ),
    Résultat = c(
      paste0(result$completed, "/", result$total), result$compliant,
      result$partial, result$non_compliant, result$evidences, result$open_nc
    )
  )
  doc <- flextable::body_add_flextable(doc, diam_make_table(summary, c(4.7, 1.8)))

  doc <- officer::body_add_par(doc, "2. Objet, portée et méthodologie", style = "heading 1")
  doc <- officer::body_add_par(
    doc,
    paste(
      "La mission évalue les points de conformité du guide pratique DGFiP v1.3.",
      "PDP Integrity v3.2 est utilisé comme méthode d'approfondissement technique,",
      "sans se substituer aux exigences de la DGFiP."
    ),
    style = "Normal"
  )
  doc <- officer::body_add_par(
    doc,
    paste(
      "Les travaux reposent sur la revue documentaire, les entretiens, les tests",
      "de conception et d'efficacité, l'échantillonnage et la traçabilité des preuves."
    ),
    style = "Normal"
  )

  doc <- officer::body_add_par(doc, "3. Résultats détaillés", style = "heading 1")
  chapters <- unique(data$controls$chapter)
  for (chapter in chapters) {
    doc <- officer::body_add_par(doc, chapter, style = "heading 2")
    rows <- data$controls[data$controls$chapter == chapter, , drop = FALSE]
    for (i in seq_len(nrow(rows))) {
      control <- rows[i, ]
      doc <- officer::body_add_par(
        doc, paste(control$reference, "-", control$title), style = "heading 3"
      )
      doc <- diam_add_label(doc, "Conclusion", diam_status_label(control$compliance_status))
      doc <- diam_add_label(doc, "Criticité", control$criticality)
      doc <- diam_add_label(doc, "Exigence", control$requirement)
      doc <- diam_add_label(doc, "Travaux attendus", control$verification_method)
      doc <- diam_add_label(doc, "Analyse de l'auditeur", control$answer)
      doc <- diam_add_label(doc, "Commentaire", control$comment)
      doc <- diam_add_label(doc, "Preuves rattachées", control$evidences)
    }
  }

  doc <- officer::body_add_par(doc, "4. Constats et plan d'action", style = "heading 1")
  if (nrow(data$findings)) {
    findings <- data$findings[, c(
      "finding_number", "reference", "summary", "risk", "recommendation", "status"
    )]
    names(findings) <- c("Constat", "Contrôle", "Synthèse", "Risque", "Recommandation", "État")
    doc <- flextable::body_add_flextable(doc, diam_make_table(findings))
  } else {
    doc <- officer::body_add_par(doc, "Aucun constat enregistré.", style = "Normal")
  }
  if (nrow(data$actions)) {
    doc <- officer::body_add_par(doc, "Plan d'action", style = "heading 2")
    actions <- data$actions[, c(
      "action_number", "nc_number", "action", "owner", "priority", "due_date", "status"
    )]
    names(actions) <- c("Action", "NC", "Description", "Responsable", "Priorité", "Échéance", "État")
    doc <- flextable::body_add_flextable(doc, diam_make_table(actions))
  }

  doc <- officer::body_add_par(doc, "5. Registre des preuves", style = "heading 1")
  if (nrow(data$evidences)) {
    evidence <- data$evidences[, c(
      "evidence_number", "original_name", "linked_controls", "sha256", "uploaded_at"
    )]
    names(evidence) <- c("Preuve", "Fichier", "Contrôles", "SHA-256 (extrait)", "Versement")
    doc <- flextable::body_add_flextable(doc, diam_make_table(evidence))
  } else {
    doc <- officer::body_add_par(doc, "Aucune preuve versée.", style = "Normal")
  }

  doc <- officer::body_add_par(doc, "6. Conclusion et signature", style = "heading 1")
  doc <- officer::body_add_par(
    doc,
    paste(
      "Le présent rapport doit être signé au moyen d'une signature électronique",
      "avancée afin de garantir son authenticité et son intégrité, conformément",
      "au guide pratique DGFiP v1.3."
    ),
    style = "Normal"
  )
  doc <- diam_add_label(doc, "Directeur de mission", generated_by)
  doc <- diam_add_label(doc, "Date", format(Sys.Date(), "%d/%m/%Y"))
  print(doc, target = path)

  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO report",
      "(uuid, mission_id, report_number, version, status, word_file,",
      "generated_at, signed, created_at, updated_at)",
      "VALUES (?, ?, ?, '1.0', ?, ?, ?, 0, ?, ?)"
    ),
    params = list(
      diam_uuid(), mission_id, number,
      if (result$final) "FINAL" else "DRAFT", path,
      diam_now(), diam_now(), diam_now()
    )
  )
  path
}

diam_generate_certificate_docx <- function(con, mission_id, issued_by = "DIAM") {
  data <- diam_report_data(con, mission_id)
  mission <- data$mission[1, ]
  result <- data$result
  folder <- file.path(app_config$directories$reports, mission$uuid)
  fs::dir_create(folder, recurse = TRUE)
  number <- diam_next_number(con, "certificate_number", "D2F-PA")
  path <- file.path(folder, paste0(number, ".docx"))

  doc <- officer::read_docx()
  section <- officer::prop_section(
    page_size = officer::page_size(orient = "portrait", width = 8.27, height = 11.69),
    page_margins = officer::page_mar(top = 0.55, bottom = 0.55, left = 0.65, right = 0.65)
  )
  doc <- officer::body_set_default_section(doc, section)
  doc <- diam_add_title(doc, "D2F COMPLIANT", size = 18, color = "5A6573")
  doc <- diam_add_title(doc, "CERTIFICAT", size = 34)
  doc <- diam_add_title(doc, "DE CONFORMITÉ RÉGLEMENTAIRE", size = 16, color = "B08A2E")
  if (!result$final) {
    doc <- diam_add_title(doc, "PROJET - AUDIT INCOMPLET", size = 14, color = "A11B1B")
  }
  doc <- officer::body_add_par(
    doc,
    paste(
      "Dans le cadre de la mission d'audit réalisée selon le guide pratique",
      "DGFiP v1.3 et la méthodologie PDP Integrity v3.2, D2F Compliant",
      "émet le présent certificat relatif à l'organisation auditée."
    ),
    style = "Normal"
  )
  metadata <- data.frame(
    Rubrique = c(
      "Certificat n°", "Organisation auditée", "Mission", "Référentiel",
      "Périmètre", "Période couverte", "Date d'émission"
    ),
    Information = c(
      number, mission$client, mission$number,
      "Guide pratique DGFiP v1.3 / PDP Integrity v3.2",
      mission$scope,
      paste(
        diam_display_value(mission$audit_period_start, "Non renseignée"), "au",
        diam_display_value(mission$audit_period_end, "Non renseignée")
      ),
      format(Sys.Date(), "%d/%m/%Y")
    )
  )
  doc <- flextable::body_add_flextable(doc, diam_make_table(metadata, c(2.1, 4.4)))
  doc <- officer::body_add_par(doc, "OPINION", style = "heading 1")
  opinions <- c("CONFORME", "CONFORME SOUS RÉSERVES", "NON CONFORME")
  for (opinion in opinions) {
    mark <- if (identical(result$opinion, opinion)) "☒" else "☐"
    doc <- officer::body_add_par(doc, paste(mark, opinion), style = "heading 2")
  }
  if (!result$final) {
    doc <- officer::body_add_par(
      doc, "Aucune opinion définitive n'est émise : l'audit n'est pas achevé.",
      style = "Normal"
    )
  } else {
    doc <- officer::body_add_par(doc, result$reason, style = "Normal")
  }
  doc <- officer::body_add_par(doc, "COMMENTAIRE", style = "heading 1")
  doc <- officer::body_add_par(
    doc,
    paste0(
      "Contrôles achevés : ", result$completed, "/", result$total,
      ". Conformes : ", result$compliant,
      ". Partiellement conformes : ", result$partial,
      ". Non conformes : ", result$non_compliant,
      ". Non-conformités ouvertes : ", result$open_nc, "."
    ),
    style = "Normal"
  )
  doc <- officer::body_add_par(doc, "Directeur de mission", style = "heading 2")
  doc <- officer::body_add_par(doc, issued_by, style = "Normal")
  doc <- officer::body_add_par(
    doc,
    paste(
      "Le certificat est indissociable du rapport d'audit et ne peut être",
      "reproduit que dans son intégralité."
    ),
    style = "Normal"
  )
  print(doc, target = path)

  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO certificate",
      "(uuid, mission_id, certificate_number, status, issued_at, created_at)",
      "VALUES (?, ?, ?, ?, ?, ?)"
    ),
    params = list(
      diam_uuid(), mission_id, number,
      if (result$final) result$opinion else "DRAFT",
      diam_now(), diam_now()
    )
  )
  path
}

diam_pdf_canvas <- function(path, title) {
  grDevices::pdf(
    path, width = 8.27, height = 11.69, onefile = TRUE,
    encoding = "ISOLatin1.enc", paper = "special"
  )
  state <- new.env(parent = emptyenv())
  state$page <- 0L
  state$y <- 0.91
  state$title <- title
  state$new_page <- function() {
    graphics::plot.new()
    graphics::plot.window(xlim = c(0, 1), ylim = c(0, 1))
    state$page <- state$page + 1L
    state$y <- 0.91
    graphics::segments(0.07, 0.945, 0.93, 0.945, col = "#B08A2E", lwd = 1.2)
    graphics::text(
      0.07, 0.96, "D2F COMPLIANT", adj = c(0, 0.5),
      col = "#0B2545", cex = 0.75, font = 2, family = "sans"
    )
    graphics::text(
      0.93, 0.96, state$title, adj = c(1, 0.5),
      col = "#5A6573", cex = 0.65, family = "sans"
    )
    graphics::text(
      0.93, 0.035, paste("Page", state$page), adj = c(1, 0.5),
      col = "#5A6573", cex = 0.65, family = "sans"
    )
  }
  state$new_page()
  state
}

diam_pdf_text <- function(
    state, text, size = 0.82, bold = FALSE, color = "#20252B",
    indent = 0, after = 0.012, width = 105
) {
  text <- diam_display_value(text, "Non renseigné")
  text <- gsub("[\u2018\u2019]", "'", text)
  text <- gsub("\u2026", "...", text, fixed = TRUE)
  lines <- unlist(strwrap(text, width = max(25, width - round(indent * 100))))
  line_height <- 0.018 * size / 0.82
  needed <- length(lines) * line_height + after
  if (state$y - needed < 0.065) state$new_page()
  for (line in lines) {
    graphics::text(
      0.08 + indent, state$y, line, adj = c(0, 1),
      cex = size, font = if (bold) 2 else 1, col = color, family = "sans"
    )
    state$y <- state$y - line_height
  }
  state$y <- state$y - after
  invisible(state)
}

diam_pdf_heading <- function(state, text, level = 1) {
  if (level == 1) {
    state$y <- state$y - 0.01
    diam_pdf_text(state, text, size = 1.25, bold = TRUE, color = "#0B2545", after = 0.016)
    graphics::segments(0.08, state$y + 0.006, 0.92, state$y + 0.006, col = "#D8C28E")
  } else if (level == 2) {
    diam_pdf_text(state, text, size = 1.0, bold = TRUE, color = "#1F4D78", after = 0.012)
  } else {
    diam_pdf_text(
      state, text, size = 0.88, bold = TRUE, color = "#0B2545",
      after = 0.008, width = 82
    )
  }
}

diam_pdf_label <- function(state, label, value, width = 98) {
  diam_pdf_text(
    state, paste0(label, " : ", diam_display_value(value)),
    size = 0.76, indent = 0.015, after = 0.006, width = width
  )
}

diam_generate_report_pdf <- function(con, mission_id, generated_by = "DIAM") {
  data <- diam_report_data(con, mission_id)
  mission <- data$mission[1, ]
  result <- data$result
  folder <- file.path(app_config$directories$reports, mission$uuid)
  fs::dir_create(folder, recurse = TRUE)
  number <- diam_next_number(con, "report_number", "RAP")
  path <- file.path(folder, paste0(number, ".pdf"))
  state <- diam_pdf_canvas(path, "Rapport d'audit")
  on.exit(grDevices::dev.off(), add = TRUE)

  state$y <- 0.78
  diam_pdf_text(
    state, "RAPPORT D'AUDIT DE CONFORMITÉ", size = 1.65,
    bold = TRUE, color = "#0B2545", after = 0.02
  )
  diam_pdf_text(
    state, "Plateforme agréée - Facturation électronique",
    size = 1.0, color = "#B08A2E", after = 0.04
  )
  diam_pdf_label(state, "Organisation auditée", mission$client)
  diam_pdf_label(state, "Mission", paste(mission$number, mission$title))
  diam_pdf_label(state, "Référentiel", "Guide pratique DGFiP v1.3 / PDP Integrity v3.2")
  diam_pdf_label(state, "Périmètre", mission$scope)
  diam_pdf_label(
    state, "Période couverte",
    paste(
      diam_display_value(mission$audit_period_start, "Non renseignée"), "au",
      diam_display_value(mission$audit_period_end, "Non renseignée")
    )
  )
  diam_pdf_label(state, "Date d'émission", format(Sys.Date(), "%d/%m/%Y"))
  diam_pdf_label(state, "Directeur de mission", generated_by)
  state$new_page()

  diam_pdf_heading(state, "1. Opinion d'audit")
  diam_pdf_text(
    state, result$opinion, size = 1.35, bold = TRUE,
    color = switch(
      result$opinion,
      "CONFORME" = "#237A3B",
      "CONFORME SOUS RÉSERVES" = "#A66A00",
      "NON CONFORME" = "#A11B1B",
      "#5A6573"
    )
  )
  diam_pdf_text(state, result$reason)
  diam_pdf_label(state, "Contrôles achevés", paste0(result$completed, "/", result$total))
  diam_pdf_label(state, "Conformes", result$compliant)
  diam_pdf_label(state, "Partiellement conformes", result$partial)
  diam_pdf_label(state, "Non conformes", result$non_compliant)
  diam_pdf_label(state, "Preuves enregistrées", result$evidences)
  diam_pdf_label(state, "Non-conformités ouvertes", result$open_nc)

  diam_pdf_heading(state, "2. Objet, portée et méthodologie")
  diam_pdf_text(
    state,
    paste(
      "La mission évalue les points de conformité du guide pratique DGFiP v1.3.",
      "PDP Integrity v3.2 est utilisé comme méthode d'approfondissement technique",
      "sans se substituer aux exigences de la DGFiP."
    )
  )
  diam_pdf_text(
    state,
    paste(
      "Les travaux reposent sur la revue documentaire, les entretiens, les tests",
      "de conception et d'efficacité, l'échantillonnage et la traçabilité des preuves."
    )
  )

  diam_pdf_heading(state, "3. Résultats détaillés")
  chapters <- unique(data$controls$chapter)
  for (chapter in chapters) {
    if (state$y < 0.2) state$new_page()
    diam_pdf_heading(state, chapter, level = 2)
    rows <- data$controls[data$controls$chapter == chapter, , drop = FALSE]
    for (i in seq_len(nrow(rows))) {
      if (state$y < 0.26) state$new_page()
      control <- rows[i, ]
      diam_pdf_heading(state, paste(control$reference, "-", control$title), level = 3)
      diam_pdf_label(state, "Conclusion", diam_status_label(control$compliance_status))
      diam_pdf_label(state, "Criticité", control$criticality)
      diam_pdf_label(state, "Exigence", control$requirement)
      diam_pdf_label(state, "Méthode", control$verification_method)
      diam_pdf_label(state, "Analyse", control$answer)
      diam_pdf_label(state, "Commentaire", control$comment)
      diam_pdf_label(state, "Preuves", control$evidences)
      state$y <- state$y - 0.008
    }
  }

  diam_pdf_heading(state, "4. Constats et plan d'action")
  if (nrow(data$findings)) {
    for (i in seq_len(nrow(data$findings))) {
      row <- data$findings[i, ]
      diam_pdf_heading(
        state, paste(row$finding_number, "-", row$reference, "-", row$summary), level = 3
      )
      diam_pdf_label(state, "Risque", row$risk)
      diam_pdf_label(state, "Recommandation", row$recommendation)
      diam_pdf_label(state, "État", row$status)
    }
  } else {
    diam_pdf_text(state, "Aucun constat enregistré.")
  }
  if (nrow(data$actions)) {
    diam_pdf_heading(state, "Plan d'action", level = 2)
    for (i in seq_len(nrow(data$actions))) {
      row <- data$actions[i, ]
      diam_pdf_heading(state, paste(row$action_number, "-", row$action), level = 3)
      diam_pdf_label(state, "Non-conformité", row$nc_number)
      diam_pdf_label(state, "Responsable", row$owner)
      diam_pdf_label(state, "Priorité", row$priority)
      diam_pdf_label(state, "Échéance", row$due_date)
      diam_pdf_label(state, "État", row$status)
    }
  }

  diam_pdf_heading(state, "5. Registre des preuves")
  if (nrow(data$evidences)) {
    for (i in seq_len(nrow(data$evidences))) {
      row <- data$evidences[i, ]
      diam_pdf_heading(
        state, paste(row$evidence_number, "-", row$original_name), level = 3
      )
      diam_pdf_label(state, "Contrôles liés", row$linked_controls)
      diam_pdf_label(state, "SHA-256 (extrait)", row$sha256)
      diam_pdf_label(state, "Date de versement", row$uploaded_at)
    }
  } else {
    diam_pdf_text(state, "Aucune preuve versée.")
  }

  diam_pdf_heading(state, "6. Conclusion et signature")
  diam_pdf_text(
    state,
    paste(
      "Le présent rapport doit être signé au moyen d'une signature électronique",
      "avancée afin de garantir son authenticité et son intégrité, conformément",
      "au guide pratique DGFiP v1.3."
    )
  )
  diam_pdf_label(state, "Directeur de mission", generated_by)
  diam_pdf_label(state, "Date", format(Sys.Date(), "%d/%m/%Y"))
  grDevices::dev.off()
  on.exit(NULL, add = FALSE)

  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO report",
      "(uuid, mission_id, report_number, version, status, pdf_file,",
      "generated_at, signed, created_at, updated_at)",
      "VALUES (?, ?, ?, '1.0', ?, ?, ?, 0, ?, ?)"
    ),
    params = list(
      diam_uuid(), mission_id, number,
      if (result$final) "FINAL" else "DRAFT", path,
      diam_now(), diam_now(), diam_now()
    )
  )
  path
}

diam_generate_certificate_pdf <- function(con, mission_id, issued_by = "DIAM") {
  data <- diam_report_data(con, mission_id)
  mission <- data$mission[1, ]
  result <- data$result
  folder <- file.path(app_config$directories$reports, mission$uuid)
  fs::dir_create(folder, recurse = TRUE)
  number <- diam_next_number(con, "certificate_number", "D2F-PA")
  path <- file.path(folder, paste0(number, ".pdf"))
  grDevices::pdf(
    path, width = 8.27, height = 11.69, onefile = TRUE,
    encoding = "ISOLatin1.enc", paper = "special"
  )
  on.exit(grDevices::dev.off(), add = TRUE)
  graphics::plot.new()
  graphics::plot.window(xlim = c(0, 1), ylim = c(0, 1))
  graphics::rect(0.035, 0.035, 0.965, 0.965, border = "#0B2545", lwd = 3)
  graphics::rect(0.047, 0.047, 0.953, 0.953, border = "#B08A2E", lwd = 1.2)
  graphics::text(0.5, 0.91, "D2F COMPLIANT", cex = 1.15, font = 2, col = "#0B2545")
  graphics::text(0.5, 0.84, "CERTIFICAT", cex = 2.4, font = 2, col = "#0B2545")
  graphics::text(
    0.5, 0.795, "DE CONFORMITÉ RÉGLEMENTAIRE",
    cex = 1.15, font = 2, col = "#B08A2E"
  )
  if (!result$final) {
    graphics::text(
      0.5, 0.755, "PROJET - AUDIT INCOMPLET",
      cex = 0.9, font = 2, col = "#A11B1B"
    )
  }
  graphics::text(
    0.5, 0.71,
    paste(
      "Mission réalisée selon le guide pratique DGFiP v1.3",
      "et la méthodologie PDP Integrity v3.2"
    ),
    cex = 0.78, col = "#303840"
  )
  labels <- c(
    "Certificat n°", "Organisation auditée", "Mission", "Référentiel",
    "Périmètre", "Période couverte", "Date d'émission"
  )
  values <- c(
    number, mission$client, mission$number,
    "Guide DGFiP v1.3 / PDP Integrity v3.2", mission$scope,
    paste(
      diam_display_value(mission$audit_period_start, "Non renseignée"), "au",
      diam_display_value(mission$audit_period_end, "Non renseignée")
    ),
    format(Sys.Date(), "%d/%m/%Y")
  )
  y <- 0.64
  for (i in seq_along(labels)) {
    graphics::text(0.12, y, labels[[i]], adj = c(0, 0.5), cex = 0.72, font = 2, col = "#0B2545")
    graphics::text(
      0.35, y, diam_display_value(values[[i]]), adj = c(0, 0.5),
      cex = 0.72, col = "#303840"
    )
    graphics::segments(0.12, y - 0.018, 0.88, y - 0.018, col = "#DDD4BE")
    y <- y - 0.05
  }
  graphics::text(0.5, 0.265, "OPINION", cex = 1.05, font = 2, col = "#0B2545")
  opinions <- c("CONFORME", "CONFORME SOUS RÉSERVES", "NON CONFORME")
  x <- c(0.22, 0.5, 0.78)
  for (i in seq_along(opinions)) {
    selected <- identical(result$opinion, opinions[[i]])
    half_width <- if (i == 2) 0.115 else 0.085
    graphics::rect(
      x[[i]] - half_width, 0.205, x[[i]] + half_width, 0.245,
      border = if (selected) "#237A3B" else "#7F8790",
      col = if (selected) "#E8F5EB" else NA, lwd = if (selected) 2 else 1
    )
    graphics::text(
      x[[i]], 0.225, opinions[[i]], cex = 0.5,
      font = if (selected) 2 else 1,
      col = if (selected) "#237A3B" else "#4A5158"
    )
  }
  comment <- if (result$final) result$reason else {
    "Aucune opinion définitive n'est émise tant que tous les contrôles ne sont pas achevés."
  }
  lines <- strwrap(comment, width = 90)
  graphics::text(0.5, 0.155, paste(lines, collapse = "\n"), cex = 0.68, col = "#303840")
  graphics::text(0.2, 0.09, paste("Émis par :", issued_by), cex = 0.68, font = 2, col = "#0B2545")
  graphics::text(
    0.76, 0.09,
    paste0(
      "Résultats : ", result$compliant, " conformes / ",
      result$partial, " réserves / ", result$non_compliant, " non conformes"
    ),
    cex = 0.52, col = "#303840"
  )
  graphics::text(
    0.5, 0.06,
    "Ce certificat est indissociable du rapport d'audit et ne peut être reproduit que dans son intégralité.",
    cex = 0.55, col = "#5A6573"
  )
  grDevices::dev.off()
  on.exit(NULL, add = FALSE)

  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO certificate",
      "(uuid, mission_id, certificate_number, status, issued_at, created_at)",
      "VALUES (?, ?, ?, ?, ?, ?)"
    ),
    params = list(
      diam_uuid(), mission_id, number,
      if (result$final) result$opinion else "DRAFT",
      diam_now(), diam_now()
    )
  )
  path
}

diam_convert_to_pdf <- function(docx_path) {
  soffice <- Sys.which("soffice")
  if (!nzchar(soffice)) {
    candidates <- c(
      "/Applications/LibreOffice.app/Contents/MacOS/soffice",
      "/usr/bin/libreoffice"
    )
    found <- candidates[file.exists(candidates)]
    if (length(found)) soffice <- found[[1]]
  }
  if (!nzchar(soffice)) {
    stop("LibreOffice est requis pour produire le PDF. Utilisez l'export Word.")
  }
  outdir <- dirname(docx_path)
  status <- system2(
    soffice,
    c("--headless", "--convert-to", "pdf", "--outdir", outdir, docx_path),
    stdout = TRUE, stderr = TRUE
  )
  pdf <- file.path(outdir, paste0(tools::file_path_sans_ext(basename(docx_path)), ".pdf"))
  if (!file.exists(pdf)) stop(paste("Conversion PDF impossible.", paste(status, collapse = " ")))
  pdf
}
