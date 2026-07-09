```r
# ============================================================
# DIAM
# Module Question
# ============================================================

mod_question_ui <- function(id) {

  ns <- NS(id)

  tagList(

    fluidRow(

      column(
        12,
        h2("Questions d'audit"),
        tags$hr()
      )

    ),

    fluidRow(

      column(
        3,
        textInput(
          ns("filter"),
          "Recherche"
        )
      ),

      column(
        2,
        selectInput(
          ns("status"),
          "Etat",
          choices = c(
            "Tous",
            "NOT_STARTED",
            "IN_PROGRESS",
            "COMPLETED"
          )
        )
      )

    ),

    reactable::reactableOutput(
      ns("questions")
    )

  )

}

mod_question_server <- function(
    id,
    con,
    mission_id
) {

  moduleServer(

    id,

    function(input, output, session) {

      refresh <- reactiveVal(0)

      questions <- reactive({

        refresh()

        get_questions(
          con,
          mission_id
        )

      })

      filtered_questions <- reactive({

        data <- questions()

        if (input$status != "Tous") {

          data <-

            data |>

            dplyr::filter(

              status == input$status

            )

        }

        if (nzchar(input$filter)) {

          pattern <-

            stringr::str_to_lower(
              input$filter
            )

          data <-

            data |>

            dplyr::filter(

              stringr::str_detect(

                stringr::str_to_lower(title),

                pattern

              ) |

                stringr::str_detect(

                  stringr::str_to_lower(reference),

                  pattern

                )

            )

        }

        data

      })

      output$questions <-

        reactable::renderReactable({

          reactable::reactable(

            filtered_questions(),

            searchable = FALSE,

            striped = TRUE,

            bordered = TRUE,

            highlight = TRUE,

            pagination = TRUE,

            defaultPageSize = 20,

            selection = "single",

            columns = list(

              reference = reactable::colDef(
                name = "Référence",
                minWidth = 120
              ),

              chapter = reactable::colDef(
                name = "Chapitre",
                minWidth = 120
              ),

              title = reactable::colDef(
                name = "Question"
              ),

              criticality = reactable::colDef(
                name = "Criticité"
              ),

              status = reactable::colDef(
                name = "Etat"
              )

            )

          )

        })

      selected_question <- reactive({

        index <-

          getReactableState(

            "questions",

            "selected"

          )

        req(index)

        filtered_questions()[index, ]

      })

      return(

        list(

          refresh = function() {

            refresh(

              refresh() + 1

            )

          },

          selected_question = selected_question

        )

      )

    }

  )

}
```
