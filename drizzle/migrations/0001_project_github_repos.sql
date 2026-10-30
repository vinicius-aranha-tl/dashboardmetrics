ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS api_repo_owner text,
  ADD COLUMN IF NOT EXISTS api_repo_name text,
  ADD COLUMN IF NOT EXISTS api_branch text NOT NULL DEFAULT 'automation-metrics',
  ADD COLUMN IF NOT EXISTS ui_repo_owner text,
  ADD COLUMN IF NOT EXISTS ui_repo_name text,
  ADD COLUMN IF NOT EXISTS ui_branch text NOT NULL DEFAULT 'automation-metrics',
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_error text;
COMMENT ON COLUMN public.projects.api_executions_url IS 'DEPRECATED fallback: replaced by api_repo_owner/api_repo_name/api_branch';
COMMENT ON COLUMN public.projects.api_evolution_url IS 'DEPRECATED fallback: replaced by api_repo_owner/api_repo_name/api_branch';
COMMENT ON COLUMN public.projects.ui_executions_url IS 'DEPRECATED fallback: replaced by ui_repo_owner/ui_repo_name/ui_branch';
COMMENT ON COLUMN public.projects.ui_evolution_url IS 'DEPRECATED fallback: replaced by ui_repo_owner/ui_repo_name/ui_branch';