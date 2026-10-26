import { Role } from '@prisma/client';

/** Senha das contas de demonstração (documentada no README). NUNCA use em produção real. */
export const DEMO_PASSWORD = 'senha123';

export interface DemoAccount {
  key: 'seller' | 'bidder1' | 'bidder2';
  name: string;
  email: string;
  role: Role;
  /** Saldo inicial (centavos) via depósito simulado. */
  initialBalanceCents: number;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: 'seller',
    name: 'Casa Leiloeira Demo',
    email: 'leiloeiro@leilao.dev',
    role: 'AUCTIONEER',
    initialBalanceCents: 0,
  },
  {
    key: 'bidder1',
    name: 'Ana Licitante',
    email: 'licitante1@leilao.dev',
    role: 'BIDDER',
    initialBalanceCents: 10_000_000, // R$ 100.000,00
  },
  {
    key: 'bidder2',
    name: 'Bruno Licitante',
    email: 'licitante2@leilao.dev',
    role: 'BIDDER',
    initialBalanceCents: 10_000_000, // R$ 100.000,00
  },
];
