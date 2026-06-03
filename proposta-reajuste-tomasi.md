# Proposta de Reajuste — Sistema Lava-Jato Tomasi
**MX Digital · Junho 2026**

---

## O que foi entregue

### Sistema base (implantação)
- Aplicativo web com instalação no celular (PWA — funciona como app, sem precisar de Play Store)
- Login seguro com autenticação por e-mail e senha
- Banco de dados na nuvem com backup automático (Supabase)
- Deploy em produção com domínio próprio (Vercel)

### Registro de lavagens
- Leitura automática de placas por **Inteligência Artificial** — tira a foto, a IA identifica a placa
- Suporte a todos os tipos de veículo: cavalo, carreta, ambos, truck e rodotrem
- Registro de tipos de carroceria: Baú e Sider
- Rodotrem em duas etapas (1ª carreta + completar com 2ª carreta)
- Fotos das placas salvas automaticamente na nuvem

### Painel de gestão (João)
- Lista de todas as lavagens com filtro por mês e lavador
- Contagem de lavagens por tipo (Baú / Sider / Total)
- Configuração de preço por lavagem
- Tabela de valores diferenciados:
  - Só cavalo → R$ 50
  - Só carreta → R$ 100
  - Ambos / Truck → R$ 100
  - Rodotrem completo → R$ 200
- Exportação de PDF com relatório completo (valores + total a receber)
- Botão de exclusão com confirmação

### Folha de Higienização (POP3.1 · Revisão 4)
- Página dedicada com filtro por mês
- Tabela com: data, placas, tipo de lavação, confirmação
- Campos de confirmação (Completo / Confirmação João) com salvamento automático
- Exportação em PDF padrão TOMASI LOGÍSTICA — pronta para auditoria

### Controle de acessos (multi-usuário)
Quatro níveis de acesso configurados e em produção:

| Usuário | Acesso |
|---|---|
| João (gestor) | Controle total — painel, valores, PDF, exclusão |
| Andrei (lavador) | Registro de lavagens + visualização da lista |
| Alex (operacional) | Painel sem valores + registro de teste isolado |
| Cláudio (gestão) | Visualização completa com valores + PDF — somente leitura |

- Registros de teste (Alex/Cláudio) **não aparecem** nos dados reais do João
- Segurança por RLS (Row Level Security) no banco — valores financeiros bloqueados no servidor, não só na tela

---

## Investimento atual vs. valor de mercado

| Item | Cobrado | Mercado |
|---|---|---|
| Desenvolvimento e implantação | R$ 1.000 | R$ 3.500 – R$ 6.000 |
| Manutenção mensal | R$ 60/mês | R$ 150 – R$ 300/mês |

---

## Proposta de reajuste

O sistema cresceu significativamente desde a entrega inicial.
Proponho ajustar a manutenção mensal a partir de **julho/2026**:

> **De R$ 60/mês → para R$ 150/mês**

O que está incluído na manutenção:
- Suporte técnico e correções
- Pequenas melhorias e ajustes no sistema
- Monitoramento do servidor e banco de dados
- Novas funcionalidades conforme a operação crescer

---

*Documento elaborado por MX Digital — maxwel7639@gmail.com*
