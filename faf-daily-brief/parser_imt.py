"""
Parser de IMT (Informação de Modificação de Tabela) — e-mails que a CBF manda
para as federações quando muda algo num jogo já tabelado (data, hora, local).
Chegam por e-mail em contato@futeboldealagoas.net com um PDF anexado no
padrão abaixo (confirmado com um IMT real — 201 threads históricas na caixa).

Formato real observado (IMT 02CNE20 de 06.08.2026.pdf):

    INFORMAÇÃO DE
    IMT – 02CNE20/26                              Data
    MODIFICAÇÃO DE TABELA                         06/08/2026
    Comunicamos as modificações abaixo assinaladas com relação à tabela
    original da Copa do Nordeste Sub 20:
    Jogo 011: Ferroviário/CE x CSE/AL
    Modificação: De: 15/08, sábado, em a definir, às 16h00
    Para: 17/08, segunda-feira, no estádio Presidente Vargas, às 15h00
    Solicitante: Ferroviário/CE
    Motivo: Solicitação do clube mandante.

Cada modificação também pode vir fatiada em campos "Data:"/"Local:" mantidos
sem "De:"/"Para:" quando só um dos três (data/hora/local) muda.

Regra de negócio: qualquer jogo tocado por um IMT tem que ter prioridade
sobre a tabela original (Urano/matches.ts) — o IMT é sempre mais recente.
"""
import re
from dataclasses import dataclass

BLOCO_RE = re.compile(
    r"Jogo\s+(?P<numero>\S+):\s*(?P<mandante>[^x\n]+?)\s+x\s+(?P<visitante>[^\n]+?)\n"
    r"(?P<corpo>.*?)(?=\nJogo\s+\S+:|\Z)",
    re.DOTALL,
)
DE_PARA_RE = re.compile(r"De:\s*(?P<de>.+?)\nPara:\s*(?P<para>.+?)(?:\n|$)")
SOLICITANTE_RE = re.compile(r"Solicitante:\s*(?P<solicitante>.+)")
MOTIVO_RE = re.compile(r"Motivo:\s*(?P<motivo>.+)")
REFERENCIA_RE = re.compile(r"IMT\s*[–\-]\s*(?P<ref>\S+)")
DATA_DOC_RE = re.compile(r"Data\s*\n?\s*(?P<data>\d{2}/\d{2}/\d{4})")


@dataclass
class ModificacaoJogo:
    imt_ref: str
    imt_data: str
    jogo_numero: str
    mandante: str
    visitante: str
    de: str
    para: str
    solicitante: str
    motivo: str


def parse_imt_texto(texto: str) -> list[ModificacaoJogo]:
    ref_match = REFERENCIA_RE.search(texto)
    data_match = DATA_DOC_RE.search(texto)
    imt_ref = ref_match.group("ref") if ref_match else ""
    imt_data = data_match.group("data") if data_match else ""

    modificacoes = []
    for bloco in BLOCO_RE.finditer(texto):
        corpo = bloco.group("corpo")
        de_para = DE_PARA_RE.search(corpo)
        solicitante = SOLICITANTE_RE.search(corpo)
        motivo = MOTIVO_RE.search(corpo)
        modificacoes.append(
            ModificacaoJogo(
                imt_ref=imt_ref,
                imt_data=imt_data,
                jogo_numero=bloco.group("numero"),
                mandante=bloco.group("mandante").strip(),
                visitante=bloco.group("visitante").strip(),
                de=de_para.group("de").strip() if de_para else "",
                para=de_para.group("para").strip() if de_para else "",
                solicitante=solicitante.group("solicitante").strip() if solicitante else "",
                motivo=motivo.group("motivo").strip() if motivo else "",
            )
        )
    return modificacoes


def demo() -> None:
    """ponytail: self-check com o texto real extraído do IMT 02CNE20."""
    texto = """INFORMAÇÃO DE
IMT – 02CNE20/26
MODIFICAÇÃO DE TABELA Data
06/08/2026
Às Federações e Clubes.
Comunicamos as modificações abaixo assinaladas com relação à tabela original da Copa do Nordeste Sub 20:
Jogo 011: Ferroviário/CE x CSE/AL
Modificação: De: 15/08, sábado, em a definir, às 16h00
Para: 17/08, segunda-feira, no estádio Presidente Vargas, às 15h00
Solicitante: Ferroviário/CE
Motivo: Solicitação do clube mandante.
Jogo 016: Confiança/PB x São Luís/MA
Modificação: De: 16h00
Para: 15h00
Solicitante: Confiança/PB
Motivo:
Solicitação do clube mandante.
"""
    mods = parse_imt_texto(texto)
    assert len(mods) == 2, f"esperava 2 modificações, achou {len(mods)}"
    assert mods[0].imt_ref == "02CNE20/26"
    assert mods[0].imt_data == "06/08/2026"
    assert mods[0].mandante == "Ferroviário/CE"
    assert mods[0].visitante == "CSE/AL"
    assert "17/08" in mods[0].para
    assert mods[1].jogo_numero == "016"
    print(f"ok — {len(mods)} modificações extraídas do IMT {mods[0].imt_ref}")


if __name__ == "__main__":
    demo()
