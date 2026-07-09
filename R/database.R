```r
# ============================================================
# DIAM
# Database Service
# ============================================================

#' Ouverture d'une connexion SQLite
#'
#' @return Objet DBIConnection
#' @export
db_connect <- function() {

  initialize_directories()

  con <- DBI::dbConnect(
    RSQLite::SQLite(),
    dbname = get_database_path()
  )

  DBI::dbExecute(con, "PRAGMA foreign_keys = ON;")
  DBI::dbExecute(con, "PRAGMA journal_mode = WAL;")
  DBI::dbExecute(con, "PRAGMA synchronous = NORMAL;")
  DBI::dbExecute(con, "PRAGMA temp_store = MEMORY;")
  DBI::dbExecute(con, "PRAGMA cache_size = -64000;")

  con

}

#' Fermeture d'une connexion
#'
#' @param con Connexion SQLite
#' @export
db_disconnect <- function(con) {

  if (!is.null(con) && DBI::dbIsValid(con)) {

    DBI::dbDisconnect(con)

  }

  invisible(TRUE)

}

#------------------------------------------------------------
# Exécution SQL
#------------------------------------------------------------

db_execute <- function(
    con,
    sql,
    params = NULL
) {

  tryCatch(

    DBI::dbExecute(
      con,
      sql,
      params = params
    ),

    error = function(e) {

      stop(

        sprintf(
          "Erreur SQL : %s",
          e$message
        ),

        call. = FALSE

      )

    }

  )

}

#------------------------------------------------------------
# Lecture SQL
#------------------------------------------------------------

db_query <- function(
    con,
    sql,
    params = NULL
) {

  tryCatch(

    DBI::dbGetQuery(
      con,
      sql,
      params = params
    ),

    error = function(e) {

      stop(

        sprintf(
          "Erreur SQL : %s",
          e$message
        ),

        call. = FALSE

      )

    }

  )

}

#------------------------------------------------------------
# Transaction
#------------------------------------------------------------

db_transaction <- function(
    con,
    code
) {

  DBI::dbBegin(con)

  result <- tryCatch(

    {

      value <- force(code)

      DBI::dbCommit(con)

      value

    },

    error = function(e) {

      DBI::dbRollback(con)

      stop(e)

    }

  )

  result

}

#------------------------------------------------------------
# Base existante ?
#------------------------------------------------------------

database_exists <- function() {

  file.exists(

    get_database_path()

  )

}

#------------------------------------------------------------
# Initialisation
#------------------------------------------------------------

initialize_database <- function() {

  initialize_directories()

  con <- db_connect()

  on.exit(

    db_disconnect(con),

    add = TRUE

  )

  sql_file <- file.path(

    "sql",

    "schema.sql"

  )

  if (!file.exists(sql_file)) {

    stop(

      "Le fichier sql/schema.sql est introuvable.",

      call. = FALSE

    )

  }

  sql <- paste(

    readLines(
      sql_file,
      warn = FALSE
    ),

    collapse = "\n"

  )

  DBI::dbExecute(

    con,

    sql

  )

  invisible(TRUE)

}

#------------------------------------------------------------
# Vérification
#------------------------------------------------------------

table_exists <- function(
    con,
    table
) {

  table %in%

    DBI::dbListTables(con)

}

#------------------------------------------------------------
# Nombre d'enregistrements
#------------------------------------------------------------

count_rows <- function(
    con,
    table
) {

  sql <- sprintf(

    "SELECT COUNT(*) AS n FROM %s",

    table

  )

  db_query(

    con,

    sql

  )$n

}
```
