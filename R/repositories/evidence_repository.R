# ============================================================
# DIAM
# Evidence Repository
# ============================================================

#------------------------------------------------------------
# Insertion
#------------------------------------------------------------

insert_evidence <- function(
    con,
    evidence
) {

  stopifnot(DBI::dbIsValid(con))

  sql <- "

INSERT INTO evidence (

    uuid,
    mission_id,
    evidence_number,
    original_name,
    stored_name,
    description,
    extension,
    mime_type,
    document_type,
    file_size,
    sha256,
    sha512,
    version,
    status,
    uploaded_by,
    uploaded_at,
    archive_path,
    signature,
    comments,
    created_at,
    updated_at

)

VALUES (

?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?

)

"

db_execute(

  con,
  sql,

  params = list(

    evidence$uuid,

    evidence$mission_id,

    evidence$evidence_number,

    evidence$original_name,

    evidence$stored_name,

    evidence$description,

    evidence$extension,

    evidence$mime_type,

    evidence$document_type,

    evidence$file_size,

    evidence$sha256,

    evidence$sha512,

    evidence$version,

    evidence$status,

    evidence$uploaded_by,

    evidence$uploaded_at,

    evidence$archive_path,

    evidence$signature,

    evidence$comments,

    evidence$created_at,

    evidence$updated_at

  )

)

invisible(evidence$uuid)

}

#------------------------------------------------------------
# Recherche par UUID
#------------------------------------------------------------

get_evidence <- function(
    con,
    uuid
) {

  sql <- "

SELECT *

FROM evidence

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
# Liste d'une mission
#------------------------------------------------------------

list_evidences <- function(
    con,
    mission_id
) {

  sql <- "

SELECT *

FROM evidence

WHERE mission_id = ?

ORDER BY evidence_number

"

  db_query(

    con,

    sql,

    params = list(mission_id)

  )

}

#------------------------------------------------------------
# Suppression logique
#------------------------------------------------------------

delete_evidence <- function(
    con,
    uuid
) {

  sql <- "

UPDATE evidence

SET

status='DELETED',

updated_at=datetime('now')

WHERE uuid=?

"

  db_execute(

    con,

    sql,

    params = list(uuid)

  )

}

#------------------------------------------------------------
# Modification du commentaire
#------------------------------------------------------------

update_evidence_comment <- function(
    con,
    uuid,
    comments
) {

  sql <- "

UPDATE evidence

SET

comments=?,

updated_at=datetime('now')

WHERE uuid=?

"

  db_execute(

    con,

    sql,

    params = list(

      comments,

      uuid

    )

  )

}

#------------------------------------------------------------
# Vérification doublon SHA256
#------------------------------------------------------------

exists_sha256 <- function(
    con,
    sha256
) {

  sql <- "

SELECT COUNT(*) AS n

FROM evidence

WHERE sha256 = ?

AND status <> 'DELETED'

"

  db_query(

    con,

    sql,

    params = list(sha256)

  )$n > 0

}

#------------------------------------------------------------
# Nombre de preuves d'une mission
#------------------------------------------------------------

count_evidences <- function(
    con,
    mission_id
) {

  sql <- "

SELECT COUNT(*) AS n

FROM evidence

WHERE mission_id=?

"

  db_query(

    con,

    sql,

    params = list(mission_id)

  )$n

}
