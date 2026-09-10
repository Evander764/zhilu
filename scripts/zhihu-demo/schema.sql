CREATE TABLE IF NOT EXISTS zhihu_demo_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id varchar(80) NOT NULL UNIQUE,
  display_name varchar(60) NOT NULL DEFAULT '',
  bio varchar(160) NOT NULL DEFAULT '',
  preferences text NOT NULL DEFAULT '{"recordHistory":true,"emailNotifications":false,"compactFeed":false}',
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile,
  _updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile
);
CREATE TABLE IF NOT EXISTS zhihu_demo_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id varchar(80) NOT NULL,
  kind varchar(20) NOT NULL CHECK (kind IN ('bookmark','history','vote','follow')),
  target_id varchar(80) NOT NULL,
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile,
  _updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile,
  UNIQUE(owner_id, kind, target_id)
);
DO $migration$
DECLARE t text; p record; s text := current_schema(); auth_role text; service_role_name text; anon_role text;
BEGIN
  auth_role := 'authenticated_' || s;
  service_role_name := 'service_role_' || s;
  anon_role := 'anon_' || s;
  FOREACH t IN ARRAY ARRAY['zhihu_demo_profiles','zhihu_demo_activity'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname=s AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON %I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY own_rows ON %I FOR ALL TO %I USING (owner_id = NULLIF(current_setting(''app.user_id'', true), '''')) WITH CHECK (owner_id = NULLIF(current_setting(''app.user_id'', true), ''''))', t, auth_role);
    EXECUTE format('CREATE POLICY service_access ON %I FOR ALL TO %I USING (true) WITH CHECK (true)', t, service_role_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I, %I', t, auth_role, service_role_name);
    EXECUTE format('REVOKE ALL ON %I FROM %I, anon, authenticated, service_role', t, anon_role);
  END LOOP;
END $migration$;
