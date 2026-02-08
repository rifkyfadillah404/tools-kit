import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from './components/layout';
import { LoginPage, RegisterPage } from './pages/auth';
import { DashboardPage } from './pages/dashboard';
import { ToolsPage, CategoriesPage } from './pages/tools';
import { LoanRequestsPage, LoansPage } from './pages/loans';
import { ReportsPage } from './pages/reports';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user } = useAuthStore();

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { initializeTheme } = useUIStore();

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route
              path="/categories"
              element={
                <ProtectedRoute roles={['admin']}>
                  <CategoriesPage />
                </ProtectedRoute>
              }
            />
            <Route path="/peminjaman" element={<LoanRequestsPage />} />
            <Route
              path="/loans"
              element={
                <ProtectedRoute roles={['admin', 'petugas']}>
                  <LoansPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute roles={['admin', 'petugas']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
