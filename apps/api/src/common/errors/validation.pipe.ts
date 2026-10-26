import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { DomainException } from './domain.exception';

function flatten(errors: ValidationError[], parent = ''): Array<{ field: string; messages: string[] }> {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/**
 * ValidationPipe global: rejeita campos desconhecidos, converte tipos e devolve erros
 * no mesmo formato do restante da API: `{ code: 'VALIDATION_ERROR', message, details.fields }`.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const fields = flatten(errors);
      const first = fields[0]?.messages[0] ?? 'Dados inválidos.';
      return new DomainException('VALIDATION_ERROR', first, HttpStatus.BAD_REQUEST, { fields });
    },
  });
}
