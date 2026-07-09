# ============================================================
# DIAM
# Evidence Storage Engine
# ============================================================

#------------------------------------------------------------
# Arborescence d'une mission
#------------------------------------------------------------

create_evidence_tree <- function(mission_uuid) {

  root <- fs::path(

    app_config$directories$evidence,

    mission_uuid

  )

  folders <- c(

    "originals",

    "thumbnails",

    "ocr",

    "signatures",

    "manifest",

    "archive"

  )

  purrr::walk(

    folders,

    \(folder) {

      fs::dir_create(

        fs::path(root, folder),

        recurse = TRUE

      )

    }

  )

  invisible(root)

}

#------------------------------------------------------------
# Répertoire d'une mission
#------------------------------------------------------------

get_evidence_root <- function(mission_uuid) {

  fs::path(

    app_config$directories$evidence,

    mission_uuid

  )

}

#------------------------------------------------------------
# Nom physique
#------------------------------------------------------------

generate_storage_filename <- function(file) {

  extension <-

    tolower(

      fs::path_ext(file)

    )

  paste0(

    UUIDgenerate(),

    ".",

    extension

  )

}

#------------------------------------------------------------
# Chemin physique
#------------------------------------------------------------

build_storage_path <- function(

  mission_uuid,

  filename

) {

  fs::path(

    get_evidence_root(mission_uuid),

    "originals",

    filename

  )

}

#------------------------------------------------------------
# Stockage
#------------------------------------------------------------

store_file <- function(

  source_file,

  mission_uuid

) {

  stopifnot(

    fs::file_exists(source_file)

  )

  create_evidence_tree(

    mission_uuid

  )

  storage_name <-

    generate_storage_filename(

      source_file

    )

  destination <-

    build_storage_path(

      mission_uuid,

      storage_name

    )

  ok <-

    fs::file_copy(

      source_file,

      destination,

      overwrite = FALSE

    )

  if (!ok) {

    stop(

      "Impossible de copier la preuve."

    )

  }

  destination

}

#------------------------------------------------------------
# Vérification
#------------------------------------------------------------

storage_exists <- function(path) {

  fs::file_exists(path)

}

#------------------------------------------------------------
# Taille physique
#------------------------------------------------------------

storage_size <- function(path) {

  if (!storage_exists(path)) {

    return(NA_real_)

  }

  fs::file_size(path)

}

#------------------------------------------------------------
# Suppression physique
#------------------------------------------------------------

delete_storage <- function(path) {

  if (

    storage_exists(path)

  ) {

    fs::file_delete(path)

  }

  invisible(TRUE)

}

#------------------------------------------------------------
# Thumbnail
#------------------------------------------------------------

thumbnail_path <- function(

  mission_uuid,

  filename

) {

  fs::path(

    get_evidence_root(

      mission_uuid

    ),

    "thumbnails",

    filename

  )

}

#------------------------------------------------------------
# OCR
#------------------------------------------------------------

ocr_path <- function(

  mission_uuid,

  filename

) {

  fs::path(

    get_evidence_root(

      mission_uuid

    ),

    "ocr",

    paste0(

      tools::file_path_sans_ext(

        filename

      ),

      ".txt"

    )

  )

}

#------------------------------------------------------------
# Signature
#------------------------------------------------------------

signature_path <- function(

  mission_uuid,

  filename

) {

  fs::path(

    get_evidence_root(

      mission_uuid

    ),

    "signatures",

    paste0(

      filename,

      ".sig"

    )

  )

}

#------------------------------------------------------------
# Manifest
#------------------------------------------------------------

manifest_path <- function(

  mission_uuid

) {

  fs::path(

    get_evidence_root(

      mission_uuid

    ),

    "manifest",

    "manifest.json"

  )

}

#------------------------------------------------------------
# Archive ZIP
#------------------------------------------------------------

archive_path <- function(

  mission_uuid

) {

  fs::path(

    get_evidence_root(

      mission_uuid

    ),

    "archive",

    paste0(

      mission_uuid,

      ".zip"

    )

  )

}
