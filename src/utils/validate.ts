import { t } from './i18n';

const format = (key: string, params: Record<string, string | number> = {}): string => {
  let message = t(key);
  Object.entries(params).forEach(([param, value]) => {
    message = message.replace(`{${param}}`, String(value));
  });
  return message;
};

export const validateEmail = (email: string): string => {
  if (!email) return t('validation_email_required');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return t('validation_email_invalid');

  return '';
};

export const validatePassword = (password: string, minLength: number = 6): string => {
  if (!password) return t('validation_password_required');

  if (password.length < minLength) {
    return format('validation_password_min', { min: minLength });
  }

  return '';
};

export const validateVerificationCode = (code: string, length: number = 6): string => {
  if (!code) return t('validation_otp_required');

  if (code.length !== length) {
    return format('validation_otp_length', { length });
  }

  const codeRegex = /^\d+$/;
  if (!codeRegex.test(code)) {
    return t('validation_otp_numeric');
  }

  return '';
};

export const validatePhone = (phone: string): string => {
  if (!phone) return t('validation_phone_required');

  const phoneRegex = /^0\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return t('validation_phone_invalid');
  }

  return '';
};

export const validateUsername = (username: string, minLength: number = 3, maxLength: number = 20): string => {
  if (!username) return t('validation_username_required');

  if (username.length < minLength) {
    return format('validation_username_min', { min: minLength });
  }

  if (username.length > maxLength) {
    return format('validation_username_max', { max: maxLength });
  }

  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return t('validation_username_format');
  }

  return '';
};

export const validateConfirmPassword = (password: string, confirmPassword: string): string => {
  if (!confirmPassword) return t('validation_confirm_password_required');

  if (password !== confirmPassword) {
    return t('validation_confirm_password_mismatch');
  }

  return '';
};

export const validateRequired = (value: string, fieldName: string = t('validation_field_default')): string => {
  if (!value || value.trim() === '') {
    return format('validation_required', { field: fieldName });
  }

  return '';
};

export const validateLength = (
  value: string,
  minLength: number,
  maxLength: number,
  fieldName: string = t('validation_field_default')
): string => {
  if (value.length < minLength) {
    return format('validation_length_min', { field: fieldName, min: minLength });
  }

  if (value.length > maxLength) {
    return format('validation_length_max', { field: fieldName, max: maxLength });
  }

  return '';
};

export const validateEmailOrPhone = (value: string): string => {
  if (!value) return t('validation_login_required');

  const trimmedValue = value.trim();

  if (/^\d+$/.test(trimmedValue)) {
    if (trimmedValue.length === 10 && trimmedValue.startsWith('0')) {
      return validatePhone(trimmedValue);
    }
    if (trimmedValue.length < 10) {
      return t('validation_phone_length_10');
    }
    if (trimmedValue.length > 10) {
      return t('validation_phone_invalid_short');
    }
    return t('validation_phone_must_start_zero');
  }

  if (trimmedValue.includes('@')) {
    return validateEmail(trimmedValue);
  }

  if (trimmedValue.length < 3) {
    return t('validation_username_min_3');
  }

  if (trimmedValue.length > 50) {
    return t('validation_username_max_50');
  }

  const usernameRegex = /^[a-zA-Z0-9_.]+$/;
  if (!usernameRegex.test(trimmedValue)) {
    return t('validation_username_format_extended');
  }

  return '';
};

export const detectInputType = (value: string): 'email' | 'phone' | 'username' | 'unknown' => {
  if (!value) return 'unknown';

  const trimmedValue = value.trim();

  if (/^\d+$/.test(trimmedValue)) {
    return 'phone';
  }

  if (trimmedValue.includes('@')) {
    return 'email';
  }

  if (/^[a-zA-Z0-9_.]+$/.test(trimmedValue) && trimmedValue.length >= 3) {
    return 'username';
  }

  return 'unknown';
};

export const validateFullName = (fullName: string): string => {
  if (!fullName) return t('validation_full_name_required');

  if (fullName.trim().length < 2) {
    return t('validation_full_name_min_2');
  }

  const nameRegex = /^[a-zA-ZÀ-ỹ\s]+$/;
  if (!nameRegex.test(fullName)) {
    return t('validation_full_name_format');
  }

  return '';
};

export const validateCheckbox = (isChecked: boolean, message: string = t('validation_checkbox_required')): string => {
  if (!isChecked) return message;
  return '';
};
