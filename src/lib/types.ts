export interface Perfil {
  id: string;
  nome: string;
  papel: "lavador" | "gestor";
}

export interface Lavagem {
  id: string;
  data_hora: string;
  placa_cavalo: string;
  placa_carreta: string;
  tipo: "bau" | "sider";
  registrado_por: string | null;
  foto_cavalo_url: string | null;
  foto_carreta_url: string | null;
  escopo: "cavalo" | "carreta" | "ambos";
  excluido: boolean;
}

export interface LavagemComPerfil extends Lavagem {
  perfis: {
    nome: string;
  } | null;
}
