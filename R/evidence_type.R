library(fs)

detect_evidence_type <- function(file) {

  ext <- tolower(fs::path_ext(file))

  switch(

    ext,

    pdf = "pdf",

    doc = "office",

    docx = "office",

    odt = "office",

    xls = "spreadsheet",

    xlsx = "spreadsheet",

    ods = "spreadsheet",

    csv = "spreadsheet",

    png = "image",

    jpg = "image",

    jpeg = "image",

    bmp = "image",

    tif = "image",

    tiff = "image",

    gif = "image",

    json = "json",

    xml = "xml",

    txt = "text",

    log = "log",

    zip = "archive",

    "other"

  )

}
