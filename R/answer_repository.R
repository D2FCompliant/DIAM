# ============================================================
# DIAM
# Answer Repository
# ============================================================

#------------------------------------------------------------
# Insertion
#------------------------------------------------------------

insert_answer <- function(
    con,
    answer
) {

  sql <- "

INSERT INTO answer (

    uuid,
    question_id,
    answer,
    compliance_status,
    comment,
    answered_by,
    answered_at,
    reviewed_by,
    reviewed_at,
    created_at,
    updated_at

)

VALUES (

?,?,?,?,?,?,?,?,?,?,?

)

"

db_execute(

  con,

  sql,

  params = list(

    answer$uuid,
    answer$question_id,
    answer$answer,
    answer$compliance_status,
    answer$comment,
    answer$answered_by,
    answer$answered_at,
    answer$reviewed_by,
    answer$reviewed_at,
    answer$created_at,
    answer$updated_at

  )

)

invisible(TRUE)

}

#------------------------------------------------------------
# Lecture
#------------------------------------------------------------

get_answer <- function(
    con,
    question_id
) {

  result <- db_query(

    con,

    "

SELECT *

FROM answer

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

update_answer <- function(
    con,
    answer
) {

  sql <- "

UPDATE answer

SET

answer=?,
compliance_status=?,
comment=?,
reviewed_by=?,
reviewed_at=?,
updated_at=?

WHERE uuid=?

"

  db_execute(

    con,

    sql,

    params = list(

      answer$answer,
      answer$compliance_status,
      answer$comment,
      answer$reviewed_by,
      answer$reviewed_at,
      answer$updated_at,
      answer$uuid

    )

  )

}

#------------------------------------------------------------
# Suppression
#------------------------------------------------------------

delete_answer <- function(
    con,
    uuid
) {

  db_execute(

    con,

    "

DELETE

FROM answer

WHERE uuid=?

",

    params = list(uuid)

  )

}

#------------------------------------------------------------
# Existence
#------------------------------------------------------------

answer_exists <- function(
    con,
    question_id
) {

  db_query(

    con,

    "

SELECT COUNT(*) AS n

FROM answer

WHERE question_id=?

",

    params = list(question_id)

  )$n > 0

}
