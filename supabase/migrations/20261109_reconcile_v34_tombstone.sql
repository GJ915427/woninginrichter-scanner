-- Reconcile historical v34 tombstone that failed due to 409 Conflict
UPDATE documents_store
SET is_deleted = true, updated_at = NOW()
WHERE filename = 'domeinmodel_woninginrichting_v34.md';
