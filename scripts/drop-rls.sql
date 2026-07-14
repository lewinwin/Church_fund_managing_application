-- Branch isolation moved from database RLS to an application-level gate
-- (src/lib/server/scope.ts: branchScope) for testability + no per-request
-- set_config round-trip. Drop the policies and disable RLS on the tables that
-- were scoped, so the app role can read/write and the app does the filtering.
--
-- Run this once per database (Supabase and any pure-Postgres deployment) when
-- deploying the scope-based code. Superseded scripts/rls.sql.
DROP POLICY IF EXISTS branch_isolation ON expenses;
DROP POLICY IF EXISTS branch_isolation ON funding_plans;
DROP POLICY IF EXISTS branch_isolation ON fund_releases;

ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE funding_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE fund_releases DISABLE ROW LEVEL SECURITY;
