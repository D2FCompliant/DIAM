app_ui <- function() {

  fluidPage(

    theme = bs_theme(
      version = 5,
      bootswatch = "flatly"
    ),

    titlePanel("DIAM"),

    sidebarLayout(

      sidebarPanel(

        h3("Mission"),

        actionButton(
          "newMission",
          "Nouvelle mission",
          class = "btn-primary"
        ),

        hr(),

        uiOutput("missionSelector")

      ),

      mainPanel(

        h2("Bienvenue dans DIAM"),

        hr(),

        h4("DGFiP Audit Manager"),

        p(
          "Sprint 0 : Fondation"
        )

      )

    )

  )

}
