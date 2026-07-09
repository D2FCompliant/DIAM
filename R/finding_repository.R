# ============================================================
# DIAM
# Finding Repository
# ============================================================

#------------------------------------------------------------
# Insertion
#------------------------------------------------------------

insert_finding <- function(
    con,
    finding
) {

  sql <- "

INSERT INTO finding (

    uuid,
    question_id,
    auditor_id,
    finding_number,
    summary,
    analysis,
    risk,
    impact,
    recommendation,
    conclusion,
    decision,
    status,
    created_at,
    updated_at,
    validated_by,
    validated_at

)

VALUES (

?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?

)

"

db_execute(

  con,
  sql,

  params = list(

    finding$uuid,
    finding$question_id,
    finding$auditor_id,
    finding$finding_number,
    finding$summary,
    finding$analysis,
    finding$risk,
    finding$impact,
    finding$recommendation,
    finding$conclusion,
    finding$decision,
    finding$status,
    finding$created_at,
    finding$updated_at,
    finding$validated_by,
    finding$validated_at

  )

)

invisible(TRUE)

}

#------------------------------------------------------------
# Lecture
#------------------------------------------------------------

get_finding <- function(
    con,
    question_id
) {

  result <- db_query(

    con,

    "

SELECT *

FROM finding

WHERE question_id = ?

",

    params = list(question_id)

  )

  if (nrow(result) == 0) {

    return(NULL)

  }

  result

}

#------------------------------------------------------------
# Mise à jour
#------------------------------------------------------------

update_finding <- function(
    con,
    finding
) {

  sql <- "

UPDATE finding

SET

summary=?,
analysis=?,
risk=?,
impact=?,
recommendation=?,
conclusion=?,
decision=?,
status=?,
updated_at=?,
validated_by=?,
validated_at=?

WHERE uuid=?

"

  db_execute(

    con,

    sql,

    params = list(

      finding$summary,
      finding$analysis,
      finding$risk,
      finding$impact,
      finding$recommendation,
      finding$conclusion,
      finding$decision,
      finding$status,
      finding$updated_at,
      finding$validated_by,
      finding$validated_at,
      finding$uuid

    )

  )

}

#------------------------------------------------------------
# Suppression
#------------------------------------------------------------

delete_finding <- function(
    con,
    uuid
) {

  db_execute(

    con,

    "

DELETE FROM finding

WHERE uuid = ?

",

    params = list(uuid)

  )

}

#------------------------------------------------------------
# Existence
#------------------------------------------------------------

finding_exists <- function(
    con,
    question_id
) {

  db_query(

    con,

    "

SELECT COUNT(*) AS n

FROM finding

WHERE question_id = ?

",

    params = list(question_id)

  )$n > 0

}

#------------------------------------------------------------
# Liste Mission
#------------------------------------------------------------

list_findings <- function(
    con,
    mission_id
) {

  db_query(

    con,

    "

SELECT

f.*,
q.reference,
q.title

FROM finding f

INNER JOIN question q
ON q.id = f.question_id

WHERE q.mission_id = ?

ORDER BY q.reference

",

    params = list(mission_id)

  )

}
