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
  placa_carreta2?: string | null;
  tipo: "bau" | "sider" | "rodotrem";
  registrado_por: string | null;
  foto_cavalo_url: string | null;
  foto_carreta_url: string | null;
  escopo: "ambos" | "cavalo" | "carreta" | null;
}

export interface LavagemComPerfil extends Lavagem {
  perfis: {
    nome: string;
  } | null;
}
