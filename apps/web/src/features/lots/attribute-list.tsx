import type { ItemAttribute } from '@/types/api';

/** Lista de atributos do item (artista, técnica, dimensões...). */
export function AttributeList({ attributes }: { attributes: ItemAttribute[] }) {
  if (attributes.length === 0) return null;
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {attributes.map((attribute) => (
        <div key={attribute.label} className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{attribute.label}</dt>
          <dd className="break-words">{attribute.value}</dd>
        </div>
      ))}
    </dl>
  );
}
