-- Add viewable period column for existing environments
ALTER TABLE RPT.TB_RPT_WORKFLOW_JOBS
ADD VIEWABLE_UNTIL TIMESTAMP(6) WITH TIME ZONE;
