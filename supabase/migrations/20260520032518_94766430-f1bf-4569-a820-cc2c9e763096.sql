CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job anterior (se houver) para idempotência
DO $$
BEGIN
  PERFORM cron.unschedule('disparo-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'disparo-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--19d7a289-449c-48b2-8793-a108b5c1bf64.lovable.app/api/public/hooks/disparo-tick',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpc3Z6a2l5enN5dmpucXBvY21uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMjg2NTgsImV4cCI6MjA5NDgwNDY1OH0.3CdQlyL_Zk9a1stfyhxzIBh4MWiGIVfRNVO3-PW3KCI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);