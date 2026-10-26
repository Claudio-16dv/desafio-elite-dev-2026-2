import { Fingerprint, Radio, Wallet } from 'lucide-react';

const POINTS = [
  { icon: Radio, title: 'Ao vivo de verdade', text: 'Lances chegam na hora, sem recarregar a página.' },
  { icon: Wallet, title: 'Saldo transparente', text: 'Veja o que está disponível e o que está reservado nos seus lances.' },
  { icon: Fingerprint, title: 'Auditável', text: 'Qualquer pessoa confere se o histórico de um lote foi alterado.' },
];

/** Moldura das telas de login e cadastro: painel artístico à esquerda e o formulário à direita. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid items-stretch gap-6 lg:grid-cols-2">
      <aside className="dark relative isolate hidden overflow-hidden rounded-[2rem] border border-white/10 bg-[oklch(0.2_0.008_60)] p-10 text-foreground lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute -top-20 -left-16 size-80 animate-aurora rounded-full bg-brand-3/15 blur-[100px]" />
          <div className="absolute -right-16 -bottom-24 size-80 animate-aurora rounded-full bg-brand-2/10 blur-[100px] [animation-delay:-8s]" />
          <div className="bg-grain absolute inset-0 opacity-[0.12] mix-blend-overlay" />
        </div>
        <p className="font-display text-4xl leading-tight font-semibold">
          A sala de leilões
          <br />
          <span className="text-brand italic">cabe no seu navegador.</span>
        </p>
        <ul className="space-y-5">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Icon className="size-5 text-brand-3" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex items-center justify-center py-4 lg:py-10">{children}</div>
    </div>
  );
}
