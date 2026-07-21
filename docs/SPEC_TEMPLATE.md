# Especificação de Templates SVG

Esta especificação descreve os templates efetivamente suportados pela engine.

## Estrutura

Cada template fica em `public/templates/<id>/` e contém:

- `config.json`: identificação e variantes;
- um SVG por variante;
- `cover.png`: miniatura usada pela galeria.

O `config.json` possui `id`, `name` e `variants`. Cada variante declara o
número de jogos em `games` e o arquivo SVG em `file`.

## IDs SVG

Os IDs são a API pública do SVG. A engine reconhece os prefixos abaixo:

- `txt_`: texto;
- `img_`: imagem, imagem em pattern ou grupo que contenha rects com pattern;
- `grp_`: camada ou agrupamento que pode ser mostrado ou ocultado.

IDs não reconhecidos são preservados sem alteração.

## Slots de jogos

Um template de múltiplos jogos usa o primeiro slot sem sufixo e os seguintes
com `_2`, `_3` e assim por diante. Por exemplo,
`txt_hora`, `txt_hora_2` e `img_escudo_mandante_3`.

Um slot pode expor somente parte dos campos. Campos ausentes são ignorados,
o que permite templates institucionais, thumbnails e placeholders.

## Convenções usadas pelos templates atuais

`jogos-do-dia` usa `txt_dia`, `txt_data`, `txt_mes`, `txt_hora`,
`txt_cidade`, `txt_estadio`, `img_escudo_mandante` e
`img_escudo_visitante` em cada slot.

`thumb-faftv` usa `img_mandante`, `img_mandante_2` e `img_visitante`. Ele não
declara campos de texto e a engine deve preservá-lo assim.

## Assets

Escudos são referenciados pelo campo `shield` de `tables/clubs.ts`. Os arquivos
locais ficam sob `public/assets/escudos/`; a resolução do caminho deve ficar
centralizada na engine, nunca em componentes React.
