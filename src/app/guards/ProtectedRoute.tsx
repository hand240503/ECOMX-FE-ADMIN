import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import AppLoading from '../../components/AppLoading';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const { status } = useAuth();

  if (status === 'unknown') {
    return (
      <AppLoading
        fullScreen
        title="Dang xac thuc tai khoan"
        subtitle="He thong dang kiem tra phien dang nhap cua ban."
      />
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
