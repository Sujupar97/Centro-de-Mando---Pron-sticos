import React from 'react';
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
import { AuthPage } from './components/Auth';
import { AdminPage } from './components/Admin';

export type Page = 'dashboard' | 'bets' | 'add' | 'ai' | 'live' | 'scan' | 'settings' | 'admin';

const AppContent: React.FC = () => {
  const { session, profile } = useAuth();
  const [currentPage, setCurrentPage] = React.useState<Page>('dashboard');
  const { bets, addBet, deleteBet } = useBets();
  const { initialCapital, setInitialCapital } = useSettings();

  // La sesión es la única fuente de verdad para la autenticación.
  // Si no hay sesión, se muestra la página de login.
  if (!session) {
    return <AuthPage />;
  }

  // Si hay sesión pero el perfil no se cargó (debido a un error de red, etc.),
  // se muestra un estado de error claro en lugar de expulsar al usuario,
  // lo cual previene el problema de quedarse atascado en el login.
  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <h2 className="text-2xl font-bold mb-4 text-center">Error al Cargar Perfil</h2>
        <p className="text-gray-400 mb-6 text-center">No pudimos cargar los datos de tu perfil, posiblemente por un problema de red. Tu sesión sigue activa.</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-green-accent hover:bg-green-600 text-white font-bold py-2 px-6 rounded-md transition duration-300"
        >
          Refrescar la Página
        </button>
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
        // Solo renderiza la página de admin si el rol es el adecuado
        if (profile.role === 'superadmin' || profile.role === 'admin') {
          return <AdminPage />;
        }
        // Redirige al dashboard si no tiene permisos
        setCurrentPage('dashboard');
        return <Dashboard />;
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

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;