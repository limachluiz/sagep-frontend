const CP1252_BYTE_BY_CODE_POINT = new Map<number, number>([
  [0x20AC, 0x80],
  [0x201A, 0x82],
  [0x0192, 0x83],
  [0x201E, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02C6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8A],
  [0x2039, 0x8B],
  [0x0152, 0x8C],
  [0x017D, 0x8E],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201C, 0x93],
  [0x201D, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02DC, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9A],
  [0x203A, 0x9B],
  [0x0153, 0x9C],
  [0x017E, 0x9E],
  [0x0178, 0x9F],
]);

const MOJIBAKE_PATTERN = /(?:Ã.|Â.|â[\u0080-\u00BF\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178])/;
const MOJIBAKE_MARKERS = /[ÃÂâ]/g;

function cp1252Bytes(value: string): Uint8Array {
  return Uint8Array.from([...value].map((char) => {
    const codePoint = char.codePointAt(0) ?? 0;
    return codePoint <= 0xff ? codePoint : CP1252_BYTE_BY_CODE_POINT.get(codePoint) ?? 0x3f;
  }));
}

function markerCount(value: string): number {
  return value.match(MOJIBAKE_MARKERS)?.length ?? 0;
}

export function formatDisplayText(value: unknown): string {
  if (value == null) {
    return '';
  }

  const text = String(value);

  if (!MOJIBAKE_PATTERN.test(text)) {
    return text;
  }

  const decoded = new TextDecoder('utf-8').decode(cp1252Bytes(text));

  if (decoded.includes('\uFFFD') || markerCount(decoded) >= markerCount(text)) {
    return text;
  }

  return decoded;
}

export function formatLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Não informado';
  }

  return formatDisplayText(value)
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
    return 'Não informado';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numericValue);
}

export function formatDate(value: unknown): string {
  if (!value || typeof value !== 'string') {
    return 'Não informado';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Não informado';
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
