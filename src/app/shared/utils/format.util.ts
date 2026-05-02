export function formatLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Nao informado';
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getStatusBadgeClasses(status: string | null | undefined): string {
  switch (status) {
    case 'FINALIZADA':
    case 'CONCLUIDO':
    case 'SERVICO_CONCLUIDO':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'RASCUNHO':
    case 'EM_ANDAMENTO':
    case 'SERVICO_EM_EXECUCAO':
    case 'OS_LIBERADA':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'CANCELADA':
    case 'PAUSADO':
    case 'ANALISANDO_AS_BUILT':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'CANCELADO':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

export function formatCurrency(value: unknown): string {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;

  if (Number.isNaN(numericValue)) {
    return 'Nao informado';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numericValue);
}

export function formatDate(value: unknown): string {
  if (!value || typeof value !== 'string') {
    return 'Nao informado';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Nao informado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function buildHumanIdentifier(prefix: string, code: number | null | undefined, dateLike: unknown): string | null {
  if (!code) {
    return null;
  }

  const paddedCode = String(code).padStart(4, '0');

  if (typeof dateLike === 'string' || dateLike instanceof Date) {
    const date = new Date(dateLike);

    if (!Number.isNaN(date.getTime())) {
      return `${prefix}-${date.getFullYear()}-${paddedCode}`;
    }
  }

  return `${prefix}-${paddedCode}`;
}

export function buildProjectIdentifier(projectCode: number | null | undefined, projectId: string, createdAt?: unknown): string {
  return buildHumanIdentifier('PRJ', projectCode, createdAt) ?? projectId;
}

export function extractProjectCodeFromFriendlyIdentifier(identifier: string): string {
  const normalized = identifier.trim().toUpperCase();
  const match = normalized.match(/^PRJ(?:-\d{4})?-(\d+)$/);

  if (match) {
    return match[1];
  }

  return identifier;
}

export function buildEstimateIdentifier(
  estimateCode: number | null | undefined,
  estimateId: string,
  createdAt?: unknown,
): string {
  return buildHumanIdentifier('EST', estimateCode, createdAt) ?? estimateId;
}

export function extractEstimateCodeFromFriendlyIdentifier(identifier: string): string {
  const normalized = identifier.trim().toUpperCase();
  const match = normalized.match(/^EST(?:-\d{4})?-(\d+)$/);

  if (match) {
    return match[1];
  }

  return identifier;
}
