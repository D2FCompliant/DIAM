# ============================================================
# DIAM
# Evidence Database Service
# ============================================================

library(DBI)
library(dplyr)
library(uuid)

#------------------------------------------------------------
# Ajout d'une preuve
#------------------------------------------------------------

insert_evidence <- function(con, evidence) {

  DBI::dbExecute(
    con,
    "
    INSERT INTO evidence (

      uuid,
      number,

      mission_uuid,
      question_uuid,

      filename_original,
      filename_storage,

      extension,
      mime_type,

      size_bytes,

      sha256,
      md5,

      pages,
      width,
      height,
      dpi,

      created_by,
      created_at,
      collected_at,

      version,

      status,

      comment,

      storage_path,

      thumbnail_path,

      ocr_text,

      signature,

      deleted

    )

    VALUES (

      ?,?,?,?,?,?,
      ?,?,?,?,
      ?,?,?,?,
      ?,?,?,?,
      ?,?,?,?,
      ?,?,?,?,
      ?,?

    )
    ",

    params = list(

      evidence$uuid,
      evidence$number,

      evidence$mission_uuid,
      evidence$question_uuid,

      evidence$filename_original,
      evidence$filename_storage,

      evidence$extension,
      evidence$mime,

      evidence$size,

      evidence$sha256,
      evidence$md5,

      evidence$pages,
      evidence$width,
      evidence$height,
      evidence$dpi,

      evidence$created_by,
      evidence$created_at,
      evidence$collected_at,

      evidence$version,

      evidence$status,

      evidence$comment,

      evidence$storage_path,

      evidence$thumbnail_path,

      evidence$ocr_text,

      evidence$signature,

      evidence$deleted

    )

  )

}
