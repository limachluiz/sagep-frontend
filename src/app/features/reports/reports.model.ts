export type ReportDocumentFormat = 'html' | 'pdf' | 'xlsx';

export interface ReportActionState {
  loading: boolean;
  error: string;
}

export interface ProjectDossierRequest {
  projectIdentifier: string;
  format: Extract<ReportDocumentFormat, 'html' | 'pdf'>;
}
