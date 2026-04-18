import { useMemo } from "react";

export function useChat() {
  return useMemo(
    () => ({
      endpoint: "/api/chat",
    }),
    [],
  );
}
