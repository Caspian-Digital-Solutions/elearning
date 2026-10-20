
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
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
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"after": Json | null,"at": string,"before": Json | null,"created_at": string,"id": string,"row_id": string | null,"table_name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"created_at"?: string,"id"?: string,"row_id"?: string | null,"table_name": string,"updated_at"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"created_at"?: string,"id"?: string,"row_id"?: string | null,"table_name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cohorts": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slot": string | null,"start_date": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slot"?: string | null,"start_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slot"?: string | null,"start_date"?: string | null,"updated_at"?: string
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
    }
                  ]
                },"learner_plan": {
                  Row: {
                    "created_at": string,"id": string,"module_id": string,"reason": string | null,"set_by": string | null,"status": Database["public"]['Enums']["plan_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"module_id": string,"reason"?: string | null,"set_by"?: string | null,"status": Database["public"]['Enums']["plan_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"module_id"?: string,"reason"?: string | null,"set_by"?: string | null,"status"?: Database["public"]['Enums']["plan_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "learner_plan_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learner_plan_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learner_plan_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_progress": {
                  Row: {
                    "completed_at": string,"created_at": string,"id": string,"lesson_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"created_at"?: string,"id"?: string,"lesson_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string,"created_at"?: string,"id"?: string,"lesson_id"?: string,"updated_at"?: string,"user_id"?: string
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
    }
                  ]
                },"lessons": {
                  Row: {
                    "body_md": string,"created_at": string,"department_ids": (string)[],"duration_min": number | null,"id": string,"module_id": string,"slug": string,"sort_order": number,"status": Database["public"]['Enums']["content_status"],"summary": string | null,"title": string,"updated_at": string,"version": number,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_md"?: string,"created_at"?: string,"department_ids"?: (string)[],"duration_min"?: number | null,"id"?: string,"module_id": string,"slug": string,"sort_order"?: number,"status"?: Database["public"]['Enums']["content_status"],"summary"?: string | null,"title": string,"updated_at"?: string,"version"?: number,"video_url"?: string | null
                  }
                  Update: {
                    "body_md"?: string,"created_at"?: string,"department_ids"?: (string)[],"duration_min"?: number | null,"id"?: string,"module_id"?: string,"slug"?: string,"sort_order"?: number,"status"?: Database["public"]['Enums']["content_status"],"summary"?: string | null,"title"?: string,"updated_at"?: string,"version"?: number,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
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
    }
                  ]
                },"modules": {
                  Row: {
                    "assessed_by": string | null,"async_hours": number,"code": string,"created_at": string,"id": string,"is_leadership": boolean,"live_hours": number,"sort_order": number,"stage_id": string,"title": string,"updated_at": string,"week_end": number,"week_start": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assessed_by"?: string | null,"async_hours"?: number,"code": string,"created_at"?: string,"id"?: string,"is_leadership"?: boolean,"live_hours"?: number,"sort_order": number,"stage_id": string,"title": string,"updated_at"?: string,"week_end": number,"week_start": number
                  }
                  Update: {
                    "assessed_by"?: string | null,"async_hours"?: number,"code"?: string,"created_at"?: string,"id"?: string,"is_leadership"?: boolean,"live_hours"?: number,"sort_order"?: number,"stage_id"?: string,"title"?: string,"updated_at"?: string,"week_end"?: number,"week_start"?: number
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
                },"pages": {
                  Row: {
                    "body_md": string,"created_at": string,"id": string,"owner_id": string | null,"slug": string,"status": Database["public"]['Enums']["content_status"],"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body_md"?: string,"created_at"?: string,"id"?: string,"owner_id"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["content_status"],"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "body_md"?: string,"created_at"?: string,"id"?: string,"owner_id"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["content_status"],"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pages_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "cohort_id": string | null,"created_at": string,"department_id": string | null,"email": string,"full_name": string | null,"id": string,"is_active": boolean,"progress_scope": Database["public"]['Enums']["progress_scope_type"],"role": Database["public"]['Enums']["app_role"],"specialist_pathway": Database["public"]['Enums']["specialist_pathway_type"] | null,"stream": Database["public"]['Enums']["stream_type"] | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cohort_id"?: string | null,"created_at"?: string,"department_id"?: string | null,"email": string,"full_name"?: string | null,"id": string,"is_active"?: boolean,"progress_scope"?: Database["public"]['Enums']["progress_scope_type"],"role"?: Database["public"]['Enums']["app_role"],"specialist_pathway"?: Database["public"]['Enums']["specialist_pathway_type"] | null,"stream"?: Database["public"]['Enums']["stream_type"] | null,"updated_at"?: string
                  }
                  Update: {
                    "cohort_id"?: string | null,"created_at"?: string,"department_id"?: string | null,"email"?: string,"full_name"?: string | null,"id"?: string,"is_active"?: boolean,"progress_scope"?: Database["public"]['Enums']["progress_scope_type"],"role"?: Database["public"]['Enums']["app_role"],"specialist_pathway"?: Database["public"]['Enums']["specialist_pathway_type"] | null,"stream"?: Database["public"]['Enums']["stream_type"] | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    }
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
                },"updates": {
                  Row: {
                    "action_required": boolean,"body_md": string,"created_at": string,"id": string,"published_at": string | null,"title": string,"tools": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action_required"?: boolean,"body_md"?: string,"created_at"?: string,"id"?: string,"published_at"?: string | null,"title": string,"tools"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "action_required"?: boolean,"body_md"?: string,"created_at"?: string,"id"?: string,"published_at"?: string | null,"title"?: string,"tools"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_view_user":
{ Args: { "target": string }; Returns: boolean
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"has_role":
{ Args: { "roles": (Database["public"]['Enums']["app_role"])[] }; Returns: boolean
                           },
"hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"is_allowed_sign_in_email":
{ Args: { "email": string }; Returns: boolean
                           }
          }
          Enums: {
            "app_role": "learner"|"champion"|"manager"|"trainer"|"admin","content_status": "draft"|"published"|"archived","plan_status": "required"|"optional"|"tested_out"|"bridge"|"not_applicable","progress_scope_type": "self"|"department"|"all","specialist_pathway_type": "business"|"builder"|"technical","stream_type": "foundation"|"practitioner"|"practitioner_fast_track"|"champion"
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
  "public": {
          Enums: {
            "app_role": ["learner", "champion", "manager", "trainer", "admin"],"content_status": ["draft", "published", "archived"],"plan_status": ["required", "optional", "tested_out", "bridge", "not_applicable"],"progress_scope_type": ["self", "department", "all"],"specialist_pathway_type": ["business", "builder", "technical"],"stream_type": ["foundation", "practitioner", "practitioner_fast_track", "champion"]
          }
        }
} as const
