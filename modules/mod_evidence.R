# ============================================================
# DIAM
# Module Evidence
# ============================================================

mod_evidence_ui <- function(id) {

  ns <- NS(id)

  tagList(

    fluidRow(

      column(

        width = 12,

        h2("Gestion des preuves"),

        tags$hr()

      )

    ),

    fluidRow(

      column(

        width = 12,

        fileInput(

          ns("files"),

          label = "Ajouter une ou plusieurs preuves",

          multiple = TRUE,

          accept = c(

            ".pdf",

            ".png",

            ".jpg",

            ".jpeg",

            ".bmp",

            ".tif",

            ".tiff",

            ".gif",

            ".docx",

            ".xlsx",

            ".csv",

            ".json",

            ".xml",

            ".zip",

            ".log",

            ".txt"

          )

        )

      )

    ),

    br(),

    DT::DTOutput(

      ns("table")

    )

  )

}
# ============================================================
# Server
# ============================================================

mod_evidence_server <- function(
    id,
    mission_uuid
) {

  moduleServer(id, function(input, output, session) {

    ns <- session$ns

    evidences <- reactiveVal(
      tibble::tibble(
        uuid = character(),
        filename = character(),
        original_name = character(),
        extension = character(),
        size = numeric(),
        sha256 = character(),
        created_at = character()
      )
    )

    observeEvent(input$files, {

      req(input$files)

      year_dir <-
        format(Sys.Date(), "%Y")

      evidence_dir <-
        file.path(
          "evidence",
          year_dir,
          mission_uuid
        )

      if (!dir.exists(evidence_dir)) {

        dir.create(
          evidence_dir,
          recursive = TRUE
        )

      }

      current_tbl <-
        evidences()

      for (i in seq_len(nrow(input$files))) {

        file_uuid <-
          UUIDgenerate()

        extension <-
          tools::file_ext(
            input$files$name[i]
          )

        destination <-
          file.path(
            evidence_dir,
            paste0(
              file_uuid,
              ".",
              extension
            )
          )

        file.copy(
          from = input$files$datapath[i],
          to = destination,
          overwrite = FALSE
        )

        sha256 <-
          digest::digest(
            file = destination,
            algo = "sha256"
          )

        current_tbl <-
          dplyr::bind_rows(

            current_tbl,

            tibble::tibble(

              uuid = file_uuid,

              filename = basename(destination),

              original_name = input$files$name[i],

              extension = extension,

              size = input$files$size[i],

              sha256 = sha256,

              created_at =
                format(
                  Sys.time(),
                  "%Y-%m-%d %H:%M:%S"
                )

            )

          )

      }

      evidences(current_tbl)

    })

    output$table <-

      DT::renderDT({

        DT::datatable(

          evidences(),

          rownames = FALSE,

          filter = "top",

          extensions = c("Buttons"),

          options = list(

            pageLength = 15,

            scrollX = TRUE,

            dom = "Bfrtip",

            buttons = c(

              "copy",

              "csv",

              "excel"

            )

          )

        )

      })

  })

}
