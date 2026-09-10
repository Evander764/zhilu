-- Apply through the official application DB admin command. No content or secrets.
-- The SDK carries the visitor role into SQL. Visitors may consume a bounded slot,
-- but cannot read, modify or reset the budget table directly.
DO $migration$
DECLARE app_schema text := current_schema();
BEGIN
  EXECUTE format($definition$
    CREATE OR REPLACE FUNCTION %I.zhilu_reserve_search(requested_limit integer DEFAULT 200)
    RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = %I, pg_catalog AS $body$
    DECLARE reserved_id uuid; reserved_used integer; daily_key text;
    BEGIN
      INSERT INTO zhilu_budget (bucket, used) VALUES ('burst', 1)
      ON CONFLICT (bucket) DO UPDATE SET _updated_at = clock_timestamp(), used = 1
      WHERE zhilu_budget._updated_at < clock_timestamp() - interval '2 seconds'
      RETURNING id INTO reserved_id;
      IF reserved_id IS NULL THEN RETURN 'burst'; END IF;
      daily_key := 'day:' || to_char(clock_timestamp() AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD');
      INSERT INTO zhilu_budget (bucket, used) VALUES (daily_key, 1)
      ON CONFLICT (bucket) DO UPDATE SET used = zhilu_budget.used + 1, _updated_at = clock_timestamp()
      WHERE zhilu_budget.used < greatest(1, least(200, coalesce(requested_limit, 200)))
      RETURNING used INTO reserved_used;
      IF reserved_used IS NULL THEN RETURN 'quota'; END IF;
      RETURN 'allowed';
    END $body$;
  $definition$, app_schema, app_schema);
  EXECUTE format('REVOKE ALL ON FUNCTION %I.zhilu_reserve_search(integer) FROM PUBLIC', app_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %I.zhilu_reserve_search(integer) TO anon, authenticated, service_role', app_schema);
END $migration$;
