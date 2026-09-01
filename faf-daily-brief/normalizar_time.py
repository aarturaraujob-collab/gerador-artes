"""
Casa o nome de um clube como aparece nos documentos da CBF (ex.: "CSE/AL",
"Ferroviário/CE", "Santa Cruz-PE") com o id usado no Urano (tables/clubs.ts,
ex.: "cse", "santa-cruz"). Sem isso não dá pra cruzar um IMT/tabela da CBF
com o jogo correspondente no calendário do Urano.
"""
import re
import unicodedata


def _normaliza(texto: str) -> str:
    """minúsculo, sem acento, sem sufixo de UF, só letras/números."""
    texto = texto.split("/")[0].split("-")[0] if re.search(r"[/-][A-Z]{2}$", texto) else texto
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", texto.lower())


def build_lookup(clubs: list[dict]) -> dict[str, str]:
    """Mapa normalizado(shortName|fullName|id) -> id do clube."""
    lookup = {}
    for club in clubs:
        for chave in (club["id"], club["shortName"], club["fullName"]):
            lookup[_normaliza(chave)] = club["id"]
    return lookup


def resolve_club_id(nome: str, lookup: dict[str, str]) -> str | None:
    """Retorna o id do clube no Urano para um nome como aparece num
    documento da CBF, ou None se não achar (não inventa)."""
    return lookup.get(_normaliza(nome))


def demo() -> None:
    """ponytail: self-check com nomes reais vistos nos PDFs da CBF."""
    clubs = [
        {"id": "cse", "shortName": "CSE", "fullName": "CSE"},
        {"id": "csa", "shortName": "CSA", "fullName": "CSA"},
        {"id": "santa-cruz", "shortName": "Santa Cruz", "fullName": "Santa Cruz"},
    ]
    lookup = build_lookup(clubs)
    assert resolve_club_id("CSE/AL", lookup) == "cse"
    assert resolve_club_id("Santa Cruz-PE", lookup) == "santa-cruz"
    assert resolve_club_id("CSA", lookup) == "csa"
    assert resolve_club_id("Time Inexistente/XX", lookup) is None
    print("ok — normalizador resolve nomes reais de CBF para ids do Urano")


if __name__ == "__main__":
    demo()
