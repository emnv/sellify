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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      buyback_prices: {
        Row: {
          base_price_cents: number
          created_at: string
          id: string
          model_id: number
          shop_id: string
          storage_gb: number
          updated_at: string
        }
        Insert: {
          base_price_cents: number
          created_at?: string
          id?: string
          model_id: number
          shop_id: string
          storage_gb: number
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          created_at?: string
          id?: string
          model_id?: number
          shop_id?: string
          storage_gb?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyback_prices_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "device_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyback_prices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      buyback_settings: {
        Row: {
          battery_bad_pct: number
          no_power_pct: number
          screen_cracked_pct: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          battery_bad_pct?: number
          no_power_pct?: number
          screen_cracked_pct?: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          battery_bad_pct?: number
          no_power_pct?: number
          screen_cracked_pct?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyback_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      buybacks: {
        Row: {
          answers: Json
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          device_label: string
          handover: string
          id: string
          model_id: number | null
          notes: string | null
          offer_cents: number
          shop_id: string
          source: string
          status: string
          storage_gb: number | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          device_label: string
          handover?: string
          id?: string
          model_id?: number | null
          notes?: string | null
          offer_cents: number
          shop_id: string
          source: string
          status?: string
          storage_gb?: number | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          device_label?: string
          handover?: string
          id?: string
          model_id?: number | null
          notes?: string | null
          offer_cents?: number
          shop_id?: string
          source?: string
          status?: string
          storage_gb?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buybacks_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "device_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buybacks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      device_brands: {
        Row: {
          id: number
          name: string
          sort_order: number
        }
        Insert: {
          id?: never
          name: string
          sort_order?: number
        }
        Update: {
          id?: never
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      device_models: {
        Row: {
          brand_id: number
          id: number
          name: string
          release_year: number | null
          sort_order: number
          storage_options: number[]
        }
        Insert: {
          brand_id: number
          id?: never
          name: string
          release_year?: number | null
          sort_order?: number
          storage_options?: number[]
        }
        Update: {
          brand_id?: number
          id?: never
          name?: string
          release_year?: number | null
          sort_order?: number
          storage_options?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "device_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "device_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          condition: string | null
          created_at: string
          description: string | null
          id: string
          images: string[]
          is_part: boolean
          model_id: number | null
          name: string
          price_cents: number
          repair_type_id: number | null
          shop_id: string
          sku: string | null
          stock_qty: number
          updated_at: string
          visible_online: boolean
        }
        Insert: {
          category?: string
          condition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          is_part?: boolean
          model_id?: number | null
          name: string
          price_cents: number
          repair_type_id?: number | null
          shop_id: string
          sku?: string | null
          stock_qty?: number
          updated_at?: string
          visible_online?: boolean
        }
        Update: {
          category?: string
          condition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          is_part?: boolean
          model_id?: number | null
          name?: string
          price_cents?: number
          repair_type_id?: number | null
          shop_id?: string
          sku?: string | null
          stock_qty?: number
          updated_at?: string
          visible_online?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "device_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_repair_type_id_fkey"
            columns: ["repair_type_id"]
            isOneToOne: false
            referencedRelation: "repair_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_prices: {
        Row: {
          created_at: string
          duration_min: number
          id: string
          model_id: number
          price_cents: number
          repair_type_id: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_min?: number
          id?: string
          model_id: number
          price_cents: number
          repair_type_id: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_min?: number
          id?: string
          model_id?: number
          price_cents?: number
          repair_type_id?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_prices_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "device_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_prices_repair_type_id_fkey"
            columns: ["repair_type_id"]
            isOneToOne: false
            referencedRelation: "repair_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_prices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_tickets: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          device_label: string
          id: string
          model_id: number | null
          notes: string | null
          quoted_price_cents: number
          repair_label: string
          repair_type_id: number | null
          scheduled_at: string | null
          shop_id: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          device_label: string
          id?: string
          model_id?: number | null
          notes?: string | null
          quoted_price_cents: number
          repair_label: string
          repair_type_id?: number | null
          scheduled_at?: string | null
          shop_id: string
          source: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          device_label?: string
          id?: string
          model_id?: number | null
          notes?: string | null
          quoted_price_cents?: number
          repair_label?: string
          repair_type_id?: number | null
          scheduled_at?: string | null
          shop_id?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_tickets_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "device_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_tickets_repair_type_id_fkey"
            columns: ["repair_type_id"]
            isOneToOne: false
            referencedRelation: "repair_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_tickets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_types: {
        Row: {
          id: number
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: never
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: never
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          name: string
          product_id: string | null
          qty: number
          sale_id: string
          unit_price_cents: number
        }
        Insert: {
          id?: string
          name: string
          product_id?: string | null
          qty: number
          sale_id: string
          unit_price_cents: number
        }
        Update: {
          id?: string
          name?: string
          product_id?: string | null
          qty?: number
          sale_id?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          channel: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          note: string | null
          paid_at: string | null
          payment_method: string | null
          shop_id: string
          status: string
          stripe_session_id: string | null
          total_cents: number
        }
        Insert: {
          channel: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          note?: string | null
          paid_at?: string | null
          payment_method?: string | null
          shop_id: string
          status?: string
          stripe_session_id?: string | null
          total_cents?: number
        }
        Update: {
          channel?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          note?: string | null
          paid_at?: string | null
          payment_method?: string | null
          shop_id?: string
          status?: string
          stripe_session_id?: string | null
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_members: {
        Row: {
          created_at: string
          role: string
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          name: string
          notification_email: string | null
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          name: string
          notification_email?: string | null
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          name?: string
          notification_email?: string | null
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_ai_requests: {
        Row: {
          created_at: string
          id: number
          input_tokens: number | null
          output_tokens: number | null
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          input_tokens?: number | null
          output_tokens?: number | null
          store_id: string
        }
        Update: {
          created_at?: string
          id?: never
          input_tokens?: number | null
          output_tokens?: number | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_design_history: {
        Row: {
          created_at: string
          id: number
          prompt: string | null
          store_id: string
          template: string
          theme: Json
        }
        Insert: {
          created_at?: string
          id?: never
          prompt?: string | null
          store_id: string
          template: string
          theme: Json
        }
        Update: {
          created_at?: string
          id?: never
          prompt?: string | null
          store_id?: string
          template?: string
          theme?: Json
        }
        Relationships: [
          {
            foreignKeyName: "store_design_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_domains: {
        Row: {
          checked_at: string | null
          created_at: string
          domain: string
          id: string
          last_error: string | null
          status: string
          store_id: string
          verification: Json | null
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          domain: string
          id?: string
          last_error?: string | null
          status?: string
          store_id: string
          verification?: Json | null
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          domain?: string
          id?: string
          last_error?: string | null
          status?: string
          store_id?: string
          verification?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "store_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string
          draft_config: Json
          id: string
          is_published: boolean
          published_at: string | null
          published_config: Json | null
          shop_id: string
          slug: string
          template: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_config?: Json
          id?: string
          is_published?: boolean
          published_at?: string | null
          published_config?: Json | null
          shop_id: string
          slug: string
          template?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_config?: Json
          id?: string
          is_published?: boolean
          published_at?: string | null
          published_config?: Json | null
          shop_id?: string
          slug?: string
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_shop: {
        Args: { p_email?: string; p_name: string }
        Returns: string
      }
      finalize_online_sale: { Args: { p_sale_id: string }; Returns: boolean }
      public_booked_slots: {
        Args: { p_from: string; p_key: string; p_to: string }
        Returns: string[]
      }
      public_buyback_options: { Args: { p_key: string }; Returns: Json }
      public_products: {
        Args: { p_key: string; p_product_id?: string }
        Returns: {
          category: string
          condition: string
          description: string
          id: string
          images: string[]
          name: string
          price_cents: number
          stock_qty: number
        }[]
      }
      public_repair_options: {
        Args: { p_key: string }
        Returns: {
          brand: string
          brand_id: number
          duration_min: number
          model: string
          model_id: number
          part_in_stock: boolean
          price_cents: number
          repair: string
          repair_type_id: number
        }[]
      }
      public_store: { Args: { p_key: string }; Returns: Json }
      record_pos_sale: {
        Args: {
          p_customer_name?: string
          p_items: Json
          p_note?: string
          p_payment_method?: string
          p_shop_id: string
        }
        Returns: string
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
