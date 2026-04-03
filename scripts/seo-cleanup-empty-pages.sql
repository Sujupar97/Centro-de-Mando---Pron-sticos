-- Delete SEO pages that have no corresponding report in reports_v2
DELETE FROM seo_pages
WHERE fixture_id NOT IN (
    SELECT DISTINCT fixture_id FROM reports_v2 WHERE report_packet IS NOT NULL
);

-- Verify remaining pages all have reports
SELECT sp.fixture_id, sp.home_team, sp.away_team,
  CASE WHEN r.id IS NOT NULL THEN 'OK' ELSE 'MISSING' END as report_status
FROM seo_pages sp
LEFT JOIN reports_v2 r ON r.fixture_id = sp.fixture_id
ORDER BY sp.match_date DESC;
