# ============================================================
# DIAM
# Audit Log Service
# ============================================================

#------------------------------------------------------------
# Journalisation
#------------------------------------------------------------

log_action <- function(
    con,
    mission_id = NULL,
    action,
    object_type,
    object_uuid,
    user,
    details = NULL
) {

  stopifnot(DBI::dbIsValid(con))

  sql <- "

INSERT INTO audit_log (

    uuid,
    mission_id,
    user_name,
    action,
    object_type,
    object_uuid,
    timestamp,
    details

)

VALUES (

?,?,?,?,?,?,?,?

)

"

db_execute(

  con,

  sql,

  params = list(

    UUIDgenerate(),

    mission_id,

    user,

    action,

    object_type,

    object_uuid,

    as.character(Sys.time()),

    details

  )

)

invisible(TRUE)

}

#------------------------------------------------------------
# Historique d'un objet
#------------------------------------------------------------

get_object_history <- function(
    con,
    object_uuid
) {

  sql <- "

SELECT

timestamp,
user_name,
action,
details

FROM audit_log

WHERE object_uuid = ?

ORDER BY timestamp DESC

"

  db_query(

    con,

    sql,

    params = list(object_uuid)

  )

}

#------------------------------------------------------------
# Historique d'une mission
#------------------------------------------------------------

get_mission_history <- function(
    con,
    mission_id
) {

  sql <- "

SELECT

timestamp,
user_name,
action,
object_type,
details

FROM audit_log

WHERE mission_id = ?

ORDER BY timestamp DESC

"

  db_query(

    con,

    sql,

    params = list(mission_id)

  )

}

#------------------------------------------------------------
# Dernières actions
#------------------------------------------------------------

get_last_actions <- function(
    con,
    n = 100
) {

  sql <- sprintf(

    "

SELECT *

FROM audit_log

ORDER BY timestamp DESC

LIMIT %d

",

    as.integer(n)

  )

  db_query(

    con,

    sql

  )

}

#------------------------------------------------------------
# Purge
#------------------------------------------------------------

purge_audit_log <- function(
    con,
    before
) {

  sql <- "

DELETE

FROM audit_log

WHERE timestamp < ?

"

  db_execute(

    con,

    sql,

    params = list(before)

  )

}
