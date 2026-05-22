export interface LoginRequest {
  login: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  verificationCode: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
  deviceId?: string;
}

export interface SendOTPRequest {
  login: string;
}

export interface VerifyOTPRequest {
  login: string;
  otp: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UserInfoDetails {
  fullName: string | null;
  telephone: string | null;
  avatar: string | null;
  managerId: number | null;
  info01: string | null;
  info02: string | null;
  info03: string | null;
  info04: string | null;
}

export interface UserAddress {
  id: number;
  addressLine: string;
  city: string;
  state: string | null;
  country: string;
  zipCode: string | null;
  isDefault: boolean;
  /** @see docs/API_SHIPPING_AND_ORDERS_UPDATE.md §2 */
  addressType?: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceToWarehouseMeters?: number | null;
  shippingFeeVnd?: number | null;
}

/** `POST /users/addresses` — docs/API_user_address.md */
export interface CreateAddressRequest {
  addressLine: string;
  city: string;
  state?: string | null;
  country: string;
  zipCode?: string | null;
  isDefault?: boolean;
}

/** `PUT /users/addresses/{id}` — partial — docs/API_user_address.md */
export interface UpdateAddressRequest {
  addressLine?: string;
  city?: string;
  state?: string | null;
  country?: string;
  zipCode?: string | null;
  isDefault?: boolean;
}

export interface UserInfo {
  id: number;
  username: string | null;
  email: string;
  phoneNumber: string | null;
  status: number;
  type: number | null;
  userInfo: UserInfoDetails;
  roles: string[];
  permissions: string[];
  defaultAddress: UserAddress | null;
}

export interface AuthResponse {
  user_info: UserInfo;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

export type GenderValue = 'male' | 'female' | 'other';

export interface UpdateProfileRequest {
  // Legacy FE field (BE now resolves current user from token)
  id?: number;

  // Common profile fields
  fullName?: string | null;
  telephone?: string | null;
  avatar?: string | null;
  avatarFile?: File | null;
  managerId?: number | null;

  // Flexible info slots (BE-defined meaning)
  info01?: string | null;
  info02?: string | null;
  info03?: string | null;
  info04?: string | null;

  // Optional role assignment
  roleIds?: number[] | null;

  // Present in BE DTO but usually not needed for profile update
  email?: string | null;
  phoneNumber?: string | null;
  status?: number | null;
  type?: number | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangeContactRequest {
  email?: string;
  phoneNumber?: string;
  currentPassword: string;
}

export interface APIResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export type LoginResponse = APIResponse<AuthResponse>;
export type RegisterResponse = APIResponse<AuthResponse>;
export type RefreshTokenResponse = APIResponse<AuthResponse>;
