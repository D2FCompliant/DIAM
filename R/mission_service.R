# ============================================================
# DIAM
# Mission Service
# ============================================================

#------------------------------------------------------------
# Génération du numéro métier
#------------------------------------------------------------

generate_mission_number <- function(con) {

  current <- db_query(
    con,
    "
    SELECT value
    FROM settings
    WHERE key = 'mission_number'
    "
  )

  if (nrow(current) == 0) {
    stop("Le compteur 'mission_number' est absent.")
  }

  value <- as.integer(current$value) + 1

  db_execute(
    con,
    "
    UPDATE settings
    SET
      value = ?,
      updated_at = datetime('now')
    WHERE key = 'mission_number'
    ",
    params = list(value)
  )

  sprintf(
    "MIS-%s-%06d",
    format(Sys.Date(), "%Y"),
    value
  )

}

#------------------------------------------------------------
# Construction de l'objet Mission
#------------------------------------------------------------

build_mission <- function(
    client_id,
    referential_id,
    title,
    scope,
    audit_period_start,
    audit_period_end,
    created_by
) {

  now <- as.character(Sys.time())

  tibble::tibble(

    uuid = UUIDgenerate(),

    number = NA_character_,

    client_id = client_id,

    referential_id = referential_id,

    title = title,

    scope = scope,

    audit_period_start = audit_period_start,

    audit_period_end = audit_period_end,

    start_date = as.character(Sys.Date()),

    end_date = NA_character_,

    status = "CREATED",

    progress = 0,

    report_version = "1.0",

    created_by = created_by,

    created_at = now,

    updated_at = now

  )

}

#------------------------------------------------------------
# Création complète
#------------------------------------------------------------

create_mission <- function(
    con,
    client_id,
    referential_id,
    title,
    scope = "",
    audit_period_start = NULL,
    audit_period_end = NULL,
    created_by
) {

  db_transaction(

    con,

    {

      mission <- build_mission(

        client_id = client_id,

        referential_id = referential_id,

        title = title,

        scope = scope,

        audit_period_start = audit_period_start,

        audit_period_end = audit_period_end,

        created_by = created_by

      )

      mission$number <-

        generate_mission_number(con)

      insert_mission(

        con,
        mission

      )

      create_evidence_tree(

        mission$uuid

      )

      log_action(

        con = con,

        mission_id = NULL,

        action = "CREATE_MISSION",

        object_type = "MISSION",

        object_uuid = mission$uuid,

        user = created_by,

        details = mission$title

      )

      mission_id <-

        DBI::dbGetQuery(

          con,

          "
          SELECT id

          FROM mission

          WHERE uuid = ?
          ",

          params = list(

            mission$uuid

          )

        )$id

      add_workflow_history(

        con = con,

        mission_id = mission_id,

        object_type = "MISSION",

        object_id = mission_id,

        previous_status = "",

        new_status = "CREATED",

        changed_by = created_by,

        comments = "Mission créée"

      )

      mission

    }

  )

}

#------------------------------------------------------------
# Démarrer la mission
#------------------------------------------------------------

start_mission <- function(
    con,
    mission_id,
    user
) {

  change_status(

    con = con,

    table = "mission",

    id = mission_id,

    status = "IN_PROGRESS",

    user = user,

    mission_id = mission_id

  )

}

#------------------------------------------------------------
# Clôturer
#------------------------------------------------------------

close_mission <- function(
    con,
    mission_id,
    user
) {

  change_status(

    con = con,

    table = "mission",

    id = mission_id,

    status = "CLOSED",

    user = user,

    mission_id = mission_id

  )

}

#------------------------------------------------------------
# Dashboard
#------------------------------------------------------------

get_dashboard <- function(con) {

  db_query(

    con,

    "

SELECT *

FROM vw_dashboard

ORDER BY number DESC

"

  )

}

#------------------------------------------------------------
# Recherche
#------------------------------------------------------------

find_mission <- function(
    con,
    uuid
) {

  get_mission(

    con,
    uuid

  )

}
