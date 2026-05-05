import { Estimate } from '../../features/estimates/estimate.model';
import { Project } from './project.model';

export interface Diex {
  id: string;
  diexCode?: number | null;
  code?: number | null;
  diexNumber?: string | null;
  number?: string | null;
  projectId?: string | null;
  projectCode?: number | null;
  estimateId?: string | null;
  estimateCode?: number | null;
  status?: string | null;
  issuedAt?: string | null;
  supplierCnpj?: string | null;
  requesterName?: string | null;
  requesterRank?: string | null;
  requesterCpf?: string | null;
  requesterRole?: string | null;
  issuingOrganization?: string | null;
  commandName?: string | null;
  pregaoNumber?: string | null;
  uasg?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  project?: Partial<Project> | null;
  estimate?: Partial<Estimate> | null;
}

export interface DiexCreatePayload {
  projectId?: string;
  projectCode?: number;
  estimateId?: string;
  estimateCode?: number;
  diexNumber?: string;
  supplierCnpj: string;
  requesterName?: string;
  requesterRank?: string;
  requesterCpf?: string;
  notes?: string;
}
