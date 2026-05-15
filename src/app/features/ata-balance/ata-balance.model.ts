export interface AtaBalanceAtaSummary {
  id: string;
  ataCode?: number | null;
  number?: string | null;
  type?: string | null;
  vendorName?: string | null;
  externalLastSyncAt?: string | null;
}

export interface AtaBalanceCoverageGroup {
  id: string;
  code?: string | null;
  name?: string | null;
}

export interface AtaBalanceValues {
  initialQuantity?: string | number | null;
  reservedQuantity?: string | number | null;
  consumedQuantity?: string | number | null;
  availableQuantity?: string | number | null;
  initialAmount?: string | number | null;
  reservedAmount?: string | number | null;
  consumedAmount?: string | number | null;
  availableAmount?: string | number | null;
  lowStock?: boolean | null;
  insufficient?: boolean | null;
  lastMovementAt?: string | null;
}

export interface AtaBalanceMovement {
  id?: string | null;
  type?: string | null;
  movementType?: string | null;
  summary?: string | null;
  description?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  totalPrice?: string | number | null;
  amount?: string | number | null;
  balanceAfter?: string | number | null;
  actorName?: string | null;
  actor?: {
    id?: string | null;
    name?: string | null;
    fullName?: string | null;
  } | null;
  projectCode?: string | number | null;
  projectNumber?: string | null;
  project?: {
    id?: string | null;
    projectCode?: string | number | null;
    title?: string | null;
  } | null;
  estimateCode?: string | number | null;
  estimate?: {
    id?: string | null;
    estimateCode?: string | number | null;
  } | null;
  diexCode?: string | number | null;
  diexNumber?: string | null;
  diex?: {
    id?: string | null;
    diexCode?: string | number | null;
    diexNumber?: string | null;
  } | null;
  serviceOrderCode?: string | number | null;
  serviceOrderNumber?: string | null;
  serviceOrder?: {
    id?: string | null;
    serviceOrderCode?: string | number | null;
    serviceOrderNumber?: string | null;
  } | null;
  createdAt?: string | null;
  occurredAt?: string | null;
  source?: string | null;
  documentNumber?: string | null;
}

export interface AtaBalanceMovementListResponse {
  items: AtaBalanceMovement[];
}

export type ExternalBalanceStatus =
  | 'OK'
  | 'DIVERGENTE'
  | 'CONSUMO_EXTERNO_DETECTADO'
  | 'ADESAO_DETECTADA'
  | 'CONSUMO_GERENCIADORA_DETECTADO'
  | 'CONSUMO_GERENCIADORA_E_ADESAO_DETECTADOS'
  | 'NAO_ENCONTRADO'
  | 'SEM_EMPENHO_REGISTRADO'
  | 'ERRO_CONSULTA_EXTERNA'
  | 'RATE_LIMIT_COMPRAS_GOV'
  | 'DIVERGENT'
  | 'EXTERNAL_CONSUMPTION_DETECTED'
  | 'NOT_FOUND'
  | string;

export type ExternalSyncStatus =
  | 'SINCRONIZADO'
  | 'NAO_SINCRONIZADO'
  | 'RATE_LIMIT_COMPRAS_GOV'
  | 'ERRO_CONSULTA_EXTERNA'
  | 'OK'
  | 'NOT_SYNCED'
  | string;

export interface AtaExternalBalanceValues {
  registeredQuantity?: string | number | null;
  committedQuantity?: string | number | null;
  availableQuantity?: string | number | null;
  commitments?: AtaExternalBalanceCommitment[] | null;
  nonParticipantCommitments?: AtaExternalBalanceCommitment[] | null;
  adhesions?: AtaExternalBalanceCommitment[] | null;
}

export interface AtaExternalAdheringOrganization {
  name?: string | null;
  unit?: string | null;
  unitName?: string | null;
  unidade?: string | null;
  organization?: string | null;
  organizationName?: string | null;
  agency?: string | null;
}

export interface AtaExternalManagedBalance {
  registeredQuantity?: string | number | null;
  contractedQuantity?: string | number | null;
  committedQuantity?: string | number | null;
  pledgedQuantity?: string | number | null;
  availableQuantity?: string | number | null;
  balanceQuantity?: string | number | null;
  unit?: string | null;
  unitName?: string | null;
  unidade?: string | null;
  commitments?: AtaExternalBalanceCommitment[] | null;
}

export interface AtaExternalAdhesionBalance {
  registeredQuantity?: string | number | null;
  contractedQuantity?: string | number | null;
  limitQuantity?: string | number | null;
  approvedQuantity?: string | number | null;
  adhesionApprovedQuantity?: string | number | null;
  committedQuantity?: string | number | null;
  pledgedQuantity?: string | number | null;
  availableQuantity?: string | number | null;
  balanceQuantity?: string | number | null;
  adheringOrganizations?: Array<AtaExternalAdheringOrganization | string> | null;
  organizations?: Array<AtaExternalAdheringOrganization | string> | null;
  units?: Array<AtaExternalAdheringOrganization | string> | null;
  commitments?: AtaExternalBalanceCommitment[] | null;
  adhesions?: AtaExternalBalanceCommitment[] | null;
}

export interface AtaExternalBalancePayload extends AtaExternalBalanceValues {
  managedBalance?: AtaExternalManagedBalance | null;
  adhesionBalance?: AtaExternalAdhesionBalance | null;
  externalUsageStatus?: ExternalBalanceStatus | null;
  syncStatus?: ExternalSyncStatus | null;
  estimatedAmount?: string | number | null;
}

export interface AtaExternalBalanceCommitment {
  commitmentNumber?: string | number | null;
  number?: string | number | null;
  empenhoNumber?: string | number | null;
  numeroEmpenho?: string | number | null;
  affectsManagedBalance?: boolean | null;
  unit?: string | null;
  unitName?: string | null;
  unidade?: string | null;
  supplier?: string | null;
  supplierName?: string | null;
  vendor?: string | null;
  vendorName?: string | null;
  commitmentDate?: string | null;
  date?: string | null;
  empenhoDate?: string | null;
  includedQuantity?: string | number | null;
  quantityIncluded?: string | number | null;
  committedQuantity?: string | number | null;
  quantityCommitted?: string | number | null;
  value?: string | number | null;
  amount?: string | number | null;
  totalValue?: string | number | null;
}

export interface AtaExternalBalanceComparison {
  id?: string | null;
  itemId?: string | null;
  ataItemId?: string | null;
  item?: {
    id?: string | null;
    lastSyncAt?: string | null;
  } | null;
  itemComparison?: {
    lastSyncAt?: string | null;
  } | null;
  ata?: {
    id?: string | null;
    externalLastSyncAt?: string | null;
  } | null;
  localBalance?: string | number | null;
  localAvailableQuantity?: string | number | null;
  availableQuantity?: string | number | null;
  externalBalance?: AtaExternalBalancePayload | AtaExternalBalanceValues | string | number | null;
  externalAvailableQuantity?: string | number | null;
  comprasGovAvailableQuantity?: string | number | null;
  fallbackBalance?: string | number | null;
  fallbackAvailableQuantity?: string | number | null;
  importedQuantity?: string | number | null;
  importedAvailableQuantity?: string | number | null;
  difference?: string | number | null;
  balanceDifference?: string | number | null;
  status?: ExternalBalanceStatus | null;
  syncStatus?: ExternalSyncStatus | null;
  retryAfterSeconds?: number | null;
  warnings?: Array<string | { message?: string | null; detail?: string | null }> | null;
  lastSyncAt?: string | null;
  comparedAt?: string | null;
  externalLastSyncAt?: string | null;
  lastSyncedAt?: string | null;
  syncedAt?: string | null;
  updatedAt?: string | null;
}

export interface AtaExternalBalanceListResponse {
  items?: AtaExternalBalanceComparison[];
  comparisons?: AtaExternalBalanceComparison[];
  comparedAt?: string | null;
  externalLastSyncAt?: string | null;
  lastSyncedAt?: string | null;
  lastSyncAt?: string | null;
  status?: ExternalBalanceStatus | null;
  syncStatus?: ExternalSyncStatus | null;
  retryAfterSeconds?: number | null;
  warnings?: Array<string | { message?: string | null; detail?: string | null }> | null;
  errors?: Array<string | { message?: string | null; detail?: string | null }> | null;
  message?: string | null;
}

export interface AtaRegisterExternalConsumptionPayload {
  quantity: number;
  reason: string;
  source: 'COMPRAS_GOV';
  externalStatus?: string | null;
  externalReference?: string | null;
  commitmentNumber?: string | number | null;
  unit?: string | null;
  notes?: string | null;
}

export interface AtaBalanceItem {
  id: string;
  ataItemCode?: number | null;
  referenceCode?: string | null;
  description?: string | null;
  unit?: string | null;
  unitPrice?: string | number | null;
  initialQuantity?: string | number | null;
  isActive?: boolean | null;
  deletedAt?: string | null;
  ataId?: string | null;
  ataCode?: number | null;
  ataNumber?: string | null;
  ata?: AtaBalanceAtaSummary | null;
  lastSyncAt?: string | null;
  coverageGroupId?: string | null;
  coverageGroup?: AtaBalanceCoverageGroup | null;
  balance?: AtaBalanceValues | null;
  latestExternalBalanceSnapshot?: AtaExternalBalanceComparison | null;
  externalBalanceSnapshot?: AtaExternalBalanceComparison | null;
  balanceComparison?: AtaExternalBalanceComparison | null;
  externalComparison?: AtaExternalBalanceComparison | null;
}

export interface AtaBalanceListResponse {
  items: AtaBalanceItem[];
  meta?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
