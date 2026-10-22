import type { Database, Json } from "@/lib/types/database";

export type SubmissionStatus =
  | "submitted"
  | "in_review"
  | "returned"
  | "resubmit_requested"
  | "withdrawn";

export type ReviewKind = "primary" | "double_mark" | "final";

export type AssignmentRow = {
  id: string;
  code: string;
  module_id: string;
  title: string;
  brief_md: string;
  rubric_id: string;
  submission_types: string[];
  department_id: string | null;
  pass_mark_pct: number;
  is_test_out: boolean;
  version: number;
  status: Database["public"]["Enums"]["content_status"];
  is_sample: boolean;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmissionRow = {
  id: string;
  assignment_id: string;
  user_id: string;
  attempt_no: number;
  link_url: string | null;
  file_path: string | null;
  text_md: string | null;
  data_declaration: boolean;
  status: SubmissionStatus;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

export type ReviewRow = {
  id: string;
  submission_id: string;
  reviewer_id: string;
  kind: ReviewKind;
  criterion_scores: Json;
  total: number;
  max_total: number;
  feedback_md: string | null;
  created_at: string;
  released_at: string | null;
  updated_at: string;
};

type AssignmentTables = {
  assignments: {
    Row: AssignmentRow;
    Insert: Partial<AssignmentRow> & Pick<AssignmentRow, "code" | "module_id" | "title" | "rubric_id" | "pass_mark_pct">;
    Update: Partial<AssignmentRow>;
    Relationships: [];
  };
  submissions: {
    Row: SubmissionRow;
    Insert: never;
    Update: never;
    Relationships: [];
  };
  reviews: {
    Row: ReviewRow;
    Insert: never;
    Update: never;
    Relationships: [];
  };
  review_assignments: {
    Row: {
      id: string;
      submission_id: string;
      reviewer_id: string;
      kind: ReviewKind;
      assigned_at: string;
      completed_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: never;
    Update: never;
    Relationships: [];
  };
};

type AssignmentFunctions = {
  submit_assignment: {
    Args: {
      p_assignment_id: string;
      p_link_url?: string | null;
      p_file_path?: string | null;
      p_text_md?: string | null;
      p_data_declaration?: boolean;
    };
    Returns: SubmissionRow;
  };
  upload_submission_file: {
    Args: {
      p_assignment_id: string;
      p_filename: string;
      p_mime_type: string;
      p_byte_size: number;
    };
    Returns: string;
  };
  withdraw_submission: {
    Args: { p_submission_id: string };
    Returns: SubmissionRow;
  };
  save_review: {
    Args: {
      p_submission_id: string;
      p_kind: ReviewKind;
      p_criterion_scores: Json;
      p_feedback_md?: string | null;
    };
    Returns: ReviewRow;
  };
  request_resubmission: {
    Args: { p_submission_id: string; p_feedback_md: string };
    Returns: SubmissionRow;
  };
  release_feedback: {
    Args: { p_submission_id: string };
    Returns: SubmissionRow;
  };
  assign_double_marks: {
    Args: { p_assignment_id: string };
    Returns: Json;
  };
};

export type DatabaseWithAssignments = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions" | "Enums"> & {
    Tables: Database["public"]["Tables"] & AssignmentTables;
    Functions: Database["public"]["Functions"] & AssignmentFunctions;
    Enums: Database["public"]["Enums"] & {
      content_type: Database["public"]["Enums"]["content_type"] | "assignment";
      submission_status: SubmissionStatus;
      review_kind: ReviewKind;
    };
  };
};
