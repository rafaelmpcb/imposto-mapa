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
      case_diagnostic_docs: {
        Row: {
          case_id: string
          created_at: string
          doc_key: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          doc_key: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          doc_key?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_diagnostic_docs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_documents: {
        Row: {
          case_id: string
          content_type: string | null
          created_at: string
          file_name: string
          id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          case_id: string
          content_type?: string | null
          created_at?: string
          file_name: string
          id?: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string
          content_type?: string | null
          created_at?: string
          file_name?: string
          id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_stage_events: {
        Row: {
          case_id: string
          changed_at: string
          from_stage: Database["public"]["Enums"]["case_stage"] | null
          id: string
          to_stage: Database["public"]["Enums"]["case_stage"]
        }
        Insert: {
          case_id: string
          changed_at?: string
          from_stage?: Database["public"]["Enums"]["case_stage"] | null
          id?: string
          to_stage: Database["public"]["Enums"]["case_stage"]
        }
        Update: {
          case_id?: string
          changed_at?: string
          from_stage?: Database["public"]["Enums"]["case_stage"] | null
          id?: string
          to_stage?: Database["public"]["Enums"]["case_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "case_stage_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          carteira_column_mapping: Json | null
          carteira_uploaded_at: string | null
          client_name: string | null
          cnpj: string | null
          created_at: string
          id: string
          owner_id: string | null
          owner_name: string | null
          stage: Database["public"]["Enums"]["case_stage"]
          updated_at: string
        }
        Insert: {
          carteira_column_mapping?: Json | null
          carteira_uploaded_at?: string | null
          client_name?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          owner_id?: string | null
          owner_name?: string | null
          stage?: Database["public"]["Enums"]["case_stage"]
          updated_at?: string
        }
        Update: {
          carteira_column_mapping?: Json | null
          carteira_uploaded_at?: string | null
          client_name?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          owner_id?: string | null
          owner_name?: string | null
          stage?: Database["public"]["Enums"]["case_stage"]
          updated_at?: string
        }
        Relationships: []
      }
      composicao_carteira: {
        Row: {
          case_id: string
          cnpj: string
          created_at: string
          data_classificacao: string | null
          fonte_classificacao: string
          id: string
          nome: string
          percentual_carteira: number
          regime: Database["public"]["Enums"]["carteira_regime"]
          status_consulta: Database["public"]["Enums"]["carteira_status"]
          tipo: Database["public"]["Enums"]["carteira_tipo"]
          updated_at: string
          valor_movimentado: number
        }
        Insert: {
          case_id: string
          cnpj: string
          created_at?: string
          data_classificacao?: string | null
          fonte_classificacao?: string
          id?: string
          nome?: string
          percentual_carteira?: number
          regime?: Database["public"]["Enums"]["carteira_regime"]
          status_consulta?: Database["public"]["Enums"]["carteira_status"]
          tipo: Database["public"]["Enums"]["carteira_tipo"]
          updated_at?: string
          valor_movimentado?: number
        }
        Update: {
          case_id?: string
          cnpj?: string
          created_at?: string
          data_classificacao?: string | null
          fonte_classificacao?: string
          id?: string
          nome?: string
          percentual_carteira?: number
          regime?: Database["public"]["Enums"]["carteira_regime"]
          status_consulta?: Database["public"]["Enums"]["carteira_status"]
          tipo?: Database["public"]["Enums"]["carteira_tipo"]
          updated_at?: string
          valor_movimentado?: number
        }
        Relationships: [
          {
            foreignKeyName: "composicao_carteira_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_fiscal_compra_xml: {
        Row: {
          aplicado_composicao_carteira: boolean
          arquivo_original: string
          case_id: string
          chave_acesso: string | null
          cnpj_emitente: string | null
          created_at: string
          data_emissao: string | null
          id: string
          numero_nota: string | null
          razao_social_emitente: string | null
          regime_emitente: string | null
          serie: string | null
          status_processamento: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          aplicado_composicao_carteira?: boolean
          arquivo_original?: string
          case_id: string
          chave_acesso?: string | null
          cnpj_emitente?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          numero_nota?: string | null
          razao_social_emitente?: string | null
          regime_emitente?: string | null
          serie?: string | null
          status_processamento?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          aplicado_composicao_carteira?: boolean
          arquivo_original?: string
          case_id?: string
          chave_acesso?: string | null
          cnpj_emitente?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          numero_nota?: string | null
          razao_social_emitente?: string | null
          regime_emitente?: string | null
          serie?: string | null
          status_processamento?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_compra_xml_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_fiscal_venda_xml: {
        Row: {
          aplicado_composicao_carteira: boolean
          arquivo_original: string
          case_id: string
          chave_acesso: string | null
          cnpj_destinatario: string | null
          created_at: string
          data_emissao: string | null
          id: string
          numero_nota: string | null
          razao_social_destinatario: string | null
          serie: string | null
          status_processamento: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          aplicado_composicao_carteira?: boolean
          arquivo_original?: string
          case_id: string
          chave_acesso?: string | null
          cnpj_destinatario?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          numero_nota?: string | null
          razao_social_destinatario?: string | null
          serie?: string | null
          status_processamento?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          aplicado_composicao_carteira?: boolean
          arquivo_original?: string
          case_id?: string
          chave_acesso?: string | null
          cnpj_destinatario?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          numero_nota?: string | null
          razao_social_destinatario?: string | null
          serie?: string | null
          status_processamento?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_venda_xml_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      office_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      pgdasd_extraido: {
        Row: {
          anexos: Json
          aplicado_ao_calculo: boolean
          arquivo_original: string
          case_id: string
          cnpj_extraido: string | null
          competencia: string | null
          created_at: string
          detalhamento_tributos: Json
          folha_12_meses: number | null
          id: string
          razao_social_extraida: string | null
          rbt12: number | null
          receita_bruta_pa: number | null
          status_extracao: string
          updated_at: string
          valor_total_das: number | null
        }
        Insert: {
          anexos?: Json
          aplicado_ao_calculo?: boolean
          arquivo_original?: string
          case_id: string
          cnpj_extraido?: string | null
          competencia?: string | null
          created_at?: string
          detalhamento_tributos?: Json
          folha_12_meses?: number | null
          id?: string
          razao_social_extraida?: string | null
          rbt12?: number | null
          receita_bruta_pa?: number | null
          status_extracao?: string
          updated_at?: string
          valor_total_das?: number | null
        }
        Update: {
          anexos?: Json
          aplicado_ao_calculo?: boolean
          arquivo_original?: string
          case_id?: string
          cnpj_extraido?: string | null
          competencia?: string | null
          created_at?: string
          detalhamento_tributos?: Json
          folha_12_meses?: number | null
          id?: string
          razao_social_extraida?: string | null
          rbt12?: number | null
          receita_bruta_pa?: number | null
          status_extracao?: string
          updated_at?: string
          valor_total_das?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pgdasd_extraido_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          activity_id: string
          base_amount: number
          case_id: string | null
          client_name: string | null
          cnpj: string | null
          cnpj_data: Json | null
          created_at: string
          created_by: string | null
          current_rate: number
          current_total: number
          id: string
          input: Json
          reform_rate: number
          reform_total: number
          share_enabled: boolean
          share_token: string | null
          taxpayer_type: string
          uf: string
          year_id: number
        }
        Insert: {
          activity_id: string
          base_amount?: number
          case_id?: string | null
          client_name?: string | null
          cnpj?: string | null
          cnpj_data?: Json | null
          created_at?: string
          created_by?: string | null
          current_rate?: number
          current_total?: number
          id?: string
          input: Json
          reform_rate?: number
          reform_total?: number
          share_enabled?: boolean
          share_token?: string | null
          taxpayer_type: string
          uf: string
          year_id: number
        }
        Update: {
          activity_id?: string
          base_amount?: number
          case_id?: string | null
          client_name?: string | null
          cnpj?: string | null
          cnpj_data?: Json | null
          created_at?: string
          created_by?: string | null
          current_rate?: number
          current_total?: number
          id?: string
          input?: Json
          reform_rate?: number
          reform_total?: number
          share_enabled?: boolean
          share_token?: string | null
          taxpayer_type?: string
          uf?: string
          year_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_config: {
        Row: {
          key: string
          updated_at: string
          value: number
        }
        Insert: {
          key: string
          updated_at?: string
          value: number
        }
        Update: {
          key?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      tax_parameters: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          note: string | null
          param_key: string
          source: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          note?: string | null
          param_key: string
          source?: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          note?: string | null
          param_key?: string
          source?: string
          value?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      carteira_regime: "simples" | "regular" | "pendente" | "erro"
      carteira_status: "ok" | "nao_encontrado" | "erro" | "pendente"
      carteira_tipo: "cliente" | "fornecedor"
      case_stage:
        | "lead"
        | "diagnostico_basico"
        | "memorando_assinado"
        | "aguardando_documentos"
        | "diagnostico_full"
        | "em_revisao"
        | "reuniao_agendada"
        | "elaboracao_proposta"
        | "proposta_enviada"
        | "contrato_assinado"
        | "relatorio_entregue"
        | "acompanhamento_implantacao"
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
      carteira_regime: ["simples", "regular", "pendente", "erro"],
      carteira_status: ["ok", "nao_encontrado", "erro", "pendente"],
      carteira_tipo: ["cliente", "fornecedor"],
      case_stage: [
        "lead",
        "diagnostico_basico",
        "memorando_assinado",
        "aguardando_documentos",
        "diagnostico_full",
        "em_revisao",
        "reuniao_agendada",
        "elaboracao_proposta",
        "proposta_enviada",
        "contrato_assinado",
        "relatorio_entregue",
        "acompanhamento_implantacao",
      ],
    },
  },
} as const
