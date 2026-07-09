```r
# ============================================================
# DIAM
# Mission Repository
# ============================================================

#------------------------------------------------------------
# Insertion
#------------------------------------------------------------

insert_mission <- function(
    con,
    mission
) {

  sql <- "

INSERT INTO mission (

    uuid,
    number,
    client_id,
    referential_id,
    title,
    scope,
    audit_period_start,
    audit_period_end,
    start_date,
    end_date,
    status,
    progress,
    report_version,
    created_by,
    created_at,
    updated_at

)

VALUES (

?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?

)

"

db_execute(

  con,

  sql,

  params = list(

    mission$uuid,

    mission$number,

    mission$client_id,

    mission$referential_id,

    mission$title,

    mission$scope,

    mission$audit_period_start,

    mission$audit_period_end,

    mission$start_date,

    mission$end_date,

    mission$status,

    mission$progress,

    mission$report_version,

    mission$created_by,

    mission$created_at,

    mission$updated_at

  )

)

invisible(TRUE)

}

#------------------------------------------------------------
# Recherche UUID
#------------------------------------------------------------

get_mission <- function(
    con,
    uuid
) {

  sql <- "

SELECT *

FROM mission

WHERE uuid = ?

"

  result <- db_query(

    con,

    sql,

    params = list(uuid)

  )

  if (nrow(result) == 0) {

    return(NULL)

  }

  result

}

#------------------------------------------------------------
# Recherche ID
#------------------------------------------------------------

get_mission_by_id <- function(
    con,
    id
) {

  sql <- "

SELECT *

FROM mission

WHERE id = ?

"

  result <- db_query(

    con,

    sql,

    params = list(id)

  )

  if (nrow(result) == 0) {

    return(NULL)

  }

  result

}

#------------------------------------------------------------
# Liste
#------------------------------------------------------------

list_missions <- function(con) {

  sql <- "

SELECT

m.*,

c.name AS client,

r.code AS referential

FROM mission m

LEFT JOIN client c

ON c.id = m.client_id

LEFT JOIN referential r

ON r.id = m.referential_id

ORDER BY m.created_at DESC

"

  db_query(

    con,

    sql

  )

}

#------------------------------------------------------------
# Mise à jour
#------------------------------------------------------------

update_mission <- function(
    con,
    mission
) {

  sql <- "

UPDATE mission

SET

title=?,
scope=?,
audit_period_start=?,
audit_period_end=?,
start_date=?,
end_date=?,
status=?,
progress=?,
report_version=?,
updated_at=?

WHERE uuid=?

"

  db_execute(

    con,

    sql,

    params = list(

      mission$title,

      mission$scope,

      mission$audit_period_start,

      mission$audit_period_end,

      mission$start_date,

      mission$end_date,

      mission$status,

      mission$progress,

      mission$report_version,

      mission$updated_at,

      mission$uuid

    )

  )

}

#------------------------------------------------------------
# Suppression
#------------------------------------------------------------

delete_mission <- function(
    con,
    uuid
) {

  sql <- "

DELETE

FROM mission

WHERE uuid=?

"

  db_execute(

    con,

    sql,

    params = list(uuid)

  )

}

#------------------------------------------------------------
# Progression
#------------------------------------------------------------

update_progress <- function(
    con,
    uuid,
    progress
) {

  sql <- "

UPDATE mission

SET

progress=?,
updated_at=datetime('now')

WHERE uuid=?

"

  db_execute(

    con,

    sql,

    params = list(

      progress,

      uuid

    )

  )

}

#------------------------------------------------------------
# Numéro métier
#------------------------------------------------------------

mission_number_exists <- function(
    con,
    number
) {

  sql <- "

SELECT COUNT(*) AS n

FROM mission

WHERE number=?

"

  db_query(

    con,

    sql,

    params = list(number)

  )$n > 0

}
```
