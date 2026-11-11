-- 0005_background_work — lets the Node background worker find pending
-- documents and queued evaluations across users without bypassing RLS for
-- anything else. The function returns only ids and owners; the worker then
-- processes each item inside that owner's RLS context (withUser).
CREATE FUNCTION omnix_pending_work(p_limit integer)
RETURNS TABLE (kind text, id uuid, owner_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  (SELECT 'document'::text, d.id, d.owner_id FROM ai_knowledge_documents d
    WHERE d.processing_status = 'pending' AND d.updated_at < now() - interval '3 seconds'
    ORDER BY d.updated_at LIMIT p_limit)
  UNION ALL
  (SELECT 'evaluation'::text, r.id, r.owner_id FROM ai_evaluation_runs r
    WHERE r.status = 'queued' AND r.created_at < now() - interval '3 seconds'
    ORDER BY r.created_at LIMIT p_limit)
$$;

-- Work abandoned by a crashed process goes back to the queue.
CREATE FUNCTION omnix_requeue_stale_work() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE n integer; m integer;
BEGIN
  UPDATE ai_knowledge_documents SET processing_status = 'pending'
   WHERE processing_status = 'processing' AND updated_at < now() - interval '15 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE ai_evaluation_runs SET status = 'error', error = 'Interrupted (worker stopped)', completed_at = now()
   WHERE status = 'running' AND started_at < now() - interval '2 hours';
  GET DIAGNOSTICS m = ROW_COUNT;
  RETURN n + m;
END
$$;

REVOKE ALL ON FUNCTION omnix_pending_work(integer), omnix_requeue_stale_work() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION omnix_pending_work(integer), omnix_requeue_stale_work() TO omnix_app;
