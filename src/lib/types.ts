export interface Perfil {
  id: string;
  nome: string;
  papel: "lavador" | "gestor" | "dev";
}

export interface Lavagem {
  id: string;
  data_hora: string;
  placa_cavalo: string;
  placa_carreta: string;
  placa_carreta_2: string | null;
  tipo: "bau" | "sider";
  registrado_por: string | null;
  foto_cavalo_url: string | null;
  foto_carreta_url: string | null;
  escopo: "ambos" | "cavalo" | "carreta" | "truck" | "rodotrem" | null;
  excluido: boolean;
}

export interface LavagemComPerfil extends Lavagem {
  perfis: {
    nome: string;
  } | null;
}

// Tabela lavagens_maxwel — registro pessoal de lavagens do Maxwel (aba "Minhas Lavagens", só dev)
export interface LavagemMaxwel {
  id: string;
  data: string; // date (YYYY-MM-DD)
  placa_cavalo: string | null;
  placa_carreta: string | null;
  placa_carreta_2: string | null;
  tipo: string | null;
  escopo: string | null;
  valor: number;
  observacao: string | null;
  excluido: boolean;
  excluido_em: string | null;
  created_at: string;
}
