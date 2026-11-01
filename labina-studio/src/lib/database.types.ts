
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
            "admins": {
                  Row: {
                    "created_at": string,"display_name": string | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"role"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"blocked_dates": {
                  Row: {
                    "created_at": string,"day": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"reason"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"booking_events": {
                  Row: {
                    "actor_id": string | null,"actor_label": string,"booking_id": string,"created_at": string,"event": string,"from_status": string | null,"id": number,"note": string | null,"to_status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"actor_label"?: string,"booking_id": string,"created_at"?: string,"event": string,"from_status"?: string | null,"id"?: never,"note"?: string | null,"to_status"?: string | null
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_label"?: string,"booking_id"?: string,"created_at"?: string,"event"?: string,"from_status"?: string | null,"id"?: never,"note"?: string | null,"to_status"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_events_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "admin_notes": string | null,"booking_date": string,"cancelled_reason": string | null,"children_count": number,"created_at": string,"customer_email": string | null,"customer_id": string,"customer_name": string,"customer_phone": string,"end_time": string,"id": string,"manage_token": string,"notes": string | null,"price_snapshot": number | null,"reference": string,"service_id": string | null,"service_name": string,"source": string,"start_time": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_notes"?: string | null,"booking_date": string,"cancelled_reason"?: string | null,"children_count": number,"created_at"?: string,"customer_email"?: string | null,"customer_id": string,"customer_name": string,"customer_phone": string,"end_time": string,"id"?: string,"manage_token"?: string,"notes"?: string | null,"price_snapshot"?: number | null,"reference": string,"service_id"?: string | null,"service_name": string,"source"?: string,"start_time": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "admin_notes"?: string | null,"booking_date"?: string,"cancelled_reason"?: string | null,"children_count"?: number,"created_at"?: string,"customer_email"?: string | null,"customer_id"?: string,"customer_name"?: string,"customer_phone"?: string,"end_time"?: string,"id"?: string,"manage_token"?: string,"notes"?: string | null,"price_snapshot"?: number | null,"reference"?: string,"service_id"?: string | null,"service_name"?: string,"source"?: string,"start_time"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_messages": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"is_read": boolean,"message": string,"phone": string | null,"subject": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"is_read"?: boolean,"message": string,"phone"?: string | null,"subject"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"is_read"?: boolean,"message"?: string,"phone"?: string | null,"subject"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"customers": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"notes": string | null,"phone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"notes"?: string | null,"phone": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"notes"?: string | null,"phone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"faqs": {
                  Row: {
                    "answer": string,"created_at": string,"id": string,"is_published": boolean,"question": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": string,"created_at"?: string,"id"?: string,"is_published"?: boolean,"question": string,"sort_order"?: number
                  }
                  Update: {
                    "answer"?: string,"created_at"?: string,"id"?: string,"is_published"?: boolean,"question"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"gallery_items": {
                  Row: {
                    "alt": string | null,"category": string,"created_at": string,"height": number | null,"id": string,"image_url": string,"is_featured": boolean,"is_published": boolean,"shape": string,"sort_order": number,"storage_path": string | null,"title": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string | null,"category": string,"created_at"?: string,"height"?: number | null,"id"?: string,"image_url": string,"is_featured"?: boolean,"is_published"?: boolean,"shape"?: string,"sort_order"?: number,"storage_path"?: string | null,"title"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "alt"?: string | null,"category"?: string,"created_at"?: string,"height"?: number | null,"id"?: string,"image_url"?: string,"is_featured"?: boolean,"is_published"?: boolean,"shape"?: string,"sort_order"?: number,"storage_path"?: string | null,"title"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"services": {
                  Row: {
                    "color": string,"created_at": string,"description": string | null,"duration_minutes": number,"features": (string)[],"icon": string,"id": string,"image_url": string | null,"is_active": boolean,"is_bookable": boolean,"name": string,"price": number | null,"price_note": string | null,"slug": string,"sort_order": number,"tagline": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"features"?: (string)[],"icon"?: string,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"is_bookable"?: boolean,"name": string,"price"?: number | null,"price_note"?: string | null,"slug": string,"sort_order"?: number,"tagline"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"features"?: (string)[],"icon"?: string,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"is_bookable"?: boolean,"name"?: string,"price"?: number | null,"price_note"?: string | null,"slug"?: string,"sort_order"?: number,"tagline"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"site_settings": {
                  Row: {
                    "is_public": boolean,"key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "is_public"?: boolean,"key": string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Update: {
                    "is_public"?: boolean,"key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"testimonials": {
                  Row: {
                    "author_label": string | null,"author_name": string,"content": string,"created_at": string,"id": string,"is_published": boolean,"rating": number,"service_id": string | null,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "author_label"?: string | null,"author_name": string,"content": string,"created_at"?: string,"id"?: string,"is_published"?: boolean,"rating"?: number,"service_id"?: string | null,"sort_order"?: number
                  }
                  Update: {
                    "author_label"?: string | null,"author_name"?: string,"content"?: string,"created_at"?: string,"id"?: string,"is_published"?: boolean,"rating"?: number,"service_id"?: string | null,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "testimonials_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"working_hours": {
                  Row: {
                    "close_time": string,"is_open": boolean,"open_time": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "close_time"?: string,"is_open"?: boolean,"open_time"?: string,"weekday": number
                  }
                  Update: {
                    "close_time"?: string,"is_open"?: boolean,"open_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_dashboard_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_reschedule_booking":
{ Args: { "p_booking_id": string,"p_date": string,"p_note": string,"p_start": string }; Returns: Json
                           },
"admin_set_booking_status":
{ Args: { "p_booking_id": string,"p_note": string,"p_status": string }; Returns: Json
                           },
"cancel_booking_by_token":
{ Args: { "p_reason": string,"p_token": string }; Returns: Json
                           },
"create_booking":
{ Args: { "p_children": number,"p_date": string,"p_email": string,"p_name": string,"p_notes": string,"p_phone": string,"p_service_id": string,"p_start": string }; Returns: Json
                           },
"get_available_slots":
{ Args: { "p_date": string,"p_service_id": string }; Returns: Json
                           },
"get_booking_by_token":
{ Args: { "p_token": string }; Returns: Json
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"submit_contact_message":
{ Args: { "p_email": string,"p_message": string,"p_name": string,"p_phone": string,"p_subject": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
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
            
          }
        }
} as const
