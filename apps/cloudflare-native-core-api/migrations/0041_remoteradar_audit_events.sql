CREATE TABLE IF NOT EXISTS remoteradar_audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'resume.uploaded',
    'resume.parsed',
    'resume.parse_failed',
    'resume.deleted',
    'application_pack.generated',
    'application_pack.approved',
    'application.sent',
    'application.send_failed'
  )),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('resume', 'resume_document', 'application_pack', 'application')),
  resource_id TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  CHECK (json_valid(metadata)),
  CHECK (length(metadata) <= 1024)
);

CREATE INDEX IF NOT EXISTS idx_remoteradar_audit_events_user_created
ON remoteradar_audit_events(user_id, created_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_remoteradar_audit_resume_uploaded
AFTER INSERT ON remoteradar_resume_documents
BEGIN
  INSERT INTO remoteradar_audit_events
    (id, user_id, event_type, resource_type, resource_id, metadata, created_at)
  VALUES
    (lower(hex(randomblob(16))), NEW.user_id, 'resume.uploaded', 'resume_document', NEW.id,
     json_object('resumeId', NEW.resume_id), NEW.created_at);
END;

CREATE TRIGGER IF NOT EXISTS trg_remoteradar_audit_resume_parsed
AFTER UPDATE OF extraction_status ON remoteradar_resume_documents
WHEN OLD.extraction_status <> NEW.extraction_status AND NEW.extraction_status = 'ready'
BEGIN
  INSERT INTO remoteradar_audit_events
    (id, user_id, event_type, resource_type, resource_id, metadata, created_at)
  VALUES
    (lower(hex(randomblob(16))), NEW.user_id, 'resume.parsed', 'resume_document', NEW.id,
     json_object('resumeId', NEW.resume_id), NEW.updated_at);
END;

CREATE TRIGGER IF NOT EXISTS trg_remoteradar_audit_resume_parse_failed
AFTER UPDATE OF extraction_status ON remoteradar_resume_documents
WHEN OLD.extraction_status <> NEW.extraction_status AND NEW.extraction_status = 'failed'
BEGIN
  INSERT INTO remoteradar_audit_events
    (id, user_id, event_type, resource_type, resource_id, metadata, created_at)
  VALUES
    (lower(hex(randomblob(16))), NEW.user_id, 'resume.parse_failed', 'resume_document', NEW.id,
     json_object('resumeId', NEW.resume_id), NEW.updated_at);
END;

CREATE TRIGGER IF NOT EXISTS trg_remoteradar_audit_resume_deleted
BEFORE DELETE ON native_rr_resumes
BEGIN
  INSERT INTO remoteradar_audit_events
    (id, user_id, event_type, resource_type, resource_id, metadata, created_at)
  VALUES
    (lower(hex(randomblob(16))), OLD.user_id, 'resume.deleted', 'resume', OLD.id, '{}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER IF NOT EXISTS trg_remoteradar_audit_pack_generated
AFTER INSERT ON native_rr_application_pack_versions
BEGIN
  INSERT INTO remoteradar_audit_events
    (id, user_id, event_type, resource_type, resource_id, metadata, created_at)
  VALUES
    (lower(hex(randomblob(16))), NEW.user_id, 'application_pack.generated', 'application_pack', NEW.pack_id,
     json_object('versionId', NEW.id, 'version', NEW.version), NEW.created_at);
END;

CREATE TRIGGER IF NOT EXISTS trg_remoteradar_audit_pack_approved
AFTER UPDATE OF approved_at ON native_rr_application_pack_versions
WHEN OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL
BEGIN
  INSERT INTO remoteradar_audit_events
    (id, user_id, event_type, resource_type, resource_id, metadata, created_at)
  VALUES
    (lower(hex(randomblob(16))), NEW.user_id, 'application_pack.approved', 'application_pack', NEW.pack_id,
     json_object('versionId', NEW.id, 'version', NEW.version), NEW.approved_at);
END;

CREATE TRIGGER IF NOT EXISTS trg_remoteradar_audit_application_sent
AFTER UPDATE OF status ON remoteradar_application_submissions
WHEN OLD.status <> NEW.status AND NEW.status = 'sent'
BEGIN
  INSERT INTO remoteradar_audit_events
    (id, user_id, event_type, resource_type, resource_id, metadata, created_at)
  VALUES
    (lower(hex(randomblob(16))), NEW.user_id, 'application.sent', 'application', NEW.application_id,
     json_object('submissionId', NEW.id, 'transport', NEW.transport), COALESCE(NEW.sent_at, NEW.updated_at));
END;

CREATE TRIGGER IF NOT EXISTS trg_remoteradar_audit_application_send_failed
AFTER UPDATE OF status ON remoteradar_application_submissions
WHEN OLD.status <> NEW.status AND NEW.status = 'failed'
BEGIN
  INSERT INTO remoteradar_audit_events
    (id, user_id, event_type, resource_type, resource_id, metadata, created_at)
  VALUES
    (lower(hex(randomblob(16))), NEW.user_id, 'application.send_failed', 'application', NEW.application_id,
     json_object('submissionId', NEW.id, 'transport', NEW.transport), NEW.updated_at);
END;

INSERT INTO runtime_metadata(key, value) VALUES ('core_schema_version', '0041')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
