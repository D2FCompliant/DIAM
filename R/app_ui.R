app_ui <- function() {
  navbarPage(
    title = "DIAM",
    theme = bslib::bs_theme(version = 5, bootswatch = "flatly"),
    header = tags$div(
      class = "container-fluid bg-light border-bottom py-2",
      tags$span("DGFiP Integrity Audit Manager", class = "text-muted"),
      tags$span("Auditeur : "),
      textInput("current_user", NULL, value = "Auditeur DIAM", width = "220px")
    ),
    tabPanel(
      "Tableau de bord",
      fluidPage(
        h2("Pilotage des audits"),
        uiOutput("dashboard_cards"),
        h3("Missions"),
        DT::DTOutput("dashboard_missions")
      )
    ),
    tabPanel(
      "Missions",
      fluidPage(
        h2("Créer et piloter une mission"),
        fluidRow(
          column(3, textInput("mission_title", "Titre")),
          column(3, textInput("mission_client", "Client")),
          column(2, textInput("mission_ref", "Référentiel", value = "DGFiP")),
          column(3, textInput("mission_scope", "Périmètre")),
          column(1, br(), actionButton("create_mission", "Créer", class = "btn-primary"))
        ),
        fluidRow(
          column(3, dateInput("mission_period_start", "Début de période auditée")),
          column(3, dateInput("mission_period_end", "Fin de période auditée"))
        ),
        DT::DTOutput("missions"),
        fluidRow(
          column(
            4,
            selectInput(
              "mission_status", "Nouvel état",
              c("CREATED", "IN_PROGRESS", "REVIEW", "APPROVED", "CLOSED", "CANCELLED")
            )
          ),
          column(2, br(), actionButton("set_mission_status", "Mettre à jour"))
        )
      )
    ),
    tabPanel(
      "Questionnaire",
      fluidPage(
        h2("Questionnaire et évaluation"),
        p(
          "Chaque nouvelle mission est préchargée avec le questionnaire DGFiP v1.3,",
          "approfondi par les contrôles techniques PDP Integrity v3.2."
        ),
        selectInput("audit_mission", "Mission", choices = character()),
        fluidRow(
          column(2, textInput("question_ref", "Référence")),
          column(2, textInput("question_chapter", "Chapitre")),
          column(3, textInput("question_title", "Question")),
          column(2, selectInput("question_criticality", "Criticité", c("LOW", "MEDIUM", "HIGH", "CRITICAL"))),
          column(2, textInput("question_expected", "Preuve attendue")),
          column(1, br(), actionButton("add_question", "Ajouter"))
        ),
        DT::DTOutput("questions"),
        uiOutput("question_detail"),
        wellPanel(
          h4("Évaluation de la question sélectionnée"),
          fluidRow(
            column(
              3,
              selectInput(
                "answer_status", "Conformité",
                c("COMPLIANT", "PARTIALLY_COMPLIANT", "NON_COMPLIANT", "NOT_APPLICABLE")
              )
            ),
            column(4, textAreaInput("answer_analysis", "Analyse", width = "100%")),
            column(4, textAreaInput("answer_comment", "Commentaire", width = "100%")),
            column(1, br(), actionButton("save_answer", "Enregistrer", class = "btn-success"))
          )
        )
      )
    ),
    tabPanel(
      "Preuves",
      fluidPage(
        h2("Evidence Book"),
        selectInput("evidence_mission", "Mission", choices = character()),
        selectInput(
          "evidence_question", "Contrôle associé",
          choices = character()
        ),
        fileInput("evidence_file", "Importer une preuve", multiple = TRUE),
        actionButton("upload_evidence", "Verser au dossier", class = "btn-primary"),
        DT::DTOutput("evidences")
      )
    ),
    tabPanel(
      "Constats & actions",
      fluidPage(
        h2("Constats, non-conformités et plan d'action"),
        selectInput("finding_mission", "Mission", choices = character()),
        h4("Créer ou modifier un constat depuis une question"),
        fluidRow(
          column(3, selectInput("finding_question", "Question", choices = character())),
          column(3, textInput("finding_summary", "Synthèse")),
          column(2, selectInput("finding_risk", "Risque", c("LOW", "MEDIUM", "HIGH", "CRITICAL"))),
          column(3, textInput("finding_recommendation", "Recommandation")),
          column(1, br(), actionButton("save_finding", "Enregistrer"))
        ),
        DT::DTOutput("findings"),
        h4("Déclarer une non-conformité"),
        fluidRow(
          column(3, selectInput("nc_finding", "Constat", choices = character())),
          column(2, selectInput("nc_severity", "Sévérité", c("MINOR", "MAJOR", "CRITICAL"))),
          column(3, textInput("nc_title", "Titre")),
          column(3, textInput("nc_description", "Description")),
          column(1, br(), actionButton("add_nc", "Créer"))
        ),
        DT::DTOutput("non_conformities"),
        h4("Ajouter une action corrective"),
        fluidRow(
          column(2, selectInput("action_nc", "Non-conformité", choices = character())),
          column(3, textInput("action_text", "Action")),
          column(2, textInput("action_owner", "Responsable")),
          column(2, dateInput("action_due", "Échéance")),
          column(2, selectInput("action_priority", "Priorité", c("LOW", "MEDIUM", "HIGH"))),
          column(1, br(), actionButton("add_action", "Ajouter"))
        ),
        DT::DTOutput("actions")
      )
    ),
    tabPanel(
      "Rapport & journal",
      fluidPage(
        h2("Restitution et traçabilité"),
        selectInput("report_mission", "Mission", choices = character()),
        uiOutput("audit_opinion"),
        fluidRow(
          column(3, downloadButton("download_report_docx", "Rapport Word")),
          column(3, downloadButton("download_report_pdf", "Rapport PDF")),
          column(3, downloadButton("download_certificate_docx", "Certificat Word")),
          column(3, downloadButton("download_certificate_pdf", "Certificat PDF"))
        ),
        br(),
        downloadButton("download_evidence_book", "Registre des preuves CSV"),
        h3("Journal d'audit"),
        DT::DTOutput("history")
      )
    )
  )
}
