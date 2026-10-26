import { Fingerprint, Gavel, Radio } from 'lucide-react';
import { BrandMark } from './brand-mark';

const PILLARS = [
  { icon: Radio, text: 'Lances ao vivo, sem recarregar' },
  { icon: Fingerprint, text: 'Histórico auditável por qualquer pessoa' },
  { icon: Gavel, text: 'Acervo do Cleveland Museum of Art' },
];

export function AppFooter() {
  return (
    <footer className="mx-auto mt-10 w-full max-w-7xl px-4 pb-10">
      <div className="flex flex-col gap-6 border-t pt-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="font-display text-lg font-semibold">Casa de Leilões</p>
            <p className="text-xs text-muted-foreground">Desafio Elite Dev (Verzel). Saldos e pagamentos são simulados.</p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {PILLARS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2">
              <Icon className="size-4 text-primary" aria-hidden /> {text}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
