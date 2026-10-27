-- Add the private campuses used by the app and website verification lists.
-- Safe to re-run. Domains ending in .ac.lk, .edu.lk, or .edu.au are already
-- accepted by is_allowed_student_domain; these rows keep the dropdown names
-- in sync and allow the .lk addresses that the suffix rule does not cover.

INSERT INTO public.allowed_domains (domain, institution_name)
VALUES
  ('ancedu.com', 'ANC Education'),
  ('acbt.lk', 'Australian College of Business and Technology (ACBT)'),
  ('ucl.lk', 'Universal College Lanka (UCL)'),
  ('our.ecu.edu.au', 'Edith Cowan University Sri Lanka (ECU)'),
  ('ecu.edu.lk', 'Edith Cowan University Sri Lanka (ECU)'),
  ('horizoncampus.edu.lk', 'Horizon Campus'),
  ('bcas.lk', 'British College of Applied Studies (BCAS)'),
  ('saegis.ac.lk', 'Saegis Campus'),
  ('kiu.ac.lk', 'KIU (Kaatsu International University)'),
  ('kiu.lk', 'KIU (Kaatsu International University)'),
  ('student.curtin.edu.au', 'Curtin University Colombo'),
  ('curtincolombo.lk', 'Curtin University Colombo'),
  ('msi.edu.lk', 'Management and Science Institute (MSI)')
ON CONFLICT (domain) DO UPDATE
SET institution_name = EXCLUDED.institution_name;
