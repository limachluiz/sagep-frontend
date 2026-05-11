export type ComprasGovAtaType = 'CFTV' | 'FIBRA_OPTICA';

export interface ComprasGovAtaPreviewParams {
  uasg: string;
  numeroPregao: string;
  anoPregao: string;
  numeroAta?: string;
}

export interface ComprasGovAtaImportPayload extends ComprasGovAtaPreviewParams {
  ataType: ComprasGovAtaType;
  coverageGroupId?: string;
  coverageGroupCode?: string;
  coverageGroupName?: string;
  dryRun?: boolean;
}

export interface ComprasGovAtaPreviewItem {
  referenceCode?: string | null;
  description?: string | null;
  unit?: string | null;
  unitPrice?: number | string | null;
  initialQuantity?: number | string | null;
  externalItemId?: string | null;
  externalItemNumber?: string | null;
}

export interface ComprasGovAtaPreview {
  source?: 'COMPRAS_GOV' | string;
  uasg?: string | null;
  numeroPregao?: string | null;
  anoPregao?: string | null;
  ata?: {
    number?: string | null;
    type?: ComprasGovAtaType | string | null;
    vendorName?: string | null;
    managingAgency?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
  } | null;
  coverageGroups?: unknown[];
  items?: ComprasGovAtaPreviewItem[];
  warnings?: string[];
}

export interface ComprasGovAtaImportResponse {
  dryRun?: boolean;
  preview?: ComprasGovAtaPreview;
  imported?: {
    ataId?: string | null;
    coverageGroupId?: string | null;
    coverageGroupCode?: string | null;
    createdItems?: number | null;
    updatedItems?: number | null;
  } | null;
}
