-- Candidate for app_17dut1cfq4a / zhihu-hackathon-group6 DEV only.
-- Creates search counters only. No user content or credentials.
-- Platform manages grants; row policies deny visitor access to counter rows.
-- Execute through lark-cli apps +db-execute; then review dev -> online diff.
-- One DO statement keeps setup atomic across CLI statement boundaries.
DO $budget_setup$
BEGIN
CREATE TABLE zhilu_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket varchar(80) NOT NULL UNIQUE,
  used integer NOT NULL DEFAULT 0,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile
);
ALTER TABLE zhilu_budget ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_bypass_policy ON zhilu_budget
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "修改全部数据" ON zhilu_budget
  AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "查看全部数据" ON zhilu_budget
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (false);
CREATE POLICY "修改本人数据" ON zhilu_budget
  AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY budget_caller_deny ON zhilu_budget
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
COMMENT ON TABLE zhilu_budget IS 'Bounded search request counters; no queries or user identities.';
DO $migration$
DECLARE
  app_schema text := current_schema();
BEGIN
  EXECUTE format($definition$
    CREATE FUNCTION %1$I.zhilu_reserve_search(requested_limit integer DEFAULT 200)
    RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, %1$I, pg_temp AS $body$
    DECLARE reserved_id uuid; reserved_used integer; daily_key text;
    BEGIN
      INSERT INTO %1$I.zhilu_budget AS counters (bucket, used, _created_by, _updated_by) VALUES ('burst', 1, NULL, NULL)
      ON CONFLICT (bucket) DO UPDATE SET _updated_at = clock_timestamp(), used = 1, _updated_by = NULL
      WHERE counters._updated_at < clock_timestamp() - interval '2 seconds'
      RETURNING id INTO reserved_id;
      IF reserved_id IS NULL THEN RETURN 'burst'; END IF;
      daily_key := 'day:' || to_char(clock_timestamp() AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD');
      INSERT INTO %1$I.zhilu_budget AS counters (bucket, used, _created_by, _updated_by) VALUES (daily_key, 1, NULL, NULL)
      ON CONFLICT (bucket) DO UPDATE SET used = counters.used + 1, _updated_at = clock_timestamp(), _updated_by = NULL
      WHERE counters.used < greatest(1, least(200, coalesce(requested_limit, 200)))
      RETURNING used INTO reserved_used;
      IF reserved_used IS NULL THEN RETURN 'quota'; END IF;
      RETURN 'allowed';
    END $body$;
  $definition$, app_schema);
END $migration$;
END $budget_setup$;
