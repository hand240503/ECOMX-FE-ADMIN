import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { authService } from '../api/services';
import type { ApiResponse } from '../api/types/common.types';
import { t } from '../utils/i18n';
import { detectInputType, validateEmailOrPhone, validatePassword } from '../utils/validate';
import { useRouteLoadingNavigation } from '../app/loading/useRouteLoadingNavigation';

export const useLogin = () => {
  const { navigateWithLoading } = useRouteLoadingNavigation();
  const location = useLocation();

  const locationState = location.state as { message?: string; email?: string; from?: string } | null;
  const from = locationState?.from || '/admin';

  const [login, setLogin] = useState(locationState?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('password');
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [apiError, setApiError] = useState('');

  const inputType = detectInputType(login);

  useEffect(() => {
    if (locationState?.message) {
      window.history.replaceState({}, document.title);
    }
  }, [locationState]);

  const getPlaceholder = () => {
    if (!login) return t('login_placeholder_default');
    switch (inputType) {
      case 'email':
        return t('login_placeholder_email');
      case 'phone':
        return t('login_placeholder_phone');
      case 'username':
        return t('login_placeholder_username');
      default:
        return t('login_placeholder_default');
    }
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLogin(e.target.value);
    if (emailError) setEmailError('');
    if (apiError) setApiError('');
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError('');
    if (apiError) setApiError('');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const validateForm = (): boolean => {
    const emailValidationError = validateEmailOrPhone(login);
    const passwordValidationError = validatePassword(password);

    if (emailValidationError) setEmailError(emailValidationError);
    if (passwordValidationError) setPasswordError(passwordValidationError);

    return !emailValidationError && !passwordValidationError;
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');
    setApiError('');
    if (!validateForm()) return;

    setLoading(true);
    try {
      await authService.login({
        login: login.trim(),
        password
      });

      navigateWithLoading(from, { replace: true, delayMs: 300 });
    } catch (error) {
      if (error instanceof AxiosError) {
        const apiResponse = error.response?.data as ApiResponse;
        if (apiResponse) {
          setApiError(apiResponse.message || t('login_failed'));
          if (apiResponse.errors && apiResponse.errors.length > 0) {
            apiResponse.errors.forEach((err) => {
              if (err.field === 'login' || err.field === 'email') {
                setEmailError(err.message);
              } else if (err.field === 'password') {
                setPasswordError(err.message);
              }
            });
          }
        } else {
          setApiError(t('common_server_unreachable'));
        }
      } else if (error instanceof Error) {
        setApiError(error.message);
      } else {
        setApiError(t('common_unexpected_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    login,
    password,
    showPassword,
    activeTab,
    loading,
    emailError,
    passwordError,
    apiError,
    inputType,
    getPlaceholder,
    handleEmailChange,
    handlePasswordChange,
    togglePasswordVisibility,
    handleTabChange,
    handleLogin
  };
};
