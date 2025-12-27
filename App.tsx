import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { BetTable } from './components/BetTable';
import { AddBetForm } from './components/AddBetForm';
import { AiAnalysis } from './components/AiAnalysis';
import { TicketScanner } from './components/TicketScanner';
import { Settings } from './components/Settings';
import { useBets } from './hooks/useBets';
import { useSettings } from './hooks/useSettings';
import { Bet } from './types';
import { FixturesFeed } from './components/LiveFeed';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LanguageProvider } from './contexts/LanguageContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { AuthPage } from './components/Auth';
import { LandingPage } from './components/LandingPage';
import { AdminPage } from './components/Admin';
import MLDashboard from './components/ai/MLDashboard';

export type Page = 'dashboard' | 'bets' | 'add' | 'ai' | 'live' | 'scan' | 'settings' | 'admin' | 'ml';

// --- PLATFORM (PROTECTED APP) ---
const Platform: React.FC = () => {
  const { profile } = useAuth();
  const [currentPage, setCurrentPage] = React.useState<Page>('dashboard');
  const { bets, addBet, deleteBet } = useBets();
  const { initialCapital, setInitialCapital } = useSettings();

  // Error safety for profile loading
  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <h2 className="text-2xl font-bold mb-4 text-center">Cargando Perfil...</h2>
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleAddBet = async (newBet: Omit<Bet, 'id' | 'payout' | 'user_id'>) => {
    await addBet(newBet);
    setCurrentPage('bets');
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'bets':
        return <BetTable bets={bets} onDeleteBet={deleteBet} onAddBetClick={() => setCurrentPage('add')} />;
      case 'add':
        return <AddBetForm onAddBet={handleAddBet} />;
      case 'ai':
        return <AiAnalysis />;
      case 'live':
        return <FixturesFeed />;
      case 'scan':
        return <TicketScanner />;
      case 'settings':
        return <Settings initialCapital={initialCapital} setInitialCapital={setInitialCapital} />;
      case 'admin':
        if (profile.role === 'superadmin' || profile.role === 'admin') {
          return <AdminPage />;
        }
        setCurrentPage('dashboard');
        return <Dashboard />;
      case 'ml':
        return <MLDashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {renderContent()}
    </Layout>
  );
};

// --- ROUTE WRAPPERS ---

const LandingRoute = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  if (session) {
    return <Navigate to="/app" replace />;
  }

  return (
    <LandingPage
      onGetStarted={() => navigate('/login')}
      onLoginClick={() => navigate('/login')}
    />
  );
};

const LoginRoute = () => {
  const { session } = useAuth();

  if (session) {
    return <Navigate to="/app" replace />;
  }

  return <AuthPage />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) return null; // Or a spinner
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

// --- MAIN APP ---

const AppContent: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <Platform />
          </ProtectedRoute>
        }
      />
      {/* Catch all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
};

export default App;