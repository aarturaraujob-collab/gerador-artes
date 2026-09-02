"""
Protótipo: extrai a escalação de árbitros a partir do corpo de e-mails do tipo
"Fwd: Designação de Árbitros Campeonato Alagoano 2026".

Baseado no formato real observado na caixa de entrada:
    Arbitro: RODRIGO JOSE PEREIRA DE LIMA (FIFA-PE)
    Assistente 1: LEILA NAIARA MOREIRA DA CRUZ (FIFA-DF)
    Assistente 2: ...

Isto é um protótipo de regex — o formato real pode variar entre remetentes
(CBF x FAF x diferentes secretários digitando o e-mail), então em produção
o classificador deve sinalizar baixa confiança para revisão manual quando
o padrão não bater.
"""
import re
from dataclasses import dataclass, field


@dataclass
class DesignacaoArbitragem:
    jogo: str | None = None
    data: str | None = None
    arbitro: str | None = None
    federacao_arbitro: str | None = None
    assistentes: list[tuple[str, str]] = field(default_factory=list)
    quarto_arbitro: str | None = None
    var: str | None = None

    @property
    def tem_arbitro_alagoano(self) -> bool:
        # heurística simples: federação "AL" no nome ou entre parênteses
        campos = [self.federacao_arbitro] + [f for _, f in self.assistentes]
        return any(f and "AL" in f.upper() for f in campos)


NOME_FED_RE = re.compile(r"([A-ZÀ-Ú\s]+?)\s*\(([A-Z\-]+)\)")


def parse_designacao(texto: str) -> DesignacaoArbitragem:
    d = DesignacaoArbitragem()

    m = re.search(r"Arbitro:\s*\*?([A-ZÀ-Ú\s]+?)\*?\s*\(([A-Z\-]+)\)", texto, re.IGNORECASE)
    if m:
        d.arbitro = m.group(1).strip().title()
        d.federacao_arbitro = m.group(2).upper()

    for am in re.finditer(
        r"Assistente\s*(\d)\s*:\s*\*?([A-ZÀ-Ú\s]+?)\*?\s*\(([A-Z\-]+)\)", texto, re.IGNORECASE
    ):
        nome = am.group(2).strip().title()
        fed = am.group(3).upper()
        d.assistentes.append((nome, fed))

    jm = re.search(r"Jogo:\s*(.+)", texto)
    if jm:
        d.jogo = jm.group(1).strip()

    return d


if __name__ == "__main__":
    # Exemplo real capturado no e-mail "Fwd: Designação de Árbitros Campeonato Alagoano 2026"
    exemplo = (
        "Jogo: CSA x CRB - AL\n"
        "Arbitro: *RODRIGO JOSE PEREIRA DE LIMA (FIFA-PE)*\n"
        "Assistente 1: *LEILA NAIARA MOREIRA DA CRUZ (FIFA-DF)*\n"
        "Assistente 2: *NOME EXEMPLO (AL)*\n"
    )
    resultado = parse_designacao(exemplo)
    print(resultado)
    print("Tem árbitro/assistente alagoano?", resultado.tem_arbitro_alagoano)
