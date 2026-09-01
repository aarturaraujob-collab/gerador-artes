"""
Gera o HTML da seção "Jogos do dia" a partir das tabelas reais do Urano
(faf-mkt-ops), filtrando tables/matches.ts pela data de hoje.

Fonte: tables/matches.ts, clubs.ts, stadiums.ts, cities.ts, competitions.ts
(arquivos TS com `export const x = [...] as const;` — extraímos só o array
JSON de dentro, sem precisar de um parser TS completo).

Uso:
    python3 gerar_jogos_do_dia.py <pasta_tables> <DD/MM/AAAA>

Imprime o HTML dos <div class="game-card">...</div> (ou o empty-state) em
stdout, pronto para colar na seção #jogos do resumo_diario_faf.html.
"""
import json
import re
import sys
from pathlib import Path


def load_ts_array(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    # remove o "export const nome = " do início e o " as const;" do fim
    inner = re.sub(r"^\s*export const \w+ =\s*", "", text.strip())
    inner = re.sub(r"\s*as const;\s*$", "", inner)
    return json.loads(inner)


def build_index(rows: list[dict]) -> dict[str, dict]:
    return {r["id"]: r for r in rows}


def resolve_time_link(match: dict) -> str:
    home = match["homeClubId"]
    away = match["awayClubId"]
    return f"https://www.sofascore.com/search?q={home}%20{away}"


def games_today(tables_dir: Path, date_ddmmaaaa: str) -> list[dict]:
    matches = load_ts_array(tables_dir / "matches.ts")
    return [m for m in matches if m.get("date") == date_ddmmaaaa]


def render_card(match: dict, clubs: dict, stadiums: dict, cities: dict, competitions: dict) -> str:
    home = clubs.get(match["homeClubId"], {"shortName": match["homeClubId"], "shield": ""})
    away = clubs.get(match["awayClubId"], {"shortName": match["awayClubId"], "shield": ""})
    stadium = stadiums.get(match.get("stadiumId"), {})
    city = cities.get(stadium.get("cityId"), {})
    local = f"{stadium.get('name', '')} — {city.get('name', '')}".strip(" —")
    time = match.get("time") or "--:--"
    sofa_url = resolve_time_link(match)
    comp = competitions.get(match.get("competitionId", "").lower(), {}).get("name", match.get("competitionId", ""))
    round_ = match.get("round", "")
    # brasões sem arquivo local (shield vazio) caem no placeholder de bola — não inventamos crest.
    def crest_img(club: dict) -> str:
        if club.get("shield"):
            return f'<img class="crest" src="{club["shield"]}" alt="{club["shortName"]}">'
        return '<span class="crest" aria-hidden="true"></span>'
    tv_attr = f' data-canais="{match["tv"]}"' if match.get("tv") else ""
    tv_button = (
        f'<button class="tv-icon" type="button" onclick="toggleWatch(this)"{tv_attr} '
        'aria-expanded="false" aria-label="Onde assistir">📺</button>'
        if match.get("tv") else ""
    )
    return f"""<div class="game-card">
  <div class="row-top">
    <span class="kickoff">{time}</span>
    <a class="link-arrow" href="{sofa_url}" target="_blank" rel="noopener" aria-label="Ver no Sofascore">&rarr;</a>
  </div>
  <div class="teams">
    <div class="teams-col">
      <div class="team-line">{crest_img(home)}<span class="code">{home['shortName']}</span></div>
      <div class="team-line">{crest_img(away)}<span class="code">{away['shortName']}</span></div>
    </div>
    {tv_button}
  </div>
  <div class="competicao">{comp} — {round_} · {local}</div>
</div>"""


def main() -> None:
    tables_dir = Path(sys.argv[1])
    date_ddmmaaaa = sys.argv[2]

    matches = games_today(tables_dir, date_ddmmaaaa)
    if not matches:
        print(
            '<p class="lede">Nenhuma partida cadastrada no Urano (faf-mkt-ops) '
            f'para {date_ddmmaaaa}.</p>\n<div class="empty">Sem jogos verificados para hoje.</div>'
        )
        return

    clubs = build_index(load_ts_array(tables_dir / "clubs.ts"))
    stadiums = build_index(load_ts_array(tables_dir / "stadiums.ts"))
    cities = build_index(load_ts_array(tables_dir / "cities.ts"))
    competitions = build_index(load_ts_array(tables_dir / "competitions.ts"))

    cards = "\n".join(render_card(m, clubs, stadiums, cities, competitions) for m in matches)
    print(cards)


if __name__ == "__main__":
    main()
