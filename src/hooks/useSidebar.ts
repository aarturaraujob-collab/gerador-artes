import { useState } from "react";

export function useSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = () => {
    setCollapsed((value) => !value);
  };

  return {
    collapsed,
    toggle,
  };
}