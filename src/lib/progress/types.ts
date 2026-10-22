export type ProgressPersonPublicRow = {
  user_id: string;
  person_name: string;
  department_name: string | null;
  department_id: string | null;
  cohort_name: string | null;
  cohort_id: string | null;
  stream: string | null;
  is_test_account: boolean;
  last_seen_at: string | null;
  required_modules_done: number;
  required_modules_total: number;
  bridge_modules_done: number;
  bridge_modules_total: number;
  test_out_status: string;
  lessons_completed: number;
  quizzes_completed: number;
  quizzes_passed: number;
  assignments_submitted: number;
  assignments_returned: number;
  data_rules_confirmed: boolean;
  data_rules_version: number | null;
  week0_status: string;
};

export type ProgressPersonTrainerRow = ProgressPersonPublicRow & {
  week0_total: string | null;
  quiz_best_summary: string | null;
  assignment_marks_summary: string | null;
};

export type ProgressDepartmentRow = {
  department_id: string;
  department_name: string;
  people: number;
  week0_not_started: number;
  week0_in_progress: number;
  week0_submitted: number;
  week0_confirmed: number;
  stream_foundation: number;
  stream_practitioner: number;
  stream_practitioner_fast_track: number;
  stream_champion: number;
  required_modules_done_sum: number;
  required_modules_total_sum: number;
  data_rules_confirmed_count: number;
  active_last_7_days: number;
};

export type ProgressModuleRow = {
  module_id: string;
  module_code: string;
  module_title: string;
  people_required: number;
  people_done: number;
  test_out_pending: number;
  lesson_completions: number;
  quiz_attempts: number;
  quiz_passes: number;
  assignment_submissions: number;
  assignment_returned: number;
  resubmit_requested: number;
  median_working_days_to_return: number | null;
};

export type ProgressWeeklyRow = {
  cohort_id: string;
  cohort_name: string;
  programme_week: number;
  people_active: number;
  lessons_completed: number;
  quizzes_submitted: number;
  assignments_submitted: number;
  feedback_released: number;
};
