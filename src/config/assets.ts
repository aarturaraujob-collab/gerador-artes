export interface AssetItem {
  name: string;
  path: string;
}

export interface AssetCategory {
  id: string;
  label: string;
  folder: string;
  items: AssetItem[];
}

function fromFolder(folder: string, files: string[]): AssetItem[] {
  return files.map((file) => ({ name: file, path: `/assets/${folder}/${file}` }));
}

/**
 * Reflects what's actually on disk under public/assets/ today. There's no
 * upload flow that writes new files there yet (uploads in the app go into
 * IndexedDB as data URIs), so this static list won't drift silently —
 * adding a real asset-upload pipeline later is the natural next step.
 */
export const assetCategories: AssetCategory[] = [
  {
    id: "escudos",
    label: "Escudos",
    folder: "escudos",
    items: fromFolder("escudos", [
      "agrimaq.png", "alianca.png", "asa.png", "atletico_sao_jose.png", "canoense.png",
      "cap_paulo_jacinto.png", "chute_inicial.png", "coruripe.png", "crb.png",
      "cruzeiro_alagoano.png", "csa.png", "cse.png", "dimensao_saude.png", "dzm.png",
      "ff_sport.png", "guarani_paripueira.png", "ind_atalaia.png", "inter_arabia.png",
      "jacioba.png", "m10.png", "maceio_ec.png", "miguelense.png", "murici.png",
      "penedense.png", "ponte_preta.png", "santa_cruz.png", "sao_domingos.png",
      "sporting.png", "uda.png", "unec.png", "zumbi.png",
    ]),
  },
  {
    id: "backgrounds",
    label: "Backgrounds",
    folder: "backgrounds",
    items: fromFolder("backgrounds", [
      "bg_default.png", "bg_thumbnail.png", "bg_thumbnail_20a1.png", "bg_thumbnail_20a2.png",
    ]),
  },
  {
    id: "logos",
    label: "Logos",
    folder: "logos",
    items: fromFolder("logos", ["faf.png", "alagoano_sub20_a1.png", "alagoano_sub20_a2.png"]),
  },
  { id: "patrocinadores", label: "Patrocinadores", folder: "patrocinadores", items: [] },
  { id: "fontes", label: "Fontes", folder: "fontes", items: [] },
  { id: "icones", label: "Ícones", folder: "icones", items: [] },
  { id: "videos", label: "Vídeos", folder: "videos", items: [] },
  { id: "audios", label: "Áudios", folder: "audios", items: [] },
];
