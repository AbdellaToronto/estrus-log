-- Add configuration columns for flexible/general purpose tracking

-- Update Cohorts to store configuration templates
alter table cohorts 
add column type text default 'estrus_tracking', -- 'estrus_tracking', 'general', etc.
add column subject_config jsonb default '{}'::jsonb, -- Defines custom fields for subjects (e.g. genotype)
add column log_config jsonb default '{}'::jsonb; -- Defines fields for logs (e.g. valid stages, measurements)

-- Update Mice (Subjects) to support flexible metadata
alter table mice 
add column metadata jsonb default '{}'::jsonb;

-- Update Logs to support flexible data
alter table estrus_logs 
add column data jsonb default '{}'::jsonb; -- Generic bucket for measurements/observations

