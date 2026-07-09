# ============================================================
# DIAM
# Module Mission
# ============================================================

#------------------------------------------------------------
# UI
#------------------------------------------------------------

mod_mission_ui <- function(id) {

  ns <- NS(id)

  tagList(

    fluidRow(

      column(

        width = 12,

        h2("Gestion des missions"),

        tags$hr()

      )

    ),

    fluidRow(

      column(

        width = 4,

        textInput(

          ns("title"),

          "Titre de la mission"

        )

      ),

      column(

        width = 4,

        textInput(

          ns("scope"),

          "Périmètre"

        )

      ),

      column(

        width = 2,

        actionButton(

          ns("create"),

          "Créer",

          class = "btn-primary"

        )

      )

    ),

    br(),

    reactable::reactableOutput(

      ns("missions")

    )

  )

}

#------------------------------------------------------------
# SERVER
#------------------------------------------------------------

mod_mission_server <- function(
    id,
    con,
    current_user
) {

  moduleServer(

    id,

    function(input, output, session) {

      refresh <- reactiveVal(0)

      load_data <- reactive({

        refresh()

        list_missions(con)

      })

      observeEvent(

        input$create,

        {

          req(input$title)

          create_mission(

            con = con,

            client_id = 1,

            referential_id = 1,

            title = input$title,

            scope = input$scope,

            created_by = current_user

          )

          refresh(

            refresh() + 1

          )

          showNotification(

            "Mission créée.",

            type = "message"

          )

        }

      )

      output$missions <-

        reactable::renderReactable({

          reactable::reactable(

            load_data(),

            searchable = TRUE,

            sortable = TRUE,

            striped = TRUE,

            bordered = TRUE,

            highlight = TRUE,

            pagination = TRUE,

            defaultPageSize = 15,

            columns = list(

              number = reactable::colDef(

                name = "Mission"

              ),

              client = reactable::colDef(

                name = "Client"

              ),

              referential = reactable::colDef(

                name = "Référentiel"

              ),

              progress = reactable::colDef(

                name = "Progression"

              ),

              status = reactable::colDef(

                name = "Etat"

              )

            )

          )

        })

    }

  )

}
