# ============================================================
# DIAM
# Evidence Metadata Engine
# ============================================================

#------------------------------------------------------------
# Vérification
#------------------------------------------------------------

check_file_exists <- function(file) {

  if (!fs::file_exists(file)) {

    stop(

      sprintf(
        "Le fichier '%s' est introuvable.",
        file
      ),

      call. = FALSE

    )

  }

}

#------------------------------------------------------------
# UUID
#------------------------------------------------------------

generate_uuid <- function() {

  UUIDgenerate()

}

#------------------------------------------------------------
# SHA256
#------------------------------------------------------------

compute_sha256 <- function(file) {

  check_file_exists(file)

  raw <- readBin(

    file,

    "raw",

    n = file.info(file)$size

  )

  as.character(

    openssl::sha256(raw)

  )

}

#------------------------------------------------------------
# SHA512
#------------------------------------------------------------

compute_sha512 <- function(file) {

  check_file_exists(file)

  raw <- readBin(

    file,

    "raw",

    n = file.info(file)$size

  )

  as.character(

    openssl::sha512(raw)

  )

}

#------------------------------------------------------------
# MD5
#------------------------------------------------------------

compute_md5 <- function(file) {

  check_file_exists(file)

  unname(

    tools::md5sum(file)

  )

}

#------------------------------------------------------------
# Extension
#------------------------------------------------------------

get_extension <- function(file) {

  tolower(

    fs::path_ext(file)

  )

}

#------------------------------------------------------------
# MIME
#------------------------------------------------------------

get_mime_type <- function(file) {

  mime::guess_type(file)

}

#------------------------------------------------------------
# Taille
#------------------------------------------------------------

get_file_size <- function(file) {

  file.info(file)$size

}

#------------------------------------------------------------
# Dates système
#------------------------------------------------------------

get_dates <- function(file) {

  info <- file.info(file)

  list(

    created = as.character(info$ctime),

    modified = as.character(info$mtime),

    accessed = as.character(info$atime)

  )

}

#------------------------------------------------------------
# Nombre de pages PDF
#------------------------------------------------------------

get_pdf_pages <- function(file) {

  if (

    get_extension(file) != "pdf"

  ) {

    return(NA_integer_)

  }

  if (

    requireNamespace(

      "pdftools",

      quietly = TRUE

    )

  ) {

    return(

      pdftools::pdf_info(file)$pages

    )

  }

  NA_integer_

}

#------------------------------------------------------------
# Dimensions image
#------------------------------------------------------------

get_image_information <- function(file) {

  ext <- get_extension(file)

  if (

    !ext %in%

    c(

      "png",

      "jpg",

      "jpeg",

      "bmp",

      "gif",

      "tif",

      "tiff"

    )

  ) {

    return(

      list(

        width = NA,

        height = NA

      )

    )

  }

  if (

    requireNamespace(

      "magick",

      quietly = TRUE

    )

  ) {

    img <-

      magick::image_read(file)

    info <-

      magick::image_info(img)

    return(

      list(

        width = info$width,

        height = info$height

      )

    )

  }

  list(

    width = NA,

    height = NA

  )

}

#------------------------------------------------------------
# DPI
#------------------------------------------------------------

get_dpi <- function(file) {

  NA_integer_

}

#------------------------------------------------------------
# Analyse complète
#------------------------------------------------------------

analyse_file <- function(file) {

  check_file_exists(file)

  dates <- get_dates(file)

  image <- get_image_information(file)

  list(

    uuid = generate_uuid(),

    original_name = basename(file),

    extension = get_extension(file),

    mime = get_mime_type(file),

    size = get_file_size(file),

    sha256 = compute_sha256(file),

    sha512 = compute_sha512(file),

    md5 = compute_md5(file),

    pages = get_pdf_pages(file),

    width = image$width,

    height = image$height,

    dpi = get_dpi(file),

    created = dates$created,

    modified = dates$modified,

    accessed = dates$accessed

  )

}
