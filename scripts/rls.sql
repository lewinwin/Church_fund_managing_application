-- Row-Level Security: a branch user can only see/modify rows for their own
-- branch. The app sets two session vars per request (inside a transaction):
--   SET LOCAL app.is_hq     = 'true'|'false'
--   SET LOCAL app.branch_id = '<branchId>'
-- Reference tables (branches, expense_categories) stay globally readable.
-- postgres (migrations/seed) and any superuser BYPASS RLS by design.
-- Missing session vars => deny (fail-closed): branch_id = NULL is never true.

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branch_isolation ON expenses;
CREATE POLICY branch_isolation ON expenses
  USING (current_setting('app.is_hq', true) = 'true'
         OR branch_id = current_setting('app.branch_id', true))
  WITH CHECK (current_setting('app.is_hq', true) = 'true'
         OR branch_id = current_setting('app.branch_id', true));

DROP POLICY IF EXISTS branch_isolation ON funding_plans;
CREATE POLICY branch_isolation ON funding_plans
  USING (current_setting('app.is_hq', true) = 'true'
         OR branch_id = current_setting('app.branch_id', true))
  WITH CHECK (current_setting('app.is_hq', true) = 'true'
         OR branch_id = current_setting('app.branch_id', true));

DROP POLICY IF EXISTS branch_isolation ON fund_releases;
CREATE POLICY branch_isolation ON fund_releases
  USING (current_setting('app.is_hq', true) = 'true'
         OR branch_id = current_setting('app.branch_id', true))
  WITH CHECK (current_setting('app.is_hq', true) = 'true'
         OR branch_id = current_setting('app.branch_id', true));
