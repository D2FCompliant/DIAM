# Core application operations used by the Shiny interface.

diam_now <- function() as.character(Sys.time())

diam_uuid <- function() uuid::UUIDgenerate()

diam_scalar <- function(x) {
  if (is.null(x) || length(x) == 0 || is.na(x) || !nzchar(trimws(x))) {
    return(NA_character_)
  }
  trimws(x)
}

diam_next_number <- function(con, key, prefix) {
  DBI::dbWithTransaction(con, {
    DBI::dbExecute(
      con,
      "INSERT OR IGNORE INTO settings(key, value) VALUES (?, '0')",
      params = list(key)
    )
    current <- DBI::dbGetQuery(
      con,
      "SELECT value FROM settings WHERE key = ?",
      params = list(key)
    )
    value <- as.integer(current$value[[1]]) + 1L
    DBI::dbExecute(
      con,
      "UPDATE settings SET value = ?, updated_at = ? WHERE key = ?",
      params = list(as.character(value), diam_now(), key)
    )
    sprintf("%s-%s-%05d", prefix, format(Sys.Date(), "%Y"), value)
  })
}

diam_ensure_client <- function(con, name) {
  name <- trimws(name)
  found <- DBI::dbGetQuery(
    con,
    "SELECT id FROM client WHERE lower(name) = lower(?) LIMIT 1",
    params = list(name)
  )
  if (nrow(found)) return(found$id[[1]])
  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO client",
      "(uuid, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ),
    params = list(diam_uuid(), name, diam_now(), diam_now())
  )
  DBI::dbGetQuery(con, "SELECT last_insert_rowid() AS id")$id[[1]]
}

diam_ensure_referential <- function(con, code) {
  code <- toupper(trimws(code))
  found <- DBI::dbGetQuery(
    con,
    "SELECT id FROM referential WHERE lower(code) = lower(?) LIMIT 1",
    params = list(code)
  )
  if (nrow(found)) return(found$id[[1]])
  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO referential",
      "(uuid, code, title, version, publisher, active, created_at)",
      "VALUES (?, ?, ?, '1.0', 'D2F Compliant', 1, ?)"
    ),
    params = list(diam_uuid(), code, code, diam_now())
  )
  DBI::dbGetQuery(con, "SELECT last_insert_rowid() AS id")$id[[1]]
}

diam_create_mission <- function(con, title, client, referential, scope, user) {
  stopifnot(nzchar(trimws(title)), nzchar(trimws(client)))
  client_id <- diam_ensure_client(con, client)
  referential_id <- diam_ensure_referential(con, referential)
  number <- diam_next_number(con, "mission_number", "MIS")
  id <- diam_uuid()
  now <- diam_now()
  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO mission",
      "(uuid, number, client_id, referential_id, title, scope,",
      "start_date, status, progress, report_version, created_by, created_at, updated_at)",
      "VALUES (?, ?, ?, ?, ?, ?, ?, 'CREATED', 0, '1.0', ?, ?, ?)"
    ),
    params = list(
      id, number, client_id, referential_id, trimws(title),
      diam_scalar(scope), as.character(Sys.Date()), user, now, now
    )
  )
  mission_id <- DBI::dbGetQuery(con, "SELECT last_insert_rowid() AS id")$id[[1]]
  diam_log(con, mission_id, user, "CREATE_MISSION", "MISSION", id, title)
  diam_seed_questionnaire(con, mission_id, user)
  mission_id
}

diam_missions <- function(con) {
  DBI::dbGetQuery(
    con,
    paste(
      "SELECT m.id, m.number, m.title, c.name AS client, r.code AS referential,",
      "m.status, m.progress, m.start_date",
      "FROM mission m JOIN client c ON c.id=m.client_id",
      "JOIN referential r ON r.id=m.referential_id",
      "ORDER BY m.created_at DESC"
    )
  )
}

diam_set_mission_status <- function(con, mission_id, status, user) {
  allowed <- c("CREATED", "IN_PROGRESS", "REVIEW", "APPROVED", "CLOSED", "CANCELLED")
  stopifnot(status %in% allowed)
  DBI::dbExecute(
    con,
    "UPDATE mission SET status=?, updated_at=? WHERE id=?",
    params = list(status, diam_now(), mission_id)
  )
  diam_log(con, mission_id, user, "CHANGE_STATUS", "MISSION", as.character(mission_id), status)
}

diam_add_question <- function(
    con, mission_id, reference, chapter, title, criticality, expected,
    description = NULL, requirement = NULL, verification_method = NULL
) {
  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO question",
      "(uuid, mission_id, reference, chapter, title, description, requirement,",
      "criticality, verification_method, expected_evidence, status, created_at, updated_at)",
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED', ?, ?)"
    ),
    params = list(
      diam_uuid(), mission_id, trimws(reference), diam_scalar(chapter),
      trimws(title), diam_scalar(description), diam_scalar(requirement),
      criticality, diam_scalar(verification_method), diam_scalar(expected),
      diam_now(), diam_now()
    )
  )
  diam_update_progress(con, mission_id)
}

diam_seed_questionnaire <- function(con, mission_id, user = "SYSTEM") {
  template <- diam_questionnaire_template()
  sql <- paste(
    "INSERT OR IGNORE INTO question",
    "(uuid, mission_id, reference, chapter, title, description, requirement,",
    "criticality, verification_method, expected_evidence, status, created_at, updated_at)",
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED', ?, ?)"
  )
  now <- diam_now()
  for (i in seq_len(nrow(template))) {
    DBI::dbExecute(
      con, sql,
      params = list(
        diam_uuid(), mission_id, template$reference[[i]], template$chapter[[i]],
        template$title[[i]], template$description[[i]], template$requirement[[i]],
        template$criticality[[i]], template$verification_method[[i]],
        template$expected_evidence[[i]], now, now
      )
    )
  }
  diam_update_progress(con, mission_id)
  diam_log(
    con, mission_id, user, "LOAD_QUESTIONNAIRE", "MISSION",
    as.character(mission_id), paste(nrow(template), "questions DGFiP/PDP Integrity")
  )
  invisible(nrow(template))
}

diam_questions <- function(con, mission_id) {
  DBI::dbGetQuery(
    con,
    paste(
      "SELECT q.id, q.reference, q.chapter, q.title, q.description, q.requirement,",
      "q.criticality, q.verification_method, q.expected_evidence, q.status,",
      "COALESCE(a.compliance_status, 'NOT_STARTED') AS compliance_status,",
      "COALESCE(a.answer, '') AS answer, COALESCE(a.comment, '') AS comment",
      "FROM question q LEFT JOIN answer a ON a.question_id=q.id",
      "WHERE q.mission_id=? ORDER BY q.reference"
    ),
    params = list(mission_id)
  )
}

diam_save_answer <- function(con, question_id, status, analysis, comment, user) {
  allowed <- c("COMPLIANT", "PARTIALLY_COMPLIANT", "NON_COMPLIANT", "NOT_APPLICABLE")
  stopifnot(status %in% allowed)
  current <- DBI::dbGetQuery(
    con, "SELECT uuid FROM answer WHERE question_id=?", params = list(question_id)
  )
  now <- diam_now()
  if (nrow(current)) {
    DBI::dbExecute(
      con,
      paste(
        "UPDATE answer SET answer=?, compliance_status=?, comment=?,",
        "reviewed_at=?, updated_at=? WHERE question_id=?"
      ),
      params = list(analysis, status, comment, now, now, question_id)
    )
  } else {
    DBI::dbExecute(
      con,
      paste(
        "INSERT INTO answer",
        "(uuid, question_id, answer, compliance_status, comment, answered_at, created_at, updated_at)",
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ),
      params = list(diam_uuid(), question_id, analysis, status, comment, now, now, now)
    )
  }
  mission_id <- DBI::dbGetQuery(
    con, "SELECT mission_id FROM question WHERE id=?", params = list(question_id)
  )$mission_id[[1]]
  DBI::dbExecute(
    con,
    "UPDATE question SET status='COMPLETED', updated_at=? WHERE id=?",
    params = list(now, question_id)
  )
  diam_update_progress(con, mission_id)
  diam_log(con, mission_id, user, "SAVE_ANSWER", "QUESTION", as.character(question_id), status)
}

diam_update_progress <- function(con, mission_id) {
  counts <- DBI::dbGetQuery(
    con,
    paste(
      "SELECT COUNT(*) AS total,",
      "SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) AS completed",
      "FROM question WHERE mission_id=?"
    ),
    params = list(mission_id)
  )
  progress <- if (counts$total[[1]] == 0) 0 else {
    round(100 * counts$completed[[1]] / counts$total[[1]])
  }
  DBI::dbExecute(
    con, "UPDATE mission SET progress=?, updated_at=? WHERE id=?",
    params = list(progress, diam_now(), mission_id)
  )
  progress
}

diam_save_finding <- function(con, question_id, summary, risk, recommendation, user) {
  current <- DBI::dbGetQuery(
    con, "SELECT id, uuid FROM finding WHERE question_id=?", params = list(question_id)
  )
  now <- diam_now()
  if (nrow(current)) {
    DBI::dbExecute(
      con,
      paste(
        "UPDATE finding SET summary=?, risk=?, recommendation=?,",
        "status='OPEN', updated_at=? WHERE question_id=?"
      ),
      params = list(summary, risk, recommendation, now, question_id)
    )
    finding_id <- current$id[[1]]
  } else {
    DBI::dbExecute(
      con,
      paste(
        "INSERT INTO finding",
        "(uuid, question_id, finding_number, summary, risk, recommendation, status, created_at, updated_at)",
        "VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)"
      ),
      params = list(
        diam_uuid(), question_id, diam_next_number(con, "finding_number", "CST"),
        summary, risk, recommendation, now, now
      )
    )
    finding_id <- DBI::dbGetQuery(con, "SELECT last_insert_rowid() AS id")$id[[1]]
  }
  mission_id <- DBI::dbGetQuery(
    con, "SELECT mission_id FROM question WHERE id=?", params = list(question_id)
  )$mission_id[[1]]
  diam_log(con, mission_id, user, "SAVE_FINDING", "FINDING", as.character(finding_id), summary)
  finding_id
}

diam_findings <- function(con, mission_id) {
  DBI::dbGetQuery(
    con,
    paste(
      "SELECT f.id, f.finding_number, q.reference, f.summary, f.risk,",
      "f.recommendation, f.status",
      "FROM finding f JOIN question q ON q.id=f.question_id",
      "WHERE q.mission_id=? ORDER BY f.created_at DESC"
    ),
    params = list(mission_id)
  )
}

diam_add_non_conformity <- function(con, finding_id, severity, title, description) {
  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO non_conformity",
      "(uuid, finding_id, nc_number, severity, status, title, description, created_at, updated_at)",
      "VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?, ?)"
    ),
    params = list(
      diam_uuid(), finding_id, diam_next_number(con, "nc_number", "NC"),
      severity, title, description, diam_now(), diam_now()
    )
  )
}

diam_non_conformities <- function(con, mission_id) {
  DBI::dbGetQuery(
    con,
    paste(
      "SELECT nc.id, nc.nc_number, nc.severity, nc.title, nc.status,",
      "f.finding_number, COUNT(ap.id) AS actions",
      "FROM non_conformity nc JOIN finding f ON f.id=nc.finding_id",
      "JOIN question q ON q.id=f.question_id",
      "LEFT JOIN action_plan ap ON ap.nc_id=nc.id",
      "WHERE q.mission_id=? GROUP BY nc.id ORDER BY nc.created_at DESC"
    ),
    params = list(mission_id)
  )
}

diam_add_action <- function(con, nc_id, action, owner, due_date, priority) {
  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO action_plan",
      "(uuid, nc_id, action_number, action, owner, priority, due_date, status, created_at, updated_at)",
      "VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)"
    ),
    params = list(
      diam_uuid(), nc_id, diam_next_number(con, "action_number", "ACT"),
      action, owner, diam_scalar(due_date), priority, diam_now(), diam_now()
    )
  )
}

diam_actions <- function(con, mission_id) {
  DBI::dbGetQuery(
    con,
    paste(
      "SELECT ap.id, ap.action_number, nc.nc_number, ap.action, ap.owner,",
      "ap.priority, ap.due_date, ap.status",
      "FROM action_plan ap JOIN non_conformity nc ON nc.id=ap.nc_id",
      "JOIN finding f ON f.id=nc.finding_id JOIN question q ON q.id=f.question_id",
      "WHERE q.mission_id=? ORDER BY ap.due_date, ap.created_at"
    ),
    params = list(mission_id)
  )
}

diam_add_evidence <- function(con, mission_id, datapath, filename, user) {
  bytes <- readBin(datapath, "raw", n = file.info(datapath)$size)
  hash <- as.character(openssl::sha256(bytes))
  duplicate <- DBI::dbGetQuery(
    con,
    "SELECT id FROM evidence WHERE mission_id=? AND sha256=? AND status='ACTIVE'",
    params = list(mission_id, hash)
  )
  if (nrow(duplicate)) stop("Cette preuve existe déjà pour la mission.")
  mission_uuid <- DBI::dbGetQuery(
    con, "SELECT uuid FROM mission WHERE id=?", params = list(mission_id)
  )$uuid[[1]]
  folder <- fs::path(app_config$directories$evidence, mission_uuid, "originals")
  fs::dir_create(folder, recurse = TRUE)
  stored <- paste0(diam_uuid(), ".", fs::path_ext(filename))
  destination <- fs::path(folder, stored)
  fs::file_copy(datapath, destination)
  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO evidence",
      "(uuid, mission_id, evidence_number, original_name, stored_name, extension,",
      "mime_type, file_size, sha256, version, status, uploaded_at, archive_path, created_at, updated_at)",
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', ?, ?, ?, ?)"
    ),
    params = list(
      diam_uuid(), mission_id, diam_next_number(con, "evidence_number", "EVD"),
      filename, stored, tolower(fs::path_ext(filename)), mime::guess_type(filename),
      as.numeric(file.info(datapath)$size), hash, diam_now(),
      as.character(destination), diam_now(), diam_now()
    )
  )
  diam_log(con, mission_id, user, "ADD_EVIDENCE", "EVIDENCE", stored, filename)
}

diam_evidences <- function(con, mission_id) {
  DBI::dbGetQuery(
    con,
    paste(
      "SELECT id, evidence_number, original_name, mime_type, file_size,",
      "substr(sha256, 1, 16) || '…' AS sha256, uploaded_at",
      "FROM evidence WHERE mission_id=? AND status='ACTIVE'",
      "ORDER BY uploaded_at DESC"
    ),
    params = list(mission_id)
  )
}

diam_dashboard <- function(con) {
  missions <- DBI::dbGetQuery(con, "SELECT COUNT(*) AS n FROM mission")$n[[1]]
  active <- DBI::dbGetQuery(
    con, "SELECT COUNT(*) AS n FROM mission WHERE status NOT IN ('CLOSED','CANCELLED')"
  )$n[[1]]
  nc <- DBI::dbGetQuery(
    con, "SELECT COUNT(*) AS n FROM non_conformity WHERE status='OPEN'"
  )$n[[1]]
  actions <- DBI::dbGetQuery(
    con, "SELECT COUNT(*) AS n FROM action_plan WHERE status='OPEN'"
  )$n[[1]]
  list(missions = missions, active = active, non_conformities = nc, actions = actions)
}

diam_log <- function(con, mission_id, user, action, object_type, object_uuid, details = NULL) {
  DBI::dbExecute(
    con,
    paste(
      "INSERT INTO audit_log",
      "(uuid, mission_id, user_name, action, object_type, object_uuid, timestamp, details)",
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ),
    params = list(
      diam_uuid(), mission_id, user, action, object_type,
      object_uuid, diam_now(), diam_scalar(details)
    )
  )
}

diam_history <- function(con, mission_id) {
  DBI::dbGetQuery(
    con,
    paste(
      "SELECT timestamp, user_name, action, object_type, details",
      "FROM audit_log WHERE mission_id=? ORDER BY timestamp DESC LIMIT 200"
    ),
    params = list(mission_id)
  )
}
