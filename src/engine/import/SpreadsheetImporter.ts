import * as XLSX from "xlsx";
import { clubs } from "@/data/clubs";

export interface GameData {
  homeId: string;
  awayId: string;
  dia: string;
  data: string;
  mes: string;
  hora: string;
  cidade: string;
  estadio: string;
}

// ---------------------------------------------------------------------------
// Mapeamento flexível de nomes de coluna → campo do GameData
// ---------------------------------------------------------------------------

const COLUMN_MAP: Record<string, keyof GameData> = {
  // mandante
  mandante: "homeId",
  home: "homeId",
  casa: "homeId",
  clube_mandante: "homeId",
  clube_casa: "homeId",
  time_mandante: "homeId",
  time_casa: "homeId",

  // visitante
  visitante: "awayId",
  away: "awayId",
  fora: "awayId",
  clube_visitante: "awayId",
  clube_fora: "awayId",
  time_visitante: "awayId",
  time_fora: "awayId",

  // dia da semana
  dia: "dia",
  dia_semana: "dia",
  day: "dia",

  // data numérica
  data: "data",
  date: "data",
  numero: "data",

  // mês
  mes: "mes",
  month: "mes",

  // hora
  hora: "hora",
  horario: "hora",
  time: "hora",

  // cidade
  cidade: "cidade",
  city: "cidade",
  local: "cidade",

  // estádio
  estadio: "estadio",
  stadium: "estadio",
  praca: "estadio",
};

/**
 * Normaliza texto para comparação:
 * "Dia da Semana" → "dia_da_semana"
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // remove acentos
    .replace(/[^a-z0-9]+/g, "_")       // espaços/pontuação → _
    .replace(/^_|_$/g, "");
}

/**
 * Tenta resolver um nome de clube (texto livre) para o `id` registrado em
 * `clubs.ts`. Busca por: id exato, shortName, name (case-insensitive,
 * sem acento).
 */
function resolveClubId(raw: string): string {
  const n = normalize(raw);
  // 1. id exato
  const byId = clubs.find((c) => c.id === n || normalize(c.id) === n);
  if (byId) return byId.id;
  // 2. shortName
  const byShort = clubs.find((c) => normalize(c.shortName) === n);
  if (byShort) return byShort.id;
  // 3. name (contém)
  const byName = clubs.find((c) => normalize(c.name).includes(n) || n.includes(normalize(c.name)));
  if (byName) return byName.id;
  // 4. não encontrou — devolve o texto cru (o form vai exibir "Selecione..." e o
  //    usuário corrige manualmente)
  return "";
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

export interface ImportResult {
  games: GameData[];
  warnings: string[];
}

/**
 * Lê um File (CSV ou XLSX) e retorna uma lista de GameData prontos para o
 * formulário.
 */
export async function importSpreadsheet(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  // Usa primeira aba
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    return { games: [], warnings: ["A planilha está vazia."] };
  }

  // Mapear headers
  const sampleHeaders = Object.keys(rows[0]);
  const headerMap: Record<string, keyof GameData> = {};
  const unmapped: string[] = [];

  for (const h of sampleHeaders) {
    const key = normalize(h);
    if (COLUMN_MAP[key]) {
      headerMap[h] = COLUMN_MAP[key];
    } else {
      unmapped.push(h);
    }
  }

  const warnings: string[] = [];
  if (unmapped.length > 0) {
    warnings.push(`Colunas ignoradas (não reconhecidas): ${unmapped.join(", ")}`);
  }

  const games: GameData[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const game: GameData = {
      homeId: "",
      awayId: "",
      dia: "",
      data: "",
      mes: "",
      hora: "",
      cidade: "",
      estadio: "",
    };

    for (const [header, field] of Object.entries(headerMap)) {
      const val = String(row[header] ?? "").trim();
      if (!val) continue;

      if (field === "homeId" || field === "awayId") {
        game[field] = resolveClubId(val);
        if (!game[field]) {
          warnings.push(`Linha ${i + 2}: clube "${val}" não encontrado.`);
        }
      } else if (field === "dia") {
        // Aceita "Sáb", "SAB", "SÁB", "Sábado" → "SÁB"
        const dayMap: Record<string, string> = {
          seg: "SEG", segunda: "SEG",
          ter: "TER", terca: "TER",
          qua: "QUA", quarta: "QUA",
          qui: "QUI", quinta: "QUI",
          sex: "SEX", sexta: "SEX",
          sab: "SÁB", sabado: "SÁB",
          dom: "DOM", domingo: "DOM",
        };
        game.dia = dayMap[normalize(val)] ?? val.toUpperCase().slice(0, 3);
      } else if (field === "mes") {
        // Aceita "Jul", "JUL", "Julho", "07" → "JUL"
        const monthNames = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
        const num = parseInt(val, 10);
        if (num >= 1 && num <= 12) {
          game.mes = monthNames[num - 1];
        } else {
          const n = normalize(val).slice(0, 3);
          const monthMap: Record<string, string> = {
            jan: "JAN", fev: "FEV", mar: "MAR", abr: "ABR",
            mai: "MAI", jun: "JUN", jul: "JUL", ago: "AGO",
            set: "SET", out: "OUT", nov: "NOV", dez: "DEZ",
          };
          game.mes = monthMap[n] ?? val.toUpperCase().slice(0, 3);
        }
      } else {
        game[field] = val;
      }
    }

    games.push(game);
  }

  if (games.length === 0) {
    warnings.push("Nenhum jogo encontrado na planilha.");
  }

  return { games, warnings };
}
