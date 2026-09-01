# Resumo Diário FAF — Arquitetura Proposta

## Objetivo
Newsletter diária (padrão visual FENACON) com 7 seções, enviada por e-mail todas as manhãs.

## Por que não é uma "API" no sentido clássico
Não existe hoje um sistema estruturado com jogos/árbitros/tabela. Os dados chegam
por e-mail em `contato@futeboldealagoas.net`, em três formatos diferentes:

| Seção | Fonte real observada na caixa de entrada |
|---|---|
| Árbitros escalados | **Dois formatos diferentes**: (a) corpo de texto em e-mails "Fwd: Designação de Árbitros..." e (b) PDF anexado em e-mails "CA-CBF: Escala [competição] - Período X a Y" enviados por `departamento.arbitragem@cbf.com.br` (este é o mais comum para competições nacionais) |
| Tabelas e resultados / Próximos jogos | PDFs anexados: "Tabela Básica", "Tabela Detalhada", REC, PGA (CBF e FAF) |
| Notícias FAF | **Sem fonte identificada ainda** — precisa definir (site da FAF? redes sociais? clipping manual?) |
| Agenda da FAF | Sem fonte estruturada — hoje é informação institucional avulsa |
| KPIs FAF | Planilha do FAFTV (já coberta pela skill faftv-kpi-sheet) |
| Jogos do dia | Derivado da Tabela (PDF) filtrada pela data |

Ou seja, o "backend" real é um **pipeline de ingestão de e-mail + extração de PDF**,
não uma API pronta para consumir.

## Pipeline proposto

```
[IMAP: contato@futeboldealagoas.net]
        │
        ▼
[1. Coletor] — lê e-mails não processados, classifica por assunto/remetente
        │
        ├── "Designação de Árbitros..." (texto) ──► [2a. Parser de árbitros - regex no corpo]
        ├── "CA-CBF: Escala..." (PDF) ────────────► [2b. Parser de PDF - tabela de escalação]
        ├── anexo contendo "Tabela"/"REC"/"PGA" ──► [2c. Parser de PDF - jogos/resultados]
        └── outros (não classificados) ───────────► fila de revisão manual

Observação: os PDFs de escala (CBF) e de tabela têm layouts diferentes por
competição/remetente — o parser de PDF precisa ser tolerante a variação de
formato (usar extração de tabela como `pdfplumber` e validar campos-chave
como "Jogo", "Árbitro", "Data", "Estádio" em vez de depender de posição fixa
de coluna).
        │
        ▼
[3. Banco de dados] (SQLite) — jogos, árbitros, resultados, por data/competição
        │
        ▼
[4. Gerador do resumo] — monta HTML no padrão Fenacon com as 7 seções
        │
        ▼
[5. Envio SMTP] — dispara a newsletter (cron diário, ex: 7h)
```

## Hospedagem recomendada
VPS pequeno (DigitalOcean/Hetzner, ~R$25–50/mês), rodando:
- Script Python com `cron` (1x/dia) para coleta + geração + envio
- SQLite (não precisa de banco separado nesse volume)
- Sem necessidade de framework web/API pública — é um job agendado, não um serviço exposto

## Atualização — conector Gmail resolve a ingestão (testado em produção real)

Em vez de IMAP com senha de app dedicada, conectamos a FAF via **conector oficial do Gmail**
(OAuth, já autenticado na conta contato@futeboldealagoas.net). Isso elimina o item de credencial
sensível do plano original.

Confirmado nesta sessão:
- `search_threads` / `get_thread` leem e-mails reais em tempo real (testado: notícias do dia,
  ofícios da CBF).
- Anexos em PDF **podem ser extraídos**: pedindo a mensagem em formato `RAW`, decodificando o
  MIME (`email.message_from_bytes`) e salvando cada parte com `get_filename()`. Testado com sucesso
  no PDF real "TABELA DETALHADA - COPA DO BRASIL MASCULINA SUB-20 2026.pdf" (353 KB) — extraiu
  corretamente os dois jogos de clubes alagoanos (CSA x Confiança-PB, Santa Cruz-PE x CSE).
- Isso substitui o item 1 ("credencial IMAP dedicada") do plano original — não precisa mais.

## Atualização — IMT (Informação de Modificação de Tabela) confirmado como fonte real

A CBF avisa mudanças de jogo já tabelado (data, hora, local) por e-mail com um PDF
"IMT — <competição> de <data>" anexado, encaminhado por `secretariageral@` com
cópia para `contato@futeboldealagoas.net` — 201 threads históricas na caixa, então
é um sinal recorrente, não esporádico. Testado com um IMT real (02CNE20, Copa do
Nordeste Sub-20): PDF estruturado com "Jogo N: Mandante x Visitante", bloco
"Modificação: De: ... / Para: ..." (ou só "Data:"/"Local:" quando um único campo
muda), "Solicitante:" e "Motivo:". Parser em `parser_imt.py`, validado contra esse
PDF real (extraiu corretamente os 3 jogos, incluindo a mudança do CSE/AL).

**Regra de negócio**: um jogo tocado por IMT tem que ter prioridade sobre a tabela
original — seja ela o Urano (`tables/matches.ts`) ou um PDF de tabela anterior da
CBF. Isso vale tanto para "Jogos do dia" (um jogo pode ter sido *movido para* hoje,
ou *movido para fora* de hoje) quanto para "Próximos jogos" e qualquer súmula já
mostrada. Antes de publicar a seção de jogos, o pipeline precisa: (1) buscar por
`IMT` nos e-mails recentes, (2) extrair mandante/visitante/data nova de cada
modificação, (3) cruzar pelo nome dos times com o jogo correspondente na tabela
base e (4) usar a data/hora/local do "Para:" em vez do original — sinalizando que
houve alteração (útil para avisar a Secretaria/imprensa).

## O que falta decidir para produção
1. **Credencial IMAP dedicada** (senha de app) para `contato@futeboldealagoas.net` — nunca
   deve ser colada em texto puro numa conversa; deve ir direto como variável de ambiente
   no servidor.
2. **Fonte de Notícias FAF** — de onde vem esse conteúdo hoje?
3. **Fonte de Agenda da FAF** — existe calendário (Google Calendar, planilha)?
4. **Lista de destinatários** da newsletter.
5. Confirmar o provedor de VPS e quem vai manter o servidor.

## Protótipo incluído neste pacote
- `template_resumo.html` — template visual (padrão Fenacon) com dados de exemplo
- `parser_arbitros.py` — parser de designação de árbitros a partir do texto real observado
- `sample_data.json` — dados de exemplo usados para renderizar o template
