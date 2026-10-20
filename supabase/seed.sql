-- GENERATED FILE. Do not edit by hand.
-- Source: docs/seed/curriculum_v1_1.json
-- Regenerate with: npm run db:seed:generate
-- Safe to run more than once. Reference data is upserted from the JSON;
-- app settings and help pages are inserted only when missing.

begin;

-- Departments
insert into public.departments (code, name, is_active, note) values
  ('content', 'Content', true, null),
  ('creative', 'Creative', true, null),
  ('performance', 'Performance', true, null),
  ('performance-seo', 'Performance: SEO', true, null),
  ('performance-paid', 'Performance: Paid', true, null),
  ('performance-analytics', 'Performance: Analytics', true, null),
  ('account-management', 'Account Management', true, null),
  ('senior-management', 'Senior Management', true, null),
  ('finance-ops', 'Finance and Operations', false, 'Pending scope decision D3'),
  ('tech-delivery', 'Tech delivery', false, 'Pending scope decision D3')
on conflict (code) do update set
  name = excluded.name,
  is_active = excluded.is_active,
  note = excluded.note;

update public.departments child
set parent_id = parent.id
from (values
  ('content', null),
  ('creative', null),
  ('performance', null),
  ('performance-seo', 'performance'),
  ('performance-paid', 'performance'),
  ('performance-analytics', 'performance'),
  ('account-management', null),
  ('senior-management', null),
  ('finance-ops', null),
  ('tech-delivery', null)
) as links (code, parent_code)
left join public.departments parent on parent.code = links.parent_code
where child.code = links.code
  and child.parent_id is distinct from parent.id;

-- Competency domains
insert into public.competency_domains (code, name) values
  ('C1', 'AI and LLM literacy'),
  ('C2', 'Prompting and context'),
  ('C3', 'Output evaluation and verification'),
  ('C4', 'Responsible use and data protection'),
  ('C5', 'Reusable systems (templates, Projects, Skills)'),
  ('C6', 'Knowledge and grounding'),
  ('C7', 'Automation and integration'),
  ('C8', 'Agentic design and oversight'),
  ('C9', 'Workflow redesign and value')
on conflict (code) do update set
  name = excluded.name;

-- Stages
insert into public.stages (code, name, week_start, week_end, hours_per_week, sort_order) values
  ('assessment', 'Week 0 assessment', 0, 0, 2, 1),
  ('foundation', 'Foundation', 1, 4, 3, 2),
  ('practitioner', 'Practitioner', 5, 10, 4, 3),
  ('apply_certify', 'Apply and certify', 11, 12, 5, 4),
  ('specialist', 'Specialist track', 13, 20, 6, 5),
  ('leadership', 'Leadership briefings', 3, 10, null, 6)
on conflict (code) do update set
  name = excluded.name,
  week_start = excluded.week_start,
  week_end = excluded.week_end,
  hours_per_week = excluded.hours_per_week,
  sort_order = excluded.sort_order;

-- Modules
insert into public.modules
  (code, title, stage_id, week_start, week_end, live_hours, async_hours, assessed_by, is_leadership, sort_order)
select v.code, v.title, s.id, v.week_start, v.week_end, v.live_hours, v.async_hours, v.assessed_by, v.is_leadership, v.sort_order
from (values
  ('F1', 'AI and LLMs in plain language', 'foundation', 1, 1, 1::numeric, 0::numeric, '5-question check', false, 1),
  ('F2', 'Claude at CDS, and where ChatGPT, Perplexity, Jira and Confluence fit', 'foundation', 1, 1, 1::numeric, 0::numeric, 'Guided task', false, 2),
  ('F3', 'Limits, hallucination, verification, CDS data rules for every AI tool', 'foundation', 2, 2, 1::numeric, 0::numeric, 'Safety quiz, 80% pass required', false, 3),
  ('F4', 'Anatomy of a prompt', 'foundation', 2, 2, 1::numeric, 0::numeric, 'Rubric-marked prompt', false, 4),
  ('F5', 'Improving prompts', 'foundation', 3, 3, 1::numeric, 0::numeric, 'Before/after prompt pair', false, 5),
  ('F6', 'Department prompting lab', 'foundation', 3, 3, 1::numeric, 0::numeric, 'Department output', false, 6),
  ('F7', 'Everyday productivity across the stack: Perplexity research, Claude drafting, Jira follow-up', 'foundation', 4, 4, 1::numeric, 0::numeric, 'Time log on 2 tasks', false, 7),
  ('F8', 'Using Skills and saved prompts', 'foundation', 4, 4, 1::numeric, 0::numeric, 'Correct Skill in 3 scenarios', false, 8),
  ('F9', 'Foundation capstone', 'foundation', 4, 4, 0::numeric, 2::numeric, 'Capstone rubric', false, 9),
  ('P1', 'Advanced prompting: decomposition, chaining, self-critique', 'practitioner', 5, 5, 1.25::numeric, 0::numeric, 'Multi-step workflow', false, 10),
  ('P2', 'Structured outputs and QA checklists', 'practitioner', 5, 5, 1.25::numeric, 0::numeric, 'Checklist on 3 outputs', false, 11),
  ('P3', 'Templates, Project instructions, context management', 'practitioner', 6, 6, 1.25::numeric, 0::numeric, 'Library template', false, 12),
  ('P4', 'Skills architecture', 'practitioner', 6, 6, 1.25::numeric, 0::numeric, 'Skill specification', false, 13),
  ('P5', 'Skill build lab', 'practitioner', 7, 7, 2.5::numeric, 0::numeric, 'Working Skill draft', false, 14),
  ('P6', 'Testing, versioning, governing Skills', 'practitioner', 8, 8, 2.5::numeric, 0::numeric, 'Test set of 8+ cases', false, 15),
  ('P7', 'Knowledge management for AI', 'practitioner', 9, 9, 1::numeric, 0::numeric, 'Project audit', false, 16),
  ('P8', 'Grounding and RAG concepts', 'practitioner', 9, 9, 1.5::numeric, 0::numeric, 'Grounded answer test', false, 17),
  ('P9', 'Connectors and automation with Jira, Confluence, Drive; when not to use an agent', 'practitioner', 10, 10, 1.5::numeric, 0::numeric, 'Workflow map', false, 18),
  ('P10', 'Practitioner capstone: Skill in live use', 'apply_certify', 10, 12, 4::numeric, 0::numeric, 'Live-use evidence + demo', false, 19),
  ('L1', 'AI strategy and economics', 'leadership', 3, 3, 1.5::numeric, 0::numeric, 'Priorities agreed', true, 20),
  ('L2', 'Governance sign-off: AUP and risk tiers', 'leadership', 6, 6, 1.5::numeric, 0::numeric, 'Policy approved', true, 21),
  ('L3', 'Portfolio review: Specialist projects', 'leadership', 10, 10, 1.5::numeric, 0::numeric, 'Projects selected', true, 22),
  ('S1', 'Workflow architecture, enterprise prompt systems', 'specialist', 13, 13, 3::numeric, 0::numeric, 'Blueprint', false, 23),
  ('S2', 'Advanced Skills: suites, references, scripts', 'specialist', 14, 14, 3::numeric, 0::numeric, 'Skill suite', false, 24),
  ('S3', 'Knowledge architecture and RAG design', 'specialist', 15, 15, 3::numeric, 0::numeric, 'RAG spec', false, 25),
  ('S4', 'RAG build and evaluation', 'specialist', 16, 16, 3::numeric, 0::numeric, 'Prototype + eval set (Technical)', false, 26),
  ('S5', 'APIs, MCP connectors, automation', 'specialist', 17, 17, 3::numeric, 0::numeric, 'Working integration', false, 27),
  ('S6', 'Agents: patterns, tools, human-in-the-loop, multi-agent limits', 'specialist', 18, 18, 3::numeric, 0::numeric, 'Agent design worksheet', false, 28),
  ('S7', 'Security, governance, AI risk', 'specialist', 19, 19, 3::numeric, 0::numeric, 'Governance pack', false, 29),
  ('S8', 'Transformation project, ROI, capstone', 'specialist', 20, 20, 3::numeric, 0::numeric, 'Capstone panel', false, 30)
) as v (code, title, stage_code, week_start, week_end, live_hours, async_hours, assessed_by, is_leadership, sort_order)
join public.stages s on s.code = v.stage_code
on conflict (code) do update set
  title = excluded.title,
  stage_id = excluded.stage_id,
  week_start = excluded.week_start,
  week_end = excluded.week_end,
  live_hours = excluded.live_hours,
  async_hours = excluded.async_hours,
  assessed_by = excluded.assessed_by,
  is_leadership = excluded.is_leadership,
  sort_order = excluded.sort_order;

-- Module domains
insert into public.module_domains (module_id, domain_id)
select m.id, d.id
from (values
  ('F1', 'C1'),
  ('F2', 'C1'),
  ('F2', 'C5'),
  ('F3', 'C3'),
  ('F3', 'C4'),
  ('F4', 'C2'),
  ('F5', 'C2'),
  ('F5', 'C3'),
  ('F6', 'C2'),
  ('F7', 'C2'),
  ('F7', 'C9'),
  ('F8', 'C5'),
  ('F9', 'C1'),
  ('F9', 'C2'),
  ('F9', 'C3'),
  ('F9', 'C4'),
  ('F9', 'C5'),
  ('F9', 'C6'),
  ('F9', 'C7'),
  ('F9', 'C8'),
  ('F9', 'C9'),
  ('P1', 'C2'),
  ('P2', 'C3'),
  ('P3', 'C2'),
  ('P3', 'C5'),
  ('P4', 'C5'),
  ('P5', 'C5'),
  ('P6', 'C3'),
  ('P6', 'C4'),
  ('P6', 'C5'),
  ('P7', 'C6'),
  ('P8', 'C6'),
  ('P9', 'C7'),
  ('P9', 'C8'),
  ('P10', 'C1'),
  ('P10', 'C2'),
  ('P10', 'C3'),
  ('P10', 'C4'),
  ('P10', 'C5'),
  ('P10', 'C6'),
  ('P10', 'C7'),
  ('P10', 'C8'),
  ('P10', 'C9'),
  ('L1', 'C9'),
  ('L2', 'C4'),
  ('L3', 'C8'),
  ('L3', 'C9'),
  ('S1', 'C2'),
  ('S1', 'C9'),
  ('S2', 'C5'),
  ('S3', 'C6'),
  ('S4', 'C6'),
  ('S4', 'C3'),
  ('S5', 'C7'),
  ('S6', 'C8'),
  ('S7', 'C4'),
  ('S8', 'C9')
) as v (module_code, domain_code)
join public.modules m on m.code = v.module_code
join public.competency_domains d on d.code = v.domain_code
on conflict (module_id, domain_id) do nothing;

-- Department domain requirements
insert into public.department_domain_requirements (department_id, domain_id, required)
select dep.id, dom.id, v.required
from (values
  ('content', 'C1', true),
  ('content', 'C2', true),
  ('content', 'C3', true),
  ('content', 'C4', true),
  ('content', 'C5', true),
  ('content', 'C6', true),
  ('creative', 'C1', true),
  ('creative', 'C2', true),
  ('creative', 'C3', true),
  ('creative', 'C4', true),
  ('creative', 'C5', true),
  ('performance', 'C1', true),
  ('performance', 'C2', true),
  ('performance', 'C3', true),
  ('performance', 'C4', true),
  ('performance', 'C5', true),
  ('performance', 'C6', true),
  ('performance', 'C7', true),
  ('performance', 'C9', true),
  ('account-management', 'C1', true),
  ('account-management', 'C2', true),
  ('account-management', 'C3', true),
  ('account-management', 'C4', true),
  ('account-management', 'C5', true),
  ('account-management', 'C6', true),
  ('senior-management', 'C1', true),
  ('senior-management', 'C2', true),
  ('senior-management', 'C3', true),
  ('senior-management', 'C4', true),
  ('senior-management', 'C5', true),
  ('senior-management', 'C6', true),
  ('senior-management', 'C8', true),
  ('senior-management', 'C9', true)
) as v (department_code, domain_code, required)
join public.departments dep on dep.code = v.department_code
join public.competency_domains dom on dom.code = v.domain_code
on conflict (department_id, domain_id) do update set
  required = excluded.required;

-- App settings (PROPOSED values; inserted only when the key is missing)
insert into public.app_settings (key, value, note) values
  ('placement.week0_sections', '{"note":"PROPOSED (DL-002 to DL-004). Edit here, not in code.","sections":[{"code":"knowledge","name":"Knowledge","max":25,"counts_in_total":true,"parts":"MCQ 15 + scenarios 10"},{"code":"prompting","name":"Prompting","max":25,"counts_in_total":true},{"code":"department","name":"Department task","max":25,"counts_in_total":true},{"code":"safety","name":"Safety and judgement","max":15,"counts_in_total":true},{"code":"workflow","name":"Workflow","max":10,"counts_in_total":true},{"code":"technical","name":"Technical supplement (optional)","max":null,"counts_in_total":false}]}'::jsonb, 'PROPOSED (DL-002 to DL-004). Edit here, not in code.'),
  ('placement.gates', '{"note":"PROPOSED DL-002","safety_min_else_foundation":9,"prompting_min_for_practitioner":15}'::jsonb, 'PROPOSED DL-002'),
  ('placement.bands', '{"note":"PROPOSED DL-003","bands":[{"min":0,"max":44,"stream":"foundation"},{"min":45,"max":69,"stream":"practitioner","bridges_for_domains_below_pct":60},{"min":70,"max":84,"stream":"practitioner_fast_track"},{"min":85,"max":100,"stream":"champion","requires":"portfolio review confirmed by trainer"}]}'::jsonb, 'PROPOSED DL-003'),
  ('certification.foundation', '{"note":"From CURRICULUM_MASTER G2","overall_min_pct":70,"safety_quiz_must_pass":true,"safety_quiz_pass_pct":80}'::jsonb, 'From CURRICULUM_MASTER G2'),
  ('certification.department', '{"note":"From CURRICULUM_MASTER §5","live_use_weeks_required":2}'::jsonb, 'From CURRICULUM_MASTER §5')
on conflict (key) do nothing;

-- Help pages (drafts with a placeholder; inserted only when the slug is missing)
insert into public.pages (slug, title, body_md, status) values
  ('data-rules', 'Data rules', 'Placeholder. A trainer writes this page before launch. Interim one-page rules come from Deliverable 16 (Batch 2).', 'draft'),
  ('risk-tiers', 'Risk tiers', 'Placeholder. A trainer writes this page before launch.', 'draft'),
  ('glossary', 'Glossary', 'Placeholder. A trainer writes this page before launch.', 'draft'),
  ('faq', 'FAQ', 'Placeholder. A trainer writes this page before launch.', 'draft'),
  ('who-to-ask', 'Who to ask', 'Placeholder. A trainer writes this page before launch.', 'draft')
on conflict (slug) do nothing;

commit;
