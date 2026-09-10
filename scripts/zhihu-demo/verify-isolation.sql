-- Uses disposable identities inside one atomic statement; leaves no test data.
DO $test$
DECLARE
  s text := current_schema();
  caller_role text := current_user;
  user_a text := 'qa_a_' || gen_random_uuid()::text;
  user_b text := 'qa_b_' || gen_random_uuid()::text;
  n integer;
  rejected boolean;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', 'authenticated_' || s);
  PERFORM set_config('app.user_id', user_a, true);
  INSERT INTO zhihu_demo_profiles(owner_id, display_name, bio) VALUES (user_a, 'isolation-test', '');
  INSERT INTO zhihu_demo_activity(owner_id,kind,target_id) VALUES (user_a,'bookmark','learning-with-ai');
  SELECT count(*) INTO n FROM zhihu_demo_profiles WHERE owner_id=user_a;
  IF n <> 1 THEN RAISE EXCEPTION 'Owner cannot read own profile'; END IF;
  SELECT count(*) INTO n FROM zhihu_demo_activity WHERE owner_id=user_a;
  IF n <> 1 THEN RAISE EXCEPTION 'Owner cannot read own bookmark'; END IF;

  PERFORM set_config('app.user_id', user_b, true);
  SELECT count(*) INTO n FROM zhihu_demo_profiles WHERE owner_id=user_a;
  IF n <> 0 THEN RAISE EXCEPTION 'Cross-account profile read'; END IF;
  SELECT count(*) INTO n FROM zhihu_demo_activity WHERE owner_id=user_a;
  IF n <> 0 THEN RAISE EXCEPTION 'Cross-account activity read'; END IF;
  UPDATE zhihu_demo_profiles SET bio='unauthorized' WHERE owner_id=user_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Cross-account profile update'; END IF;
  DELETE FROM zhihu_demo_activity WHERE owner_id=user_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Cross-account activity delete'; END IF;
  rejected := false;
  BEGIN
    INSERT INTO zhihu_demo_activity(owner_id,kind,target_id) VALUES (user_a,'vote','learning-with-ai');
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Forged owner insert accepted'; END IF;
  INSERT INTO zhihu_demo_activity(owner_id,kind,target_id) VALUES (user_b,'vote','learning-with-ai');

  EXECUTE format('SET LOCAL ROLE %I', caller_role);
  EXECUTE format('SET LOCAL ROLE %I', 'anon_' || s);
  PERFORM set_config('app.user_id', '', true);
  rejected := false;
  BEGIN
    SELECT count(*) INTO n FROM zhihu_demo_activity WHERE owner_id=user_a;
    IF n = 0 THEN rejected := true; END IF;
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Anonymous data leak'; END IF;

  EXECUTE format('SET LOCAL ROLE %I', caller_role);
  DELETE FROM zhihu_demo_profiles WHERE owner_id IN (user_a,user_b);
  DELETE FROM zhihu_demo_activity WHERE owner_id IN (user_a,user_b);
END $test$;
