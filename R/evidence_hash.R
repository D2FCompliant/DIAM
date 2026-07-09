# ============================================================
# DIAM
# Evidence Metadata Engine
# ============================================================

library(fs)
library(openssl)
library(uuid)
library(tools)
library(mime)

#------------------------------------------------------------
# SHA256
#------------------------------------------------------------

compute_sha256 <- function(file) {

  stopifnot(fs::file_exists(file))

  raw <- readBin(
    file,
    what = "raw",
    n = file.info(file)$size
  )

  openssl::sha256(raw)

}

#------------------------------------------------------------
# MD5
#------------------------------------------------------------

compute_md5 <- function(file) {

  tools::md5sum(file)[1]

}

#------------------------------------------------------------
# MIME
#------------------------------------------------------------

get_mime_type <- function(file) {

  mime::guess_type(file)

}

#------------------------------------------------------------
# Extension
#------------------------------------------------------------

get_extension <- function(file) {

  tolower(fs::path_ext(file))

}

#------------------------------------------------------------
# Taille
#------------------------------------------------------------

get_file_size <- function(file) {

  file.info(file)$size

}

#------------------------------------------------------------
# Dates
#------------------------------------------------------------

get_dates <- function(file) {

  info <- file.info(file)

  list(

    created = as.character(info$ctime),

    modified = as.character(info$mtime)

  )

}

#------------------------------------------------------------
# UUID
#------------------------------------------------------------

generate_uuid <- function() {

  UUIDgenerate()

}

#------------------------------------------------------------
# Analyse complète
#------------------------------------------------------------

analyse_file <- function(file) {

  stopifnot(fs::file_exists(file))

  dates <- get_dates(file)

  list(

    uuid = generate_uuid(),

    original_name = basename(file),

    extension = get_extension(file),

    mime = get_mime_type(file),

    size = get_file_size(file),

    sha256 = compute_sha256(file),

    md5 = compute_md5(file),

    created = dates$created,

    modified = dates$modified

  )

}
