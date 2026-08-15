#!/bin/sh
set -eu

: "${APP_DB_USER:?APP_DB_USER is required}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"

case "$APP_DB_USER" in
  ''|*[!a-zA-Z0-9_]*)
    echo "APP_DB_USER must contain only letters, numbers and underscores" >&2
    exit 1
    ;;
esac

psql --set=ON_ERROR_STOP=1 \
  --set=app_db_user="$APP_DB_USER" \
  --set=app_db_password="$APP_DB_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'app_db_user',
  :'app_db_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_db_user') \gexec

SELECT format(
  'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'app_db_user',
  :'app_db_password'
) \gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_db_user') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_db_user') \gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', :'app_db_user') \gexec
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_db_user') \gexec

-- Históricos, auditoria e snapshots são append-only também no nível de grants.
-- Os triggers das migrations continuam como segunda barreira para qualquer role
-- que receba privilégios mais amplos por engano no futuro.
SELECT format('REVOKE UPDATE, DELETE ON TABLE public.%I FROM %I', table_name, :'app_db_user')
FROM (VALUES
  ('AuditLog'),
  ('AssetAssociationHistory'),
  ('ProjectPersonaUsage'),
  ('ProjectQuestionnaireUsage')
) AS append_only(table_name)
WHERE to_regclass(format('public.%I', table_name)) IS NOT NULL
\gexec
SQL
