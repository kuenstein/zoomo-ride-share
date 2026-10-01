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
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      community_pins: {
        Row: {
          category: string
          created_at: string
          created_by: string
          id: string
          is_hidden: boolean
          lat: number
          lng: number
          name: string
          reviewed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          is_hidden?: boolean
          lat: number
          lng: number
          name: string
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          is_hidden?: boolean
          lat?: number
          lng?: number
          name?: string
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_documents: {
        Row: {
          created_at: string
          doc_type: string
          id: string
          reviewed_at: string | null
          reviewer_notes: string | null
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          id?: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          id?: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_feedback: {
        Row: {
          comment: string | null
          created_at: string
          driver_id: string
          id: string
          ride_id: string
          rider_id: string
          sentiment: string
          status: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          driver_id: string
          id?: string
          ride_id: string
          rider_id: string
          sentiment: string
          status?: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          ride_id?: string
          rider_id?: string
          sentiment?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_feedback_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: true
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
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
          license_expiry: string | null
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
          license_expiry?: string | null
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
          license_expiry?: string | null
          license_number?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          total_trips?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      geo_cache: {
        Row: {
          created_at: string
          key: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          value?: Json
        }
        Relationships: []
      }
      geo_rate: {
        Row: {
          bucket: string
          hits: number
          user_id: string
        }
        Insert: {
          bucket: string
          hits?: number
          user_id: string
        }
        Update: {
          bucket?: string
          hits?: number
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          pushed_at: string | null
          read: boolean
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          pushed_at?: string | null
          read?: boolean
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          pushed_at?: string | null
          read?: boolean
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_checkouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          paid_at: string | null
          provider_session_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          paid_at?: string | null
          provider_session_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          paid_at?: string | null
          provider_session_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          resolved_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pin_reports: {
        Row: {
          created_at: string
          id: string
          pin_id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin_id: string
          reason: string
          reporter_id?: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          pin_id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_reports_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "community_pins"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_settings: {
        Row: {
          airport_fare_bike: number
          airport_fare_tricycle: number
          airport_flat_fare: number
          airport_lat: number
          airport_lng: number
          airport_radius_km: number
          baggage_fee: number
          base_fare: number
          base_fare_bike: number
          base_fare_tricycle: number
          commission_percent: number
          currency: string
          extra_passenger_fee: number
          id: number
          max_driver_debt: number
          minimum_fare: number
          minimum_fare_bike: number
          minimum_fare_tricycle: number
          multiplier_bike: number
          multiplier_comfort: number
          multiplier_economy: number
          multiplier_tricycle: number
          multiplier_xl: number
          per_km: number
          per_km_bike: number
          per_km_tricycle: number
          per_minute: number
          tricycle_surcharge: number
          updated_at: string
        }
        Insert: {
          airport_fare_bike?: number
          airport_fare_tricycle?: number
          airport_flat_fare?: number
          airport_lat?: number
          airport_lng?: number
          airport_radius_km?: number
          baggage_fee?: number
          base_fare?: number
          base_fare_bike?: number
          base_fare_tricycle?: number
          commission_percent?: number
          currency?: string
          extra_passenger_fee?: number
          id?: number
          max_driver_debt?: number
          minimum_fare?: number
          minimum_fare_bike?: number
          minimum_fare_tricycle?: number
          multiplier_bike?: number
          multiplier_comfort?: number
          multiplier_economy?: number
          multiplier_tricycle?: number
          multiplier_xl?: number
          per_km?: number
          per_km_bike?: number
          per_km_tricycle?: number
          per_minute?: number
          tricycle_surcharge?: number
          updated_at?: string
        }
        Update: {
          airport_fare_bike?: number
          airport_fare_tricycle?: number
          airport_flat_fare?: number
          airport_lat?: number
          airport_lng?: number
          airport_radius_km?: number
          baggage_fee?: number
          base_fare?: number
          base_fare_bike?: number
          base_fare_tricycle?: number
          commission_percent?: number
          currency?: string
          extra_passenger_fee?: number
          id?: number
          max_driver_debt?: number
          minimum_fare?: number
          minimum_fare_bike?: number
          minimum_fare_tricycle?: number
          multiplier_bike?: number
          multiplier_comfort?: number
          multiplier_economy?: number
          multiplier_tricycle?: number
          multiplier_xl?: number
          per_km?: number
          per_km_bike?: number
          per_km_tricycle?: number
          per_minute?: number
          tricycle_surcharge?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          consent_at: string | null
          consent_version: string | null
          created_at: string
          deleted_at: string | null
          full_name: string
          id: string
          phone: string | null
          rating: number
          rating_count: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          consent_at?: string | null
          consent_version?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string
          id: string
          phone?: string | null
          rating?: number
          rating_count?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          consent_at?: string | null
          consent_version?: string | null
          created_at?: string
          deleted_at?: string | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
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
      reports: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          details: string
          id: string
          reporter_id: string
          ride_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          category: string
          created_at?: string
          details: string
          id?: string
          reporter_id: string
          ride_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          details?: string
          id?: string
          reporter_id?: string
          ride_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_ride_id_fkey"
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
          cancelled_by: string | null
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
          extra_baggage: boolean
          extras_fee: number
          fare_estimate: number
          fare_offer: number | null
          final_fare: number | null
          id: string
          passengers: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          promo_code: string | null
          requested_at: string
          rider_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          target_driver_id: string | null
          target_expires_at: string | null
          target_status: string | null
          tip: number
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          accepted_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          extra_baggage?: boolean
          extras_fee?: number
          fare_estimate?: number
          fare_offer?: number | null
          final_fare?: number | null
          id?: string
          passengers?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          promo_code?: string | null
          requested_at?: string
          rider_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          target_driver_id?: string | null
          target_expires_at?: string | null
          target_status?: string | null
          tip?: number
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          accepted_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          extra_baggage?: boolean
          extras_fee?: number
          fare_estimate?: number
          fare_offer?: number | null
          final_fare?: number | null
          id?: string
          passengers?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          promo_code?: string | null
          requested_at?: string
          rider_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          target_driver_id?: string | null
          target_expires_at?: string | null
          target_status?: string | null
          tip?: number
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      safety_incidents: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          reporter_id: string
          reporter_role: string
          resolved_at: string | null
          ride_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          reporter_id: string
          reporter_role: string
          resolved_at?: string | null
          ride_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          reporter_id?: string
          reporter_role?: string
          resolved_at?: string | null
          ride_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_incidents_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
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
      trusted_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          user_id?: string
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
      accept_terms: { Args: { _version: string }; Returns: Json }
      add_tip: { Args: { _amount: number; _ride_id: string }; Returns: Json }
      admin_resolve_payout: {
        Args: { _id: string; _notes?: string; _status: string }
        Returns: Json
      }
      admin_stats: { Args: never; Returns: Json }
      admin_wallet_adjust: {
        Args: { _amount: number; _note?: string; _user_id: string }
        Returns: Json
      }
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
      credit_paid_checkout: { Args: { _session_id: string }; Returns: Json }
      decline_direct_ride: { Args: { _ride_id: string }; Returns: Json }
      driver_available_for: {
        Args: {
          _driver: string
          _type: Database["public"]["Enums"]["vehicle_type"]
        }
        Returns: boolean
      }
      driver_debt_blocked: { Args: { _user_id: string }; Returns: boolean }
      driver_docs_complete: {
        Args: { _approved_only: boolean; _user_id: string }
        Returns: boolean
      }
      driver_license_expired: { Args: { _user_id: string }; Returns: boolean }
      driver_set_ride_status: {
        Args: {
          _reason?: string
          _ride_id: string
          _status: Database["public"]["Enums"]["ride_status"]
        }
        Returns: Json
      }
      driver_vehicle_type: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["vehicle_type"]
      }
      drivers_for_pickup: {
        Args: {
          _lat: number
          _lng: number
          _type: Database["public"]["Enums"]["vehicle_type"]
        }
        Returns: {
          approx_lat: number
          approx_lng: number
          avatar_url: string
          distance_km: number
          driver_id: string
          full_name: string
          rating: number
          rating_count: number
          vehicle: string
        }[]
      }
      expire_stale_rides: { Args: never; Returns: number }
      geo_hit: { Args: { _limit: number; _user: string }; Returns: boolean }
      has_active_ride_with: {
        Args: { _driver: string; _rider: string }
        Returns: boolean
      }
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
      launch_db_status: { Args: never; Returns: Json }
      nearby_drivers: {
        Args: { _lat: number; _lng: number; _radius_km?: number }
        Returns: {
          distance_km: number
          driver_id: string
          lat: number
          lng: number
        }[]
      }
      nearby_ride_requests: {
        Args: never
        Returns: {
          area: string
          direct_to_me: boolean
          distance_km: number
          requested_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }[]
      }
      raise_sos: {
        Args: { _lat?: number; _lng?: number; _ride_id: string }
        Returns: Json
      }
      request_payout: {
        Args: { _amount: number; _method: string }
        Returns: Json
      }
      ride_broadcast: { Args: { _ride_id: string }; Returns: Json }
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
      ride_retarget: {
        Args: { _driver_id: string; _ride_id: string }
        Returns: Json
      }
      rider_cancel_blocked: { Args: { _ride_id: string }; Returns: boolean }
      rider_cancel_ride: {
        Args: { _reason?: string; _ride_id: string }
        Returns: Json
      }
      shares_ride: { Args: { _a: string; _b: string }; Returns: boolean }
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
