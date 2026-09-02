# Auditoria Pré Go-Live — Urano FAF

## Resumo geral

- **Stack**: React 19 + Vite 7 + TypeScript + Tailwind 4, roteamento com `wouter`, dados via Supabase (`@supabase/supabase-js`, só `anon key` no client), export de documentos/imagens (jsPDF, html2canvas, canvg), planilhas (`xlsx`).
- **Build**: `tsc --noEmit` limpo, `eslint .` sem erros (14 warnings cosméticos pré-existentes, não tocados), `vite build` concluído sem erros.
- **Situação atual**: sistema estável, sem erros de tipagem/build/lint. Único ponto crítico de produção era a ausência de uma rede de segurança para erros de render, agora corrigida.
- **Nível de risco**: Baixo.
- **Nota geral**: 8.5/10.

## Problemas encontrados

**P1**
1. Nenhum Error Boundary na árvore React — qualquer exceção não tratada durante o render quebrava a aplicação inteira com tela branca, sem fallback. Corrigido.

**P2**
2. Dependência `xlsx` (usada em `SpreadsheetImporter.ts` e `PlayerStatsImporter.ts`) tem vulnerabilidade conhecida (prototype pollution / ReDoS, GHSA-4r6h-8v6p-xvw6) sem correção disponível no registry. Uso é restrito a upload interno feito por administradores autenticados (não é endpoint público), o que reduz a exposição real, mas o pacote em si continua vulnerável.
3. `triggerBlobDownload` passou a ser assíncrona (para suportar Web Share no iOS) mas alguns callers (`GenerateIMTDialog.tsx:241`, `imtRepository.ts:142`, `detailedTableRepository.ts:125`, `EscalaOficiaisPage.tsx:154`, `FafLabDashboard.tsx:265`, `CompetitionHub.tsx:242`) não fazem `await`/`.catch`. Não é regressão funcional (o padrão fire-and-forget já existia antes, quando a função era síncrona), mas uma falha dentro do fluxo de compartilhamento agora gera uma promise rejeitada sem tratamento.

**P3**
4. Chunk principal do build (`index-*.js`) está em ~2.28 MB (674 KB gziped) — acima do limite recomendado pelo Vite. Não é erro, é aviso de performance de carregamento inicial.
5. 14 warnings de lint pré-existentes (fast-refresh em arquivos `ui/*`, variáveis não usadas, uma dependência de `useMemo`) — cosméticos, sem risco funcional.

## Correções executadas

| Arquivo | Problema | Solução | Impacto |
|---|---|---|---|
| [src/components/ErrorBoundary.tsx](src/components/ErrorBoundary.tsx) | Sem rede de segurança para erros de render | Criado Error Boundary mínimo com fallback de "recarregar página" | Elimina tela branca em produção; não altera nenhum fluxo existente enquanto não há erro |
| [src/main.tsx](src/main.tsx) | App renderizado sem proteção contra crash | Envolvido `<App />` com `<ErrorBoundary>` na raiz | Mesmo comportamento visual em uso normal; fallback só aparece em caso de exceção |

## Pendências (não corrigidas nesta rodada — decisão de produto/escopo)

- **`xlsx` vulnerável sem fix upstream**: trocar de biblioteca (ex. `exceljs`) é uma mudança de dependência/comportamento fora do escopo desta auditoria (não é bugfix pontual). Recomenda-se avaliar separadamente.
- **Callers de `triggerBlobDownload` sem `await`**: comportamento idêntico ao anterior à mudança (já era fire-and-forget); ajustá-los para `await`/`.catch` é uma melhoria de robustez, não um bug ativo — deixado como item de acompanhamento.
- **Code splitting do bundle principal**: bundle >500KB é aviso de performance, não bloqueador de go-live.

## Teste ao vivo (navegador, dados reais de produção via Supabase)

Percorridos sem erros de console/runtime: Dashboard, Competições (listagem e hub completo — Visão Geral, Jogos com filtro por status, Classificação, Fase Eliminatória, Documentos), edição inline de placar (aberta e cancelada sem alterar dado real), diálogo "Criar Partida" (aberto e cancelado), Central de Geração de Artes (seleção de jogos + export PNG real, confirmado no Histórico), FAF Lab, FAFTV, Clubes, Estádios, Cidades, Oficiais DCO, Assets, Configurações, Lixeira, Histórico.

**Bug real encontrado e corrigido**: `public/templates/resultados-do-dia/config.json` declarava os campos `txt_cidade` e `txt_estadio`, mas nenhuma das 6 variantes SVG desse template os possui — todo export do template "Resultados do Dia" emitia dois warnings de diagnóstico no console sem qualquer efeito (config morta). Removidos do config; export re-testado após reload completo e confirmado limpo, sem warnings.

**Verificado e não é bug**: labels "Confronto B, C, D..." na Fase Eliminatória (sem "Confronto A") — intencional, a Fase 1 (grupo único) consome a letra "A" (ver comentário em `competitionRepository.ts:120`). Botões duplicados "Limpar seleção" na Central de Geração quando toda a seleção visível já está marcada — redundância de UX pré-existente, não uma regressão; fora de escopo alterar (regra do projeto proíbe mudança de UX).

## GO-LIVE

**APROVADO.**

Justificativa: build, typecheck e lint passam sem erros; nenhuma chave sensível (`service_role`) é exposta no client, apenas a `anon key` esperada; escaping de HTML nos templates de documento (`escapeHtml` em `renderDetailedTable.ts`, `renderEscalaOficiais.ts`) está consistente, prevenindo XSS via dados do usuário; o único ponto crítico identificado (ausência de Error Boundary) foi corrigido nesta rodada. As pendências restantes (P2/P3) são riscos contidos ou de escopo fora de correção pontual, não bloqueiam o lançamento.
