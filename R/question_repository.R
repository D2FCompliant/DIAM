```r
# ============================================================
# DIAM
# Question Repository
# ============================================================

#------------------------------------------------------------
# Insertion
#------------------------------------------------------------

insert_question <- function(
    con,
    question
) {

  sql <- "

INSERT INTO question (

    uuid,
    mission_id,
    reference,
    chapter,
    title,
    description,
    requirement,
    criticality,
    verification_method,
    expected_evidence,
    status,
    created_at,
    updated_at

)

VALUES (

?,?,?,?,?,?,?,?,?,?,?,?,?

)

"

db_execute(

  con,

  sql,

  params = list(

    question$uuid,

    question$mission_id,

    question$reference,

    question$chapter,

    question$title,

    question$description,

    question$requirement,

    question$criticality,

    question$verification_method,

    question$expected_evidence,

    question$status,

    question$created_at,

    question$updated_at

  )

)

invisible(TRUE)

}

#------------------------------------------------------------
# UUID
#------------------------------------------------------------

get_question <- function(
    con,
    uuid
) {

  result <- db_query(

    con,

    "

SELECT *

FROM question

WHERE uuid = ?

",

    params = list(uuid)

  )

  if (nrow(result) == 0) {

    return(NULL)

  }

  result

}

#------------------------------------------------------------
# ID
#------------------------------------------------------------

get_question_by_id <- function(
    con,
    id
) {

  result <- db_query(

    con,

    "

SELECT *

FROM question

WHERE id = ?

",

    params = list(id)

  )

  if (nrow(result) == 0) {

    return(NULL)

  }

  result

}

#------------------------------------------------------------
# Liste mission
#------------------------------------------------------------

list_questions <- function(
    con,
    mission_id
) {

  db_query(

    con,

    "

SELECT *

FROM question

WHERE mission_id = ?

ORDER BY reference

",

    params = list(mission_id)

  )

}

#------------------------------------------------------------
# Etat
#------------------------------------------------------------

update_question_status <- function(
    con,
    id,
    status
) {

  db_execute(

    con,

    "

UPDATE question

SET

status = ?,
updated_at = datetime('now')

WHERE id = ?

",

    params = list(

      status,

      id

    )

  )

}

#------------------------------------------------------------
# Mise à jour
#------------------------------------------------------------

update_question <- function(
    con,
    question
) {

  sql <- "

UPDATE question

SET

reference=?,
chapter=?,
title=?,
description=?,
requirement=?,
criticality=?,
verification_method=?,
expected_evidence=?,
updated_at=?

WHERE uuid=?

"

  db_execute(

    con,

    sql,

    params = list(

      question$reference,

      question$chapter,

      question$title,

      question$description,

      question$requirement,

      question$criticality,

      question$verification_method,

      question$expected_evidence,

      question$updated_at,

      question$uuid

    )

  )

}

#------------------------------------------------------------
# Suppression
#------------------------------------------------------------

delete_question <- function(
    con,
    uuid
) {

  db_execute(

    con,

    "

DELETE

FROM question

WHERE uuid = ?

",

    params = list(uuid)

  )

}

#------------------------------------------------------------
# Comptage
#------------------------------------------------------------

count_questions <- function(
    con,
    mission_id
) {

  db_query(

    con,

    "

SELECT COUNT(*) AS n

FROM question

WHERE mission_id = ?

",

    params = list(mission_id)

  )$n

}

#------------------------------------------------------------
# Progression
#------------------------------------------------------------

count_completed_questions <- function(
    con,
    mission_id
) {

  db_query(

    con,

    "

SELECT COUNT(*) AS n

FROM question

WHERE mission_id = ?
AND status = 'COMPLETED'

",

    params = list(mission_id)

  )$n

}

#------------------------------------------------------------
# Recherche par référence
#------------------------------------------------------------

find_question_by_reference <- function(
    con,
    mission_id,
    reference
) {

  result <- db_query(

    con,

    "

SELECT *

FROM question

WHERE mission_id = ?
AND reference = ?

",

    params = list(

      mission_id,

      reference

    )

  )

  if (nrow(result) == 0) {

    return(NULL)

  }

  result

}
```
