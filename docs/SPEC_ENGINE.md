# Especificação da Engine SVG

## Pipeline

`DataStore` fornece o objeto `Match` selecionado. A engine resolve a variante
com `TemplateResolver`, aplica os campos ao SVG com `SvgDocument` e envia o
SVG final para `exportToPng`.

`TemplateLayoutResolver` define a divisão de lotes de até quatro jogos para
templates que suportam renderização em lote.

## Responsabilidades

- `SvgDocument`: indexa IDs SVG, altera textos e imagens e controla grupos;
- `TemplateResolver`: carrega `config.json` e resolve uma variante por número
  de jogos;
- `TemplateLayoutResolver`: determina os tamanhos de cada lote;
- `exportToPng`: converte um SVG final em arquivo PNG.

O objeto `Match` permanece a entrada da renderização. A UI seleciona e exibe
o resultado, mas não conhece IDs de SVG, caminhos de assets ou regras de
substituição.

## Compatibilidade

A engine aceita imagens em elementos `image`, `rect` com `pattern` e grupos
que contenham `rects` com `pattern`. Ao atualizar uma imagem compartilhada,
`SvgDocument` clona a imagem do pattern quando necessário para que slots
independentes não se sobrescrevam.
