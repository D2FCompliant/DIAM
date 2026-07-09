# ============================================================
# DIAM
# Configuration
# ============================================================

#' Configuration globale de l'application DIAM
#'
#' Toutes les constantes de l'application sont regroupées ici.
#' Les autres fichiers doivent utiliser cette configuration
#' plutôt que des chemins codés en dur.
#'
#' @noRd

app_config <- list(

  # ----------------------------------------------------------
  # Informations générales
  # ----------------------------------------------------------

  app_name = "DIAM",

  version = "0.1.0",

  organisation = "D2F Compliant",

  # ----------------------------------------------------------
  # Base SQLite
  # ----------------------------------------------------------

  database = list(

    directory = "data",

    file = "diam.sqlite"

  ),

  # ----------------------------------------------------------
  # Répertoires de travail
  # ----------------------------------------------------------

  directories = list(

    reports = "reports",

    archive = "archive",

    evidence = "evidence",

    client_documents = "client_documents",

    logs = "logs",

    temp = "tmp"

  ),

  # ----------------------------------------------------------
  # Upload
  # ----------------------------------------------------------

  upload = list(

    max_size = 500 * 1024^2

  )

)

# ------------------------------------------------------------
# Accès au chemin de la base
# ------------------------------------------------------------

get_database_path <- function() {

  file.path(

    app_config$database$directory,

    app_config$database$file

  )

}

# ------------------------------------------------------------
# Création automatique des dossiers
# ------------------------------------------------------------

initialize_directories <- function() {

  dirs <- c(

    app_config$database$directory,

    app_config$directories$reports,

    app_config$directories$archive,

    app_config$directories$evidence,

    app_config$directories$client_documents,

    app_config$directories$logs,

    app_config$directories$temp

  )

  purrr::walk(

    dirs,

    fs::dir_create,

    recurse = TRUE

  )

  invisible(TRUE)

}
