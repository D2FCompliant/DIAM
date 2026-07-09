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
    wellPanel(
      h4(paste(question$reference, "-", question$title)),
      p(tags$strong("Source et correspondance : "), question$description),
      p(tags$strong("Exigence DGFiP : "), question$requirement),
      p(tags$strong("Méthode de vérification : "), question$verification_method),
      p(tags$strong("Preuves attendues : "), question$expected_evidence)
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
  findings_data <- reactive({
    refresh()
    req(input$finding_mission)
    diam_findings(con, as.integer(input$finding_mission))
  })
  output$findings <- DT::renderDT(
    DT::datatable(findings_data(), rownames = FALSE, options = list(scrollX = TRUE))
  )
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
  observeEvent(input$save_finding, {
    req(input$finding_question, nzchar(trimws(input$finding_summary)))
    diam_save_finding(
      con, as.integer(input$finding_question), input$finding_summary,
      input$finding_risk, input$finding_recommendation, user()
    )
    bump()
  })

  ncs_data <- reactive({
    refresh()
    req(input$finding_mission)
    diam_non_conformities(con, as.integer(input$finding_mission))
  })
  output$non_conformities <- DT::renderDT(
    DT::datatable(ncs_data(), rownames = FALSE, options = list(scrollX = TRUE))
  )
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

  actions_data <- reactive({
    refresh()
    req(input$finding_mission)
    diam_actions(con, as.integer(input$finding_mission))
  })
  output$actions <- DT::renderDT(
    DT::datatable(actions_data(), rownames = FALSE, options = list(scrollX = TRUE))
  )
  observeEvent(input$add_action, {
    req(input$action_nc, nzchar(trimws(input$action_text)))
    diam_add_action(
      con, as.integer(input$action_nc), input$action_text, input$action_owner,
      as.character(input$action_due), input$action_priority
    )
    bump()
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
  output$download_evidence_book <- downloadHandler(
    filename = function() paste0("evidence-book-", input$report_mission, ".csv"),
    content = function(file) {
      utils::write.csv(
        diam_evidences(con, as.integer(input$report_mission)),
        file, row.names = FALSE, fileEncoding = "UTF-8"
      )
    }
  )
}
