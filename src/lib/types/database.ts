
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "created_at": string,"id": string,"key": string,"note": string | null,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"key": string,"note"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"key"?: string,"note"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "app_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "app_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"assessment_item_keys": {
                  Row: {
                    "created_at": string,"explanation_md": string | null,"id": string,"item_id": string,"marking_notes_md": string | null,"model_answer_md": string | null,"option_points": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"explanation_md"?: string | null,"id"?: string,"item_id": string,"marking_notes_md"?: string | null,"model_answer_md"?: string | null,"option_points"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"explanation_md"?: string | null,"id"?: string,"item_id"?: string,"marking_notes_md"?: string | null,"model_answer_md"?: string | null,"option_points"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_item_keys_item_id_fkey"
      columns: ["item_id"]
isOneToOne: true
      referencedRelation: "assessment_items"
      referencedColumns: ["id"]
    }
                  ]
                },"assessment_items": {
                  Row: {
                    "allow_multiple": boolean,"assessment_id": string,"created_at": string,"department_id": string | null,"difficulty": number | null,"domain_id": string | null,"id": string,"options": NonNullable<Json>,"points": number,"prompt_md": string,"ref": string,"response_format": Database["public"]['Enums']["response_format"] | null,"rubric_id": string | null,"section_id": string,"sort_order": number,"type": Database["public"]['Enums']["item_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_multiple"?: boolean,"assessment_id": string,"created_at"?: string,"department_id"?: string | null,"difficulty"?: number | null,"domain_id"?: string | null,"id"?: string,"options"?: NonNullable<Json>,"points"?: number,"prompt_md"?: string,"ref": string,"response_format"?: Database["public"]['Enums']["response_format"] | null,"rubric_id"?: string | null,"section_id": string,"sort_order"?: number,"type": Database["public"]['Enums']["item_type"],"updated_at"?: string
                  }
                  Update: {
                    "allow_multiple"?: boolean,"assessment_id"?: string,"created_at"?: string,"department_id"?: string | null,"difficulty"?: number | null,"domain_id"?: string | null,"id"?: string,"options"?: NonNullable<Json>,"points"?: number,"prompt_md"?: string,"ref"?: string,"response_format"?: Database["public"]['Enums']["response_format"] | null,"rubric_id"?: string | null,"section_id"?: string,"sort_order"?: number,"type"?: Database["public"]['Enums']["item_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_items_assessment_id_fkey"
      columns: ["assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessment_items_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessment_items_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_department_summary"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "assessment_items_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "assessment_items_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "assessment_items_domain_id_fkey"
      columns: ["domain_id"]
isOneToOne: false
      referencedRelation: "competency_domains"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessment_items_rubric_id_fkey"
      columns: ["rubric_id"]
isOneToOne: false
      referencedRelation: "rubrics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessment_items_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "assessment_sections"
      referencedColumns: ["id"]
    }
                  ]
                },"assessment_sections": {
                  Row: {
                    "assessment_id": string,"code": string,"counts_in_total": boolean,"created_at": string,"id": string,"instructions_md": string,"max_score": number | null,"sort_order": number,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assessment_id": string,"code": string,"counts_in_total"?: boolean,"created_at"?: string,"id"?: string,"instructions_md"?: string,"max_score"?: number | null,"sort_order"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assessment_id"?: string,"code"?: string,"counts_in_total"?: boolean,"created_at"?: string,"id"?: string,"instructions_md"?: string,"max_score"?: number | null,"sort_order"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_sections_assessment_id_fkey"
      columns: ["assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    }
                  ]
                },"assessments": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"instructions_md": string,"is_sample": boolean,"items_per_attempt": number | null,"max_attempts": number | null,"module_id": string | null,"pass_mark_pct": number | null,"published_at": string | null,"published_by": string | null,"show_review_after_submit": boolean,"status": Database["public"]['Enums']["content_status"],"time_guide_min": number | null,"title": string,"type": Database["public"]['Enums']["assessment_type"],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"instructions_md"?: string,"is_sample"?: boolean,"items_per_attempt"?: number | null,"max_attempts"?: number | null,"module_id"?: string | null,"pass_mark_pct"?: number | null,"published_at"?: string | null,"published_by"?: string | null,"show_review_after_submit"?: boolean,"status"?: Database["public"]['Enums']["content_status"],"time_guide_min"?: number | null,"title": string,"type": Database["public"]['Enums']["assessment_type"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"instructions_md"?: string,"is_sample"?: boolean,"items_per_attempt"?: number | null,"max_attempts"?: number | null,"module_id"?: string | null,"pass_mark_pct"?: number | null,"published_at"?: string | null,"published_by"?: string | null,"show_review_after_submit"?: boolean,"status"?: Database["public"]['Enums']["content_status"],"time_guide_min"?: number | null,"title"?: string,"type"?: Database["public"]['Enums']["assessment_type"],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessments_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessments_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "progress_module_summary"
      referencedColumns: ["module_id"]
    },{
      foreignKeyName: "assessments_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessments_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "assessments_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"assignments": {
                  Row: {
                    "brief_md": string,"code": string,"created_at": string,"department_id": string | null,"id": string,"is_sample": boolean,"is_test_out": boolean,"module_id": string,"pass_mark_pct": number,"published_at": string | null,"published_by": string | null,"rubric_id": string,"status": Database["public"]['Enums']["content_status"],"submission_types": (string)[],"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "brief_md"?: string,"code": string,"created_at"?: string,"department_id"?: string | null,"id"?: string,"is_sample"?: boolean,"is_test_out"?: boolean,"module_id": string,"pass_mark_pct": number,"published_at"?: string | null,"published_by"?: string | null,"rubric_id": string,"status"?: Database["public"]['Enums']["content_status"],"submission_types"?: (string)[],"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "brief_md"?: string,"code"?: string,"created_at"?: string,"department_id"?: string | null,"id"?: string,"is_sample"?: boolean,"is_test_out"?: boolean,"module_id"?: string,"pass_mark_pct"?: number,"published_at"?: string | null,"published_by"?: string | null,"rubric_id"?: string,"status"?: Database["public"]['Enums']["content_status"],"submission_types"?: (string)[],"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_department_summary"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "assignments_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "assignments_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "assignments_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "progress_module_summary"
      referencedColumns: ["module_id"]
    },{
      foreignKeyName: "assignments_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "assignments_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "assignments_rubric_id_fkey"
      columns: ["rubric_id"]
isOneToOne: false
      referencedRelation: "rubrics"
      referencedColumns: ["id"]
    }
                  ]
                },"attempts": {
                  Row: {
                    "allowed_by": string | null,"assessment_id": string,"created_at": string,"data_declaration": boolean,"id": string,"item_ids": (string)[],"meta": NonNullable<Json>,"passed": boolean | null,"percentage": number | null,"seconds_active": number | null,"started_at": string,"status": Database["public"]['Enums']["attempt_status"],"submitted_at": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_by"?: string | null,"assessment_id": string,"created_at"?: string,"data_declaration"?: boolean,"id"?: string,"item_ids"?: (string)[],"meta"?: NonNullable<Json>,"passed"?: boolean | null,"percentage"?: number | null,"seconds_active"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["attempt_status"],"submitted_at"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "allowed_by"?: string | null,"assessment_id"?: string,"created_at"?: string,"data_declaration"?: boolean,"id"?: string,"item_ids"?: (string)[],"meta"?: NonNullable<Json>,"passed"?: boolean | null,"percentage"?: number | null,"seconds_active"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["attempt_status"],"submitted_at"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attempts_allowed_by_fkey"
      columns: ["allowed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempts_allowed_by_fkey"
      columns: ["allowed_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "attempts_allowed_by_fkey"
      columns: ["allowed_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "attempts_assessment_id_fkey"
      columns: ["assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "attempts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"after": Json | null,"at": string,"before": Json | null,"created_at": string,"id": string,"reason": string | null,"row_id": string | null,"table_name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"created_at"?: string,"id"?: string,"reason"?: string | null,"row_id"?: string | null,"table_name": string,"updated_at"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"created_at"?: string,"id"?: string,"reason"?: string | null,"row_id"?: string | null,"table_name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cohort_breaks": {
                  Row: {
                    "cohort_id": string,"created_at": string,"id": string,"label": string,"start_date": string,"updated_at": string,"weeks": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cohort_id": string,"created_at"?: string,"id"?: string,"label": string,"start_date": string,"updated_at"?: string,"weeks": number
                  }
                  Update: {
                    "cohort_id"?: string,"created_at"?: string,"id"?: string,"label"?: string,"start_date"?: string,"updated_at"?: string,"weeks"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cohort_breaks_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cohort_breaks_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "progress_weekly_activity"
      referencedColumns: ["cohort_id"]
    }
                  ]
                },"cohorts": {
                  Row: {
                    "created_at": string,"id": string,"is_archived": boolean,"name": string,"notes": string | null,"slot": string | null,"start_date": string | null,"updated_at": string,"week0_start_date": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_archived"?: boolean,"name": string,"notes"?: string | null,"slot"?: string | null,"start_date"?: string | null,"updated_at"?: string,"week0_start_date"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_archived"?: boolean,"name"?: string,"notes"?: string | null,"slot"?: string | null,"start_date"?: string | null,"updated_at"?: string,"week0_start_date"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"competency_domains": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"content_drafts": {
                  Row: {
                    "body_md": string,"content_id": string,"content_type": Database["public"]['Enums']["content_type"],"created_at": string,"id": string,"metadata": NonNullable<Json>,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_md"?: string,"content_id": string,"content_type": Database["public"]['Enums']["content_type"],"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "body_md"?: string,"content_id"?: string,"content_type"?: Database["public"]['Enums']["content_type"],"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_drafts_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_drafts_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "content_drafts_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"content_revisions": {
                  Row: {
                    "body_md": string,"change_note": string,"content_id": string,"content_type": Database["public"]['Enums']["content_type"],"created_at": string,"id": string,"metadata": NonNullable<Json>,"published_at": string,"published_by": string | null,"revision_no": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_md"?: string,"change_note": string,"content_id": string,"content_type": Database["public"]['Enums']["content_type"],"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"published_at"?: string,"published_by"?: string | null,"revision_no": number,"title": string
                  }
                  Update: {
                    "body_md"?: string,"change_note"?: string,"content_id"?: string,"content_type"?: Database["public"]['Enums']["content_type"],"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"published_at"?: string,"published_by"?: string | null,"revision_no"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_revisions_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_revisions_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "content_revisions_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"department_domain_requirements": {
                  Row: {
                    "created_at": string,"department_id": string,"domain_id": string,"id": string,"required": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_id": string,"domain_id": string,"id"?: string,"required"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: string,"domain_id"?: string,"id"?: string,"required"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "department_domain_requirements_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "department_domain_requirements_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_department_summary"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "department_domain_requirements_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "department_domain_requirements_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "department_domain_requirements_domain_id_fkey"
      columns: ["domain_id"]
isOneToOne: false
      referencedRelation: "competency_domains"
      referencedColumns: ["id"]
    }
                  ]
                },"departments": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"note": string | null,"parent_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"note"?: string | null,"parent_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"note"?: string | null,"parent_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "departments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "departments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "progress_department_summary"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "departments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "departments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["department_id"]
    }
                  ]
                },"learner_plan": {
                  Row: {
                    "created_at": string,"due_week": number | null,"id": string,"is_override": boolean,"module_id": string,"override_reason": string | null,"reason": string | null,"set_by": string | null,"status": Database["public"]['Enums']["plan_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"due_week"?: number | null,"id"?: string,"is_override"?: boolean,"module_id": string,"override_reason"?: string | null,"reason"?: string | null,"set_by"?: string | null,"status": Database["public"]['Enums']["plan_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"due_week"?: number | null,"id"?: string,"is_override"?: boolean,"module_id"?: string,"override_reason"?: string | null,"reason"?: string | null,"set_by"?: string | null,"status"?: Database["public"]['Enums']["plan_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "learner_plan_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learner_plan_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "progress_module_summary"
      referencedColumns: ["module_id"]
    },{
      foreignKeyName: "learner_plan_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learner_plan_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "learner_plan_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "learner_plan_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learner_plan_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "learner_plan_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"lesson_progress": {
                  Row: {
                    "completed_at": string,"created_at": string,"id": string,"lesson_id": string,"lesson_version": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"created_at"?: string,"id"?: string,"lesson_id": string,"lesson_version"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string,"created_at"?: string,"id"?: string,"lesson_id"?: string,"lesson_version"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_progress_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_progress_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_progress_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "lesson_progress_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "body_md": string,"created_at": string,"department_ids": (string)[],"duration_min": number | null,"id": string,"kind": Database["public"]['Enums']["lesson_kind"],"module_id": string,"published_at": string | null,"published_by": string | null,"resources": NonNullable<Json>,"slug": string,"sort_order": number,"status": Database["public"]['Enums']["content_status"],"summary": string | null,"title": string,"updated_at": string,"version": number,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_md"?: string,"created_at"?: string,"department_ids"?: (string)[],"duration_min"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["lesson_kind"],"module_id": string,"published_at"?: string | null,"published_by"?: string | null,"resources"?: NonNullable<Json>,"slug": string,"sort_order"?: number,"status"?: Database["public"]['Enums']["content_status"],"summary"?: string | null,"title": string,"updated_at"?: string,"version"?: number,"video_url"?: string | null
                  }
                  Update: {
                    "body_md"?: string,"created_at"?: string,"department_ids"?: (string)[],"duration_min"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["lesson_kind"],"module_id"?: string,"published_at"?: string | null,"published_by"?: string | null,"resources"?: NonNullable<Json>,"slug"?: string,"sort_order"?: number,"status"?: Database["public"]['Enums']["content_status"],"summary"?: string | null,"title"?: string,"updated_at"?: string,"version"?: number,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "progress_module_summary"
      referencedColumns: ["module_id"]
    },{
      foreignKeyName: "lessons_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "lessons_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"module_domains": {
                  Row: {
                    "created_at": string,"domain_id": string,"id": string,"module_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"domain_id": string,"id"?: string,"module_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"domain_id"?: string,"id"?: string,"module_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "module_domains_domain_id_fkey"
      columns: ["domain_id"]
isOneToOne: false
      referencedRelation: "competency_domains"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "module_domains_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "module_domains_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "progress_module_summary"
      referencedColumns: ["module_id"]
    }
                  ]
                },"modules": {
                  Row: {
                    "assessed_by": string | null,"async_hours": number,"code": string,"created_at": string,"id": string,"is_leadership": boolean,"live_hours": number,"overview_md": string,"sort_order": number,"stage_id": string,"title": string,"updated_at": string,"week_end": number,"week_start": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assessed_by"?: string | null,"async_hours"?: number,"code": string,"created_at"?: string,"id"?: string,"is_leadership"?: boolean,"live_hours"?: number,"overview_md"?: string,"sort_order": number,"stage_id": string,"title": string,"updated_at"?: string,"week_end": number,"week_start": number
                  }
                  Update: {
                    "assessed_by"?: string | null,"async_hours"?: number,"code"?: string,"created_at"?: string,"id"?: string,"is_leadership"?: boolean,"live_hours"?: number,"overview_md"?: string,"sort_order"?: number,"stage_id"?: string,"title"?: string,"updated_at"?: string,"week_end"?: number,"week_start"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "modules_stage_id_fkey"
      columns: ["stage_id"]
isOneToOne: false
      referencedRelation: "stages"
      referencedColumns: ["id"]
    }
                  ]
                },"page_acknowledgements": {
                  Row: {
                    "acknowledged_at": string,"created_at": string,"id": string,"page_id": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string,"created_at"?: string,"id"?: string,"page_id": string,"user_id": string,"version": number
                  }
                  Update: {
                    "acknowledged_at"?: string,"created_at"?: string,"id"?: string,"page_id"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "page_acknowledgements_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "pages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_acknowledgements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_acknowledgements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "page_acknowledgements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"pages": {
                  Row: {
                    "body_md": string,"created_at": string,"id": string,"owner_id": string | null,"published_at": string | null,"published_by": string | null,"requires_acknowledgement": boolean,"review_by": string | null,"slug": string,"sort_order": number,"status": Database["public"]['Enums']["content_status"],"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body_md"?: string,"created_at"?: string,"id"?: string,"owner_id"?: string | null,"published_at"?: string | null,"published_by"?: string | null,"requires_acknowledgement"?: boolean,"review_by"?: string | null,"slug": string,"sort_order"?: number,"status"?: Database["public"]['Enums']["content_status"],"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "body_md"?: string,"created_at"?: string,"id"?: string,"owner_id"?: string | null,"published_at"?: string | null,"published_by"?: string | null,"requires_acknowledgement"?: boolean,"review_by"?: string | null,"slug"?: string,"sort_order"?: number,"status"?: Database["public"]['Enums']["content_status"],"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pages_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pages_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "pages_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "pages_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pages_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "pages_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"placement_results": {
                  Row: {
                    "attempt_id": string,"bridges": (string)[],"confirmed_at": string | null,"confirmed_by": string | null,"confirmed_stream": Database["public"]['Enums']["stream_type"] | null,"created_at": string,"domain_percentages": NonNullable<Json>,"gates_failed": (string)[],"id": string,"override_reason": string | null,"portfolio_reviewed": boolean,"required_domain_flags": (string)[],"section_scores": NonNullable<Json>,"settings_snapshot": NonNullable<Json>,"suggested_band": string | null,"suggested_stream": Database["public"]['Enums']["stream_type"] | null,"total": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id": string,"bridges"?: (string)[],"confirmed_at"?: string | null,"confirmed_by"?: string | null,"confirmed_stream"?: Database["public"]['Enums']["stream_type"] | null,"created_at"?: string,"domain_percentages"?: NonNullable<Json>,"gates_failed"?: (string)[],"id"?: string,"override_reason"?: string | null,"portfolio_reviewed"?: boolean,"required_domain_flags"?: (string)[],"section_scores"?: NonNullable<Json>,"settings_snapshot"?: NonNullable<Json>,"suggested_band"?: string | null,"suggested_stream"?: Database["public"]['Enums']["stream_type"] | null,"total"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "attempt_id"?: string,"bridges"?: (string)[],"confirmed_at"?: string | null,"confirmed_by"?: string | null,"confirmed_stream"?: Database["public"]['Enums']["stream_type"] | null,"created_at"?: string,"domain_percentages"?: NonNullable<Json>,"gates_failed"?: (string)[],"id"?: string,"override_reason"?: string | null,"portfolio_reviewed"?: boolean,"required_domain_flags"?: (string)[],"section_scores"?: NonNullable<Json>,"settings_snapshot"?: NonNullable<Json>,"suggested_band"?: string | null,"suggested_stream"?: Database["public"]['Enums']["stream_type"] | null,"total"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "placement_results_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: true
      referencedRelation: "attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "placement_results_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "placement_results_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "placement_results_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "placement_results_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "placement_results_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "placement_results_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "cohort_id": string | null,"created_at": string,"department_id": string | null,"email": string,"full_name": string | null,"id": string,"is_active": boolean,"is_test_account": boolean,"last_seen_at": string | null,"left_at": string | null,"progress_scope": Database["public"]['Enums']["progress_scope_type"],"role": Database["public"]['Enums']["app_role"],"specialist_pathway": Database["public"]['Enums']["specialist_pathway_type"] | null,"stream": Database["public"]['Enums']["stream_type"] | null,"updated_at": string,"updates_seen_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cohort_id"?: string | null,"created_at"?: string,"department_id"?: string | null,"email": string,"full_name"?: string | null,"id": string,"is_active"?: boolean,"is_test_account"?: boolean,"last_seen_at"?: string | null,"left_at"?: string | null,"progress_scope"?: Database["public"]['Enums']["progress_scope_type"],"role"?: Database["public"]['Enums']["app_role"],"specialist_pathway"?: Database["public"]['Enums']["specialist_pathway_type"] | null,"stream"?: Database["public"]['Enums']["stream_type"] | null,"updated_at"?: string,"updates_seen_at"?: string | null
                  }
                  Update: {
                    "cohort_id"?: string | null,"created_at"?: string,"department_id"?: string | null,"email"?: string,"full_name"?: string | null,"id"?: string,"is_active"?: boolean,"is_test_account"?: boolean,"last_seen_at"?: string | null,"left_at"?: string | null,"progress_scope"?: Database["public"]['Enums']["progress_scope_type"],"role"?: Database["public"]['Enums']["app_role"],"specialist_pathway"?: Database["public"]['Enums']["specialist_pathway_type"] | null,"stream"?: Database["public"]['Enums']["stream_type"] | null,"updated_at"?: string,"updates_seen_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "progress_weekly_activity"
      referencedColumns: ["cohort_id"]
    },{
      foreignKeyName: "profiles_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_department_summary"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "profiles_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["department_id"]
    },{
      foreignKeyName: "profiles_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["department_id"]
    }
                  ]
                },"response_scores": {
                  Row: {
                    "auto_score": number | null,"comment_md": string | null,"created_at": string,"criterion_scores": Json | null,"id": string,"marked_at": string | null,"marked_by": string | null,"marker_score": number | null,"response_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_score"?: number | null,"comment_md"?: string | null,"created_at"?: string,"criterion_scores"?: Json | null,"id"?: string,"marked_at"?: string | null,"marked_by"?: string | null,"marker_score"?: number | null,"response_id": string,"updated_at"?: string
                  }
                  Update: {
                    "auto_score"?: number | null,"comment_md"?: string | null,"created_at"?: string,"criterion_scores"?: Json | null,"id"?: string,"marked_at"?: string | null,"marked_by"?: string | null,"marker_score"?: number | null,"response_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "response_scores_marked_by_fkey"
      columns: ["marked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "response_scores_marked_by_fkey"
      columns: ["marked_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "response_scores_marked_by_fkey"
      columns: ["marked_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "response_scores_response_id_fkey"
      columns: ["response_id"]
isOneToOne: true
      referencedRelation: "responses"
      referencedColumns: ["id"]
    }
                  ]
                },"responses": {
                  Row: {
                    "answer": NonNullable<Json>,"attempt_id": string,"created_at": string,"id": string,"item_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer"?: NonNullable<Json>,"attempt_id": string,"created_at"?: string,"id"?: string,"item_id": string,"updated_at"?: string
                  }
                  Update: {
                    "answer"?: NonNullable<Json>,"attempt_id"?: string,"created_at"?: string,"id"?: string,"item_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "responses_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "responses_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "assessment_items"
      referencedColumns: ["id"]
    }
                  ]
                },"review_assignments": {
                  Row: {
                    "assigned_at": string,"completed_at": string | null,"created_at": string,"id": string,"kind": Database["public"]['Enums']["review_kind"],"reviewer_id": string,"submission_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["review_kind"],"reviewer_id": string,"submission_id": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_at"?: string,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["review_kind"],"reviewer_id"?: string,"submission_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_assignments_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_assignments_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "review_assignments_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "review_assignments_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "created_at": string,"criterion_scores": NonNullable<Json>,"feedback_md": string | null,"id": string,"kind": Database["public"]['Enums']["review_kind"],"max_total": number,"released_at": string | null,"reviewer_id": string,"submission_id": string,"total": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"criterion_scores"?: NonNullable<Json>,"feedback_md"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["review_kind"],"max_total"?: number,"released_at"?: string | null,"reviewer_id": string,"submission_id": string,"total"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"criterion_scores"?: NonNullable<Json>,"feedback_md"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["review_kind"],"max_total"?: number,"released_at"?: string | null,"reviewer_id"?: string,"submission_id"?: string,"total"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "reviews_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"rubric_criteria": {
                  Row: {
                    "created_at": string,"id": string,"max_score": number,"name": string,"rubric_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"max_score": number,"name": string,"rubric_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"max_score"?: number,"name"?: string,"rubric_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rubric_criteria_rubric_id_fkey"
      columns: ["rubric_id"]
isOneToOne: false
      referencedRelation: "rubrics"
      referencedColumns: ["id"]
    }
                  ]
                },"rubric_levels": {
                  Row: {
                    "created_at": string,"criterion_id": string,"descriptor": string,"id": string,"score": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"criterion_id": string,"descriptor": string,"id"?: string,"score": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"criterion_id"?: string,"descriptor"?: string,"id"?: string,"score"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rubric_levels_criterion_id_fkey"
      columns: ["criterion_id"]
isOneToOne: false
      referencedRelation: "rubric_criteria"
      referencedColumns: ["id"]
    }
                  ]
                },"rubrics": {
                  Row: {
                    "created_at": string,"id": string,"ref": string,"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"ref": string,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"ref"?: string,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"stages": {
                  Row: {
                    "code": string,"created_at": string,"hours_per_week": number | null,"id": string,"name": string,"sort_order": number,"updated_at": string,"week_end": number,"week_start": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"hours_per_week"?: number | null,"id"?: string,"name": string,"sort_order": number,"updated_at"?: string,"week_end": number,"week_start": number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"hours_per_week"?: number | null,"id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string,"week_end"?: number,"week_start"?: number
                  }
                  Relationships: [
                    
                  ]
                },"submissions": {
                  Row: {
                    "assignment_id": string,"attempt_no": number,"created_at": string,"data_declaration": boolean,"file_path": string | null,"id": string,"link_url": string | null,"status": Database["public"]['Enums']["submission_status"],"submitted_at": string,"text_md": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"attempt_no": number,"created_at"?: string,"data_declaration": boolean,"file_path"?: string | null,"id"?: string,"link_url"?: string | null,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string,"text_md"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "assignment_id"?: string,"attempt_no"?: number,"created_at"?: string,"data_declaration"?: boolean,"file_path"?: string | null,"id"?: string,"link_url"?: string | null,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string,"text_md"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submissions_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "submissions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                },"updates": {
                  Row: {
                    "action_due": string | null,"action_required": boolean,"action_text": string | null,"body_md": string,"created_at": string,"id": string,"published_at": string | null,"published_by": string | null,"slug": string | null,"status": Database["public"]['Enums']["content_status"],"title": string,"tools": (string)[],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action_due"?: string | null,"action_required"?: boolean,"action_text"?: string | null,"body_md"?: string,"created_at"?: string,"id"?: string,"published_at"?: string | null,"published_by"?: string | null,"slug"?: string | null,"status"?: Database["public"]['Enums']["content_status"],"title": string,"tools"?: (string)[],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "action_due"?: string | null,"action_required"?: boolean,"action_text"?: string | null,"body_md"?: string,"created_at"?: string,"id"?: string,"published_at"?: string | null,"published_by"?: string | null,"slug"?: string | null,"status"?: Database["public"]['Enums']["content_status"],"title"?: string,"tools"?: (string)[],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "updates_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "updates_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_public"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "updates_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "progress_person_trainer"
      referencedColumns: ["user_id"]
    }
                  ]
                }
          }
          Views: {
            "progress_department_summary": {
                  Row: {
                    "active_last_7_days": number | null,"data_rules_confirmed_count": number | null,"department_id": string | null,"department_name": string | null,"people": number | null,"required_modules_done_sum": number | null,"required_modules_total_sum": number | null,"stream_champion": number | null,"stream_foundation": number | null,"stream_practitioner": number | null,"stream_practitioner_fast_track": number | null,"week0_confirmed": number | null,"week0_in_progress": number | null,"week0_not_started": number | null,"week0_submitted": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"progress_module_summary": {
                  Row: {
                    "assignment_returned": number | null,"assignment_submissions": number | null,"lesson_completions": number | null,"median_working_days_to_return": number | null,"module_code": string | null,"module_id": string | null,"module_title": string | null,"people_done": number | null,"people_required": number | null,"quiz_attempts": number | null,"quiz_passes": number | null,"resubmit_requested": number | null,"test_out_pending": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"progress_person_public": {
                  Row: {
                    "assignments_returned": number | null,"assignments_submitted": number | null,"bridge_modules_done": number | null,"bridge_modules_total": number | null,"cohort_id": string | null,"cohort_name": string | null,"data_rules_confirmed": boolean | null,"data_rules_version": number | null,"department_id": string | null,"department_name": string | null,"is_test_account": boolean | null,"last_seen_at": string | null,"lessons_completed": number | null,"person_name": string | null,"quizzes_completed": number | null,"quizzes_passed": number | null,"required_modules_done": number | null,"required_modules_total": number | null,"stream": string | null,"test_out_status": string | null,"user_id": string | null,"week0_status": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "profiles_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "progress_weekly_activity"
      referencedColumns: ["cohort_id"]
    }
                  ]
                },"progress_person_trainer": {
                  Row: {
                    "assignment_marks_summary": string | null,"assignments_returned": number | null,"assignments_submitted": number | null,"bridge_modules_done": number | null,"bridge_modules_total": number | null,"cohort_id": string | null,"cohort_name": string | null,"data_rules_confirmed": boolean | null,"data_rules_version": number | null,"department_id": string | null,"department_name": string | null,"is_test_account": boolean | null,"last_seen_at": string | null,"lessons_completed": number | null,"person_name": string | null,"quiz_best_summary": string | null,"quizzes_completed": number | null,"quizzes_passed": number | null,"required_modules_done": number | null,"required_modules_total": number | null,"stream": string | null,"test_out_status": string | null,"user_id": string | null,"week0_status": string | null,"week0_total": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "profiles_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "progress_weekly_activity"
      referencedColumns: ["cohort_id"]
    }
                  ]
                },"progress_weekly_activity": {
                  Row: {
                    "assignments_submitted": number | null,"cohort_id": string | null,"cohort_name": string | null,"feedback_released": number | null,"lessons_completed": number | null,"people_active": number | null,"programme_week": number | null,"quizzes_submitted": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "_calculate_placement_internal":
{ Args: { "p_attempt_id": string }; Returns: {
              "attempt_id": string,
"bridges": (string)[],
"confirmed_at": string | null,
"confirmed_by": string | null,
"confirmed_stream": Database["public"]['Enums']["stream_type"] | null,
"created_at": string,
"domain_percentages": NonNullable<Json>,
"gates_failed": (string)[],
"id": string,
"override_reason": string | null,
"portfolio_reviewed": boolean,
"required_domain_flags": (string)[],
"section_scores": NonNullable<Json>,
"settings_snapshot": NonNullable<Json>,
"suggested_band": string | null,
"suggested_stream": Database["public"]['Enums']["stream_type"] | null,
"total": number,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "placement_results"
        isOneToOne: true
        isSetofReturn: false
      } },
"_champion_assigned_submission":
{ Args: { "p_submission_id": string }; Returns: boolean
                           },
"_champion_saved_double_mark":
{ Args: { "p_submission_id": string }; Returns: boolean
                           },
"_correct_option_id_from_points":
{ Args: { "p_option_points": Json }; Returns: string
                           },
"_is_allowed_submission_link":
{ Args: { "p_url": string }; Returns: boolean
                           },
"_marking_setting_int":
{ Args: { "p_suffix": string }; Returns: number
                           },
"_option_text_from_options":
{ Args: { "p_option_id": string,"p_options": Json }; Returns: string
                           },
"_plan_module_in_test_out":
{ Args: { "p_module_code": string,"p_rules": Json,"p_stream": Database["public"]['Enums']["stream_type"] }; Returns: boolean
                           },
"_plan_rules_list_contains":
{ Args: { "p_list": string,"p_module_code": string,"p_rules": Json,"p_stream": Database["public"]['Enums']["stream_type"] }; Returns: boolean
                           },
"_plan_rules_module_list_contains":
{ Args: { "p_list": string,"p_module_code": string,"p_rules": Json,"p_stream": Database["public"]['Enums']["stream_type"] }; Returns: boolean
                           },
"_plan_test_out_week_for_module":
{ Args: { "p_module_code": string,"p_rules": Json,"p_stream": Database["public"]['Enums']["stream_type"] }; Returns: number
                           },
"_progress_break_covers_date":
{ Args: { "p_cohort_id": string,"p_ymd": string }; Returns: boolean
                           },
"_progress_module_complete":
{ Args: { "p_module_id": string,"p_user_id": string }; Returns: boolean
                           },
"_progress_monday_of_week":
{ Args: { "p_ymd": string }; Returns: string
                           },
"_progress_person_assignment_counts":
{ Args: { "p_user_id": string }; Returns: {
              "assignments_returned": number,"assignments_submitted": number
            }[]
                           },
"_progress_person_plan_counts":
{ Args: { "p_user_id": string }; Returns: {
              "bridge_modules_done": number,"bridge_modules_total": number,"required_modules_done": number,"required_modules_total": number
            }[]
                           },
"_progress_person_quiz_counts":
{ Args: { "p_user_id": string }; Returns: {
              "quizzes_completed": number,"quizzes_passed": number
            }[]
                           },
"_progress_person_test_out_status":
{ Args: { "p_user_id": string }; Returns: string
                           },
"_progress_person_week0_status":
{ Args: { "p_user_id": string }; Returns: string
                           },
"_progress_programme_week_range":
{ Args: { "p_cohort_id": string,"p_programme_week": number,"p_week0_start": string }; Returns: {
              "week_friday": string,"week_monday": string
            }[]
                           },
"_progress_require_can_view_user":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"_progress_trainer_assignment_marks_summary":
{ Args: { "p_user_id": string }; Returns: string
                           },
"_progress_trainer_quiz_summary":
{ Args: { "p_user_id": string }; Returns: string
                           },
"_progress_trainer_week0_total":
{ Args: { "p_user_id": string }; Returns: string
                           },
"_progress_working_days_malaysia":
{ Args: { "p_end": string,"p_start": string }; Returns: number
                           },
"_rubric_max_total":
{ Args: { "p_rubric_id": string }; Returns: number
                           },
"_submission_released_winning_review":
{ Args: { "p_submission_id": string }; Returns: {
              "created_at": string,
"criterion_scores": NonNullable<Json>,
"feedback_md": string | null,
"id": string,
"kind": Database["public"]['Enums']["review_kind"],
"max_total": number,
"released_at": string | null,
"reviewer_id": string,
"submission_id": string,
"total": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "reviews"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_log_event":
{ Args: { "p_event": string,"p_reason": string,"p_row_id": string,"p_table_name": string }; Returns: undefined
                           },
"admin_mark_leaver":
{ Args: { "p_reason": string,"p_user_id": string }; Returns: undefined
                           },
"admin_set_role":
{ Args: { "new_role": Database["public"]['Enums']["app_role"],"new_scope": Database["public"]['Enums']["progress_scope_type"],"reason": string,"user_id": string }; Returns: undefined
                           },
"admin_update_setting":
{ Args: { "key": string,"new_value": Json,"reason": string }; Returns: undefined
                           },
"allow_retake":
{ Args: { "p_assessment_id": string,"p_reason": string,"p_user_id": string }; Returns: undefined
                           },
"apply_test_out_result":
{ Args: { "p_test_out_code": string,"p_user_id": string }; Returns: undefined
                           },
"assign_double_marks":
{ Args: { "p_assignment_id": string }; Returns: Json
                           },
"attempt_item_applies":
{ Args: { "p_department_match_id": string,"p_item": Omit<Database["public"]['Tables']["assessment_items"]['Row'], Database["public"]['Tables']["assessment_items"]['ComputedFields']>,"p_section_code": string,"p_user_department_id": string }; Returns: boolean
                           },
"check_rate_limit":
{ Args: { "p_action_key": string,"p_bucket_key": string,"p_max_events": number,"p_window_seconds": number }; Returns: boolean
                           },
"calculate_placement":
{ Args: { "p_attempt_id": string }; Returns: {
              "attempt_id": string,
"bridges": (string)[],
"confirmed_at": string | null,
"confirmed_by": string | null,
"confirmed_stream": Database["public"]['Enums']["stream_type"] | null,
"created_at": string,
"domain_percentages": NonNullable<Json>,
"gates_failed": (string)[],
"id": string,
"override_reason": string | null,
"portfolio_reviewed": boolean,
"required_domain_flags": (string)[],
"section_scores": NonNullable<Json>,
"settings_snapshot": NonNullable<Json>,
"suggested_band": string | null,
"suggested_stream": Database["public"]['Enums']["stream_type"] | null,
"total": number,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "placement_results"
        isOneToOne: true
        isSetofReturn: false
      } },
"can_view_department":
{ Args: { "p_department_id": string }; Returns: boolean
                           },
"can_view_user":
{ Args: { "target": string }; Returns: boolean
                           },
"confirm_placement":
{ Args: { "p_attempt_id": string,"p_portfolio_reviewed"?: boolean,"p_reason"?: string,"p_stream": Database["public"]['Enums']["stream_type"] }; Returns: {
              "attempt_id": string,
"bridges": (string)[],
"confirmed_at": string | null,
"confirmed_by": string | null,
"confirmed_stream": Database["public"]['Enums']["stream_type"] | null,
"created_at": string,
"domain_percentages": NonNullable<Json>,
"gates_failed": (string)[],
"id": string,
"override_reason": string | null,
"portfolio_reviewed": boolean,
"required_domain_flags": (string)[],
"section_scores": NonNullable<Json>,
"settings_snapshot": NonNullable<Json>,
"suggested_band": string | null,
"suggested_stream": Database["public"]['Enums']["stream_type"] | null,
"total": number,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "placement_results"
        isOneToOne: true
        isSetofReturn: false
      } },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"discard_sample_in_progress_attempt":
{ Args: { "p_attempt_id": string,"p_reason": string }; Returns: undefined
                           },
"generate_learner_plan":
{ Args: { "p_user_id": string }; Returns: number
                           },
"get_attempt_review":
{ Args: { "p_attempt_id": string }; Returns: {
              "chosen_option_id": string,"chosen_text": string,"correct_option_id": string,"correct_text": string,"explanation_md": string,"item_id": string,"prompt_md": string
            }[]
                           },
"get_quiz_question_stats":
{ Args: { "p_assessment_id": string }; Returns: {
              "answered_count": number,"item_id": string,"item_ref": string,"option_counts": Json,"prompt_md": string,"sort_order": number
            }[]
                           },
"get_quiz_results_summary":
{ Args: Record<PropertyKey, never>; Returns: {
              "assessment_code": string,"assessment_id": string,"assessment_title": string,"assessment_type": Database["public"]['Enums']["assessment_type"],"attempts_used": number,"best_percentage": number,"department_code": string,"email": string,"first_pass_at": string,"full_name": string,"last_attempt_at": string,"max_attempts": number,"pass_mark_pct": number,"passed": boolean,"user_id": string
            }[]
                           },
"has_role":
{ Args: { "roles": (Database["public"]['Enums']["app_role"])[] }; Returns: boolean
                           },
"hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"is_allowed_sign_in_email":
{ Args: { "email": string }; Returns: boolean
                           },
"is_valid_content_slug":
{ Args: { "candidate": string }; Returns: boolean
                           },
"mark_updates_seen":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"my_access_status":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"next_module_revision":
{ Args: { "p_module_id": string }; Returns: number
                           },
"override_plan_item":
{ Args: { "p_module_id": string,"p_reason": string,"p_status": Database["public"]['Enums']["plan_status"],"p_user_id": string }; Returns: {
              "created_at": string,
"due_week": number | null,
"id": string,
"is_override": boolean,
"module_id": string,
"override_reason": string | null,
"reason": string | null,
"set_by": string | null,
"status": Database["public"]['Enums']["plan_status"],
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "learner_plan"
        isOneToOne: true
        isSetofReturn: false
      } },
"publish_content":
{ Args: { "p_change_note": string,"p_id": string,"p_type": Database["public"]['Enums']["content_type"] }; Returns: number
                           },
"record_last_seen":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"release_feedback":
{ Args: { "p_submission_id": string }; Returns: {
              "assignment_id": string,
"attempt_no": number,
"created_at": string,
"data_declaration": boolean,
"file_path": string | null,
"id": string,
"link_url": string | null,
"status": Database["public"]['Enums']["submission_status"],
"submitted_at": string,
"text_md": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } },
"reorder_lessons":
{ Args: { "p_lesson_ids": (string)[],"p_module_id": string }; Returns: undefined
                           },
"request_resubmission":
{ Args: { "p_feedback_md": string,"p_submission_id": string }; Returns: {
              "assignment_id": string,
"attempt_no": number,
"created_at": string,
"data_declaration": boolean,
"file_path": string | null,
"id": string,
"link_url": string | null,
"status": Database["public"]['Enums']["submission_status"],
"submitted_at": string,
"text_md": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } },
"require_trainer_or_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"resolve_department_item_department_id":
{ Args: { "p_assessment_id": string,"p_user_department_id": string }; Returns: string
                           },
"response_effective_score":
{ Args: { "p_response_id": string }; Returns: number
                           },
"restore_revision":
{ Args: { "p_id": string,"p_revision_no": number,"p_type": Database["public"]['Enums']["content_type"] }; Returns: undefined
                           },
"save_mark":
{ Args: { "p_comment_md"?: string,"p_criterion_scores": Json,"p_response_id": string }; Returns: {
              "auto_score": number | null,
"comment_md": string | null,
"created_at": string,
"criterion_scores": Json | null,
"id": string,
"marked_at": string | null,
"marked_by": string | null,
"marker_score": number | null,
"response_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "response_scores"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_review":
{ Args: { "p_criterion_scores": Json,"p_feedback_md"?: string,"p_kind": Database["public"]['Enums']["review_kind"],"p_submission_id": string }; Returns: {
              "created_at": string,
"criterion_scores": NonNullable<Json>,
"feedback_md": string | null,
"id": string,
"kind": Database["public"]['Enums']["review_kind"],
"max_total": number,
"released_at": string | null,
"reviewer_id": string,
"submission_id": string,
"total": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "reviews"
        isOneToOne: true
        isSetofReturn: false
      } },
"search_help_pages":
{ Args: { "p_query": string }; Returns: {
              "body_md": string,
"created_at": string,
"id": string,
"owner_id": string | null,
"published_at": string | null,
"published_by": string | null,
"requires_acknowledgement": boolean,
"review_by": string | null,
"slug": string,
"sort_order": number,
"status": Database["public"]['Enums']["content_status"],
"title": string,
"updated_at": string,
"version": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "pages"
        isOneToOne: false
        isSetofReturn: true
      } },
"start_attempt":
{ Args: { "p_assessment_id": string }; Returns: {
              "allowed_by": string | null,
"assessment_id": string,
"created_at": string,
"data_declaration": boolean,
"id": string,
"item_ids": (string)[],
"meta": NonNullable<Json>,
"passed": boolean | null,
"percentage": number | null,
"seconds_active": number | null,
"started_at": string,
"status": Database["public"]['Enums']["attempt_status"],
"submitted_at": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "attempts"
        isOneToOne: true
        isSetofReturn: false
      } },
"submit_assignment":
{ Args: { "p_assignment_id": string,"p_data_declaration"?: boolean,"p_file_path"?: string,"p_link_url"?: string,"p_text_md"?: string }; Returns: {
              "assignment_id": string,
"attempt_no": number,
"created_at": string,
"data_declaration": boolean,
"file_path": string | null,
"id": string,
"link_url": string | null,
"status": Database["public"]['Enums']["submission_status"],
"submitted_at": string,
"text_md": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } },
"submit_attempt":
{ Args: { "p_attempt_id": string,"p_data_declaration": boolean }; Returns: {
              "allowed_by": string | null,
"assessment_id": string,
"created_at": string,
"data_declaration": boolean,
"id": string,
"item_ids": (string)[],
"meta": NonNullable<Json>,
"passed": boolean | null,
"percentage": number | null,
"seconds_active": number | null,
"started_at": string,
"status": Database["public"]['Enums']["attempt_status"],
"submitted_at": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "attempts"
        isOneToOne: true
        isSetofReturn: false
      } },
"trainer_update_profiles":
{ Args: { "clear_fields"?: (string)[],"cohort_id"?: string,"department_id"?: string,"is_active"?: boolean,"reason"?: string,"specialist_pathway"?: Database["public"]['Enums']["specialist_pathway_type"],"stream"?: Database["public"]['Enums']["stream_type"],"user_ids": (string)[] }; Returns: number
                           },
"unpublish_content":
{ Args: { "p_id": string,"p_reason": string,"p_type": Database["public"]['Enums']["content_type"] }; Returns: undefined
                           },
"update_module_overview":
{ Args: { "p_body_md": string,"p_change_note": string,"p_module_id": string }; Returns: number
                           },
"upload_submission_file":
{ Args: { "p_assignment_id": string,"p_byte_size": number,"p_filename": string,"p_mime_type": string }; Returns: string
                           },
"withdraw_submission":
{ Args: { "p_submission_id": string }; Returns: {
              "assignment_id": string,
"attempt_no": number,
"created_at": string,
"data_declaration": boolean,
"file_path": string | null,
"id": string,
"link_url": string | null,
"status": Database["public"]['Enums']["submission_status"],
"submitted_at": string,
"text_md": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "app_role": "learner"|"champion"|"manager"|"trainer"|"admin","assessment_type": "placement"|"quiz"|"safety_quiz"|"capstone","attempt_status": "in_progress"|"submitted"|"marking"|"marked"|"confirmed","content_status": "draft"|"published"|"archived","content_type": "page"|"update"|"lesson"|"module"|"assignment","item_type": "profile"|"choice"|"short_text"|"practical","lesson_kind": "lesson"|"recording"|"worked_example","plan_status": "required"|"optional"|"tested_out"|"bridge"|"not_applicable"|"test_out_pending","progress_scope_type": "self"|"department"|"all","response_format": "text"|"prompt_and_output"|"link","review_kind": "primary"|"double_mark"|"final","specialist_pathway_type": "business"|"builder"|"technical","stream_type": "foundation"|"practitioner"|"practitioner_fast_track"|"champion","submission_status": "submitted"|"in_review"|"returned"|"resubmit_requested"|"withdrawn"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["learner", "champion", "manager", "trainer", "admin"],"assessment_type": ["placement", "quiz", "safety_quiz", "capstone"],"attempt_status": ["in_progress", "submitted", "marking", "marked", "confirmed"],"content_status": ["draft", "published", "archived"],"content_type": ["page", "update", "lesson", "module", "assignment"],"item_type": ["profile", "choice", "short_text", "practical"],"lesson_kind": ["lesson", "recording", "worked_example"],"plan_status": ["required", "optional", "tested_out", "bridge", "not_applicable", "test_out_pending"],"progress_scope_type": ["self", "department", "all"],"response_format": ["text", "prompt_and_output", "link"],"review_kind": ["primary", "double_mark", "final"],"specialist_pathway_type": ["business", "builder", "technical"],"stream_type": ["foundation", "practitioner", "practitioner_fast_track", "champion"],"submission_status": ["submitted", "in_review", "returned", "resubmit_requested", "withdrawn"]
          }
        }
} as const
