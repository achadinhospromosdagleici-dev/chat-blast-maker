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
      instances: {
        Row: {
          created_at: string
          id: string
          jid: string | null
          name: string
          phone: string | null
          qr_code: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          jid?: string | null
          name: string
          phone?: string | null
          qr_code?: string | null
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          jid?: string | null
          name?: string
          phone?: string | null
          qr_code?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      SAAS_Conexoes: {
        Row: {
          Apikey: string | null
          created_at: string
          FotoPerfil: string | null
          id: number
          idUsuario: string
          instanceName: string | null
          NomeConexao: string
          status: string
          Telefone: string | null
          updated_at: string
        }
        Insert: {
          Apikey?: string | null
          created_at?: string
          FotoPerfil?: string | null
          id?: number
          idUsuario: string
          instanceName?: string | null
          NomeConexao: string
          status?: string
          Telefone?: string | null
          updated_at?: string
        }
        Update: {
          Apikey?: string | null
          created_at?: string
          FotoPerfil?: string | null
          id?: number
          idUsuario?: string
          instanceName?: string | null
          NomeConexao?: string
          status?: string
          Telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      SAAS_Contatos: {
        Row: {
          atributos: Json | null
          created_at: string
          id: number
          idLista: number
          idUsuario: string
          nome: string | null
          telefone: string
        }
        Insert: {
          atributos?: Json | null
          created_at?: string
          id?: number
          idLista: number
          idUsuario: string
          nome?: string | null
          telefone: string
        }
        Update: {
          atributos?: Json | null
          created_at?: string
          id?: number
          idLista?: number
          idUsuario?: string
          nome?: string | null
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "SAAS_Contatos_idLista_fkey"
            columns: ["idLista"]
            isOneToOne: false
            referencedRelation: "SAAS_Listas"
            referencedColumns: ["id"]
          },
        ]
      }
      SAAS_Detalhes_Disparos: {
        Row: {
          created_at: string
          dataEnvio: string | null
          id: number
          idConexao: number | null
          idDisparo: number
          mensagem: string | null
          mensagemErro: string | null
          midia: string | null
          nomeContato: string | null
          Payload: string | null
          Status: string
          telefone: string | null
          UserId: string
        }
        Insert: {
          created_at?: string
          dataEnvio?: string | null
          id?: number
          idConexao?: number | null
          idDisparo: number
          mensagem?: string | null
          mensagemErro?: string | null
          midia?: string | null
          nomeContato?: string | null
          Payload?: string | null
          Status?: string
          telefone?: string | null
          UserId: string
        }
        Update: {
          created_at?: string
          dataEnvio?: string | null
          id?: number
          idConexao?: number | null
          idDisparo?: number
          mensagem?: string | null
          mensagemErro?: string | null
          midia?: string | null
          nomeContato?: string | null
          Payload?: string | null
          Status?: string
          telefone?: string | null
          UserId?: string
        }
        Relationships: [
          {
            foreignKeyName: "SAAS_Detalhes_Disparos_idConexao_fkey"
            columns: ["idConexao"]
            isOneToOne: false
            referencedRelation: "SAAS_Conexoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "SAAS_Detalhes_Disparos_idDisparo_fkey"
            columns: ["idDisparo"]
            isOneToOne: false
            referencedRelation: "SAAS_Disparos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "SAAS_Detalhes_Disparos_idDisparo_fkey"
            columns: ["idDisparo"]
            isOneToOne: false
            referencedRelation: "vw_Detalhes_Completo"
            referencedColumns: ["idDisparo"]
          },
        ]
      }
      SAAS_Disparos: {
        Row: {
          conexoes: number[] | null
          created_at: string
          enviados: number | null
          falhas: number | null
          id: number
          idLista: number | null
          mensagens: Json | null
          settings: Json | null
          status: string
          tipo: string
          total: number | null
          updated_at: string
          userId: string
        }
        Insert: {
          conexoes?: number[] | null
          created_at?: string
          enviados?: number | null
          falhas?: number | null
          id?: number
          idLista?: number | null
          mensagens?: Json | null
          settings?: Json | null
          status?: string
          tipo?: string
          total?: number | null
          updated_at?: string
          userId: string
        }
        Update: {
          conexoes?: number[] | null
          created_at?: string
          enviados?: number | null
          falhas?: number | null
          id?: number
          idLista?: number | null
          mensagens?: Json | null
          settings?: Json | null
          status?: string
          tipo?: string
          total?: number | null
          updated_at?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "SAAS_Disparos_idLista_fkey"
            columns: ["idLista"]
            isOneToOne: false
            referencedRelation: "SAAS_Listas"
            referencedColumns: ["id"]
          },
        ]
      }
      SAAS_Grupos: {
        Row: {
          created_at: string
          id: number
          idConexao: number | null
          idLista: number
          idUsuario: string
          nome: string | null
          participantes: number | null
          WhatsAppId: string
        }
        Insert: {
          created_at?: string
          id?: number
          idConexao?: number | null
          idLista: number
          idUsuario: string
          nome?: string | null
          participantes?: number | null
          WhatsAppId: string
        }
        Update: {
          created_at?: string
          id?: number
          idConexao?: number | null
          idLista?: number
          idUsuario?: string
          nome?: string | null
          participantes?: number | null
          WhatsAppId?: string
        }
        Relationships: [
          {
            foreignKeyName: "SAAS_Grupos_idConexao_fkey"
            columns: ["idConexao"]
            isOneToOne: false
            referencedRelation: "SAAS_Conexoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "SAAS_Grupos_idLista_fkey"
            columns: ["idLista"]
            isOneToOne: false
            referencedRelation: "SAAS_Listas"
            referencedColumns: ["id"]
          },
        ]
      }
      SAAS_Listas: {
        Row: {
          campos: Json | null
          created_at: string
          descricao: string | null
          id: number
          idConexao: number | null
          idUsuario: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          campos?: Json | null
          created_at?: string
          descricao?: string | null
          id?: number
          idConexao?: number | null
          idUsuario: string
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          campos?: Json | null
          created_at?: string
          descricao?: string | null
          id?: number
          idConexao?: number | null
          idUsuario?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "SAAS_Listas_idConexao_fkey"
            columns: ["idConexao"]
            isOneToOne: false
            referencedRelation: "SAAS_Conexoes"
            referencedColumns: ["id"]
          },
        ]
      }
      SAAS_Planos: {
        Row: {
          created_at: string
          id: number
          nome: string
          preco: number
          qntConexoes: number
          qntContatos: number
          qntDisparos: number
          qntListas: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          nome: string
          preco?: number
          qntConexoes?: number
          qntContatos?: number
          qntDisparos?: number
          qntListas?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string
          preco?: number
          qntConexoes?: number
          qntContatos?: number
          qntDisparos?: number
          qntListas?: number
          updated_at?: string
        }
        Relationships: []
      }
      SAAS_Usuarios: {
        Row: {
          apikey_gpt: string | null
          created_at: string
          dataValidade: string | null
          Email: string
          id: string
          nome: string
          plano: number | null
          senha: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          apikey_gpt?: string | null
          created_at?: string
          dataValidade?: string | null
          Email: string
          id: string
          nome?: string
          plano?: number | null
          senha?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          apikey_gpt?: string | null
          created_at?: string
          dataValidade?: string | null
          Email?: string
          id?: string
          nome?: string
          plano?: number | null
          senha?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "SAAS_Usuarios_plano_fkey"
            columns: ["plano"]
            isOneToOne: false
            referencedRelation: "SAAS_Planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "SAAS_Usuarios_plano_fkey"
            columns: ["plano"]
            isOneToOne: false
            referencedRelation: "vw_Planos_Usuarios_Count"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      vw_Detalhes_Completo: {
        Row: {
          dataEnvio: string | null
          idDetalhe: number | null
          idDisparo: number | null
          mensagem: string | null
          mensagemErro: string | null
          nomeContato: string | null
          Status: string | null
          StatusDisparo: string | null
          telefone: string | null
          UserId: string | null
        }
        Relationships: []
      }
      vw_Planos_Usuarios_Count: {
        Row: {
          created_at: string | null
          id: number | null
          nome: string | null
          preco: number | null
          qntConexoes: number | null
          qntContatos: number | null
          qntDisparos: number | null
          qntListas: number | null
          total_usuarios: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number | null
          nome?: string | null
          preco?: number | null
          qntConexoes?: number | null
          qntContatos?: number | null
          qntDisparos?: number | null
          qntListas?: number | null
          total_usuarios?: never
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number | null
          nome?: string | null
          preco?: number | null
          qntConexoes?: number | null
          qntContatos?: number | null
          qntDisparos?: number | null
          qntListas?: number | null
          total_usuarios?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_Usuarios_Com_Plano: {
        Row: {
          apikey_gpt: string | null
          created_at: string | null
          dataValidade: string | null
          Email: string | null
          id: string | null
          nome: string | null
          plano: number | null
          plano_nome: string | null
          plano_preco: number | null
          qntConexoes: number | null
          qntContatos: number | null
          qntDisparos: number | null
          qntListas: number | null
          senha: string | null
          status: string | null
          telefone: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "SAAS_Usuarios_plano_fkey"
            columns: ["plano"]
            isOneToOne: false
            referencedRelation: "SAAS_Planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "SAAS_Usuarios_plano_fkey"
            columns: ["plano"]
            isOneToOne: false
            referencedRelation: "vw_Planos_Usuarios_Count"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_connections_disparo: {
        Args: { _conns: number[]; _disparo: number; _user: string }
        Returns: undefined
      }
      create_disparo: { Args: { payload: Json }; Returns: number }
      create_disparo_grupo: { Args: { payload: Json }; Returns: number }
      delete_disparo: {
        Args: { _id: number; _user: string }
        Returns: undefined
      }
      get_contatos_by_lista: {
        Args: { _lista: number }
        Returns: {
          atributos: Json | null
          created_at: string
          id: number
          idLista: number
          idUsuario: string
          nome: string | null
          telefone: string
        }[]
        SetofOptions: {
          from: "*"
          to: "SAAS_Contatos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_grupos_by_lista: {
        Args: { _lista: number }
        Returns: {
          created_at: string
          id: number
          idConexao: number | null
          idLista: number
          idUsuario: string
          nome: string | null
          participantes: number | null
          WhatsAppId: string
        }[]
        SetofOptions: {
          from: "*"
          to: "SAAS_Grupos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pause_disparo: {
        Args: { _id: number; _user: string }
        Returns: undefined
      }
      resume_disparo: {
        Args: { _id: number; _user: string }
        Returns: undefined
      }
      swap_connection: {
        Args: { _disparo: number; _from: number; _user: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
