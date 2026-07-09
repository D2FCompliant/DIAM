# ============================================================
# DIAM
# Module Answer
# ============================================================

mod_answer_ui <- function(id) {

  ns <- NS(id)

  tagList(

    h3("Evaluation"),

    radioButtons(

      ns("status"),

      "Conformité",

      choices = c(

        "Conforme" = "COMPLIANT",

        "Partiellement conforme" = "PARTIALLY_COMPLIANT",

        "Non conforme" = "NON_COMPLIANT",

        "Non applicable" = "NOT_APPLICABLE",

        "Non commencé" = "NOT_STARTED"

      )

    ),

    textAreaInput(

      ns("answer"),

      "Analyse",

      rows = 10,

      width = "100%"

    ),

    textAreaInput(

      ns("comment"),

      "Commentaires",

      rows = 6,

      width = "100%"

    ),

    actionButton(

      ns("save"),

      "Enregistrer",

      class = "btn-success"

    )

  )

}

mod_answer_server <- function(
    id,
    con,
    question_id,
    current_user
) {

  moduleServer(

    id,

    function(input, output, session) {

      observe({

        answer <-

          load_answer(

            con,

            question_id()

          )

        if (!is.null(answer)) {

          updateRadioButtons(

            session,

            "status",

            selected = answer$compliance_status

          )

          updateTextAreaInput(

            session,

            "answer",

            value = answer$answer

          )

          updateTextAreaInput(

            session,

            "comment",

            value = answer$comment

          )

        }

      })

      observeEvent(

        input$save,

        {

          validate_answer(

            input$answer,

            input$status

          )

          save_answer(

            con = con,

            question_id = question_id(),

            answer = input$answer,

            compliance_status = input$status,

            comment = input$comment,

            user = current_user

          )

          showNotification(

            "Réponse enregistrée.",

            type = "message"

          )

        }

      )

    }

  )

}
