```r
# ============================================================
# DIAM
# Evidence Service
# ============================================================

#------------------------------------------------------------
# Numérotation métier
#------------------------------------------------------------

generate_evidence_number <- function(con) {

  year <- format(Sys.Date(), "%Y")

  sql <- "

SELECT value

FROM settings

WHERE key='evidence_number'

"

  current <- db_query(con, sql)

  if (nrow(current) == 0) {

    stop("Le compteur evidence_number est absent.")

  }

  number <- as.integer(current$value)

  number <- number + 1

  db_execute(

    con,

    "

UPDATE settings

SET value=?,
    updated_at=datetime('now')

WHERE key='evidence_number'

",

    params = list(number)

  )

  sprintf(

    "EVD-%s-%06d",

    year,

    number

  )

}

#------------------------------------------------------------
# Construction de l'objet métier
#------------------------------------------------------------

build_evidence <- function(

  mission_id,

  uploaded_by,

  metadata,

  storage_path

) {

  tibble::tibble(

    uuid = metadata$uuid,

    mission_id = mission_id,

    evidence_number = NA_character_,

    original_name = metadata$original_name,

    stored_name = basename(storage_path),

    description = "",

    extension = metadata$extension,

    mime_type = metadata$mime,

    document_type = detect_evidence_type(

      metadata$original_name

    ),

    file_size = metadata$size,

    sha256 = as.character(metadata$sha256),

    sha512 = NA_character_,

    version = 1L,

    status = "ACTIVE",

    uploaded_by = uploaded_by,

    uploaded_at = as.character(Sys.time()),

    archive_path = storage_path,

    signature = NA_character_,

    comments = "",

    created_at = as.character(Sys.time()),

    updated_at = as.character(Sys.time())

  )

}

#------------------------------------------------------------
# Import complet
#------------------------------------------------------------

add_evidence <- function(

  con,

  mission_id,

  source_file,

  uploaded_by

) {

  stopifnot(

    file.exists(source_file)

  )

  metadata <- analyse_file(

    source_file

  )

  if (

    exists_sha256(

      con,

      as.character(metadata$sha256)

    )

  ) {

    stop(

      "Cette preuve existe déjà."

    )

  }

  storage_path <-

    store_file(

      source_file,

      mission_id

    )

  evidence <-

    build_evidence(

      mission_id = mission_id,

      uploaded_by = uploaded_by,

      metadata = metadata,

      storage_path = storage_path

    )

  db_transaction(

    con,

    {

      evidence$evidence_number <-

        generate_evidence_number(

          con

        )

      insert_evidence(

        con,

        evidence

      )

      log_action(

        con = con,

        mission_id = mission_id,

        action = "IMPORT_EVIDENCE",

        object_type = "EVIDENCE",

        object_uuid = evidence$uuid,

        user = uploaded_by,

        details = evidence$original_name

      )

    }

  )

  evidence

}

#------------------------------------------------------------
# Import multiple
#------------------------------------------------------------

add_evidences <- function(

  con,

  mission_id,

  files,

  uploaded_by

) {

  purrr::map_dfr(

    files,

    \(x)

    add_evidence(

      con = con,

      mission_id = mission_id,

      source_file = x,

      uploaded_by = uploaded_by

    )

  )

}

#------------------------------------------------------------
# Suppression logique
#------------------------------------------------------------

remove_evidence <- function(

  con,

  uuid,

  user

) {

  delete_evidence(

    con,

    uuid

  )

  log_action(

    con = con,

    mission_id = NULL,

    action = "DELETE_EVIDENCE",

    object_type = "EVIDENCE",

    object_uuid = uuid,

    user = user,

    details = "Logical deletion"

  )

}

#------------------------------------------------------------
# Liste métier
#------------------------------------------------------------

get_mission_evidences <- function(

  con,

  mission_id

) {

  list_evidences(

    con,

    mission_id

  )

}
```
