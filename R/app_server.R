app_server <- function(input, output, session) {
  `%||%` <- function(x, y) if (is.null(x)) y else x
  con <- db_connect()
  session$onSessionEnded(function() db_disconnect(con))
  refresh <- reactiveVal(0L)
  bump <- function() refresh(refresh() + 1L)
  user <- reactive({
    value <- trimws(input$current_user %||% "")
    if (nzchar(value)) value else "Auditeur DIAM"
  })
  missions_data <- reactive({
    refresh()
    diam_missions(con)
  })

  clients_data <- reactive({
    refresh()
    diam_clients(con)
  })

  observe({
    clients <- clients_data()
    choices <- if (nrow(clients)) {
      stats::setNames(clients$id, clients$name)
    } else {
      character()
    }
    current <- isolate(input$selected_client)
    selected <- if (!is.null(current) && current %in% choices) current else {
      if (length(choices)) choices[[1]] else character()
    }
    updateSelectInput(session, "selected_client", choices = choices, selected = selected)
  })

  update_scope_inputs <- function(scope) {
    if (is.null(scope)) return(invisible(NULL))
    value <- function(name) isTRUE(as.logical(scope[[name]][[1]]))
    updateCheckboxInput(session, "scope_pdpe", value = value("role_pdpe"))
    updateCheckboxInput(session, "scope_pdpr", value = value("role_pdpr"))
    updateCheckboxInput(session, "scope_ereporting", value = value("e_reporting"))
    updateCheckboxInput(session, "scope_peppol", value = value("peppol"))
    updateCheckboxInput(session, "scope_api", value = value("api_only"))
    updateCheckboxInput(session, "scope_od", value = value("od_layer"))
    updateCheckboxInput(session, "scope_conversion", value = value("format_conversion"))
    updateCheckboxInput(session, "scope_cloud", value = value("cloud_external"))
    updateCheckboxInput(session, "scope_secnumcloud", value = value("secnumcloud"))
    updateCheckboxInput(session, "scope_white_label", value = value("white_label"))
    updateCheckboxInput(session, "scope_b2c", value = value("b2c"))
    updateCheckboxInput(session, "scope_payment", value = value("payment_data"))
    updateTextInput(
      session, "scope_flows",
      value = diam_display_value(scope$supported_flows, "")
    )
  }

  observeEvent(input$save_client, {
    req(nzchar(trimws(input$client_name)))
    client_id <- diam_save_client(
      con, input$client_name, input$client_siren, input$client_address,
      city = input$client_city, country = input$client_country
    )
    bump()
    updateSelectInput(session, "selected_client", selected = client_id)
    showNotification("Fiche client enregistrée.", type = "message")
  })

  observeEvent(input$selected_client, {
    req(input$selected_client)
    scope <- diam_client_scope(con, as.integer(input$selected_client))
    update_scope_inputs(scope)
  })

  client_documents_data <- reactive({
    refresh()
    req(input$selected_client)
    diam_client_documents(con, as.integer(input$selected_client))
  })

  output$client_documents <- DT::renderDT(
    DT::datatable(
      client_documents_data(), rownames = FALSE, selection = "single",
      options = list(pageLength = 8, scrollX = TRUE)
    )
  )

  selected_client_document <- reactive({
    req(input$selected_client)
    selected <- input$client_documents_rows_selected
    if (is.null(selected) || !length(selected)) return(NULL)
    documents <- client_documents_data()
    if (!nrow(documents) || selected[[1]] > nrow(documents)) return(NULL)
    diam_client_document_file(
      con,
      as.integer(input$selected_client),
      as.integer(documents$id[[selected[[1]]]])
    )
  })

  output$selected_client_document <- renderUI({
    document <- selected_client_document()
    if (is.null(document)) {
      return(tags$p(
        class = "text-muted",
        "Aucun document sélectionné."
      ))
    }
    tags$p(
      tags$strong("Document prêt : "),
      document$original_name[[1]],
      " — ",
      format(document$file_size[[1]], big.mark = " ", scientific = FALSE),
      " octets"
    )
  })

  output$client_document_download_ui <- renderUI({
    document <- selected_client_document()
    if (is.null(document)) {
      return(tags$button(
        type = "button",
        class = "btn btn-default disabled",
        disabled = "disabled",
        "Télécharger le document sélectionné"
      ))
    }
    downloadButton(
      "download_client_document",
      "Télécharger le document sélectionné",
      class = "btn-primary"
    )
  })

  output$client_scope_summary <- renderUI({
    refresh()
    req(input$selected_client)
    scope <- diam_client_scope(con, as.integer(input$selected_client))
    if (is.null(scope)) {
      return(wellPanel(
        h4("Périmètre à définir"),
        p("Importez le dossier de candidature ou renseignez les cases ci-dessous.")
      ))
    }
    wellPanel(
      h4("Périmètre d'audit retenu"),
      p(scope$scope_summary[[1]]),
      p(tags$strong("Flux déclarés : "), diam_display_value(scope$supported_flows, "Non précisés")),
      p(
        "Les missions de ce client sont automatiquement synchronisées avec ce périmètre.",
        "Les contrôles déjà évalués ne sont jamais supprimés."
      )
    )
  })

  import_candidature_status <- reactiveVal(NULL)

  output$import_candidature_status <- renderUI({
    status <- import_candidature_status()
    if (is.null(status)) return(NULL)
    tags$div(
      class = paste("alert", status$class),
      role = "alert",
      status$message
    )
  })

  observeEvent(input$import_candidature, {
    if (is.null(input$selected_client) || !nzchar(input$selected_client)) {
      import_candidature_status(list(
        class = "alert-warning",
        message = "Sélectionnez ou enregistrez d'abord un client avant d'importer un dossier."
      ))
      showNotification("Sélectionnez d'abord un client.", type = "warning")
      return(invisible(NULL))
    }
    if (is.null(input$candidature_file) || !nrow(input$candidature_file)) {
      import_candidature_status(list(
        class = "alert-warning",
        message = "Choisissez un fichier PDF de candidature avant de cliquer sur Importer et analyser."
      ))
      showNotification("Choisissez d'abord un PDF.", type = "warning")
      return(invisible(NULL))
    }
    client_id <- suppressWarnings(as.integer(input$selected_client))
    if (is.na(client_id)) {
      import_candidature_status(list(
        class = "alert-danger",
        message = "Le client sélectionné est invalide. Rechargez la page ou sélectionnez un autre client."
      ))
      return(invisible(NULL))
    }
    import_candidature_status(list(
      class = "alert-info",
      message = paste("Import et analyse en cours :", input$candidature_file$name[[1]])
    ))
    tryCatch({
      stored <- diam_store_client_document(
        con, client_id,
        input$candidature_file$datapath[[1]],
        input$candidature_file$name[[1]],
        input$candidature_type, user()
      )
      if (stored$extracted) {
        scope <- diam_analyze_client_document(
          con, client_id, stored$id, user()
        )
        update_scope_inputs(as.data.frame(scope, stringsAsFactors = FALSE))
        import_candidature_status(list(
          class = "alert-success",
          message = "Dossier importé, texte extrait, périmètre détecté et questionnaire ciblé."
        ))
        showNotification(
          "Dossier importé, périmètre détecté et questionnaire ciblé.",
          type = "message"
        )
      } else {
        showNotification(
          paste(
            "Document conservé, mais extraction automatique indisponible.",
            "Confirmez le périmètre manuellement."
          ),
          type = "warning", duration = 10
        )
        import_candidature_status(list(
          class = "alert-warning",
          message = paste(
            "Document conservé, mais l'extraction automatique du texte est indisponible.",
            "Confirmez le périmètre manuellement."
          )
        ))
      }
      bump()
    }, error = function(e) {
      import_candidature_status(list(
        class = "alert-danger",
        message = paste("Import impossible :", e$message)
      ))
      showNotification(e$message, type = "error", duration = 10)
    })
  })

  observeEvent(input$save_scope, {
    req(input$selected_client)
    scope <- list(
      role_pdpe = isTRUE(input$scope_pdpe),
      role_pdpr = isTRUE(input$scope_pdpr),
      e_reporting = isTRUE(input$scope_ereporting),
      peppol = isTRUE(input$scope_peppol),
      api_only = isTRUE(input$scope_api),
      format_conversion = isTRUE(input$scope_conversion),
      od_layer = isTRUE(input$scope_od),
      cloud_external = isTRUE(input$scope_cloud),
      secnumcloud = isTRUE(input$scope_secnumcloud),
      white_label = isTRUE(input$scope_white_label),
      b2b_domestic = isTRUE(input$scope_pdpe) || isTRUE(input$scope_pdpr),
      b2b_international = isTRUE(input$scope_ereporting),
      b2c = isTRUE(input$scope_b2c),
      payment_data = isTRUE(input$scope_payment),
      supported_flows = input$scope_flows,
      scope_summary = paste(
        c(
          if (isTRUE(input$scope_pdpe)) "PDPe",
          if (isTRUE(input$scope_pdpr)) "PDPr",
          if (isTRUE(input$scope_ereporting)) "e-reporting",
          if (isTRUE(input$scope_peppol)) "Peppol/AS4",
          if (isTRUE(input$scope_api)) "full API",
          if (isTRUE(input$scope_od)) "OD + PA",
          if (isTRUE(input$scope_cloud)) "cloud",
          if (!isTRUE(input$scope_conversion)) "sans conversion"
        ),
        collapse = " ; "
      )
    )
    diam_save_scope(
      con, as.integer(input$selected_client), scope,
      analyzed_by = user()
    )
    bump()
    showNotification("Périmètre confirmé et questionnaires synchronisés.", type = "message")
  })

  observe({
    missions <- missions_data()
    choices <- if (nrow(missions)) {
      stats::setNames(missions$id, paste(missions$number, "—", missions$title))
    } else {
      character()
    }
    selected <- if (length(choices)) choices[[1]] else character()
    for (id in c("audit_mission", "evidence_mission", "finding_mission", "report_mission")) {
      updateSelectInput(session, id, choices = choices, selected = selected)
    }
  })

  output$dashboard_cards <- renderUI({
    refresh()
    x <- diam_dashboard(con)
    fluidRow(
      column(3, wellPanel(h3(x$missions), p("Missions"))),
      column(3, wellPanel(h3(x$active), p("Missions actives"))),
      column(3, wellPanel(h3(x$non_conformities), p("Non-conformités ouvertes"))),
      column(3, wellPanel(h3(x$actions), p("Actions ouvertes")))
    )
  })

  mission_table <- function(data) {
    DT::datatable(
      data, rownames = FALSE, selection = "single",
      options = list(pageLength = 10, scrollX = TRUE)
    )
  }
  output$dashboard_missions <- DT::renderDT(mission_table(missions_data()))
  output$missions <- DT::renderDT(mission_table(missions_data()))

  observeEvent(input$create_mission, {
    req(nzchar(trimws(input$mission_title)), nzchar(trimws(input$mission_client)))
    tryCatch({
      diam_create_mission(
        con, input$mission_title, input$mission_client, input$mission_ref,
        input$mission_scope, user(),
        as.character(input$mission_period_start),
        as.character(input$mission_period_end)
      )
      bump()
      showNotification("Mission créée.", type = "message")
    }, error = function(e) showNotification(e$message, type = "error"))
  })

  observeEvent(input$set_mission_status, {
    row <- input$missions_rows_selected
    req(length(row) == 1)
    diam_set_mission_status(con, missions_data()$id[[row]], input$mission_status, user())
    bump()
  })

  questions_data <- reactive({
    refresh()
    req(input$audit_mission)
    diam_questions(con, as.integer(input$audit_mission))
  })
  output$questions <- DT::renderDT(
    DT::datatable(
      questions_data(), rownames = FALSE, selection = "single",
      options = list(pageLength = 12, scrollX = TRUE)
    )
  )

  output$question_detail <- renderUI({
    row <- input$questions_rows_selected
    if (is.null(row) || length(row) != 1) {
      return(helpText("Sélectionnez une question pour afficher l'exigence et les preuves attendues."))
    }
    question <- questions_data()[row, ]
    guidance <- diam_question_evidence_guidance(question)
    wellPanel(
      h4(paste(question$reference, "-", question$title)),
      p(tags$strong("Source et correspondance : "), question$description),
      p(tags$strong("Exigence DGFiP : "), question$requirement),
      p(tags$strong("Méthode de vérification : "), question$verification_method),
      p(tags$strong("Preuves attendues : "), question$expected_evidence),
      tags$hr(),
      h4("Guide auditeur — preuves à collecter"),
      p("À utiliser comme checklist de collecte avant de répondre à la question."),
      tags$strong("Pièces et traces à demander :"),
      tags$ul(lapply(guidance$to_collect, tags$li)),
      tags$strong("Tests et contrôles à réaliser :"),
      tags$ul(lapply(guidance$tests, tags$li)),
      tags$strong("Échantillonnage :"),
      p(guidance$sampling),
      tags$strong("Règle de conclusion :"),
      tags$ul(lapply(guidance$decision, tags$li))
    )
  })

  observeEvent(input$add_question, {
    req(input$audit_mission, nzchar(trimws(input$question_ref)), nzchar(trimws(input$question_title)))
    tryCatch({
      diam_add_question(
        con, as.integer(input$audit_mission), input$question_ref, input$question_chapter,
        input$question_title, input$question_criticality, input$question_expected
      )
      bump()
    }, error = function(e) showNotification(e$message, type = "error"))
  })

  observeEvent(input$questions_rows_selected, {
    row <- input$questions_rows_selected
    req(length(row) == 1)
    question <- questions_data()[row, ]
    updateSelectInput(session, "answer_status", selected = question$compliance_status)
    updateTextAreaInput(session, "answer_analysis", value = question$answer)
    updateTextAreaInput(session, "answer_comment", value = question$comment)
  })

  observeEvent(input$save_answer, {
    row <- input$questions_rows_selected
    req(length(row) == 1)
    diam_save_answer(
      con, questions_data()$id[[row]], input$answer_status,
      input$answer_analysis, input$answer_comment, user()
    )
    bump()
    showNotification("Évaluation enregistrée.", type = "message")
  })

  evidences_data <- reactive({
    refresh()
    req(input$evidence_mission)
    diam_evidences(con, as.integer(input$evidence_mission))
  })
  output$evidences <- DT::renderDT(
    DT::datatable(evidences_data(), rownames = FALSE, options = list(scrollX = TRUE))
  )
  observe({
    req(input$evidence_mission)
    questions <- diam_questions(con, as.integer(input$evidence_mission))
    choices <- c(
      "Mission (preuve transversale)" = "",
      stats::setNames(questions$id, paste(questions$reference, "—", questions$title))
    )
    updateSelectInput(session, "evidence_question", choices = choices)
  })
  observeEvent(input$upload_evidence, {
    req(input$evidence_mission, input$evidence_file)
    files <- input$evidence_file
    errors <- character()
    for (i in seq_len(nrow(files))) {
      tryCatch(
        diam_add_evidence(
          con, as.integer(input$evidence_mission), files$datapath[[i]],
          files$name[[i]], user(),
          if (nzchar(input$evidence_question %||% "")) {
            as.integer(input$evidence_question)
          } else {
            NULL
          }
        ),
        error = function(e) errors <<- c(errors, e$message)
      )
    }
    bump()
    if (length(errors)) showNotification(paste(errors, collapse = "\n"), type = "error")
    else showNotification("Preuve(s) versée(s).", type = "message")
  })

  finding_questions <- reactive({
    refresh()
    req(input$finding_mission)
    diam_questions(con, as.integer(input$finding_mission))
  })

  audit_evidence_book_data <- reactive({
    refresh()
    req(input$finding_mission)
    diam_audit_evidence_book(con, as.integer(input$finding_mission))
  })
  output$audit_evidence_book <- DT::renderDT(
    {
      data <- audit_evidence_book_data()
      visible <- data[, c(
        "reference", "question", "qualification_base", "qualification_retenue",
        "reponse_statut", "constat", "statut_constat", "preuves_associees"
      ), drop = FALSE]
      DT::datatable(
      visible, rownames = FALSE, selection = "single",
      options = list(pageLength = 8, scrollX = TRUE)
    )
    }
  )

  output$audit_evidence_book_detail <- renderUI({
    row <- input$audit_evidence_book_rows_selected
    if (is.null(row) || length(row) != 1) {
      return(helpText("Sélectionnez une ligne de la chaîne d'audit pour voir le détail probatoire."))
    }
    item <- audit_evidence_book_data()[row, ]
    wellPanel(
      h4(paste(item$reference, "-", item$question)),
      p(tags$strong("Qualification de base PDP/DGFiP : "), item$qualification_base),
      p(tags$strong("Qualification retenue après constat : "), item$qualification_retenue),
      p(tags$strong("Attendu DGFiP : "), item$attendu_dgfip),
      p(tags$strong("Méthode de vérification : "), item$methode_verification),
      p(tags$strong("Preuves attendues : "), item$preuves_attendues),
      p(tags$strong("Réponse client / analyse : "), item$reponse_client),
      p(tags$strong("Commentaire auditeur : "), item$commentaire_auditeur),
      p(tags$strong("Constat : "), paste(item$constat, item$synthese_constat)),
      p(tags$strong("Non-conformités : "), item$non_conformites),
      p(tags$strong("Actions : "), item$actions_correctives),
      p(tags$strong("Preuves associées : "), item$preuves_associees)
    )
  })

  observe({
    q <- finding_questions()
    choices <- if (nrow(q)) {
      stats::setNames(q$id, paste(q$reference, "—", q$title))
    } else {
      character()
    }
    updateSelectInput(
      session, "finding_question",
      choices = choices
    )
  })
  observeEvent(input$finding_question, {
    req(input$finding_question)
    q <- finding_questions()
    selected <- q[q$id == as.integer(input$finding_question), , drop = FALSE]
    if (nrow(selected)) {
      updateSelectInput(session, "finding_risk", selected = selected$criticality[[1]])
    }
  })
  output$finding_question_expected <- renderUI({
    req(input$finding_question)
    q <- finding_questions()
    selected <- q[q$id == as.integer(input$finding_question), , drop = FALSE]
    if (!nrow(selected)) return(NULL)
    guidance <- diam_question_evidence_guidance(selected)
    wellPanel(
      h4("Qualification et preuves attendues pour la question"),
      p(tags$strong("Qualification de base PDP/DGFiP : "), selected$criticality[[1]]),
      p(tags$strong("Attendu DGFiP : "), selected$requirement[[1]]),
      p(tags$strong("Preuves attendues : "), selected$expected_evidence[[1]]),
      tags$strong("Checklist auditeur :"),
      tags$ul(lapply(guidance$to_collect, tags$li))
    )
  })
  findings_data <- reactive({
    refresh()
    req(input$finding_mission)
    diam_findings(con, as.integer(input$finding_mission))
  })
  output$findings <- DT::renderDT(
    DT::datatable(
      findings_data(), rownames = FALSE, selection = "single",
      options = list(scrollX = TRUE)
    )
  )
  observeEvent(input$findings_rows_selected, {
    row <- input$findings_rows_selected
    if (length(row) == 1) {
      updateSelectInput(session, "finding_status", selected = findings_data()$status[[row]])
    }
  })
  observe({
    f <- findings_data()
    choices <- if (nrow(f)) {
      stats::setNames(f$id, paste(f$finding_number, "—", f$summary))
    } else {
      character()
    }
    updateSelectInput(
      session, "nc_finding",
      choices = choices
    )
  })
  observe({
    req(input$finding_mission)
    evidence <- diam_evidences(con, as.integer(input$finding_mission))
    choices <- if (nrow(evidence)) {
      stats::setNames(evidence$id, paste(evidence$evidence_number, "—", evidence$original_name))
    } else {
      character()
    }
    updateSelectInput(session, "finding_evidence", choices = choices)
  })
  observeEvent(input$save_finding, {
    req(input$finding_question, nzchar(trimws(input$finding_summary)))
    diam_save_finding(
      con, as.integer(input$finding_question), input$finding_summary,
      input$finding_risk, input$finding_recommendation, user()
    )
    bump()
  })
  observeEvent(input$link_finding_evidence, {
    row <- input$findings_rows_selected
    req(length(row) == 1, input$finding_evidence)
    diam_link_evidence_to_finding(
      con, findings_data()$id[[row]], as.integer(input$finding_evidence), user()
    )
    bump()
    showNotification("Preuve liée au constat.", type = "message")
  })
  observeEvent(input$set_finding_status, {
    row <- input$findings_rows_selected
    req(length(row) == 1)
    diam_set_finding_status(
      con, findings_data()$id[[row]], input$finding_status,
      user(), input$finding_status_comment
    )
    bump()
    showNotification("Statut du constat mis à jour.", type = "message")
  })

  ncs_data <- reactive({
    refresh()
    req(input$finding_mission)
    diam_non_conformities(con, as.integer(input$finding_mission))
  })
  output$non_conformities <- DT::renderDT(
    DT::datatable(
      ncs_data(), rownames = FALSE, selection = "single",
      options = list(scrollX = TRUE)
    )
  )
  observeEvent(input$non_conformities_rows_selected, {
    row <- input$non_conformities_rows_selected
    if (length(row) == 1) {
      updateSelectInput(session, "nc_status", selected = ncs_data()$status[[row]])
    }
  })
  observe({
    ncs <- ncs_data()
    choices <- if (nrow(ncs)) {
      stats::setNames(ncs$id, paste(ncs$nc_number, "—", ncs$title))
    } else {
      character()
    }
    updateSelectInput(
      session, "action_nc",
      choices = choices
    )
  })
  observeEvent(input$add_nc, {
    req(input$nc_finding, nzchar(trimws(input$nc_title)))
    diam_add_non_conformity(
      con, as.integer(input$nc_finding), input$nc_severity,
      input$nc_title, input$nc_description
    )
    bump()
  })
  observeEvent(input$set_nc_status, {
    row <- input$non_conformities_rows_selected
    req(length(row) == 1)
    diam_set_non_conformity_status(
      con, ncs_data()$id[[row]], input$nc_status, user()
    )
    bump()
    showNotification("Statut de la non-conformité mis à jour.", type = "message")
  })

  actions_data <- reactive({
    refresh()
    req(input$finding_mission)
    diam_actions(con, as.integer(input$finding_mission))
  })
  output$actions <- DT::renderDT(
    DT::datatable(
      actions_data(), rownames = FALSE, selection = "single",
      options = list(scrollX = TRUE)
    )
  )
  observeEvent(input$actions_rows_selected, {
    row <- input$actions_rows_selected
    if (length(row) == 1) {
      updateSelectInput(session, "action_status", selected = actions_data()$status[[row]])
    }
  })
  observeEvent(input$add_action, {
    req(input$action_nc, nzchar(trimws(input$action_text)))
    diam_add_action(
      con, as.integer(input$action_nc), input$action_text, input$action_owner,
      as.character(input$action_due), input$action_priority
    )
    bump()
  })
  observeEvent(input$set_action_status, {
    row <- input$actions_rows_selected
    req(length(row) == 1)
    diam_set_action_status(
      con, actions_data()$id[[row]], input$action_status,
      user(), input$action_status_comment
    )
    bump()
    showNotification("Statut de l'action mis à jour.", type = "message")
  })

  output$history <- DT::renderDT({
    refresh()
    req(input$report_mission)
    DT::datatable(
      diam_history(con, as.integer(input$report_mission)),
      rownames = FALSE, options = list(pageLength = 15, scrollX = TRUE)
    )
  })
  output$audit_opinion <- renderUI({
    refresh()
    req(input$report_mission)
    result <- diam_audit_result(con, as.integer(input$report_mission))
    color <- switch(
      result$opinion,
      "CONFORME" = "#237A3B",
      "CONFORME SOUS RÉSERVES" = "#A66A00",
      "NON CONFORME" = "#A11B1B",
      "#5A6573"
    )
    wellPanel(
      h3(tags$span(result$opinion, style = paste0("color:", color))),
      p(result$reason),
      p(
        tags$strong("Avancement : "), result$completed, "/", result$total,
        " contrôles - ",
        tags$strong("Preuves : "), result$evidences,
        " - ", tags$strong("Non-conformités ouvertes : "), result$open_nc
      )
    )
  })
  output$download_report_docx <- downloadHandler(
    filename = function() paste0("rapport-DIAM-", input$report_mission, ".docx"),
    content = function(file) {
      generated <- diam_generate_report_docx(
        con, as.integer(input$report_mission), generated_by = user()
      )
      file.copy(generated, file, overwrite = TRUE)
    }
  )
  output$download_report_pdf <- downloadHandler(
    filename = function() paste0("rapport-DIAM-", input$report_mission, ".pdf"),
    content = function(file) {
      pdf <- diam_generate_report_pdf(
        con, as.integer(input$report_mission), generated_by = user()
      )
      file.copy(pdf, file, overwrite = TRUE)
    }
  )
  output$download_certificate_docx <- downloadHandler(
    filename = function() paste0("certificat-DIAM-", input$report_mission, ".docx"),
    content = function(file) {
      generated <- diam_generate_certificate_docx(
        con, as.integer(input$report_mission), issued_by = user()
      )
      file.copy(generated, file, overwrite = TRUE)
    }
  )
  output$download_certificate_pdf <- downloadHandler(
    filename = function() paste0("certificat-DIAM-", input$report_mission, ".pdf"),
    content = function(file) {
      pdf <- diam_generate_certificate_pdf(
        con, as.integer(input$report_mission), issued_by = user()
      )
      file.copy(pdf, file, overwrite = TRUE)
    }
  )
  output$download_client_document <- downloadHandler(
    filename = function() {
      document <- selected_client_document()
      req(document)
      document$original_name[[1]]
    },
    content = function(file) {
      document <- selected_client_document()
      req(document)
      source <- document$storage_path[[1]]
      shiny::validate(shiny::need(file.exists(source), "Le fichier stocké est introuvable."))
      file.copy(source, file, overwrite = TRUE)
    }
  )
  output$download_evidence_book <- downloadHandler(
    filename = function() paste0("evidence-book-", input$report_mission, ".csv"),
    content = function(file) {
      utils::write.csv(
        diam_audit_evidence_book(con, as.integer(input$report_mission)),
        file, row.names = FALSE, fileEncoding = "UTF-8"
      )
    }
  )
}
