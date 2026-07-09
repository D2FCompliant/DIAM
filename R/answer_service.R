```r
# ============================================================
# DIAM
# Answer Service
# ============================================================

#------------------------------------------------------------
# Construction
#------------------------------------------------------------

build_answer <- function(
    question_id,
    answer,
    compliance_status,
    comment = "",
    answered_by
) {

  now <- as.character(Sys.time())

  tibble::tibble(

    uuid = UUIDgenerate(),

    question_id = question_id,

    answer = answer,

    compliance_status = compliance_status,

    comment = comment,

    answered_by = answered_by,

    answered_at = now,

    reviewed_by = NA_integer_,

    reviewed_at = NA_character_,

    created_at = now,

    updated_at = now

  )

}

#------------------------------------------------------------
# Enregistrement
#------------------------------------------------------------

save_answer <- function(
    con,
    question_id,
    answer,
    compliance_status,
    comment = "",
    user
) {

  db_transaction(

    con,

    {

      if (answer_exists(con, question_id)) {

        current <-

          get_answer(
            con,
            question_id
          )

        current$answer <- answer
        current$compliance_status <- compliance_status
        current$comment <- comment
        current$reviewed_by <- user
        current$reviewed_at <- as.character(Sys.time())
        current$updated_at <- as.character(Sys.time())

        update_answer(
          con,
          current
        )

        uuid <- current$uuid

      } else {

        current <-

          build_answer(

            question_id = question_id,

            answer = answer,

            compliance_status = compliance_status,

            comment = comment,

            answered_by = user

          )

        insert_answer(
          con,
          current
        )

        uuid <- current$uuid

      }

      question <-

        get_question_by_id(
          con,
          question_id
        )

      if (

        compliance_status != "NOT_STARTED"

      ) {

        complete_question(

          con = con,

          question_id = question_id,

          mission_id = question$mission_id,

          user = user

        )

      }

      log_action(

        con = con,

        mission_id = question$mission_id,

        action = "SAVE_ANSWER",

        object_type = "ANSWER",

        object_uuid = uuid,

        user = user,

        details = compliance_status

      )

      invisible(uuid)

    }

  )

}

#------------------------------------------------------------
# Lecture
#------------------------------------------------------------

load_answer <- function(
    con,
    question_id
) {

  get_answer(

    con,

    question_id

  )

}

#------------------------------------------------------------
# Validation
#------------------------------------------------------------

validate_answer <- function(
    answer,
    compliance_status
) {

  if (

    !compliance_status %in%

    c(

      "COMPLIANT",

      "NON_COMPLIANT",

      "PARTIALLY_COMPLIANT",

      "NOT_APPLICABLE",

      "NOT_STARTED"

    )

  ) {

    stop(

      "Statut de conformité invalide."

    )

  }

  invisible(TRUE)

}
```
