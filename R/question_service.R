# ============================================================
# DIAM
# Question Service
# ============================================================

#------------------------------------------------------------
# Construction de l'objet métier
#------------------------------------------------------------

build_question <- function(
    mission_id,
    reference,
    chapter,
    title,
    description = "",
    requirement = "",
    criticality = "MEDIUM",
    verification_method = "",
    expected_evidence = ""
) {

  now <- as.character(Sys.time())

  tibble::tibble(

    uuid = UUIDgenerate(),

    mission_id = mission_id,

    reference = reference,

    chapter = chapter,

    title = title,

    description = description,

    requirement = requirement,

    criticality = criticality,

    verification_method = verification_method,

    expected_evidence = expected_evidence,

    status = "NOT_STARTED",

    created_at = now,

    updated_at = now

  )

}

#------------------------------------------------------------
# Création
#------------------------------------------------------------

create_question <- function(
    con,
    mission_id,
    reference,
    chapter,
    title,
    description = "",
    requirement = "",
    criticality = "MEDIUM",
    verification_method = "",
    expected_evidence = "",
    user
) {

  db_transaction(

    con,

    {

      if (!is.null(
        find_question_by_reference(
          con,
          mission_id,
          reference
        )
      )) {

        stop(
          sprintf(
            "La question '%s' existe déjà.",
            reference
          )
        )

      }

      question <-

        build_question(

          mission_id = mission_id,

          reference = reference,

          chapter = chapter,

          title = title,

          description = description,

          requirement = requirement,

          criticality = criticality,

          verification_method = verification_method,

          expected_evidence = expected_evidence

        )

      insert_question(

        con,

        question

      )

      log_action(

        con = con,

        mission_id = mission_id,

        action = "CREATE_QUESTION",

        object_type = "QUESTION",

        object_uuid = question$uuid,

        user = user,

        details = question$reference

      )

      question_id <-

        DBI::dbGetQuery(

          con,

          "

SELECT id

FROM question

WHERE uuid=?

",

          params = list(

            question$uuid

          )

        )$id

      add_workflow_history(

        con = con,

        mission_id = mission_id,

        object_type = "QUESTION",

        object_id = question_id,

        previous_status = "",

        new_status = "NOT_STARTED",

        changed_by = user,

        comments = "Question créée"

      )

      update_mission_progress(

        con,

        mission_id

      )

      question

    }

  )

}

#------------------------------------------------------------
# Changement d'état
#------------------------------------------------------------

start_question <- function(
    con,
    question_id,
    mission_id,
    user
) {

  change_status(

    con = con,

    table = "question",

    id = question_id,

    status = "IN_PROGRESS",

    user = user,

    mission_id = mission_id

  )

}

complete_question <- function(
    con,
    question_id,
    mission_id,
    user
) {

  change_status(

    con = con,

    table = "question",

    id = question_id,

    status = "COMPLETED",

    user = user,

    mission_id = mission_id

  )

  update_mission_progress(

    con,

    mission_id

  )

}

#------------------------------------------------------------
# Calcul de progression
#------------------------------------------------------------

update_mission_progress <- function(
    con,
    mission_id
) {

  total <-

    count_questions(

      con,

      mission_id

    )

  if (total == 0) {

    progress <- 0

  } else {

    completed <-

      count_completed_questions(

        con,

        mission_id

      )

    progress <-

      round(

        completed /

          total *

          100,

        0

      )

  }

  mission <-

    get_mission_by_id(

      con,

      mission_id

    )

  if (!is.null(mission)) {

    update_progress(

      con,

      mission$uuid,

      progress

    )

  }

  invisible(progress)

}

#------------------------------------------------------------
# Liste
#------------------------------------------------------------

get_questions <- function(
    con,
    mission_id
) {

  list_questions(

    con,

    mission_id

  )

}

#------------------------------------------------------------
# Chargement d'un référentiel
#------------------------------------------------------------

import_questions <- function(
    con,
    mission_id,
    referential
) {

  purrr::walk(

    seq_len(nrow(referential)),

    \(i) {

      create_question(

        con = con,

        mission_id = mission_id,

        reference = referential$reference[i],

        chapter = referential$chapter[i],

        title = referential$title[i],

        description = referential$description[i],

        requirement = referential$requirement[i],

        criticality = referential$criticality[i],

        verification_method = referential$verification_method[i],

        expected_evidence = referential$expected_evidence[i],

        user = "SYSTEM"

      )

    }

  )

}
