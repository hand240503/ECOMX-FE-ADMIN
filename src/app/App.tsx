import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import AppRoutes from './routes/AppRoutes';
import { AuthProvider } from './auth/AuthProvider';
import { RouteLoadingProvider } from './loading/RouteLoadingProvider';
import '../App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouteLoadingProvider>
            <AppRoutes />
          </RouteLoadingProvider>
        </AuthProvider>
      </QueryClientProvider>
    </>
  );
};

export default App;
