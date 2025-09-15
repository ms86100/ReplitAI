export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          module: Database["public"]["Enums"]["module_name"]
          new_values: Json | null
          old_values: Json | null
          project_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          module: Database["public"]["Enums"]["module_name"]
          new_values?: Json | null
          old_values?: Json | null
          project_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          module?: Database["public"]["Enums"]["module_name"]
          new_values?: Json | null
          old_values?: Json | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_alert_rules: {
        Row: {
          condition_type: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean | null
          message: string
          project_budget_id: string
          severity: string
          threshold_value: number | null
          updated_at: string
        }
        Insert: {
          condition_type: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean | null
          message: string
          project_budget_id: string
          severity?: string
          threshold_value?: number | null
          updated_at?: string
        }
        Update: {
          condition_type?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean | null
          message?: string
          project_budget_id?: string
          severity?: string
          threshold_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_budget_alert_rules_project_budget"
            columns: ["project_budget_id"]
            isOneToOne: false
            referencedRelation: "project_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          amount_spent: number
          budget_allocated: number
          budget_received: number
          budget_type_code: string
          comments: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          project_budget_id: string
          updated_at: string
        }
        Insert: {
          amount_spent?: number
          budget_allocated?: number
          budget_received?: number
          budget_type_code: string
          comments?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          project_budget_id: string
          updated_at?: string
        }
        Update: {
          amount_spent?: number
          budget_allocated?: number
          budget_received?: number
          budget_type_code?: string
          comments?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          project_budget_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_budget_categories_project_budget"
            columns: ["project_budget_id"]
            isOneToOne: false
            referencedRelation: "project_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_comments: {
        Row: {
          author: string
          created_at: string
          id: string
          project_budget_id: string
          text: string
        }
        Insert: {
          author: string
          created_at?: string
          id?: string
          project_budget_id: string
          text: string
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          project_budget_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_budget_comments_project_budget"
            columns: ["project_budget_id"]
            isOneToOne: false
            referencedRelation: "project_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_receipts: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          date: string
          id: string
          is_restricted: boolean | null
          notes: string | null
          project_budget_id: string
          received_by: string | null
          restricted_to_category: string | null
          source: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          date: string
          id?: string
          is_restricted?: boolean | null
          notes?: string | null
          project_budget_id: string
          received_by?: string | null
          restricted_to_category?: string | null
          source: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          is_restricted?: boolean | null
          notes?: string | null
          project_budget_id?: string
          received_by?: string | null
          restricted_to_category?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_budget_receipts_project_budget"
            columns: ["project_budget_id"]
            isOneToOne: false
            referencedRelation: "project_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_spending: {
        Row: {
          amount: number
          approved_by: string | null
          budget_category_id: string
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          invoice_id: string | null
          payment_method: string | null
          status: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          approved_by?: string | null
          budget_category_id: string
          created_at?: string
          created_by: string
          date: string
          description: string
          id?: string
          invoice_id?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          budget_category_id?: string
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          invoice_id?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_budget_spending_category"
            columns: ["budget_category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_type_config: {
        Row: {
          code: string
          created_at: string
          default_allocation_percent: number
          dropdown_display_order: number
          enabled: boolean
          id: string
          label: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_allocation_percent?: number
          dropdown_display_order?: number
          enabled?: boolean
          id?: string
          label: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_allocation_percent?: number
          dropdown_display_order?: number
          enabled?: boolean
          id?: string
          label?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      discussion_action_items: {
        Row: {
          created_at: string
          created_by: string
          discussion_id: string
          id: string
          owner_id: string | null
          status: string
          target_date: string | null
          task_description: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          discussion_id: string
          id?: string
          owner_id?: string | null
          status?: string
          target_date?: string | null
          task_description: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          discussion_id?: string
          id?: string
          owner_id?: string | null
          status?: string
          target_date?: string | null
          task_description?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_action_items_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "project_discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_change_log: {
        Row: {
          action_item_id: string | null
          change_type: string
          changed_by: string
          created_at: string
          discussion_id: string | null
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action_item_id?: string | null
          change_type: string
          changed_by: string
          created_at?: string
          discussion_id?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action_item_id?: string | null
          change_type?: string
          changed_by?: string
          created_at?: string
          discussion_id?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      iteration_weeks: {
        Row: {
          created_at: string
          id: string
          iteration_id: string
          updated_at: string
          week_end: string
          week_index: number
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          iteration_id: string
          updated_at?: string
          week_end: string
          week_index: number
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          iteration_id?: string
          updated_at?: string
          week_end?: string
          week_index?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "iteration_weeks_iteration_id_fkey"
            columns: ["iteration_id"]
            isOneToOne: false
            referencedRelation: "iterations"
            referencedColumns: ["id"]
          },
        ]
      }
      iterations: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          id: string
          name: string
          project_id: string
          start_date: string
          team_id: string
          type: string
          updated_at: string
          weeks_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          name: string
          project_id: string
          start_date: string
          team_id: string
          type: string
          updated_at?: string
          weeks_count: number
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          name?: string
          project_id?: string
          start_date?: string
          team_id?: string
          type?: string
          updated_at?: string
          weeks_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "iterations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      member_weekly_availability: {
        Row: {
          availability_percent: number | null
          calculated_days_present: number | null
          calculated_days_total: number | null
          created_at: string
          effective_capacity: number | null
          id: string
          iteration_week_id: string
          leaves: number | null
          notes: string | null
          team_member_id: string
          updated_at: string
        }
        Insert: {
          availability_percent?: number | null
          calculated_days_present?: number | null
          calculated_days_total?: number | null
          created_at?: string
          effective_capacity?: number | null
          id?: string
          iteration_week_id: string
          leaves?: number | null
          notes?: string | null
          team_member_id: string
          updated_at?: string
        }
        Update: {
          availability_percent?: number | null
          calculated_days_present?: number | null
          calculated_days_total?: number | null
          created_at?: string
          effective_capacity?: number | null
          id?: string
          iteration_week_id?: string
          leaves?: number | null
          notes?: string | null
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_weekly_availability_iteration_week_id_fkey"
            columns: ["iteration_week_id"]
            isOneToOne: false
            referencedRelation: "iteration_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_weekly_availability_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          due_date: string
          id: string
          name: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          due_date: string
          id?: string
          name: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          due_date?: string
          id?: string
          name?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      module_access_audit: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"] | null
          access_type: string
          granted_by: string | null
          id: string
          metadata: Json | null
          module: Database["public"]["Enums"]["module_name"]
          project_id: string
          timestamp: string | null
          user_id: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"] | null
          access_type: string
          granted_by?: string | null
          id?: string
          metadata?: Json | null
          module: Database["public"]["Enums"]["module_name"]
          project_id: string
          timestamp?: string | null
          user_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"] | null
          access_type?: string
          granted_by?: string | null
          id?: string
          metadata?: Json | null
          module?: Database["public"]["Enums"]["module_name"]
          project_id?: string
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      module_permissions: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          created_at: string
          granted_by: string
          id: string
          module: Database["public"]["Enums"]["module_name"]
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string
          granted_by: string
          id?: string
          module: Database["public"]["Enums"]["module_name"]
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string
          granted_by?: string
          id?: string
          module?: Database["public"]["Enums"]["module_name"]
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budgets: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          department_id: string | null
          end_date: string | null
          id: string
          project_id: string
          start_date: string | null
          total_budget_allocated: number
          total_budget_received: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          department_id?: string | null
          end_date?: string | null
          id?: string
          project_id: string
          start_date?: string | null
          total_budget_allocated?: number
          total_budget_received?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          department_id?: string | null
          end_date?: string | null
          id?: string
          project_id?: string
          start_date?: string | null
          total_budget_allocated?: number
          total_budget_received?: number
          updated_at?: string
        }
        Relationships: []
      }
      project_discussions: {
        Row: {
          attendees: Json | null
          created_at: string
          created_by: string
          id: string
          meeting_date: string
          meeting_title: string
          project_id: string
          summary_notes: string | null
          updated_at: string
        }
        Insert: {
          attendees?: Json | null
          created_at?: string
          created_by: string
          id?: string
          meeting_date: string
          meeting_title: string
          project_id: string
          summary_notes?: string | null
          updated_at?: string
        }
        Update: {
          attendees?: Json | null
          created_at?: string
          created_by?: string
          id?: string
          meeting_date?: string
          meeting_title?: string
          project_id?: string
          summary_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          department_id: string | null
          id: string
          joined_at: string | null
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          department_id?: string | null
          id?: string
          joined_at?: string | null
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          department_id?: string | null
          id?: string
          joined_at?: string | null
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          priority: string | null
          start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          priority?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          priority?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      retrospective_action_items: {
        Row: {
          backlog_ref_id: string | null
          backlog_status: string | null
          backlog_task_id: string | null
          converted_to_task: boolean | null
          created_at: string
          created_by: string
          from_card_id: string | null
          how_approach: string | null
          id: string
          retrospective_id: string
          task_id: string | null
          updated_at: string
          what_task: string
          when_sprint: string | null
          who_responsible: string | null
        }
        Insert: {
          backlog_ref_id?: string | null
          backlog_status?: string | null
          backlog_task_id?: string | null
          converted_to_task?: boolean | null
          created_at?: string
          created_by: string
          from_card_id?: string | null
          how_approach?: string | null
          id?: string
          retrospective_id: string
          task_id?: string | null
          updated_at?: string
          what_task: string
          when_sprint?: string | null
          who_responsible?: string | null
        }
        Update: {
          backlog_ref_id?: string | null
          backlog_status?: string | null
          backlog_task_id?: string | null
          converted_to_task?: boolean | null
          created_at?: string
          created_by?: string
          from_card_id?: string | null
          how_approach?: string | null
          id?: string
          retrospective_id?: string
          task_id?: string | null
          updated_at?: string
          what_task?: string
          when_sprint?: string | null
          who_responsible?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_retrospective_action_items_retrospective_id"
            columns: ["retrospective_id"]
            isOneToOne: false
            referencedRelation: "retrospective_analytics"
            referencedColumns: ["retrospective_id"]
          },
          {
            foreignKeyName: "fk_retrospective_action_items_retrospective_id"
            columns: ["retrospective_id"]
            isOneToOne: false
            referencedRelation: "retrospectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrospective_action_items_backlog_task_id_fkey"
            columns: ["backlog_task_id"]
            isOneToOne: false
            referencedRelation: "task_backlog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrospective_action_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_backlog"
            referencedColumns: ["id"]
          },
        ]
      }
      retrospective_card_votes: {
        Row: {
          card_id: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retrospective_card_votes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "retrospective_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      retrospective_cards: {
        Row: {
          card_order: number
          column_id: string
          created_at: string
          created_by: string
          id: string
          text: string
          updated_at: string
          votes: number
        }
        Insert: {
          card_order?: number
          column_id: string
          created_at?: string
          created_by: string
          id?: string
          text: string
          updated_at?: string
          votes?: number
        }
        Update: {
          card_order?: number
          column_id?: string
          created_at?: string
          created_by?: string
          id?: string
          text?: string
          updated_at?: string
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_retrospective_cards_column_id"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "retrospective_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      retrospective_columns: {
        Row: {
          column_order: number
          created_at: string
          id: string
          retrospective_id: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          column_order?: number
          created_at?: string
          id?: string
          retrospective_id: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          column_order?: number
          created_at?: string
          id?: string
          retrospective_id?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_retrospective_columns_retrospective_id"
            columns: ["retrospective_id"]
            isOneToOne: false
            referencedRelation: "retrospective_analytics"
            referencedColumns: ["retrospective_id"]
          },
          {
            foreignKeyName: "fk_retrospective_columns_retrospective_id"
            columns: ["retrospective_id"]
            isOneToOne: false
            referencedRelation: "retrospectives"
            referencedColumns: ["id"]
          },
        ]
      }
      retrospectives: {
        Row: {
          created_at: string
          created_by: string
          department_id: string | null
          framework: string
          id: string
          iteration_id: string | null
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id?: string | null
          framework?: string
          id?: string
          iteration_id?: string | null
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string | null
          framework?: string
          id?: string
          iteration_id?: string | null
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      risk_register: {
        Row: {
          category: string | null
          cause: string | null
          consequence: string | null
          contingency_plan: string | null
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          id: string
          identified_date: string | null
          impact: number | null
          last_updated: string | null
          likelihood: number | null
          mitigation_plan: string[] | null
          next_review_date: string | null
          notes: string | null
          owner: string | null
          project_id: string
          residual_impact: number | null
          residual_likelihood: number | null
          residual_risk_score: number | null
          response_strategy: string | null
          risk_code: string
          risk_score: number | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          cause?: string | null
          consequence?: string | null
          contingency_plan?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          id?: string
          identified_date?: string | null
          impact?: number | null
          last_updated?: string | null
          likelihood?: number | null
          mitigation_plan?: string[] | null
          next_review_date?: string | null
          notes?: string | null
          owner?: string | null
          project_id: string
          residual_impact?: number | null
          residual_likelihood?: number | null
          residual_risk_score?: number | null
          response_strategy?: string | null
          risk_code: string
          risk_score?: number | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          cause?: string | null
          consequence?: string | null
          contingency_plan?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          id?: string
          identified_date?: string | null
          impact?: number | null
          last_updated?: string | null
          likelihood?: number | null
          mitigation_plan?: string[] | null
          next_review_date?: string | null
          notes?: string | null
          owner?: string | null
          project_id?: string
          residual_impact?: number | null
          residual_likelihood?: number | null
          residual_risk_score?: number | null
          response_strategy?: string | null
          risk_code?: string
          risk_score?: number | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      stakeholders: {
        Row: {
          created_at: string
          created_by: string
          department: string | null
          email: string | null
          id: string
          influence_level: string | null
          name: string
          notes: string | null
          project_id: string
          raci: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department?: string | null
          email?: string | null
          id?: string
          influence_level?: string | null
          name: string
          notes?: string | null
          project_id: string
          raci?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department?: string | null
          email?: string | null
          id?: string
          influence_level?: string | null
          name?: string
          notes?: string | null
          project_id?: string
          raci?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_backlog: {
        Row: {
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          id: string
          owner_id: string | null
          priority: string | null
          project_id: string
          source_id: string | null
          source_type: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          priority?: string | null
          project_id: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          priority?: string | null
          project_id?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          created_at: string
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          task_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          task_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          task_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          due_date: string | null
          id: string
          milestone_id: string | null
          owner_id: string | null
          priority: string | null
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_id?: string | null
          owner_id?: string | null
          priority?: string | null
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_id?: string | null
          owner_id?: string | null
          priority?: string | null
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_capacity_iterations: {
        Row: {
          committed_story_points: number
          created_at: string
          created_by: string
          department_id: string | null
          end_date: string
          id: string
          iteration_name: string
          project_id: string
          start_date: string
          team_id: string | null
          updated_at: string
          working_days: number
        }
        Insert: {
          committed_story_points?: number
          created_at?: string
          created_by: string
          department_id?: string | null
          end_date: string
          id?: string
          iteration_name: string
          project_id: string
          start_date: string
          team_id?: string | null
          updated_at?: string
          working_days: number
        }
        Update: {
          committed_story_points?: number
          created_at?: string
          created_by?: string
          department_id?: string | null
          end_date?: string
          id?: string
          iteration_name?: string
          project_id?: string
          start_date?: string
          team_id?: string | null
          updated_at?: string
          working_days?: number
        }
        Relationships: []
      }
      team_capacity_members: {
        Row: {
          availability_percent: number
          created_at: string
          created_by: string
          department_id: string | null
          effective_capacity_days: number
          id: string
          iteration_id: string
          leaves: number
          member_name: string
          role: string
          stakeholder_id: string | null
          team_id: string | null
          team_member_id: string | null
          updated_at: string
          work_mode: string
        }
        Insert: {
          availability_percent?: number
          created_at?: string
          created_by: string
          department_id?: string | null
          effective_capacity_days?: number
          id?: string
          iteration_id: string
          leaves?: number
          member_name: string
          role: string
          stakeholder_id?: string | null
          team_id?: string | null
          team_member_id?: string | null
          updated_at?: string
          work_mode: string
        }
        Update: {
          availability_percent?: number
          created_at?: string
          created_by?: string
          department_id?: string | null
          effective_capacity_days?: number
          id?: string
          iteration_id?: string
          leaves?: number
          member_name?: string
          role?: string
          stakeholder_id?: string | null
          team_id?: string | null
          team_member_id?: string | null
          updated_at?: string
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_capacity_members_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      team_capacity_settings: {
        Row: {
          created_at: string
          created_by: string
          hybrid_weight: number
          id: string
          iteration_basis: string
          office_weight: number
          project_id: string
          updated_at: string
          wfh_weight: number
          work_week: number
        }
        Insert: {
          created_at?: string
          created_by: string
          hybrid_weight?: number
          id?: string
          iteration_basis?: string
          office_weight?: number
          project_id: string
          updated_at?: string
          wfh_weight?: number
          work_week?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          hybrid_weight?: number
          id?: string
          iteration_basis?: string
          office_weight?: number
          project_id?: string
          updated_at?: string
          wfh_weight?: number
          work_week?: number
        }
        Relationships: []
      }
      team_definitions: {
        Row: {
          created_at: string
          created_by: string
          default_availability_percent: number
          default_leaves: number
          id: string
          stakeholder_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_availability_percent?: number
          default_leaves?: number
          id?: string
          stakeholder_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_availability_percent?: number
          default_leaves?: number
          id?: string
          stakeholder_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          role: string | null
          team_id: string
          updated_at: string
          work_mode: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          role?: string | null
          team_id: string
          updated_at?: string
          work_mode?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          role?: string | null
          team_id?: string
          updated_at?: string
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_availability: {
        Row: {
          availability_percent: number
          calculated_days_present: number
          calculated_days_total: number
          created_at: string
          created_by: string
          id: string
          iteration_week_id: string
          notes: string | null
          team_member_id: string
          updated_at: string
        }
        Insert: {
          availability_percent?: number
          calculated_days_present?: number
          calculated_days_total?: number
          created_at?: string
          created_by: string
          id?: string
          iteration_week_id: string
          notes?: string | null
          team_member_id: string
          updated_at?: string
        }
        Update: {
          availability_percent?: number
          calculated_days_present?: number
          calculated_days_total?: number
          created_at?: string
          created_by?: string
          id?: string
          iteration_week_id?: string
          notes?: string | null
          team_member_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      weekly_member_availability: {
        Row: {
          availability_percent: number
          created_at: string
          effective_capacity: number | null
          id: string
          iteration_week_id: string
          leaves: number
          notes: string | null
          team_member_id: string
          updated_at: string
        }
        Insert: {
          availability_percent?: number
          created_at?: string
          effective_capacity?: number | null
          id?: string
          iteration_week_id: string
          leaves?: number
          notes?: string | null
          team_member_id: string
          updated_at?: string
        }
        Update: {
          availability_percent?: number
          created_at?: string
          effective_capacity?: number | null
          id?: string
          iteration_week_id?: string
          leaves?: number
          notes?: string | null
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_member_availability_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_capacity_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      retrospective_analytics: {
        Row: {
          converted_to_tasks: number | null
          created_at: string | null
          created_by: string | null
          framework: string | null
          project_id: string | null
          retrospective_id: string | null
          status: string | null
          total_action_items: number | null
          total_card_votes: number | null
          total_cards: number | null
          total_votes: number | null
          unique_voters: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_effective_capacity: {
        Args: {
          availability_percent: number
          hybrid_weight?: number
          leaves: number
          office_weight?: number
          wfh_weight?: number
          work_mode: string
          working_days: number
        }
        Returns: number
      }
      find_user_by_email: {
        Args: { _email: string }
        Returns: string
      }
      get_user_department: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_email_by_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_emails_by_ids: {
        Args: { _user_ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      has_module_permission: {
        Args: {
          _module: Database["public"]["Enums"]["module_name"]
          _project_id: string
          _required_access: Database["public"]["Enums"]["access_level"]
          _user_id: string
        }
        Returns: boolean
      }
      has_module_permission_with_admin: {
        Args: {
          _module: Database["public"]["Enums"]["module_name"]
          _project_id: string
          _required_access: Database["public"]["Enums"]["access_level"]
          _user_id: string
        }
        Returns: boolean
      }
      has_project_module_permission: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      log_module_access: {
        Args: {
          _access_level?: Database["public"]["Enums"]["access_level"]
          _access_type: string
          _granted_by?: string
          _module: Database["public"]["Enums"]["module_name"]
          _project_id: string
          _user_id: string
        }
        Returns: undefined
      }
      set_current_user_id: {
        Args: { _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      access_level: "read" | "write"
      app_role: "admin" | "project_coordinator"
      module_name:
        | "overview"
        | "tasks_milestones"
        | "roadmap"
        | "kanban"
        | "stakeholders"
        | "risk_register"
        | "discussions"
        | "task_backlog"
        | "team_capacity"
        | "retrospectives"
        | "budget"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_level: ["read", "write"],
      app_role: ["admin", "project_coordinator"],
      module_name: [
        "overview",
        "tasks_milestones",
        "roadmap",
        "kanban",
        "stakeholders",
        "risk_register",
        "discussions",
        "task_backlog",
        "team_capacity",
        "retrospectives",
        "budget",
      ],
    },
  },
} as const
