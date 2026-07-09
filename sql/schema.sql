-- ============================================================
-- DIAM
-- Database schema
-- SQLite
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- CLIENT
-- ============================================================

CREATE TABLE IF NOT EXISTS client (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    name TEXT NOT NULL,

    siren TEXT,

    vat TEXT,

    address TEXT,

    postal_code TEXT,

    city TEXT,

    country TEXT,

    contact TEXT,

    email TEXT,

    phone TEXT,

    created_at TEXT NOT NULL,

    updated_at TEXT

);

CREATE INDEX IF NOT EXISTS idx_client_name
ON client(name);

CREATE INDEX IF NOT EXISTS idx_client_siren
ON client(siren);

CREATE TABLE IF NOT EXISTS client_document (

    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    sha256 TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    extracted_text TEXT,
    status TEXT DEFAULT 'ACTIVE',
    uploaded_by TEXT,
    uploaded_at TEXT NOT NULL,

    FOREIGN KEY (client_id)
        REFERENCES client(id)

);

CREATE INDEX IF NOT EXISTS idx_client_document_client
ON client_document(client_id);

CREATE TABLE IF NOT EXISTS client_scope (

    client_id INTEGER PRIMARY KEY,
    source_document_id INTEGER,
    role_pdpe INTEGER DEFAULT 0,
    role_pdpr INTEGER DEFAULT 0,
    e_reporting INTEGER DEFAULT 0,
    peppol INTEGER DEFAULT 0,
    api_only INTEGER DEFAULT 0,
    format_conversion INTEGER DEFAULT 0,
    od_layer INTEGER DEFAULT 0,
    cloud_external INTEGER DEFAULT 0,
    secnumcloud INTEGER DEFAULT 0,
    white_label INTEGER DEFAULT 0,
    b2b_domestic INTEGER DEFAULT 0,
    b2b_international INTEGER DEFAULT 0,
    b2c INTEGER DEFAULT 0,
    payment_data INTEGER DEFAULT 0,
    supported_flows TEXT,
    scope_summary TEXT,
    analyzed_at TEXT,
    analyzed_by TEXT,

    FOREIGN KEY (client_id)
        REFERENCES client(id),

    FOREIGN KEY (source_document_id)
        REFERENCES client_document(id)

);

-- ============================================================
-- AUDITOR
-- ============================================================

CREATE TABLE IF NOT EXISTS auditor (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    lastname TEXT NOT NULL,

    firstname TEXT NOT NULL,

    email TEXT,

    phone TEXT,

    company TEXT,

    role TEXT,

    active INTEGER DEFAULT 1,

    created_at TEXT NOT NULL,

    updated_at TEXT

);

CREATE INDEX IF NOT EXISTS idx_auditor_name
ON auditor(lastname);

-- ============================================================
-- REFERENTIAL
-- ============================================================

CREATE TABLE IF NOT EXISTS referential (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    code TEXT NOT NULL,

    title TEXT NOT NULL,

    version TEXT NOT NULL,

    publisher TEXT,

    publication_date TEXT,

    description TEXT,

    active INTEGER DEFAULT 1,

    created_at TEXT NOT NULL

);

CREATE INDEX IF NOT EXISTS idx_referential_code
ON referential(code);

-- ============================================================
-- MISSION
-- ============================================================

CREATE TABLE IF NOT EXISTS mission (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    number TEXT NOT NULL UNIQUE,

    client_id INTEGER NOT NULL,

    referential_id INTEGER NOT NULL,

    title TEXT NOT NULL,

    scope TEXT,

    audit_period_start TEXT,

    audit_period_end TEXT,

    start_date TEXT,

    end_date TEXT,

    status TEXT DEFAULT 'CREATED',

    progress INTEGER DEFAULT 0,

    report_version TEXT,

    created_by TEXT,

    created_at TEXT NOT NULL,

    updated_at TEXT,

    FOREIGN KEY (client_id)
        REFERENCES client(id),

    FOREIGN KEY (referential_id)
        REFERENCES referential(id)

);

CREATE INDEX IF NOT EXISTS idx_mission_number
ON mission(number);

CREATE INDEX IF NOT EXISTS idx_mission_status
ON mission(status);

CREATE INDEX IF NOT EXISTS idx_mission_client
ON mission(client_id);

-- ============================================================
-- MISSION / AUDITOR
-- Une mission possède plusieurs auditeurs
-- Un auditeur participe à plusieurs missions
-- ============================================================

CREATE TABLE IF NOT EXISTS mission_auditor (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    mission_id INTEGER NOT NULL,

    auditor_id INTEGER NOT NULL,

    role TEXT,

    lead_auditor INTEGER DEFAULT 0,

    created_at TEXT,

    FOREIGN KEY (mission_id)
        REFERENCES mission(id),

    FOREIGN KEY (auditor_id)
        REFERENCES auditor(id)

);

CREATE INDEX IF NOT EXISTS idx_mission_auditor
ON mission_auditor(
    mission_id,
    auditor_id
);
-- ============================================================
-- QUESTION
-- ============================================================

CREATE TABLE IF NOT EXISTS question (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    mission_id INTEGER NOT NULL,

    reference TEXT NOT NULL,

    chapter TEXT,

    title TEXT NOT NULL,

    description TEXT,

    requirement TEXT,

    criticality TEXT,

    verification_method TEXT,

    expected_evidence TEXT,

    status TEXT DEFAULT 'NOT_STARTED',

    created_at TEXT NOT NULL,

    updated_at TEXT,

    FOREIGN KEY (mission_id)
        REFERENCES mission(id)

);

CREATE INDEX IF NOT EXISTS idx_question_mission
ON question(mission_id);

CREATE INDEX IF NOT EXISTS idx_question_reference
ON question(reference);

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_mission_reference
ON question(mission_id, reference);

CREATE INDEX IF NOT EXISTS idx_question_status
ON question(status);

-- ============================================================
-- ANSWER
-- ============================================================

CREATE TABLE IF NOT EXISTS answer (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    question_id INTEGER NOT NULL,

    answer TEXT,

    compliance_status TEXT,

    comment TEXT,

    answered_by INTEGER,

    answered_at TEXT,

    reviewed_by INTEGER,

    reviewed_at TEXT,

    created_at TEXT,

    updated_at TEXT,

    FOREIGN KEY (question_id)
        REFERENCES question(id),

    FOREIGN KEY (answered_by)
        REFERENCES auditor(id),

    FOREIGN KEY (reviewed_by)
        REFERENCES auditor(id)

);

CREATE INDEX IF NOT EXISTS idx_answer_question
ON answer(question_id);

-- ============================================================
-- EVIDENCE
-- ============================================================

CREATE TABLE IF NOT EXISTS evidence (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    mission_id INTEGER NOT NULL,

    evidence_number TEXT,

    original_name TEXT NOT NULL,

    stored_name TEXT NOT NULL,

    description TEXT,

    extension TEXT,

    mime_type TEXT,

    document_type TEXT,

    file_size INTEGER,

    sha256 TEXT NOT NULL,

    sha512 TEXT,

    version INTEGER DEFAULT 1,

    status TEXT DEFAULT 'ACTIVE',

    uploaded_by INTEGER,

    uploaded_at TEXT,

    archive_path TEXT,

    signature TEXT,

    comments TEXT,

    created_at TEXT,

    updated_at TEXT,

    FOREIGN KEY (mission_id)
        REFERENCES mission(id),

    FOREIGN KEY (uploaded_by)
        REFERENCES auditor(id)

);

CREATE INDEX IF NOT EXISTS idx_evidence_mission
ON evidence(mission_id);

CREATE INDEX IF NOT EXISTS idx_evidence_sha256
ON evidence(sha256);

CREATE INDEX IF NOT EXISTS idx_evidence_status
ON evidence(status);

-- ============================================================
-- QUESTION / EVIDENCE
-- Relation N <-> N
-- ============================================================

CREATE TABLE IF NOT EXISTS question_evidence (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    question_id INTEGER NOT NULL,

    evidence_id INTEGER NOT NULL,

    usage TEXT,

    comments TEXT,

    created_at TEXT,

    FOREIGN KEY (question_id)
        REFERENCES question(id),

    FOREIGN KEY (evidence_id)
        REFERENCES evidence(id)

);

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_evidence_unique
ON question_evidence(
    question_id,
    evidence_id
);

CREATE INDEX IF NOT EXISTS idx_question_evidence_question
ON question_evidence(question_id);

CREATE INDEX IF NOT EXISTS idx_question_evidence_evidence
ON question_evidence(evidence_id);
-- ============================================================
-- FINDING (CONSTAT)
-- ============================================================

CREATE TABLE IF NOT EXISTS finding (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    question_id INTEGER NOT NULL,

    auditor_id INTEGER,

    finding_number TEXT,

    summary TEXT NOT NULL,

    analysis TEXT,

    risk TEXT,

    impact TEXT,

    recommendation TEXT,

    conclusion TEXT,

    decision TEXT,

    status TEXT DEFAULT 'DRAFT',

    created_at TEXT NOT NULL,

    updated_at TEXT,

    validated_by INTEGER,

    validated_at TEXT,

    FOREIGN KEY(question_id)
        REFERENCES question(id),

    FOREIGN KEY(auditor_id)
        REFERENCES auditor(id),

    FOREIGN KEY(validated_by)
        REFERENCES auditor(id)

);

CREATE INDEX IF NOT EXISTS idx_finding_question
ON finding(question_id);

CREATE INDEX IF NOT EXISTS idx_finding_status
ON finding(status);

CREATE INDEX IF NOT EXISTS idx_finding_auditor
ON finding(auditor_id);

-- ============================================================
-- NON CONFORMITY
-- ============================================================

CREATE TABLE IF NOT EXISTS non_conformity (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    finding_id INTEGER NOT NULL,

    nc_number TEXT,

    severity TEXT NOT NULL,

    category TEXT,

    status TEXT DEFAULT 'OPEN',

    title TEXT,

    description TEXT,

    root_cause TEXT,

    consequence TEXT,

    decision TEXT,

    created_by INTEGER,

    created_at TEXT NOT NULL,

    updated_at TEXT,

    closed_at TEXT,

    FOREIGN KEY(finding_id)
        REFERENCES finding(id),

    FOREIGN KEY(created_by)
        REFERENCES auditor(id)

);

CREATE INDEX IF NOT EXISTS idx_nc_finding
ON non_conformity(finding_id);

CREATE INDEX IF NOT EXISTS idx_nc_status
ON non_conformity(status);

CREATE INDEX IF NOT EXISTS idx_nc_severity
ON non_conformity(severity);

-- ============================================================
-- ACTION PLAN
-- ============================================================

CREATE TABLE IF NOT EXISTS action_plan (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    nc_id INTEGER NOT NULL,

    action_number TEXT,

    action TEXT NOT NULL,

    owner TEXT,

    priority TEXT,

    due_date TEXT,

    completion_date TEXT,

    status TEXT DEFAULT 'OPEN',

    effectiveness TEXT,

    verification_comment TEXT,

    verified_by INTEGER,

    verified_at TEXT,

    created_at TEXT NOT NULL,

    updated_at TEXT,

    FOREIGN KEY(nc_id)
        REFERENCES non_conformity(id),

    FOREIGN KEY(verified_by)
        REFERENCES auditor(id)

);

CREATE INDEX IF NOT EXISTS idx_action_nc
ON action_plan(nc_id);

CREATE INDEX IF NOT EXISTS idx_action_status
ON action_plan(status);

-- ============================================================
-- FINDING / EVIDENCE
-- Une preuve peut soutenir plusieurs constats
-- ============================================================

CREATE TABLE IF NOT EXISTS finding_evidence (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    finding_id INTEGER NOT NULL,

    evidence_id INTEGER NOT NULL,

    usage TEXT,

    created_at TEXT,

    FOREIGN KEY(finding_id)
        REFERENCES finding(id),

    FOREIGN KEY(evidence_id)
        REFERENCES evidence(id)

);

CREATE UNIQUE INDEX IF NOT EXISTS idx_finding_evidence_unique
ON finding_evidence(
    finding_id,
    evidence_id
);

CREATE INDEX IF NOT EXISTS idx_finding_evidence_finding
ON finding_evidence(finding_id);

CREATE INDEX IF NOT EXISTS idx_finding_evidence_evidence
ON finding_evidence(evidence_id);
-- ============================================================
-- REPORT
-- ============================================================

CREATE TABLE IF NOT EXISTS report (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    mission_id INTEGER NOT NULL,

    report_number TEXT,

    version TEXT,

    status TEXT DEFAULT 'DRAFT',

    word_file TEXT,

    pdf_file TEXT,

    evidence_book_file TEXT,

    generated_by INTEGER,

    generated_at TEXT,

    signed INTEGER DEFAULT 0,

    signed_by INTEGER,

    signed_at TEXT,

    created_at TEXT NOT NULL,

    updated_at TEXT,

    FOREIGN KEY (mission_id)
        REFERENCES mission(id),

    FOREIGN KEY (generated_by)
        REFERENCES auditor(id),

    FOREIGN KEY (signed_by)
        REFERENCES auditor(id)

);

CREATE INDEX IF NOT EXISTS idx_report_mission
ON report(mission_id);

CREATE INDEX IF NOT EXISTS idx_report_status
ON report(status);

-- ============================================================
-- CERTIFICATE
-- ============================================================

CREATE TABLE IF NOT EXISTS certificate (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    mission_id INTEGER NOT NULL,

    report_id INTEGER,

    certificate_number TEXT,

    status TEXT DEFAULT 'DRAFT',

    signature TEXT,

    issued_by INTEGER,

    issued_at TEXT,

    created_at TEXT,

    FOREIGN KEY (mission_id)
        REFERENCES mission(id),

    FOREIGN KEY (report_id)
        REFERENCES report(id),

    FOREIGN KEY (issued_by)
        REFERENCES auditor(id)

);

CREATE INDEX IF NOT EXISTS idx_certificate_mission
ON certificate(mission_id);

-- ============================================================
-- WORKFLOW HISTORY
-- Historique des changements d'état
-- ============================================================

CREATE TABLE IF NOT EXISTS workflow_history (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    mission_id INTEGER NOT NULL,

    object_type TEXT NOT NULL,

    object_id INTEGER,

    previous_status TEXT,

    new_status TEXT,

    changed_by INTEGER,

    changed_at TEXT,

    comments TEXT,

    FOREIGN KEY (mission_id)
        REFERENCES mission(id),

    FOREIGN KEY (changed_by)
        REFERENCES auditor(id)

);

CREATE INDEX IF NOT EXISTS idx_workflow_mission
ON workflow_history(mission_id);

CREATE INDEX IF NOT EXISTS idx_workflow_object
ON workflow_history(object_type);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    uuid TEXT NOT NULL UNIQUE,

    mission_id INTEGER,

    user_name TEXT,

    action TEXT,

    object_type TEXT,

    object_uuid TEXT,

    timestamp TEXT,

    details TEXT,

    FOREIGN KEY (mission_id)
        REFERENCES mission(id)

);

CREATE INDEX IF NOT EXISTS idx_log_mission
ON audit_log(mission_id);

CREATE INDEX IF NOT EXISTS idx_log_timestamp
ON audit_log(timestamp);

-- ============================================================
-- SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (

    key TEXT PRIMARY KEY,

    value TEXT,

    updated_at TEXT

);

-- ============================================================
-- INITIAL SETTINGS
-- ============================================================

INSERT OR IGNORE INTO settings(key, value)
VALUES
('database_version','1.0.0');

INSERT OR IGNORE INTO settings(key, value)
VALUES
('application','DIAM');

INSERT OR IGNORE INTO settings(key, value)
VALUES
('evidence_number','0');

INSERT OR IGNORE INTO settings(key, value)
VALUES
('report_number','0');

INSERT OR IGNORE INTO settings(key, value)
VALUES
('certificate_number','0');

INSERT OR IGNORE INTO settings(key, value)
VALUES
('mission_number','0');

INSERT OR IGNORE INTO settings(key, value)
VALUES
('finding_number','0');

INSERT OR IGNORE INTO settings(key, value)
VALUES
('nc_number','0');

INSERT OR IGNORE INTO settings(key, value)
VALUES
('action_number','0');

-- ============================================================
-- VIEW : DASHBOARD
-- ============================================================

CREATE VIEW IF NOT EXISTS vw_dashboard AS

SELECT

m.id,

m.number,

m.title,

m.status,

COUNT(DISTINCT q.id)              AS questions,

COUNT(DISTINCT a.id)              AS answers,

COUNT(DISTINCT e.id)              AS evidences,

COUNT(DISTINCT f.id)              AS findings,

COUNT(DISTINCT nc.id)             AS non_conformities,

COUNT(DISTINCT ap.id)             AS action_plans

FROM mission m

LEFT JOIN question q
ON q.mission_id = m.id

LEFT JOIN answer a
ON a.question_id = q.id

LEFT JOIN evidence e
ON e.mission_id = m.id

LEFT JOIN finding f
ON f.question_id = q.id

LEFT JOIN non_conformity nc
ON nc.finding_id = f.id

LEFT JOIN action_plan ap
ON ap.nc_id = nc.id

GROUP BY
m.id,
m.number,
m.title,
m.status;
