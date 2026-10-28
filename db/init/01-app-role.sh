#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 \
  -v app_user="$APP_DB_USER" \
  -v app_password="$APP_DB_PASSWORD" \
  -v db_name="$POSTGRES_DB" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<-'EOSQL'
	CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password';
	GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";
	GRANT USAGE ON SCHEMA public TO :"app_user";
EOSQL
