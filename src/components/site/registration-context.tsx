import { createContext, useContext, useState, type ReactNode } from "react";

import { RegistrationModal } from "./RegistrationModal";

type Ctx = { open: () => void };

const RegistrationContext = createContext<Ctx>({ open: () => {} });

export function useRegistration() {
  return useContext(RegistrationContext);
}

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <RegistrationContext.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <RegistrationModal open={isOpen} onOpenChange={setIsOpen} />
    </RegistrationContext.Provider>
  );
}
