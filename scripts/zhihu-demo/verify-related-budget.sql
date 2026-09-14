-- Live DEV role test. A nested subtransaction deliberately rolls back fixtures.
DO $test$
DECLARE
  s text := current_schema();
  admin_role text := current_user;
  caller_role text;
  n integer;
  expected_used integer := 0;
  result text;
  denied boolean;
BEGIN
  BEGIN
  IF (SELECT count(*) FROM zhilu_budget) <> 0 THEN
    RAISE EXCEPTION 'Expected newly created empty counter table; refusing to alter existing counters';
  END IF;
  -- A later permissive policy must not override the restrictive caller deny.
  CREATE POLICY qa_permissive_probe ON zhilu_budget AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  INSERT INTO zhilu_budget(bucket,used) VALUES ('qa-read-probe',7);
  FOREACH caller_role IN ARRAY ARRAY['anon_' || s, 'authenticated_' || s] LOOP
    EXECUTE format('SET LOCAL ROLE %I', caller_role);
    PERFORM set_config('app.user_id', 'qa_related_budget_probe', true);
    denied := false;
    BEGIN
      SELECT count(*) INTO n FROM zhilu_budget WHERE bucket='qa-read-probe';
      denied := n = 0;
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'Visitor can read budget counters'; END IF;
    denied := false;
    BEGIN
      INSERT INTO zhilu_budget(bucket,used) VALUES ('qa-forged',0);
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'Visitor can insert budget counters'; END IF;
    denied := false;
    BEGIN
      UPDATE zhilu_budget SET used=0 WHERE bucket='qa-read-probe';
      GET DIAGNOSTICS n = ROW_COUNT;
      denied := n = 0;
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'Visitor can reset budget counters'; END IF;
    denied := false;
    BEGIN
      DELETE FROM zhilu_budget WHERE bucket='qa-read-probe';
      GET DIAGNOSTICS n = ROW_COUNT;
      denied := n = 0;
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'Visitor can delete budget counters'; END IF;
    -- An attacker-owned temporary table must not shadow the definer's counter table.
    CREATE TEMP TABLE zhilu_budget(bucket text, used integer);
    SELECT zhilu_reserve_search(1000) INTO result;
    IF result IS DISTINCT FROM 'allowed' THEN RAISE EXCEPTION 'Bounded request should be allowed, got %',result; END IF;
    SELECT zhilu_reserve_search(200) INTO result;
    IF result IS DISTINCT FROM 'burst' THEN RAISE EXCEPTION 'Immediate repeat should be burst, got %',result; END IF;
    IF (SELECT count(*) FROM pg_temp.zhilu_budget) <> 0 THEN RAISE EXCEPTION 'Function touched caller temporary table'; END IF;
    DROP TABLE pg_temp.zhilu_budget;
    EXECUTE format('SET LOCAL ROLE %I', admin_role);
    expected_used := expected_used + 1;
    SELECT used INTO n FROM zhilu_budget WHERE bucket='day:' || to_char(clock_timestamp() AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD');
    IF n IS DISTINCT FROM expected_used THEN RAISE EXCEPTION 'Counter must record each allowed request'; END IF;
    IF NOT EXISTS (SELECT 1 FROM zhilu_budget WHERE bucket='burst' AND used=1) THEN RAISE EXCEPTION 'Burst counter is missing'; END IF;
    UPDATE zhilu_budget SET _updated_at=clock_timestamp()-interval '3 seconds' WHERE bucket='burst';
  END LOOP;
  UPDATE zhilu_budget SET used=200 WHERE bucket LIKE 'day:%';
  EXECUTE format('SET LOCAL ROLE %I', 'anon_' || s);
  SELECT zhilu_reserve_search(1000) INTO result;
  IF result IS DISTINCT FROM 'quota' THEN RAISE EXCEPTION 'Caller must not raise daily ceiling above 200, got %',result; END IF;
  EXECUTE format('SET LOCAL ROLE %I', admin_role);
  IF EXISTS (SELECT 1 FROM zhilu_budget WHERE (bucket='burst' OR bucket LIKE 'day:%') AND (_created_by IS NOT NULL OR _updated_by IS NOT NULL)) THEN RAISE EXCEPTION 'Counters contain caller identities'; END IF;
  RAISE EXCEPTION USING ERRCODE='ZQ001', MESSAGE='rollback verified probe';
  EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL;
  END;
  IF (SELECT count(*) FROM zhilu_budget) <> 0 THEN RAISE EXCEPTION 'Probe data was not rolled back'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='zhilu_budget'::regclass AND polname='qa_permissive_probe') THEN RAISE EXCEPTION 'Probe policy was not rolled back'; END IF;
  IF to_regclass('pg_temp.zhilu_budget') IS NOT NULL THEN RAISE EXCEPTION 'Probe temporary table remains'; END IF;
END $test$;
SELECT count(*) AS rows_after_rollback FROM zhilu_budget;
