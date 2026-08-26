import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useHashRouter } from './hooks/useHashRouter';
import { AppBootLoader } from './components/Skeleton';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyPage from './pages/VerifyPage';
import Dashboard from './pages/Dashboard';
import CreateJobPage from './pages/CreateJobPage';
import JobWorkspace from './pages/JobWorkspace';

function AppRouter() {
  const { currentPath } = useHashRouter();
  const { isAuthenticated, isLoading } = useAuth();
  
  // Clean path by stripping query params for route matching
  const route = currentPath.split('?')[0];

  if (isLoading) {
    return <AppBootLoader />;
  }

  // Public Routes
  if (!isAuthenticated) {
    if (route === '/login') return <LoginPage />;
    if (route === '/register') return <RegisterPage />;
    if (route === '/verify') return <VerifyPage />;
    return <LandingPage />;
  }

  // Protected Routes
  if (route === '/dashboard') return <Dashboard />;
  if (route === '/jobs/create') return <CreateJobPage />;
  if (route === '/jobs/workspace') return <JobWorkspace />;
  
  // Default for authenticated users
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
