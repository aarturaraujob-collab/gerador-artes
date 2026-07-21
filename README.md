# FAF MKT OPS

Ferramenta interna da **Federação Alagoana de Futebol** para geração de artes gráficas de competições — agenda de jogos, thumbnails de transmissão (FAFTV), e mais.

## Stack

- React 19 + TypeScript (strict)
- Vite 7
- Tailwind CSS 4
- Radix UI / shadcn
- SheetJS (importação de planilhas)
- save-svg-as-png (exportação de PNG)

## Início rápido

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento (http://localhost:5173)
npm run dev

# Verificar tipos
npm run typecheck

# Build para produção
npm run build
```

## Como funciona

1. O usuário abre a galeria de **Templates** (rota `/`)
2. Escolhe um template (ex.: "Jogos do Dia", "Thumbnail FAFTV")
3. Preenche o formulário com os dados dos jogos (clubes, data, hora, local)
   - Ou importa uma **planilha CSV/XLSX** para preencher vários jogos de uma vez
4. Clica em **Gerar Arte** — o app injeta os dados em um template SVG (Figma)
5. Clica em **Exportar PNG** — o app renderiza o SVG em imagem e baixa

Tudo roda no navegador. Não há backend, banco de dados, nem autenticação.

## Templates

Cada template fica em `public/templates/<nome>/` com a seguinte estrutura:

```
public/templates/jogos-do-dia/
├── agenda_1jogo_feed.svg      # Variante para 1 jogo
├── agenda_2jogos_feed.svg      # Variante para 2 jogos
├── agenda_3jogos_feed.svg      # Variante para 3 jogos
├── agenda_4jogos_feed.svg      # Variante para 4 jogos
├── config.json                 # Metadados (campos, variantes)
└── cover.png                   # Imagem de preview na galeria
```

Para adicionar um novo template:

1. Exporte o SVG do Figma, usando IDs com prefixo `txt_` (texto), `img_` (imagem) ou `grp_` (grupo)
2. Crie a pasta em `public/templates/<nome>/`
3. Adicione o `config.json` com as variantes e campos
4. Registre em `src/components/templates/templates.ts`

## Importação de planilha

O app aceita `.csv` e `.xlsx` com as seguintes colunas (nomes flexíveis):

| Coluna | Alternativas aceitas |
|--------|---------------------|
| mandante | home, casa, clube_mandante, time_casa |
| visitante | away, fora, clube_visitante, time_fora |
| dia | dia_semana, day |
| data | date, numero |
| mes | month |
| hora | horario, time |
| cidade | city, local |
| estadio | stadium, praca |

Nomes de clubes são normalizados pelo importador para as tabelas geradas em `tables/`.

Um modelo de exemplo está disponível em `public/data/modelo-importacao.csv`.

## Clubes

Clubes, cidades, estádios, competições e partidas ficam exclusivamente nas tabelas geradas em `tables/`.

## Deploy

O app é 100% estático. Recomendado: [Vercel](https://vercel.com) (grátis).

```bash
# Via Vercel CLI
npx vercel
```

Ou conecte o repositório GitHub ao Vercel — detecta Vite automaticamente e faz deploy a cada push.
