import type { Database, Json } from "@/lib/types/database";

type ContentStatus = Database["public"]["Enums"]["content_status"];
type StreamType = Database["public"]["Enums"]["stream_type"];

export type AssessmentType = "placement" | "quiz" | "safety_quiz" | "capstone";
export type ItemType = "profile" | "choice" | "short_text" | "practical";
export type AttemptStatus = "in_progress" | "submitted" | "marking" | "marked" | "confirmed";
export type ResponseFormat = "text" | "prompt_and_output" | "link";

type AssessmentTables = {
  assessments: {
    Row: {
      code: string;
      created_at: string;
      id: string;
      instructions_md: string;
      is_sample: boolean;
      module_id: string | null;
      pass_mark_pct: number | null;
      max_attempts: number | null;
      show_review_after_submit: boolean;
      items_per_attempt: number | null;
      published_at: string | null;
      published_by: string | null;
      status: ContentStatus;
      time_guide_min: number | null;
      title: string;
      type: AssessmentType;
      updated_at: string;
      version: number;
    };
    Insert: {
      code: string;
      created_at?: string;
      id?: string;
      instructions_md?: string;
      is_sample?: boolean;
      module_id?: string | null;
      pass_mark_pct?: number | null;
      max_attempts?: number | null;
      show_review_after_submit?: boolean;
      items_per_attempt?: number | null;
      published_at?: string | null;
      published_by?: string | null;
      status?: ContentStatus;
      time_guide_min?: number | null;
      title: string;
      type: AssessmentType;
      updated_at?: string;
      version?: number;
    };
    Update: {
      code?: string;
      created_at?: string;
      id?: string;
      instructions_md?: string;
      is_sample?: boolean;
      module_id?: string | null;
      pass_mark_pct?: number | null;
      max_attempts?: number | null;
      show_review_after_submit?: boolean;
      items_per_attempt?: number | null;
      published_at?: string | null;
      published_by?: string | null;
      status?: ContentStatus;
      time_guide_min?: number | null;
      title?: string;
      type?: AssessmentType;
      updated_at?: string;
      version?: number;
    };
    Relationships: [];
  };
  assessment_sections: {
    Row: {
      assessment_id: string;
      code: string;
      counts_in_total: boolean;
      created_at: string;
      id: string;
      instructions_md: string;
      max_score: number | null;
      sort_order: number;
      title: string;
      updated_at: string;
    };
    Insert: {
      assessment_id: string;
      code: string;
      counts_in_total?: boolean;
      created_at?: string;
      id?: string;
      instructions_md?: string;
      max_score?: number | null;
      sort_order?: number;
      title: string;
      updated_at?: string;
    };
    Update: {
      assessment_id?: string;
      code?: string;
      counts_in_total?: boolean;
      created_at?: string;
      id?: string;
      instructions_md?: string;
      max_score?: number | null;
      sort_order?: number;
      title?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  assessment_items: {
    Row: {
      allow_multiple: boolean;
      assessment_id: string;
      created_at: string;
      department_id: string | null;
      difficulty: number | null;
      domain_id: string | null;
      id: string;
      options: Json;
      points: number;
      prompt_md: string;
      ref: string;
      response_format: ResponseFormat | null;
      rubric_id: string | null;
      section_id: string;
      sort_order: number;
      type: ItemType;
      updated_at: string;
    };
    Insert: {
      allow_multiple?: boolean;
      assessment_id: string;
      created_at?: string;
      department_id?: string | null;
      difficulty?: number | null;
      domain_id?: string | null;
      id?: string;
      options?: Json;
      points?: number;
      prompt_md?: string;
      ref: string;
      response_format?: ResponseFormat | null;
      rubric_id?: string | null;
      section_id: string;
      sort_order?: number;
      type: ItemType;
      updated_at?: string;
    };
    Update: {
      allow_multiple?: boolean;
      assessment_id?: string;
      created_at?: string;
      department_id?: string | null;
      difficulty?: number | null;
      domain_id?: string | null;
      id?: string;
      options?: Json;
      points?: number;
      prompt_md?: string;
      ref?: string;
      response_format?: ResponseFormat | null;
      rubric_id?: string | null;
      section_id?: string;
      sort_order?: number;
      type?: ItemType;
      updated_at?: string;
    };
    Relationships: [];
  };
  assessment_item_keys: {
    Row: {
      created_at: string;
      explanation_md: string | null;
      id: string;
      item_id: string;
      marking_notes_md: string | null;
      model_answer_md: string | null;
      option_points: Json;
      updated_at: string;
    };
    Insert: {
      created_at?: string;
      explanation_md?: string | null;
      id?: string;
      item_id: string;
      marking_notes_md?: string | null;
      model_answer_md?: string | null;
      option_points?: Json;
      updated_at?: string;
    };
    Update: {
      created_at?: string;
      explanation_md?: string | null;
      id?: string;
      item_id?: string;
      marking_notes_md?: string | null;
      model_answer_md?: string | null;
      option_points?: Json;
      updated_at?: string;
    };
    Relationships: [];
  };
  attempts: {
    Row: {
      allowed_by: string | null;
      assessment_id: string;
      created_at: string;
      data_declaration: boolean;
      id: string;
      item_ids: string[];
      meta: Json;
      passed: boolean | null;
      percentage: number | null;
      seconds_active: number | null;
      started_at: string;
      status: AttemptStatus;
      submitted_at: string | null;
      updated_at: string;
      user_id: string;
    };
    Insert: {
      allowed_by?: string | null;
      assessment_id: string;
      created_at?: string;
      data_declaration?: boolean;
      id?: string;
      meta?: Json;
      seconds_active?: number | null;
      started_at?: string;
      status?: AttemptStatus;
      submitted_at?: string | null;
      updated_at?: string;
      user_id: string;
    };
    Update: {
      allowed_by?: string | null;
      assessment_id?: string;
      created_at?: string;
      data_declaration?: boolean;
      id?: string;
      meta?: Json;
      seconds_active?: number | null;
      started_at?: string;
      status?: AttemptStatus;
      submitted_at?: string | null;
      updated_at?: string;
      user_id?: string;
    };
    Relationships: [];
  };
  responses: {
    Row: {
      answer: Json;
      attempt_id: string;
      created_at: string;
      id: string;
      item_id: string;
      updated_at: string;
    };
    Insert: {
      answer?: Json;
      attempt_id: string;
      created_at?: string;
      id?: string;
      item_id: string;
      updated_at?: string;
    };
    Update: {
      answer?: Json;
      attempt_id?: string;
      created_at?: string;
      id?: string;
      item_id?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  response_scores: {
    Row: {
      auto_score: number | null;
      comment_md: string | null;
      created_at: string;
      criterion_scores: Json | null;
      id: string;
      marked_at: string | null;
      marked_by: string | null;
      marker_score: number | null;
      response_id: string;
      updated_at: string;
    };
    Insert: {
      auto_score?: number | null;
      comment_md?: string | null;
      created_at?: string;
      criterion_scores?: Json | null;
      id?: string;
      marked_at?: string | null;
      marked_by?: string | null;
      marker_score?: number | null;
      response_id: string;
      updated_at?: string;
    };
    Update: {
      auto_score?: number | null;
      comment_md?: string | null;
      created_at?: string;
      criterion_scores?: Json | null;
      id?: string;
      marked_at?: string | null;
      marked_by?: string | null;
      marker_score?: number | null;
      response_id?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  placement_results: {
    Row: {
      attempt_id: string;
      bridges: string[];
      confirmed_at: string | null;
      confirmed_by: string | null;
      confirmed_stream: StreamType | null;
      created_at: string;
      domain_percentages: Json;
      gates_failed: string[];
      id: string;
      override_reason: string | null;
      portfolio_reviewed: boolean;
      required_domain_flags: string[];
      section_scores: Json;
      settings_snapshot: Json;
      suggested_band: string | null;
      suggested_stream: StreamType | null;
      total: number;
      updated_at: string;
      user_id: string;
    };
    Insert: {
      attempt_id: string;
      bridges?: string[];
      confirmed_at?: string | null;
      confirmed_by?: string | null;
      confirmed_stream?: StreamType | null;
      created_at?: string;
      domain_percentages?: Json;
      gates_failed?: string[];
      id?: string;
      override_reason?: string | null;
      portfolio_reviewed?: boolean;
      required_domain_flags?: string[];
      section_scores?: Json;
      settings_snapshot?: Json;
      suggested_band?: string | null;
      suggested_stream?: StreamType | null;
      total?: number;
      updated_at?: string;
      user_id: string;
    };
    Update: {
      attempt_id?: string;
      bridges?: string[];
      confirmed_at?: string | null;
      confirmed_by?: string | null;
      confirmed_stream?: StreamType | null;
      created_at?: string;
      domain_percentages?: Json;
      gates_failed?: string[];
      id?: string;
      override_reason?: string | null;
      portfolio_reviewed?: boolean;
      required_domain_flags?: string[];
      section_scores?: Json;
      settings_snapshot?: Json;
      suggested_band?: string | null;
      suggested_stream?: StreamType | null;
      total?: number;
      updated_at?: string;
      user_id?: string;
    };
    Relationships: [];
  };
  rubrics: {
    Row: {
      created_at: string;
      id: string;
      ref: string;
      title: string;
      updated_at: string;
      version: number;
    };
    Insert: {
      created_at?: string;
      id?: string;
      ref: string;
      title: string;
      updated_at?: string;
      version?: number;
    };
    Update: {
      created_at?: string;
      id?: string;
      ref?: string;
      title?: string;
      updated_at?: string;
      version?: number;
    };
    Relationships: [];
  };
  rubric_criteria: {
    Row: {
      created_at: string;
      id: string;
      max_score: number;
      name: string;
      rubric_id: string;
      sort_order: number;
      updated_at: string;
    };
    Insert: {
      created_at?: string;
      id?: string;
      max_score: number;
      name: string;
      rubric_id: string;
      sort_order?: number;
      updated_at?: string;
    };
    Update: {
      created_at?: string;
      id?: string;
      max_score?: number;
      name?: string;
      rubric_id?: string;
      sort_order?: number;
      updated_at?: string;
    };
    Relationships: [];
  };
  rubric_levels: {
    Row: {
      created_at: string;
      criterion_id: string;
      descriptor: string;
      id: string;
      score: number;
      updated_at: string;
    };
    Insert: {
      created_at?: string;
      criterion_id: string;
      descriptor: string;
      id?: string;
      score: number;
      updated_at?: string;
    };
    Update: {
      created_at?: string;
      criterion_id?: string;
      descriptor?: string;
      id?: string;
      score?: number;
      updated_at?: string;
    };
    Relationships: [];
  };
};

type AssessmentFunctions = {
  start_attempt: { Args: { p_assessment_id: string }; Returns: AssessmentTables["attempts"]["Row"] };
  submit_attempt: {
    Args: { p_attempt_id: string; p_data_declaration: boolean };
    Returns: AssessmentTables["attempts"]["Row"];
  };
  save_mark: {
    Args: {
      p_response_id: string;
      p_criterion_scores: Json;
      p_comment_md?: string | null;
    };
    Returns: AssessmentTables["response_scores"]["Row"];
  };
  calculate_placement: {
    Args: { p_attempt_id: string };
    Returns: AssessmentTables["placement_results"]["Row"];
  };
  confirm_placement: {
    Args: {
      p_attempt_id: string;
      p_stream: StreamType;
      p_reason?: string | null;
      p_portfolio_reviewed?: boolean;
    };
    Returns: AssessmentTables["placement_results"]["Row"];
  };
  allow_retake: {
    Args: { p_user_id: string; p_assessment_id: string; p_reason: string };
    Returns: undefined;
  };
  get_attempt_review: {
    Args: { p_attempt_id: string };
    Returns: {
      item_id: string;
      prompt_md: string;
      chosen_option_id: string | null;
      chosen_text: string | null;
      correct_option_id: string | null;
      correct_text: string | null;
      explanation_md: string;
    }[];
  };
  get_quiz_results_summary: {
    Args: Record<string, never>;
    Returns: {
      user_id: string;
      full_name: string | null;
      email: string;
      department_code: string | null;
      assessment_id: string;
      assessment_code: string;
      assessment_title: string;
      assessment_type: AssessmentType;
      pass_mark_pct: number | null;
      max_attempts: number | null;
      attempts_used: number;
      best_percentage: number | null;
      passed: boolean;
      first_pass_at: string | null;
      last_attempt_at: string | null;
    }[];
  };
  get_quiz_question_stats: {
    Args: { p_assessment_id: string };
    Returns: {
      item_id: string;
      item_ref: string;
      prompt_md: string;
      sort_order: number;
      answered_count: number;
      option_counts: Json;
    }[];
  };
};

type AssessmentEnums = {
  assessment_type: AssessmentType;
  item_type: ItemType;
  attempt_status: AttemptStatus;
  response_format: ResponseFormat;
};

export type AppDatabase = {
  public: {
    Tables: Database["public"]["Tables"] & AssessmentTables;
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"] & AssessmentFunctions;
    Enums: Database["public"]["Enums"] & AssessmentEnums;
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};
