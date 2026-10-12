import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { RegistrationModal } from "./RegistrationModal";

type Ctx = { open: () => void };

const RegistrationContext = createContext<Ctx>({ open: () => {} });

export function useRegistration() {
  return useContext(RegistrationContext);
}

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setIsOpen(nextOpen);
    if (!nextOpen && typeof window !== "undefined" && window.location.hash === "#register") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <RegistrationContext.Provider value={value}>
      {children}
      <RegistrationModal open={isOpen} onOpenChange={handleOpenChange} />
    </RegistrationContext.Provider>
  );
}
