"""
Junta os jogos de hoje das duas fontes reais que temos:
  - Urano (tables/matches.ts) — competições que a própria FAF organiza
    (Alagoano, Copa Alagoas etc.), mantidas manualmente pela equipe.
  - Gmail — tabelas + IMTs da CBF (Brasileirão, Copa do Brasil etc.),
    já extraídas com parser_escala_pdf.py / parser_imt.py e passadas aqui
    como uma lista de dicts no mesmo formato de tables/matches.ts.

Um IMT que mexe num jogo (de qualquer uma das duas fontes) sobrescreve a
data/hora/local original — a regra combinada com o usuário: o IMT é sempre
a informação mais recente.

ponytail: isso NÃO faz scraping nem chama a CBF/Sofascore sozinho — os
jogos da CBF continuam entrando como lista já parseada de e-mail (fluxo já
provado com PDFs reais). Automatizar a busca/parsing por e-mail todo santo
dia é o próximo degrau, se/quando for necessário.
"""
from dataclasses import dataclass, field

from normalizar_time import build_lookup, resolve_club_id


@dataclass
class Jogo:
    date: str  # DD/MM/AAAA
    time: str
    home: str  # nome como veio da fonte (não normalizado)
    away: str
    competicao: str
    local: str = ""
    fonte: str = ""  # "urano" | "gmail"
    home_id: str | None = None
    away_id: str | None = None


def jogos_do_urano(matches: list[dict], clubs: list[dict], stadiums: dict, cities: dict, data: str) -> list[Jogo]:
    lookup = build_lookup(clubs)
    clubs_by_id = {c["id"]: c for c in clubs}
    out = []
    for m in matches:
        if m.get("date") != data:
            continue
        stadium = stadiums.get(m.get("stadiumId"), {})
        city = cities.get(stadium.get("cityId"), {})
        out.append(
            Jogo(
                date=data,
                time=m.get("time") or "--:--",
                home=clubs_by_id.get(m["homeClubId"], {}).get("shortName", m["homeClubId"]),
                away=clubs_by_id.get(m["awayClubId"], {}).get("shortName", m["awayClubId"]),
                competicao=m.get("competitionId", ""),
                local=f"{stadium.get('name', '')} — {city.get('name', '')}".strip(" —"),
                fonte="urano",
                home_id=resolve_club_id(m["homeClubId"], lookup),
                away_id=resolve_club_id(m["awayClubId"], lookup),
            )
        )
    return out


def jogos_do_gmail(jogos_cbf: list[dict], clubs: list[dict], data: str) -> list[Jogo]:
    """jogos_cbf: lista já extraída de tabela/IMT da CBF, cada item com
    date/time/home/away/competicao/local (nomes como aparecem no PDF, ex.
    "CSE/AL") — vem de fora (parsers de e-mail), não é lido daqui."""
    lookup = build_lookup(clubs)
    out = []
    for j in jogos_cbf:
        if j.get("date") != data:
            continue
        out.append(
            Jogo(
                date=data,
                time=j.get("time") or "--:--",
                home=j["home"],
                away=j["away"],
                competicao=j.get("competicao", ""),
                local=j.get("local", ""),
                fonte="gmail",
                home_id=resolve_club_id(j["home"], lookup),
                away_id=resolve_club_id(j["away"], lookup),
            )
        )
    return out


def aplicar_imts(jogos: list[Jogo], modificacoes: list, clubs: list[dict], data_alvo: str) -> list[Jogo]:
    """modificacoes: lista de ModificacaoJogo (parser_imt.parse_imt_texto).
    Casa por par de times (via normalizador) e substitui data/hora/local
    pelo "Para:" do IMT. Um jogo cuja data nova deixa de ser `data_alvo`
    some da lista; um jogo de fora que passa a cair em `data_alvo` é
    incluído, marcado como alterado."""
    lookup = build_lookup(clubs)
    resultado = list(jogos)
    for mod in modificacoes:
        home_id = resolve_club_id(mod.mandante, lookup)
        away_id = resolve_club_id(mod.visitante, lookup)
        if home_id is None and away_id is None:
            continue  # nenhum dos dois times é reconhecido — não mexe

        # remove o jogo antigo se ele estava na lista de hoje
        resultado = [
            j for j in resultado
            if not (j.home_id == home_id and j.away_id == away_id)
        ]

        nova_data = _extrai_data(mod.para) or _extrai_data(mod.de)
        if nova_data == data_alvo:
            resultado.append(
                Jogo(
                    date=data_alvo,
                    time=_extrai_hora(mod.para) or "--:--",
                    home=mod.mandante,
                    away=mod.visitante,
                    competicao=f"alterado por IMT {mod.imt_ref}",
                    local=mod.para,
                    fonte="gmail-imt",
                    home_id=home_id,
                    away_id=away_id,
                )
            )
    return resultado


def _extrai_data(texto: str) -> str | None:
    import re
    m = re.search(r"(\d{2}/\d{2})(?:/(\d{2,4}))?", texto)
    if not m:
        return None
    dia_mes = m.group(1)
    ano = m.group(2) or "2026"
    if len(ano) == 2:
        ano = "20" + ano
    return f"{dia_mes}/{ano}"


def _extrai_hora(texto: str) -> str | None:
    import re
    m = re.search(r"(\d{1,2})h(\d{2})", texto)
    return f"{m.group(1)}:{m.group(2)}" if m else None


def demo() -> None:
    """ponytail: self-check ponta a ponta com dados sintéticos + o IMT real
    já validado em parser_imt.py."""
    clubs = [
        {"id": "cse", "shortName": "CSE", "fullName": "CSE"},
        {"id": "csa", "shortName": "CSA", "fullName": "CSA"},
    ]
    stadiums, cities = {}, {}

    urano_matches = [
        {"competitionId": "ALAGOANO20A1", "date": "01/09/2026", "time": "15:00",
         "homeClubId": "csa", "awayClubId": "cse", "stadiumId": None},
    ]
    hoje = jogos_do_urano(urano_matches, clubs, stadiums, cities, "01/09/2026")
    assert len(hoje) == 1 and hoje[0].home == "CSA"

    from parser_imt import parse_imt_texto
    texto_imt = """IMT – 02CNE20/26
MODIFICAÇÃO DE TABELA Data
06/08/2026
Jogo 011: Ferroviário/CE x CSE/AL
Modificação: De: 15/08, sábado, em a definir, às 16h00
Para: 17/08, segunda-feira, no estádio Presidente Vargas, às 15h00
Solicitante: Ferroviário/CE
Motivo: Solicitação do clube mandante.
"""
    mods = parse_imt_texto(texto_imt)
    # jogo movido PARA 17/08 — se eu pedir a lista de 17/08, tem que aparecer
    resultado_17 = aplicar_imts([], mods, clubs, "17/08/2026")
    assert len(resultado_17) == 1
    assert resultado_17[0].away == "CSE/AL"
    assert resultado_17[0].fonte == "gmail-imt"
    # se eu pedir 15/08 (data antiga), não aparece mais
    resultado_15 = aplicar_imts([], mods, clubs, "15/08/2026")
    assert len(resultado_15) == 0

    print("ok — merge Urano + Gmail/IMT bate no dia certo e some no dia errado")


if __name__ == "__main__":
    demo()
