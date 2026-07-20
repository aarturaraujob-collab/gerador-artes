import React, { useState } from "react";
import { refreshAll } from "../modules/dataStore";

interface Props {
  onUpdated?: () => void;
}

export default function ImportPanel({ onUpdated }: Props) {
  const [working, setWorking] = useState(false);

  async function handleRefresh() {
    setWorking(true);
    try {
      await refreshAll();
      if (onUpdated) onUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="import-panel">
      <p>Para atualizar o banco a partir de uma planilha, execute no terminal:</p>
      <pre>npm run import:faf</pre>
      <p>Depois de concluído, clique em:</p>
      <button onClick={handleRefresh} disabled={working}>{working ? "Atualizando..." : "Atualizar banco"}</button>
    </div>
  );
}
