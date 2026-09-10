-- Narrow write capability for server-validated public search results only.
-- Does not permit modification of curated catalogs, identity or search budgets.
DO $migration$
DECLARE app_schema text := current_schema();
BEGIN
  EXECUTE format($definition$
    CREATE OR REPLACE FUNCTION %I.zhilu_index_question(question_id text, question_payload text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = %I, pg_catalog AS $body$
    DECLARE value jsonb;
    BEGIN
      IF question_id !~ '^[1-9][0-9]{0,24}$' OR length(question_payload) > 50000 THEN RAISE EXCEPTION 'invalid_question'; END IF;
      value := question_payload::jsonb;
      IF value->>'id' IS DISTINCT FROM question_id OR value->>'origin' IS DISTINCT FROM 'search'
        OR value->>'url' IS DISTINCT FROM 'https://www.zhihu.com/question/' || question_id
        OR jsonb_typeof(value->'sources') IS DISTINCT FROM 'array'
        OR length(value->>'title') > 300 THEN RAISE EXCEPTION 'invalid_question'; END IF;
      INSERT INTO zhilu_catalog(catalog_key, payload) VALUES ('question:' || question_id, question_payload)
      ON CONFLICT (catalog_key) DO UPDATE SET payload = EXCLUDED.payload, _updated_at = clock_timestamp();
    END $body$;
  $definition$, app_schema, app_schema);
  EXECUTE format('REVOKE ALL ON FUNCTION %I.zhilu_index_question(text,text) FROM PUBLIC', app_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %I.zhilu_index_question(text,text) TO anon, authenticated, service_role', app_schema);
END $migration$;
