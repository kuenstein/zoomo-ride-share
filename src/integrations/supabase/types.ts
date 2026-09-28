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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      driver_locations: {
        Row: {
          driver_id: string
          heading: number | null
          is_online: boolean
          lat: number
          lng: number
          updated_at: string
        }
        Insert: {
          driver_id: string
          heading?: number | null
          is_online?: boolean
          lat: number
          lng: number
          updated_at?: string
        }
        Update: {
          driver_id?: string
          heading?: number | null
          is_online?: boolean
          lat?: number
          lng?: number
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string
          id: string
          is_online: boolean
          license_number: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["driver_status"]
          total_trips: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_online?: boolean
          license_number: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          total_trips?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_online?: boolean
          license_number?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          total_trips?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          airport_flat_fare: number
          airport_lat: number
          airport_lng: number
          airport_radius_km: number
          base_fare: number
          commission_percent: number
          currency: string
          id: number
          minimum_fare: number
          multiplier_bike: number
          multiplier_comfort: number
          multiplier_economy: number
          multiplier_tricycle: number
          multiplier_xl: number
          per_km: number
          per_minute: number
          updated_at: string
        }
        Insert: {
          airport_flat_fare?: number
          airport_lat?: number
          airport_lng?: number
          airport_radius_km?: number
          base_fare?: number
          commission_percent?: number
          currency?: string
          id?: number
          minimum_fare?: number
          multiplier_bike?: number
          multiplier_comfort?: number
          multiplier_economy?: number
          multiplier_tricycle?: number
          multiplier_xl?: number
          per_km?: number
          per_minute?: number
          updated_at?: string
        }
        Update: {
          airport_flat_fare?: number
          airport_lat?: number
          airport_lng?: number
          airport_radius_km?: number
          base_fare?: number
          commission_percent?: number
          currency?: string
          id?: number
          minimum_fare?: number
          multiplier_bike?: number
          multiplier_comfort?: number
          multiplier_economy?: number
          multiplier_tricycle?: number
          multiplier_xl?: number
          per_km?: number
          per_minute?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          rating: number
          rating_count: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          rating?: number
          rating_count?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          rating?: number
          rating_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_discount: number | null
          times_used: number
          usage_limit: number | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          max_discount?: number | null
          times_used?: number
          usage_limit?: number | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_discount?: number | null
          times_used?: number
          usage_limit?: number | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          ratee_id: string
          rater_id: string
          ride_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id: string
          rater_id: string
          ride_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id?: string
          rater_id?: string
          ride_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          ride_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          ride_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          ride_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          accepted_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          commission: number
          completed_at: string | null
          created_at: string
          discount: number
          distance_km: number
          driver_earnings: number
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          duration_min: number
          fare_estimate: number
          final_fare: number | null
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          promo_code: string | null
          requested_at: string
          rider_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          tip: number
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          accepted_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          commission?: number
          completed_at?: string | null
          created_at?: string
          discount?: number
          distance_km?: number
          driver_earnings?: number
          driver_id?: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          duration_min?: number
          fare_estimate?: number
          final_fare?: number | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          promo_code?: string | null
          requested_at?: string
          rider_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          tip?: number
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          accepted_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          commission?: number
          completed_at?: string | null
          created_at?: string
          discount?: number
          distance_km?: number
          driver_earnings?: number
          driver_id?: string | null
          dropoff_address?: string
          dropoff_lat?: number
          dropoff_lng?: number
          duration_min?: number
          fare_estimate?: number
          final_fare?: number | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          promo_code?: string | null
          requested_at?: string
          rider_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          tip?: number
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      saved_places: {
        Row: {
          address: string
          created_at: string
          id: string
          label: string
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          label: string
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          label?: string
          lat?: number
          lng?: number
          user_id?: string
        }
        Relationships: []
      }
      service_areas: {
        Row: {
          active: boolean
          center_lat: number
          center_lng: number
          created_at: string
          id: string
          name: string
          radius_km: number
        }
        Insert: {
          active?: boolean
          center_lat: number
          center_lng: number
          created_at?: string
          id?: string
          name: string
          radius_km?: number
        }
        Update: {
          active?: boolean
          center_lat?: number
          center_lng?: number
          created_at?: string
          id?: string
          name?: string
          radius_km?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          color: string
          created_at: string
          driver_id: string
          id: string
          make: string
          model: string
          or_cr_number: string | null
          plate: string
          type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          color: string
          created_at?: string
          driver_id: string
          id?: string
          make: string
          model: string
          or_cr_number?: string | null
          plate: string
          type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          color?: string
          created_at?: string
          driver_id?: string
          id?: string
          make?: string
          model?: string
          or_cr_number?: string | null
          plate?: string
          type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          kind: string
          ride_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          ride_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          ride_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_ride: { Args: { _ride_id: string }; Returns: Json }
      admin_stats: { Args: never; Returns: Json }
      calculate_fare: {
        Args: {
          _km: number
          _min: number
          _type: Database["public"]["Enums"]["vehicle_type"]
        }
        Returns: number
      }
      complete_ride: {
        Args: { _ride_id: string; _tip?: number }
        Returns: Json
      }
      expire_stale_rides: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      in_service_area: {
        Args: { _lat: number; _lng: number }
        Returns: boolean
      }
      nearby_drivers: {
        Args: { _lat: number; _lng: number; _radius_km?: number }
        Returns: {
          distance_km: number
          driver_id: string
          lat: number
          lng: number
        }[]
      }
      ride_fare: {
        Args: {
          _dlat: number
          _dlng: number
          _km: number
          _min: number
          _plat: number
          _plng: number
          _type: Database["public"]["Enums"]["vehicle_type"]
        }
        Returns: number
      }
      validate_promo: {
        Args: { _amount: number; _code: string }
        Returns: Json
      }
      wallet_topup: { Args: { _amount: number }; Returns: Json }
    }
    Enums: {
      app_role: "rider" | "driver" | "admin"
      driver_status: "pending" | "approved" | "rejected" | "suspended"
      payment_method: "cash" | "card" | "wallet"
      ride_status:
        | "requested"
        | "accepted"
        | "arriving"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "expired"
      vehicle_type: "economy" | "comfort" | "xl" | "bike" | "tricycle"
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
    Enums: {
      app_role: ["rider", "driver", "admin"],
      driver_status: ["pending", "approved", "rejected", "suspended"],
      payment_method: ["cash", "card", "wallet"],
      ride_status: [
        "requested",
        "accepted",
        "arriving",
        "in_progress",
        "completed",
        "cancelled",
        "expired",
      ],
      vehicle_type: ["economy", "comfort", "xl", "bike", "tricycle"],
    },
  },
} as const
