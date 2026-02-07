export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RumorState = 'NEUTRAL' | 'PROBATION' | 'EMERGENT_TRUTH' | 'FINALIZED';
export type EmergentTruthType = 'CONFIRMED' | 'DENIED' | 'UNDETERMINED';
export type VoteType = 'CONFIRM' | 'DENY';

export interface Database {
  public: {
    Tables: {
      approved_emails: {
        Row: {
          id: string;
          email_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email_hash?: string;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          token_id: string;
          signature: string;
          trust_score: number;
          total_votes: number;
          correct_votes: number;
          incorrect_votes: number;
          rumors_posted: number;
          created_at: string;
          last_active_at: string;
        };
        Insert: {
          id?: string;
          token_id: string;
          signature: string;
          trust_score?: number;
          total_votes?: number;
          correct_votes?: number;
          incorrect_votes?: number;
          rumors_posted?: number;
          created_at?: string;
          last_active_at?: string;
        };
        Update: {
          id?: string;
          token_id?: string;
          signature?: string;
          trust_score?: number;
          total_votes?: number;
          correct_votes?: number;
          incorrect_votes?: number;
          rumors_posted?: number;
          created_at?: string;
          last_active_at?: string;
        };
      };
      server_keys: {
        Row: {
          id: string;
          private_key: string;
          public_key: string;
          n: string;
          e: string;
          created_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          private_key: string;
          public_key: string;
          n: string;
          e: string;
          created_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          private_key?: string;
          public_key?: string;
          n?: string;
          e?: string;
          created_at?: string;
          is_active?: boolean;
        };
      };
      rumors: {
        Row: {
          id: string;
          content: string;
          author_token_id: string;
          category: string;
          state: RumorState;
          trust_score: number;
          frozen_trust_score: number | null;
          confirm_votes: number;
          deny_votes: number;
          weighted_confirm_votes: number;
          weighted_deny_votes: number;
          emergent_truth: EmergentTruthType | null;
          created_at: string;
          state_changed_at: string;
          finalized_at: string | null;
          archived: boolean;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          content: string;
          author_token_id: string;
          category?: string;
          state?: RumorState;
          trust_score?: number;
          frozen_trust_score?: number | null;
          confirm_votes?: number;
          deny_votes?: number;
          weighted_confirm_votes?: number;
          weighted_deny_votes?: number;
          emergent_truth?: EmergentTruthType | null;
          created_at?: string;
          state_changed_at?: string;
          finalized_at?: string | null;
          archived?: boolean;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          content?: string;
          author_token_id?: string;
          category?: string;
          state?: RumorState;
          trust_score?: number;
          frozen_trust_score?: number | null;
          confirm_votes?: number;
          deny_votes?: number;
          weighted_confirm_votes?: number;
          weighted_deny_votes?: number;
          emergent_truth?: EmergentTruthType | null;
          created_at?: string;
          state_changed_at?: string;
          finalized_at?: string | null;
          archived?: boolean;
          archived_at?: string | null;
        };
      };
      vote_timestamps: {
        Row: {
          id: string;
          rumor_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          rumor_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          rumor_id?: string;
          created_at?: string;
        };
      };
      votes: {
        Row: {
          id: string;
          rumor_id: string;
          voter_token_id: string;
          vote_type: VoteType;
          feedback: string;
          base_weight: number;
          semantic_weight: number;
          collusion_weight: number;
          final_weight: number;
          audited: boolean;
          aligned_with_truth: boolean | null;
          created_at: string;
          audited_at: string | null;
        };
        Insert: {
          id?: string;
          rumor_id: string;
          voter_token_id: string;
          vote_type: VoteType;
          feedback: string;
          base_weight?: number;
          semantic_weight?: number;
          collusion_weight?: number;
          final_weight?: number;
          audited?: boolean;
          aligned_with_truth?: boolean | null;
          created_at?: string;
          audited_at?: string | null;
        };
        Update: {
          id?: string;
          rumor_id?: string;
          voter_token_id?: string;
          vote_type?: VoteType;
          feedback?: string;
          base_weight?: number;
          semantic_weight?: number;
          collusion_weight?: number;
          final_weight?: number;
          audited?: boolean;
          aligned_with_truth?: boolean | null;
          created_at?: string;
          audited_at?: string | null;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          audit_type: string;
          details: Json;
          rumors_processed: number;
          users_rewarded: number;
          users_penalized: number;
          duration_ms: number;
          success: boolean;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          audit_type: string;
          details?: Json;
          rumors_processed?: number;
          users_rewarded?: number;
          users_penalized?: number;
          duration_ms?: number;
          success?: boolean;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          audit_type?: string;
          details?: Json;
          rumors_processed?: number;
          users_rewarded?: number;
          users_penalized?: number;
          duration_ms?: number;
          success?: boolean;
          error?: string | null;
          created_at?: string;
        };
      };
    };
    Functions: {
      get_vote_velocity: {
        Args: { p_rumor_id: string; p_window_minutes?: number };
        Returns: number;
      };
      update_rumor_trust_score: {
        Args: { p_rumor_id: string };
        Returns: number;
      };
      record_vote: {
        Args: {
          p_rumor_id: string;
          p_voter_token_id: string;
          p_vote_type: VoteType;
          p_feedback: string;
          p_voter_trust_score: number;
        };
        Returns: string;
      };
    };
  };
}

// Helper types
export type Rumor = Database['public']['Tables']['rumors']['Row'];
export type Vote = Database['public']['Tables']['votes']['Row'];
export type User = Database['public']['Tables']['users']['Row'];
