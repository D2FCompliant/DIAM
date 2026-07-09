library(DIAM)

local({
  root <- tempfile("diam-test-")
  dir.create(root)
  old <- getwd()
  con <- NULL
  setwd(root)
  on.exit({
    if (!is.null(con)) db_disconnect(con)
    setwd(old)
    unlink(root, recursive = TRUE)
  })
  initialize_database()
  con <- db_connect()

  mission_id <- diam_create_mission(
    con, "Audit PDP", "Client Test", "DGFiP", "Facturation", "Testeur"
  )
  diam_add_question(
    con, mission_id, "Q-001", "Sécurité", "Les accès sont-ils maîtrisés ?",
    "HIGH", "Journal des accès"
  )
  question_id <- diam_questions(con, mission_id)$id[[1]]
  diam_save_answer(
    con, question_id, "NON_COMPLIANT", "Contrôle incomplet",
    "Écart confirmé", "Testeur"
  )
  finding_id <- diam_save_finding(
    con, question_id, "Accès non revus", "HIGH",
    "Mettre en place une revue", "Testeur"
  )
  diam_add_non_conformity(
    con, finding_id, "MAJOR", "Absence de revue", "Revue périodique absente"
  )
  nc_id <- diam_non_conformities(con, mission_id)$id[[1]]
  diam_add_action(
    con, nc_id, "Organiser une revue trimestrielle", "RSSI",
    as.character(Sys.Date() + 30), "HIGH"
  )

  stopifnot(
    nrow(diam_missions(con)) == 1,
    diam_missions(con)$progress[[1]] == 100,
    nrow(diam_findings(con, mission_id)) == 1,
    nrow(diam_non_conformities(con, mission_id)) == 1,
    nrow(diam_actions(con, mission_id)) == 1,
    nrow(diam_history(con, mission_id)) >= 3
  )
})
