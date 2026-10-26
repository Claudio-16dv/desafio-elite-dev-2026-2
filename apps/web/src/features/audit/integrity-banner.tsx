import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDateTimeLong } from '@/lib/format';
import type { IntegrityReport } from '@/types/api';

/** Resultado da verificação de integridade: íntegro ou adulterado (com os motivos). */
export function IntegrityBanner({ report, subject = 'histórico de lances' }: { report: IntegrityReport; subject?: string }) {
  if (report.valid) {
    return (
      <Alert variant="success">
        <ShieldCheck />
        <AlertTitle>Íntegro: nenhuma adulteração detectada</AlertTitle>
        <AlertDescription>
          <p className="text-foreground">
            O {subject} foi conferido agora ({report.checkedBids} {report.checkedBids === 1 ? 'lance verificado' : 'lances verificados'}) e continua exatamente como foi registrado.
          </p>
          <p className="text-xs text-muted-foreground">Verificado em {formatDateTimeLong(report.checkedAt)}.</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <ShieldAlert />
      <AlertTitle>Adulterado: o {subject} não confere</AlertTitle>
      <AlertDescription>
        <p className="text-foreground">Foram encontradas inconsistências que indicam alteração depois do registro:</p>
        <ul className="list-disc space-y-1 pl-5 text-foreground">
          {report.issues.map((issue, index) => (
            <li key={`${issue.code}-${issue.sequence ?? index}`}>{issue.message}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Verificado em {formatDateTimeLong(report.checkedAt)}.</p>
      </AlertDescription>
    </Alert>
  );
}
