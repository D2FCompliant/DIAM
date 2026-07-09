options(shiny.maxRequestSize = 500 * 1024^2)

library(shiny)

source("R/app_ui.R")
source("R/app_server.R")
source("R/config.R")
source("R/database.R")

initialize_database()

shinyApp(
  ui = app_ui(),
  server = app_server
)
