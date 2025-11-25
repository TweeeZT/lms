-- Backfill expire_at for progress rows where course.access_duration_days > 0
-- IMPORTANT: Review and run in Supabase SQL Editor or psql. Backup your data first.
BEGIN;

-- For user_progress: set expire_at = enrolled_at + access_duration_days if expire_at is NULL
UPDATE public.user_progress up
SET expire_at = (COALESCE(up.enrolled_at, now())::timestamptz + (c.access_duration_days || ' days')::interval)
FROM public.courses c
WHERE up.course_id = c.id
  AND up.expire_at IS NULL
  AND c.access_duration_days IS NOT NULL
  AND c.access_duration_days > 0;

-- For school_progress
UPDATE public.school_progress sp
SET expire_at = (COALESCE(sp.enrolled_at, now())::timestamptz + (c.access_duration_days || ' days')::interval)
FROM public.courses c
WHERE sp.course_id = c.id
  AND sp.expire_at IS NULL
  AND c.access_duration_days IS NOT NULL
  AND c.access_duration_days > 0;

COMMIT;

-- You can preview affected rows with:
-- SELECT up.* FROM public.user_progress up JOIN public.courses c ON up.course_id = c.id
-- WHERE up.expire_at IS NULL AND c.access_duration_days IS NOT NULL AND c.access_duration_days > 0;
