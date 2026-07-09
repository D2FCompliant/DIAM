```r
# ============================================================
# DIAM
# Workflow History Service
# ============================================================

#------------------------------------------------------------
# Historisation d'un changement d'état
#------------------------------------------------------------

add_workflow_history <- function(
    con,
    mission_id,
    object_type,
    object_id,
    previous_status,
    new_status,
    changed_by,
    comments = NULL
) {

  sql <- "

INSERT INTO workflow_history (

    uuid,
    mission_id,
    object_type,
    object_id,
    previous_status,
    new_status,
    changed_by,
    changed_at,
    comments

)

VALUES (

?,?,?,?,?,?,?,?,?

)

"

db_execute(

  con,

  sql,

  params = list(

    UUIDgenerate(),

    mission_id,

    object_type,

    object_id,

    previous_status,

    new_status,

    changed_by,

    as.character(Sys.time()),

    comments

  )

)

invisible(TRUE)

}

#------------------------------------------------------------
# Historique d'un objet
#------------------------------------------------------------

get_workflow_history <- function(
    con,
    object_type,
    object_id
) {

  sql <- "

SELECT

    previous_status,
    new_status,
    changed_by,
    changed_at,
    comments

FROM workflow_history

WHERE object_type = ?
AND object_id = ?

ORDER BY changed_at DESC

"

  db_query(

    con,

    sql,

    params = list(

      object_type,

      object_id

    )

  )

}

#------------------------------------------------------------
# Historique d'une mission
#------------------------------------------------------------

get_mission_workflow <- function(
    con,
    mission_id
) {

  sql <- "

SELECT *

FROM workflow_history

WHERE mission_id = ?

ORDER BY changed_at DESC

"

  db_query(

    con,

    sql,

    params = list(

      mission_id

    )

  )

}

#------------------------------------------------------------
# Changement d'état générique
#------------------------------------------------------------

change_status <- function(
    con,
    table,
    id,
    status,
    user,
    mission_id = NULL
) {

  current <- db_query(

    con,

    sprintf(

      "SELECT status FROM %s WHERE id = ?",

      table

    ),

    params = list(id)

  )

  if (nrow(current) == 0) {

    stop("Objet introuvable.")

  }

  previous <- current$status[1]

  db_execute(

    con,

    sprintf(

      "

UPDATE %s

SET

status = ?,
updated_at = datetime('now')

WHERE id = ?

",

      table

    ),

    params = list(

      status,

      id

    )

  )

  add_workflow_history(

    con = con,

    mission_id = mission_id,

    object_type = toupper(table),

    object_id = id,

    previous_status = previous,

    new_status = status,

    changed_by = user

  )

  invisible(TRUE)

}

#------------------------------------------------------------
# Etats autorisés
#------------------------------------------------------------

is_valid_transition <- function(
    previous,
    next
) {

  workflow <- list(

    CREATED = c(
      "IN_PROGRESS",
      "CANCELLED"
    ),

    IN_PROGRESS = c(
      "REVIEW",
      "SUSPENDED",
      "CANCELLED"
    ),

    REVIEW = c(
      "APPROVED",
      "REJECTED"
    ),

    APPROVED = c(
      "CLOSED"
    ),

    CLOSED = character(),

    CANCELLED = character(),

    REJECTED = c(
      "IN_PROGRESS"
    ),

    SUSPENDED = c(
      "IN_PROGRESS"
    )

  )

  next %in%

    workflow[[previous]]

}
```
