app_server <- function(input, output, session) {

  missions <- reactiveVal(
    tibble(
      id = character(),
      name = character()
    )
  )

  observeEvent(input$newMission, {

    id <- UUIDgenerate()

    tbl <- missions()

    tbl <- bind_rows(
      tbl,
      tibble(
        id = id,
        name = paste("Mission", nrow(tbl) + 1)
      )
    )

    missions(tbl)

  })

  output$missionSelector <- renderUI({

    selectInput(
      "mission",

      "Mission",

      choices = missions()$name
    )

  })

}
