export interface DepartmentMember {
  user_id: number;
  username: string;
  full_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  /** LEADER hoặc MEMBER */
  position?: string | null;
  assigned_by?: string | null;
}

export interface DepartmentDto {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  status: number;
  permission_codes: number[];
  member_count?: number;
  leader_name?: string | null;
  members?: DepartmentMember[];
  created_date?: string;
  modified_date?: string;
}

export interface CreateDepartmentBody {
  name: string;
  description?: string | null;
  color?: string | null;
  permissionCodes: number[];
}
