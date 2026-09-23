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
      case_contacts: {
        Row: {
          case_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_contacts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
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
      case_documento_duplicado: {
        Row: {
          arquivo_original: string
          case_id: string
          chave_acesso: string | null
          created_at: string
          id: string
          motivo: string
          tipo_documento: string
        }
        Insert: {
          arquivo_original: string
          case_id: string
          chave_acesso?: string | null
          created_at?: string
          id?: string
          motivo?: string
          tipo_documento: string
        }
        Update: {
          arquivo_original?: string
          case_id?: string
          chave_acesso?: string | null
          created_at?: string
          id?: string
          motivo?: string
          tipo_documento?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_documento_duplicado_case_id_fkey"
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
      case_interactions: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string | null
          case_id: string
          created_at: string
          happened_at: string
          id: string
          kind: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body?: string | null
          case_id: string
          created_at?: string
          happened_at?: string
          id?: string
          kind?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string | null
          case_id?: string
          created_at?: string
          happened_at?: string
          id?: string
          kind?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_interactions_case_id_fkey"
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
          commercial_status: string
          created_at: string
          deal_value: number
          escopo: string
          fee_model: string
          id: string
          lost_reason: string | null
          next_action_date: string | null
          next_action_title: string | null
          objetivo: string | null
          owner_id: string | null
          owner_name: string | null
          stage: Database["public"]["Enums"]["case_stage"]
          updated_at: string
          win_probability: number
        }
        Insert: {
          carteira_column_mapping?: Json | null
          carteira_uploaded_at?: string | null
          client_name?: string | null
          cnpj?: string | null
          commercial_status?: string
          created_at?: string
          deal_value?: number
          escopo?: string
          fee_model?: string
          id?: string
          lost_reason?: string | null
          next_action_date?: string | null
          next_action_title?: string | null
          objetivo?: string | null
          owner_id?: string | null
          owner_name?: string | null
          stage?: Database["public"]["Enums"]["case_stage"]
          updated_at?: string
          win_probability?: number
        }
        Update: {
          carteira_column_mapping?: Json | null
          carteira_uploaded_at?: string | null
          client_name?: string | null
          cnpj?: string | null
          commercial_status?: string
          created_at?: string
          deal_value?: number
          escopo?: string
          fee_model?: string
          id?: string
          lost_reason?: string | null
          next_action_date?: string | null
          next_action_title?: string | null
          objetivo?: string | null
          owner_id?: string | null
          owner_name?: string | null
          stage?: Database["public"]["Enums"]["case_stage"]
          updated_at?: string
          win_probability?: number
        }
        Relationships: []
      }
      caso_monofasico_item: {
        Row: {
          arquivo_original: string
          case_id: string
          cfop: string | null
          chave_acesso: string | null
          classificacao: string
          competencia: string | null
          created_at: string
          cst_cofins: string | null
          cst_pis: string | null
          data_emissao: string | null
          descricao: string | null
          grupo: string | null
          id: string
          indebito_estimado: number
          modelo: string | null
          ncm: string | null
          numero_nota: string | null
          regime: string
          valor_cofins: number
          valor_item: number
          valor_pis: number
        }
        Insert: {
          arquivo_original: string
          case_id: string
          cfop?: string | null
          chave_acesso?: string | null
          classificacao: string
          competencia?: string | null
          created_at?: string
          cst_cofins?: string | null
          cst_pis?: string | null
          data_emissao?: string | null
          descricao?: string | null
          grupo?: string | null
          id?: string
          indebito_estimado?: number
          modelo?: string | null
          ncm?: string | null
          numero_nota?: string | null
          regime: string
          valor_cofins?: number
          valor_item?: number
          valor_pis?: number
        }
        Update: {
          arquivo_original?: string
          case_id?: string
          cfop?: string | null
          chave_acesso?: string | null
          classificacao?: string
          competencia?: string | null
          created_at?: string
          cst_cofins?: string | null
          cst_pis?: string | null
          data_emissao?: string | null
          descricao?: string | null
          grupo?: string | null
          id?: string
          indebito_estimado?: number
          modelo?: string | null
          ncm?: string | null
          numero_nota?: string | null
          regime?: string
          valor_cofins?: number
          valor_item?: number
          valor_pis?: number
        }
        Relationships: [
          {
            foreignKeyName: "caso_monofasico_item_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      composicao_carteira: {
        Row: {
          case_id: string
          cnpj: string
          created_at: string
          data_classificacao: string | null
          fonte_classificacao: string
          id: string
          motivo_erro: string | null
          nome: string
          percentual_carteira: number
          regime: Database["public"]["Enums"]["carteira_regime"]
          status_consulta: Database["public"]["Enums"]["carteira_status"]
          tentativas_consulta: number
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
          motivo_erro?: string | null
          nome?: string
          percentual_carteira?: number
          regime?: Database["public"]["Enums"]["carteira_regime"]
          status_consulta?: Database["public"]["Enums"]["carteira_status"]
          tentativas_consulta?: number
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
          motivo_erro?: string | null
          nome?: string
          percentual_carteira?: number
          regime?: Database["public"]["Enums"]["carteira_regime"]
          status_consulta?: Database["public"]["Enums"]["carteira_status"]
          tentativas_consulta?: number
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
      contrato_aluguel: {
        Row: {
          aliquota_plena_pct: number
          aluguel_mensal: number
          ano_referencia: number
          aproveitamento_credito_pct: number
          case_id: string | null
          contraparte: string | null
          created_at: string
          created_by: string | null
          criterio: string
          id: string
          mantida_pct: number
          observacao: string | null
          papel: string
          redutor_pct: number
          regime_locador: string
          resultado_json: Json
          substituida_pct: number
          titulo: string
          updated_at: string
        }
        Insert: {
          aliquota_plena_pct?: number
          aluguel_mensal?: number
          ano_referencia?: number
          aproveitamento_credito_pct?: number
          case_id?: string | null
          contraparte?: string | null
          created_at?: string
          created_by?: string | null
          criterio?: string
          id?: string
          mantida_pct?: number
          observacao?: string | null
          papel?: string
          redutor_pct?: number
          regime_locador: string
          resultado_json?: Json
          substituida_pct?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          aliquota_plena_pct?: number
          aluguel_mensal?: number
          ano_referencia?: number
          aproveitamento_credito_pct?: number
          case_id?: string | null
          contraparte?: string | null
          created_at?: string
          created_by?: string | null
          criterio?: string
          id?: string
          mantida_pct?: number
          observacao?: string | null
          papel?: string
          redutor_pct?: number
          regime_locador?: string
          resultado_json?: Json
          substituida_pct?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_aluguel_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_reequilibrio: {
        Row: {
          aliquota_plena_pct: number
          ano_referencia: number
          case_id: string | null
          cenario: string
          contraparte: string | null
          created_at: string
          created_by: string | null
          credito_insumos_pct: number
          custo_direto_pct: number
          id: string
          observacao: string | null
          papel: string
          perfil_contratante: string
          preco_mensal_atual: number
          reducao_pct: number
          regime_prestador: string
          resultado_json: Json
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          aliquota_plena_pct?: number
          ano_referencia?: number
          case_id?: string | null
          cenario?: string
          contraparte?: string | null
          created_at?: string
          created_by?: string | null
          credito_insumos_pct?: number
          custo_direto_pct?: number
          id?: string
          observacao?: string | null
          papel?: string
          perfil_contratante: string
          preco_mensal_atual?: number
          reducao_pct?: number
          regime_prestador: string
          resultado_json?: Json
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          aliquota_plena_pct?: number
          ano_referencia?: number
          case_id?: string | null
          cenario?: string
          contraparte?: string | null
          created_at?: string
          created_by?: string | null
          credito_insumos_pct?: number
          custo_direto_pct?: number
          id?: string
          observacao?: string | null
          papel?: string
          perfil_contratante?: string
          preco_mensal_atual?: number
          reducao_pct?: number
          regime_prestador?: string
          resultado_json?: Json
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_reequilibrio_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_transicao_ibscbs: {
        Row: {
          ano: number
          case_id: string | null
          created_at: string
          fracao_aliquota_plena: number
          id: string
          updated_at: string
        }
        Insert: {
          ano: number
          case_id?: string | null
          created_at?: string
          fracao_aliquota_plena: number
          id?: string
          updated_at?: string
        }
        Update: {
          ano?: number
          case_id?: string | null
          created_at?: string
          fracao_aliquota_plena?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_transicao_ibscbs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      despesa_operacional_anual: {
        Row: {
          ano: number
          case_id: string
          created_at: string
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          ano: number
          case_id: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ano?: number
          case_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesa_operacional_anual_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_projecao_anual: {
        Row: {
          ano: number
          calculado_em: string
          case_id: string
          cenario: string
          custo: number
          deducoes: number
          despesas_operacionais: number
          id: string
          ircs: number | null
          ircs_origem: string | null
          lucro_bruto: number
          receita_bruta: number
          receita_liquida: number
          resultado_antes_ircs: number
          resultado_liquido: number | null
        }
        Insert: {
          ano: number
          calculado_em?: string
          case_id: string
          cenario: string
          custo?: number
          deducoes?: number
          despesas_operacionais?: number
          id?: string
          ircs?: number | null
          ircs_origem?: string | null
          lucro_bruto?: number
          receita_bruta?: number
          receita_liquida?: number
          resultado_antes_ircs?: number
          resultado_liquido?: number | null
        }
        Update: {
          ano?: number
          calculado_em?: string
          case_id?: string
          cenario?: string
          custo?: number
          deducoes?: number
          despesas_operacionais?: number
          id?: string
          ircs?: number | null
          ircs_origem?: string | null
          lucro_bruto?: number
          receita_bruta?: number
          receita_liquida?: number
          resultado_antes_ircs?: number
          resultado_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dre_projecao_anual_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      estudo_capex: {
        Row: {
          aliquota_plena_pct: number
          ano_aquisicao: number
          case_id: string | null
          created_at: string
          created_by: string | null
          custo_oportunidade_aa_pct: number
          fator_ciap_pct: number
          icms_pct: number
          id: string
          ipi_pct: number
          observacao: string | null
          regime: string
          resultado_json: Json
          tipo_ativo: string
          titulo: string
          updated_at: string
          valor_investimento: number
        }
        Insert: {
          aliquota_plena_pct?: number
          ano_aquisicao: number
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          custo_oportunidade_aa_pct?: number
          fator_ciap_pct?: number
          icms_pct?: number
          id?: string
          ipi_pct?: number
          observacao?: string | null
          regime: string
          resultado_json?: Json
          tipo_ativo: string
          titulo: string
          updated_at?: string
          valor_investimento?: number
        }
        Update: {
          aliquota_plena_pct?: number
          ano_aquisicao?: number
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          custo_oportunidade_aa_pct?: number
          fator_ciap_pct?: number
          icms_pct?: number
          id?: string
          ipi_pct?: number
          observacao?: string | null
          regime?: string
          resultado_json?: Json
          tipo_ativo?: string
          titulo?: string
          updated_at?: string
          valor_investimento?: number
        }
        Relationships: [
          {
            foreignKeyName: "estudo_capex_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      estudo_monofasico: {
        Row: {
          aliquota_efetiva_das_pct: number
          case_id: string | null
          created_at: string
          created_by: string | null
          faturamento_mensal: number
          honorario_exito_pct: number
          id: string
          meses_retroativos: number
          observacao: string | null
          parcela_pis_cofins_pct: number
          participacao_monofasica_pct: number
          regime: string
          resultado_json: Json | null
          segmento: string
          selic_aa_pct: number
          titulo: string
          updated_at: string
        }
        Insert: {
          aliquota_efetiva_das_pct?: number
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          faturamento_mensal?: number
          honorario_exito_pct?: number
          id?: string
          meses_retroativos?: number
          observacao?: string | null
          parcela_pis_cofins_pct?: number
          participacao_monofasica_pct?: number
          regime?: string
          resultado_json?: Json | null
          segmento?: string
          selic_aa_pct?: number
          titulo?: string
          updated_at?: string
        }
        Update: {
          aliquota_efetiva_das_pct?: number
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          faturamento_mensal?: number
          honorario_exito_pct?: number
          id?: string
          meses_retroativos?: number
          observacao?: string | null
          parcela_pis_cofins_pct?: number
          participacao_monofasica_pct?: number
          regime?: string
          resultado_json?: Json | null
          segmento?: string
          selic_aa_pct?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estudo_monofasico_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      estudo_saldos_credores: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          custo_oportunidade_aa_pct: number
          desagio_cessao_pct: number
          id: string
          ipca_aa_pct: number
          meses_compensacao_cbs: number
          observacao: string | null
          resultado_json: Json
          saldo_icms: number
          saldo_pis_cofins: number
          titulo: string
          uf: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          custo_oportunidade_aa_pct?: number
          desagio_cessao_pct?: number
          id?: string
          ipca_aa_pct?: number
          meses_compensacao_cbs?: number
          observacao?: string | null
          resultado_json?: Json
          saldo_icms?: number
          saldo_pis_cofins?: number
          titulo?: string
          uf?: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          custo_oportunidade_aa_pct?: number
          desagio_cessao_pct?: number
          id?: string
          ipca_aa_pct?: number
          meses_compensacao_cbs?: number
          observacao?: string | null
          resultado_json?: Json
          saldo_icms?: number
          saldo_pis_cofins?: number
          titulo?: string
          uf?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estudo_saldos_credores_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      fluxo_caixa_projecao_mensal: {
        Row: {
          ano: number
          calculado_em: string
          case_id: string
          credito_ibscbs_disponivel: number
          debito_ibscbs_retido: number
          debito_liquido_recolhido: number
          entradas_clientes: number
          id: string
          mes: number
          saidas_despesas: number
          saidas_fornecedores: number
          saldo_credor_acumulado: number
          variacao_caixa: number
        }
        Insert: {
          ano: number
          calculado_em?: string
          case_id: string
          credito_ibscbs_disponivel?: number
          debito_ibscbs_retido?: number
          debito_liquido_recolhido?: number
          entradas_clientes?: number
          id?: string
          mes: number
          saidas_despesas?: number
          saidas_fornecedores?: number
          saldo_credor_acumulado?: number
          variacao_caixa?: number
        }
        Update: {
          ano?: number
          calculado_em?: string
          case_id?: string
          credito_ibscbs_disponivel?: number
          debito_ibscbs_retido?: number
          debito_liquido_recolhido?: number
          entradas_clientes?: number
          id?: string
          mes?: number
          saidas_despesas?: number
          saidas_fornecedores?: number
          saldo_credor_acumulado?: number
          variacao_caixa?: number
        }
        Relationships: [
          {
            foreignKeyName: "fluxo_caixa_projecao_mensal_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      item_revisao_evento: {
        Row: {
          acao: string
          anexo: string | null
          case_id: string
          cclasstrib: string | null
          created_at: string
          decidido_por: string | null
          id: string
          item_id: string
          observacao: string | null
          origem: string
          reducao_pct: number | null
          status_anterior: string | null
          status_novo: string | null
          valor_anterior: number | null
          valor_novo: number | null
        }
        Insert: {
          acao: string
          anexo?: string | null
          case_id: string
          cclasstrib?: string | null
          created_at?: string
          decidido_por?: string | null
          id?: string
          item_id: string
          observacao?: string | null
          origem: string
          reducao_pct?: number | null
          status_anterior?: string | null
          status_novo?: string | null
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Update: {
          acao?: string
          anexo?: string | null
          case_id?: string
          cclasstrib?: string | null
          created_at?: string
          decidido_por?: string | null
          id?: string
          item_id?: string
          observacao?: string | null
          origem?: string
          reducao_pct?: number | null
          status_anterior?: string | null
          status_novo?: string | null
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_revisao_evento_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      nbs_excecao_ibscbs: {
        Row: {
          aliquota_cbs_2026: number
          aliquota_ibs_2026: number
          atualizado_em: string
          cclasstrib: string | null
          descricao_nbs: string
          flag_x_origem: boolean
          fonte: string
          grupo_cclasstrib: string | null
          id: string
          item_nbs: string
          n_cclasstrib_por_nbs: number
          nbs: string
          nome_cclasstrib: string
          observacao: string | null
          regime_especifico_sem_aliquota_simples: boolean
          requer_revisao_humana: boolean
        }
        Insert: {
          aliquota_cbs_2026?: number
          aliquota_ibs_2026?: number
          atualizado_em?: string
          cclasstrib?: string | null
          descricao_nbs?: string
          flag_x_origem?: boolean
          fonte?: string
          grupo_cclasstrib?: string | null
          id?: string
          item_nbs?: string
          n_cclasstrib_por_nbs?: number
          nbs: string
          nome_cclasstrib?: string
          observacao?: string | null
          regime_especifico_sem_aliquota_simples?: boolean
          requer_revisao_humana?: boolean
        }
        Update: {
          aliquota_cbs_2026?: number
          aliquota_ibs_2026?: number
          atualizado_em?: string
          cclasstrib?: string | null
          descricao_nbs?: string
          flag_x_origem?: boolean
          fonte?: string
          grupo_cclasstrib?: string | null
          id?: string
          item_nbs?: string
          n_cclasstrib_por_nbs?: number
          nbs?: string
          nome_cclasstrib?: string
          observacao?: string | null
          regime_especifico_sem_aliquota_simples?: boolean
          requer_revisao_humana?: boolean
        }
        Relationships: []
      }
      ncm_excecao_ibscbs: {
        Row: {
          anexo: string
          anexo_desc: string
          atualizado_em: string
          cclasstrib: string | null
          fonte: string
          id: string
          imposto_seletivo: boolean
          n_classificacoes_ncm: number
          ncm: string
          observacao: string | null
          reducao_pct: number
          requer_revisao_humana: boolean
        }
        Insert: {
          anexo?: string
          anexo_desc?: string
          atualizado_em?: string
          cclasstrib?: string | null
          fonte?: string
          id?: string
          imposto_seletivo?: boolean
          n_classificacoes_ncm?: number
          ncm: string
          observacao?: string | null
          reducao_pct?: number
          requer_revisao_humana?: boolean
        }
        Update: {
          anexo?: string
          anexo_desc?: string
          atualizado_em?: string
          cclasstrib?: string | null
          fonte?: string
          id?: string
          imposto_seletivo?: boolean
          n_classificacoes_ncm?: number
          ncm?: string
          observacao?: string | null
          reducao_pct?: number
          requer_revisao_humana?: boolean
        }
        Relationships: []
      }
      ncm_monofasico_pis_cofins: {
        Row: {
          atualizado_em: string
          base_legal: string
          cst_alternativos: string[]
          cst_esperado: string
          descricao: string
          fonte: string
          grupo: string
          id: string
          ncm_prefixo: string
          observacao: string | null
          vigencia_inicio: string
        }
        Insert: {
          atualizado_em?: string
          base_legal: string
          cst_alternativos?: string[]
          cst_esperado?: string
          descricao: string
          fonte?: string
          grupo: string
          id?: string
          ncm_prefixo: string
          observacao?: string | null
          vigencia_inicio?: string
        }
        Update: {
          atualizado_em?: string
          base_legal?: string
          cst_alternativos?: string[]
          cst_esperado?: string
          descricao?: string
          fonte?: string
          grupo?: string
          id?: string
          ncm_prefixo?: string
          observacao?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
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
      nota_fiscal_compra_xml_item: {
        Row: {
          case_id: string
          cclasstrib: string | null
          cfop: string | null
          created_at: string
          descricao: string | null
          fonte: string
          id: string
          ncm: string | null
          nota_fiscal_compra_xml_id: string
          opcoes_candidatas: Json
          quantidade: number
          status_classificacao: string
          tem_ibscbs: boolean
          updated_at: string
          valor_base_calculo: number
          valor_credito_ibs_cbs: number
          valor_item: number
        }
        Insert: {
          case_id: string
          cclasstrib?: string | null
          cfop?: string | null
          created_at?: string
          descricao?: string | null
          fonte?: string
          id?: string
          ncm?: string | null
          nota_fiscal_compra_xml_id: string
          opcoes_candidatas?: Json
          quantidade?: number
          status_classificacao?: string
          tem_ibscbs?: boolean
          updated_at?: string
          valor_base_calculo?: number
          valor_credito_ibs_cbs?: number
          valor_item?: number
        }
        Update: {
          case_id?: string
          cclasstrib?: string | null
          cfop?: string | null
          created_at?: string
          descricao?: string | null
          fonte?: string
          id?: string
          ncm?: string | null
          nota_fiscal_compra_xml_id?: string
          opcoes_candidatas?: Json
          quantidade?: number
          status_classificacao?: string
          tem_ibscbs?: boolean
          updated_at?: string
          valor_base_calculo?: number
          valor_credito_ibs_cbs?: number
          valor_item?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_compra_xml_item_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_fiscal_compra_xml_item_nota_fiscal_compra_xml_id_fkey"
            columns: ["nota_fiscal_compra_xml_id"]
            isOneToOne: false
            referencedRelation: "nota_fiscal_compra_xml"
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
      nota_fiscal_venda_xml_item: {
        Row: {
          case_id: string
          cclasstrib: string | null
          cfop: string | null
          created_at: string
          descricao: string | null
          fonte: string
          id: string
          ncm: string | null
          nota_fiscal_venda_xml_id: string
          opcoes_candidatas: Json
          quantidade: number
          status_classificacao: string
          tem_ibscbs: boolean
          updated_at: string
          valor_base_calculo: number
          valor_cofins: number
          valor_debito_ibs_cbs: number
          valor_icms: number
          valor_ipi: number
          valor_item: number
          valor_pis: number
        }
        Insert: {
          case_id: string
          cclasstrib?: string | null
          cfop?: string | null
          created_at?: string
          descricao?: string | null
          fonte?: string
          id?: string
          ncm?: string | null
          nota_fiscal_venda_xml_id: string
          opcoes_candidatas?: Json
          quantidade?: number
          status_classificacao?: string
          tem_ibscbs?: boolean
          updated_at?: string
          valor_base_calculo?: number
          valor_cofins?: number
          valor_debito_ibs_cbs?: number
          valor_icms?: number
          valor_ipi?: number
          valor_item?: number
          valor_pis?: number
        }
        Update: {
          case_id?: string
          cclasstrib?: string | null
          cfop?: string | null
          created_at?: string
          descricao?: string | null
          fonte?: string
          id?: string
          ncm?: string | null
          nota_fiscal_venda_xml_id?: string
          opcoes_candidatas?: Json
          quantidade?: number
          status_classificacao?: string
          tem_ibscbs?: boolean
          updated_at?: string
          valor_base_calculo?: number
          valor_cofins?: number
          valor_debito_ibs_cbs?: number
          valor_icms?: number
          valor_ipi?: number
          valor_item?: number
          valor_pis?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_venda_xml_item_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_fiscal_venda_xml_item_nota_fiscal_venda_xml_id_fkey"
            columns: ["nota_fiscal_venda_xml_id"]
            isOneToOne: false
            referencedRelation: "nota_fiscal_venda_xml"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_fiscal_venda_xml_item_preco: {
        Row: {
          aliquota_plena_aplicada: number
          calculado_em: string
          case_id: string
          id: string
          item_id: string
          preco_necessario: number
          regime_cliente_snapshot: string | null
          status_preco: string
          tributos_atuais_total: number
          valor_desonerado: number
          variacao_preco_pct: number
        }
        Insert: {
          aliquota_plena_aplicada?: number
          calculado_em?: string
          case_id: string
          id?: string
          item_id: string
          preco_necessario?: number
          regime_cliente_snapshot?: string | null
          status_preco?: string
          tributos_atuais_total?: number
          valor_desonerado?: number
          variacao_preco_pct?: number
        }
        Update: {
          aliquota_plena_aplicada?: number
          calculado_em?: string
          case_id?: string
          id?: string
          item_id?: string
          preco_necessario?: number
          regime_cliente_snapshot?: string | null
          status_preco?: string
          tributos_atuais_total?: number
          valor_desonerado?: number
          variacao_preco_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_venda_xml_item_preco_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_fiscal_venda_xml_item_preco_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "nota_fiscal_venda_xml_item"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_servico_nfse: {
        Row: {
          aplicado_composicao_carteira: boolean
          arquivo_original: string
          case_id: string
          chave_acesso: string | null
          cnpj_prestador: string | null
          cnpj_tomador: string | null
          codigo_servico: string | null
          created_at: string
          data_emissao: string | null
          direcao: string
          id: string
          numero_nota: string | null
          razao_social_prestador: string | null
          razao_social_tomador: string | null
          regime_prestador: string | null
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
          cnpj_prestador?: string | null
          cnpj_tomador?: string | null
          codigo_servico?: string | null
          created_at?: string
          data_emissao?: string | null
          direcao?: string
          id?: string
          numero_nota?: string | null
          razao_social_prestador?: string | null
          razao_social_tomador?: string | null
          regime_prestador?: string | null
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
          cnpj_prestador?: string | null
          cnpj_tomador?: string | null
          codigo_servico?: string | null
          created_at?: string
          data_emissao?: string | null
          direcao?: string
          id?: string
          numero_nota?: string | null
          razao_social_prestador?: string | null
          razao_social_tomador?: string | null
          regime_prestador?: string | null
          serie?: string | null
          status_processamento?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_servico_nfse_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_servico_nfse_item: {
        Row: {
          case_id: string
          cclasstrib: string | null
          created_at: string
          descricao: string | null
          fonte: string
          id: string
          item_lc116: string | null
          nbs: string | null
          nota_servico_id: string
          opcoes_candidatas: Json
          status_classificacao: string
          tem_classificacao_documento: boolean
          updated_at: string
          valor_base_calculo: number
          valor_credito_ibs_cbs: number
          valor_servico: number
        }
        Insert: {
          case_id: string
          cclasstrib?: string | null
          created_at?: string
          descricao?: string | null
          fonte?: string
          id?: string
          item_lc116?: string | null
          nbs?: string | null
          nota_servico_id: string
          opcoes_candidatas?: Json
          status_classificacao?: string
          tem_classificacao_documento?: boolean
          updated_at?: string
          valor_base_calculo?: number
          valor_credito_ibs_cbs?: number
          valor_servico?: number
        }
        Update: {
          case_id?: string
          cclasstrib?: string | null
          created_at?: string
          descricao?: string | null
          fonte?: string
          id?: string
          item_lc116?: string | null
          nbs?: string | null
          nota_servico_id?: string
          opcoes_candidatas?: Json
          status_classificacao?: string
          tem_classificacao_documento?: boolean
          updated_at?: string
          valor_base_calculo?: number
          valor_credito_ibs_cbs?: number
          valor_servico?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_servico_nfse_item_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_servico_nfse_item_nota_servico_id_fkey"
            columns: ["nota_servico_id"]
            isOneToOne: false
            referencedRelation: "nota_servico_nfse"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_servico_nfse_item_prestado: {
        Row: {
          case_id: string
          cclasstrib: string | null
          created_at: string
          descricao: string | null
          fonte: string
          id: string
          item_lc116: string | null
          nbs: string | null
          nota_servico_id: string
          opcoes_candidatas: Json
          status_classificacao: string
          tem_classificacao_documento: boolean
          updated_at: string
          valor_base_calculo: number
          valor_debito_ibs_cbs: number
          valor_iss: number
          valor_servico: number
        }
        Insert: {
          case_id: string
          cclasstrib?: string | null
          created_at?: string
          descricao?: string | null
          fonte?: string
          id?: string
          item_lc116?: string | null
          nbs?: string | null
          nota_servico_id: string
          opcoes_candidatas?: Json
          status_classificacao?: string
          tem_classificacao_documento?: boolean
          updated_at?: string
          valor_base_calculo?: number
          valor_debito_ibs_cbs?: number
          valor_iss?: number
          valor_servico?: number
        }
        Update: {
          case_id?: string
          cclasstrib?: string | null
          created_at?: string
          descricao?: string | null
          fonte?: string
          id?: string
          item_lc116?: string | null
          nbs?: string | null
          nota_servico_id?: string
          opcoes_candidatas?: Json
          status_classificacao?: string
          tem_classificacao_documento?: boolean
          updated_at?: string
          valor_base_calculo?: number
          valor_debito_ibs_cbs?: number
          valor_iss?: number
          valor_servico?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_servico_nfse_item_prestado_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_servico_nfse_item_prestado_nota_servico_id_fkey"
            columns: ["nota_servico_id"]
            isOneToOne: false
            referencedRelation: "nota_servico_nfse"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_servico_nfse_item_prestado_preco: {
        Row: {
          aliquota_plena_aplicada: number
          calculado_em: string
          case_id: string
          id: string
          item_id: string
          preco_necessario: number
          regime_cliente_snapshot: string | null
          status_preco: string
          tributos_atuais_total: number
          valor_desonerado: number
          variacao_preco_pct: number
        }
        Insert: {
          aliquota_plena_aplicada?: number
          calculado_em?: string
          case_id: string
          id?: string
          item_id: string
          preco_necessario?: number
          regime_cliente_snapshot?: string | null
          status_preco?: string
          tributos_atuais_total?: number
          valor_desonerado?: number
          variacao_preco_pct?: number
        }
        Update: {
          aliquota_plena_aplicada?: number
          calculado_em?: string
          case_id?: string
          id?: string
          item_id?: string
          preco_necessario?: number
          regime_cliente_snapshot?: string | null
          status_preco?: string
          tributos_atuais_total?: number
          valor_desonerado?: number
          variacao_preco_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_servico_nfse_item_prestado_preco_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_servico_nfse_item_prestado_preco_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "nota_servico_nfse_item_prestado"
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
      parametro_cenario_compras: {
        Row: {
          aliquota_ibs_cbs_plena_pct: number
          case_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          aliquota_ibs_cbs_plena_pct?: number
          case_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          aliquota_ibs_cbs_plena_pct?: number
          case_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametro_cenario_compras_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      parametro_fluxo_caixa: {
        Row: {
          atualizado_em: string
          case_id: string
          periodicidade_compensacao_credito_dias: number
          prazo_medio_pagamento_fornecedores_dias: number
          prazo_medio_recebimento_dias: number
        }
        Insert: {
          atualizado_em?: string
          case_id: string
          periodicidade_compensacao_credito_dias?: number
          prazo_medio_pagamento_fornecedores_dias?: number
          prazo_medio_recebimento_dias?: number
        }
        Update: {
          atualizado_em?: string
          case_id?: string
          periodicidade_compensacao_credito_dias?: number
          prazo_medio_pagamento_fornecedores_dias?: number
          prazo_medio_recebimento_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "parametro_fluxo_caixa_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      parecer_padrao: {
        Row: {
          case_id: string
          created_at: string
          dados_compilados_json: Json
          edicoes_analista_json: Json
          finalizado_em: string | null
          gerado_em: string
          gerado_por: string | null
          id: string
          share_enabled: boolean
          share_token: string | null
          status: string
          updated_at: string
          versao: number
        }
        Insert: {
          case_id: string
          created_at?: string
          dados_compilados_json?: Json
          edicoes_analista_json?: Json
          finalizado_em?: string | null
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          share_enabled?: boolean
          share_token?: string | null
          status?: string
          updated_at?: string
          versao: number
        }
        Update: {
          case_id?: string
          created_at?: string
          dados_compilados_json?: Json
          edicoes_analista_json?: Json
          finalizado_em?: string | null
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          share_enabled?: boolean
          share_token?: string | null
          status?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "parecer_padrao_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
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
      preco_necessario_projecao_anual: {
        Row: {
          ano: number
          case_id: string
          created_at: string
          id: string
          item_id: string
          preco_necessario_ano: number
          tipo_item: string
          variacao_preco_pct_ano: number
        }
        Insert: {
          ano: number
          case_id: string
          created_at?: string
          id?: string
          item_id: string
          preco_necessario_ano?: number
          tipo_item: string
          variacao_preco_pct_ano?: number
        }
        Update: {
          ano?: number
          case_id?: string
          created_at?: string
          id?: string
          item_id?: string
          preco_necessario_ano?: number
          tipo_item?: string
          variacao_preco_pct_ano?: number
        }
        Relationships: [
          {
            foreignKeyName: "preco_necessario_projecao_anual_case_id_fkey"
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
      vw_concentracao_compras_ncm: {
        Row: {
          case_id: string | null
          cfop: string | null
          cnpj_contraparte: string | null
          codigo: string | null
          n_itens: number | null
          n_itens_pendentes: number | null
          nome_contraparte: string | null
          valor_apurado_total: number | null
          valor_base_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_compra_xml_item_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_concentracao_servicos_nbs: {
        Row: {
          case_id: string | null
          cnpj_contraparte: string | null
          codigo: string | null
          direcao: string | null
          n_itens: number | null
          n_itens_pendentes: number | null
          nome_contraparte: string | null
          valor_apurado_total: number | null
          valor_base_total: number | null
        }
        Relationships: []
      }
      vw_concentracao_vendas_ncm: {
        Row: {
          case_id: string | null
          cfop: string | null
          cnpj_contraparte: string | null
          codigo: string | null
          n_itens: number | null
          n_itens_pendentes: number | null
          nome_contraparte: string | null
          valor_apurado_total: number | null
          valor_base_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_venda_xml_item_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_painel_carga: {
        Row: {
          case_id: string | null
          duplicados: number | null
          ignorados: number | null
          manuais: number | null
          nao_sao_notas: number | null
          tipo_documento: string | null
          total_recebido: number | null
          validos: number | null
        }
        Relationships: []
      }
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
