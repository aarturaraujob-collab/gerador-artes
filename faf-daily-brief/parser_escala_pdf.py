"""
Protótipo: extrai a escalação de árbitros a partir dos PDFs oficiais da CBF
("CA - Escala de Árbitros - <competição>"), formato observado em:
"Escalas_CNE SUB-20_2ª Fase_Dia_29.08.pdf"

Layout real do PDF (por jogo, um bloco se repete várias vezes na página):

    CONFEDERAÇÃO BRASILEIRA DE FUTEBOL
    CA - Escala de Árbitros - Copa do Nordeste - Sub-20

    INFORMAÇÕES DA PARTIDA
    Jogo:          Fortaleza SAF - CE x Santa Cruz - PE
    Data/Local:    29/08/2026 15:00 - CT Ribamar Bezerra - Maracanaú/CE
    Fase/Rodada/Nº Jogo: 2ª Fase / 01 / 25

    FUNÇÃO / NOME                              UF   CATEGORIA   TRANSPORTE
    Arbitro - Ezequias Da Silva Santos         CE   ASPIRANTE   Terrestre
    Arbitro Assistente 1 - Zaqueu ...          CE   AB          Terrestre
    Arbitro Assistente 2 - Camila ...          CE   CD          Terrestre
    Quarto Arbitro - Leandro ...               CE   BAS         Terrestre
    Analista de Campo - Francisco ...          CE   CBF         Terrestre

Estratégia: extrair texto do PDF com pdfplumber (mantém a ordem das linhas
das tabelas) e usar regex por bloco delimitado pelos separadores "-------".

Requer: pip install pdfplumber --break-system-packages
"""
import re
from dataclasses import dataclass, field


@dataclass
class OficialEscalado:
    funcao: str
    nome: str
    uf: str
    categoria: str
    transporte: str

    @property
    def eh_de_alagoas(self) -> bool:
        return self.uf.upper() == "AL"


@dataclass
class PartidaEscalada:
    competicao: str | None = None
    jogo: str | None = None
    data_local: str | None = None
    fase: str | None = None
    oficiais: list[OficialEscalado] = field(default_factory=list)

    @property
    def tem_oficial_alagoano(self) -> bool:
        return any(o.eh_de_alagoas for o in self.oficiais)


BLOCO_RE = re.compile(
    r"CA\s*-\s*Escala de Arbitros\s*-\s*(.+?)\n.*?"
    r"Jogo:\s*(.+?)\n"
    r"Data/Local:\s*(.+?)\n"
    r"Fase\s*/\s*Rodada\s*/\s*N[ºo]\s*Jogo:\s*(.+?)\n",
    re.IGNORECASE | re.DOTALL,
)

LINHA_OFICIAL_RE = re.compile(
    r"(Arbitro(?:\s+Assistente\s+\d)?|Quarto Arbitro|Analista de Campo)\s*-\s*"
    r"([A-Za-zÀ-ú\s]+?)\s+([A-Z]{2})\s+([A-Z]+)\s+(Terrestre|Aéreo|Aereo)",
)


def parse_pdf_texto(texto_pdf: str) -> list[PartidaEscalada]:
    """texto_pdf = texto bruto extraído do PDF (ex: via pdfplumber .extract_text())"""
    partidas = []
    # separa por blocos de partida usando "INFORMAÇÕES DA PARTIDA" como âncora
    blocos = re.split(r"INFORMA[ÇC][ÕO]ES DA PARTIDA", texto_pdf)[1:]
    competicao_m = re.search(r"CA\s*-\s*Escala de [ÁA]rbitros\s*-\s*(.+)", texto_pdf)
    competicao = competicao_m.group(1).strip() if competicao_m else None

    for bloco in blocos:
        p = PartidaEscalada(competicao=competicao)

        jm = re.search(r"Jogo:\s*(.+)", bloco)
        if jm:
            p.jogo = jm.group(1).strip()

        dm = re.search(r"Data/Local:\s*(.+)", bloco)
        if dm:
            p.data_local = dm.group(1).strip()

        fm = re.search(r"Fase\s*/\s*Rodada\s*/\s*N[ºo]\s*Jogo:\s*(.+)", bloco)
        if fm:
            p.fase = fm.group(1).strip()

        for om in LINHA_OFICIAL_RE.finditer(bloco):
            p.oficiais.append(
                OficialEscalado(
                    funcao=om.group(1).strip(),
                    nome=om.group(2).strip(),
                    uf=om.group(3).strip(),
                    categoria=om.group(4).strip(),
                    transporte=om.group(5).strip(),
                )
            )

        if p.jogo:
            partidas.append(p)

    return partidas


def extrair_texto_pdf(caminho_pdf: str) -> str:
    """Wrapper fino sobre pdfplumber — mantido separado para facilitar troca
    de biblioteca (ex: pypdf, pdfminer) sem mexer no parser."""
    import pdfplumber

    texto = []
    with pdfplumber.open(caminho_pdf) as pdf:
        for pagina in pdf.pages:
            texto.append(pagina.extract_text() or "")
    return "\n".join(texto)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        texto = extrair_texto_pdf(sys.argv[1])
    else:
        # Texto de exemplo baseado exatamente no PDF real visto na caixa de entrada
        texto = """
CONFEDERAÇÃO BRASILEIRA DE FUTEBOL
CA - Escala de Arbitros - Copa do Nordeste - Sub-20

INFORMAÇÕES DA PARTIDA
Jogo: Fortaleza SAF - CE x Santa Cruz - PE
Data/Local: 29/08/2026 15:00 - CT Ribamar Bezerra - Maracanaú/CE
Fase / Rodada / Nº Jogo: 2ª Fase / 01 / 25

FUNÇÃO / NOME UF CATEGORIA TRANSPORTE
Arbitro - Ezequias Da Silva Santos CE ASPIRANTE Terrestre
Arbitro Assistente 1 - Zaqueu Eleuterio Linhares CE AB Terrestre
Arbitro Assistente 2 - Camila Ferreira de Sousa CE CD Terrestre
Quarto Arbitro - Leandro Martins Marques CE BAS Terrestre
Analista de Campo - Francisco de Assis Almeida Filho CE CBF Terrestre
"""

    partidas = parse_pdf_texto(texto)
    for p in partidas:
        print(f"{p.jogo} — {p.data_local} ({p.fase})")
        for o in p.oficiais:
            marca = " [AL]" if o.eh_de_alagoas else ""
            print(f"   {o.funcao}: {o.nome} ({o.uf}/{o.categoria}){marca}")
        print("Tem oficial alagoano?", p.tem_oficial_alagoano)
