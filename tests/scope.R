library(DIAM)

local({
  root <- tempfile("diam-scope-test-")
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
  client_id <- diam_save_client(
    con, "Client Candidature", city = "Paris", country = "France"
  )
  candidature <- paste(
    "La société opère en tant que PDPe, PDP du fournisseur, et PDPr, PDP de l'acheteur.",
    "Elle supporte les flux 1, 2, 6, 10, 11, 12, 13, 14.",
    "La solution traite le e-reporting B2B international et B2C ainsi que les données de paiement.",
    "L'architecture OD + PDP est full API OAuth2, utilise Peppol AS4,",
    "est hébergée en cloud SecNumCloud et ne propose pas de mapping."
  )
  scope <- diam_infer_scope(candidature)
  diam_save_scope(con, client_id, scope, analyzed_by = "Testeur")
  mission_id <- diam_create_mission(
    con, "Audit ciblé", "Client Candidature", "DGFiP", "Périmètre candidature", "Testeur"
  )
  questions <- diam_questions(con, mission_id)

  stopifnot(
    scope$role_pdpe,
    scope$role_pdpr,
    scope$e_reporting,
    scope$peppol,
    scope$api_only,
    scope$od_layer,
    scope$cloud_external,
    scope$secnumcloud,
    !scope$format_conversion,
    nrow(questions) == 40,
    all(diam_scope_questions()$reference %in% questions$reference),
    !"DGFiP-A9" %in% questions$reference
  )
})
