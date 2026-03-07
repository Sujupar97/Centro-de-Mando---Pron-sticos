import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { FixturesFeed } from './components/LiveFeed';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LanguageProvider } from './contexts/LanguageContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { AuthPage } from './components/Auth';
import { LandingPage } from './components/landing/LandingPage';
import { AdminPage } from './components/Admin';
import { PricingPage } from './components/pricing/PricingPage';
import { PublicPricingPage } from './components/pricing/PublicPricingPage';
import { SignUpFlow } from './components/auth/SignUpFlow';
import { ResetPassword } from './components/auth/ResetPassword';
import { TermsOfService } from './components/legal/TermsOfService';
import { PrivacyPolicy } from './components/legal/PrivacyPolicy';
import { RefundPolicy } from './components/legal/RefundPolicy';
import { isAgencyRole } from './utils/roles';
import { useSubscription } from './contexts/SubscriptionContext';
import { useOrganization } from './contexts/OrganizationContext';
import { useDailyRecap } from './hooks/useDailyRecap';
import { DailyRecapModal } from './components/recap/DailyRecapModal';

export type Page = 'live' | 'admin' | 'pricing';

// --- PLATFORM (PROTECTED APP) ---
const Platform: React.FC = () => {
  const { profile } = useAuth();
  const { plan, isAdmin, refreshSubscription } = useSubscription();
  const { isImpersonating } = useOrganization();
  const [currentPage, setCurrentPage] = React.useState<Page>('live');
  const [paymentBanner, setPaymentBanner] = React.useState(false);

  // Handler: ?payment=success después de pagar en Whop
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setPaymentBanner(true);
      refreshSubscription();
      // Limpiar el parámetro de la URL
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-ocultar después de 8 segundos
      const timer = setTimeout(() => setPaymentBanner(false), 8000);
      return () => clearTimeout(timer);
    }
  }, []);

  const recap = useDailyRecap(
    plan.plan_name,
    isAdmin || isAgencyRole(profile?.role),
    !!profile,
    isImpersonating
  );

  // Error safety for profile loading
  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <h2 className="text-2xl font-bold mb-4 text-center">Cargando Perfil...</h2>
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'live':
        return <FixturesFeed />;
      case 'admin':
        if (isAgencyRole(profile.role)) {
          return <AdminPage />;
        }
        setCurrentPage('live');
        return <FixturesFeed />;
      case 'pricing':
        return <PricingPage />;
      default:
        return <FixturesFeed />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      recapBadge={{
        hasData: recap.hasData,
        hasUnseen: recap.hasUnseen,
        onReopen: recap.reopen,
      }}
    >
      {paymentBanner && (
        <div className="mx-4 mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between animate-fade-in">
          <p className="text-emerald-400 font-bold">¡Pago exitoso! Tu plan ha sido activado.</p>
          <button onClick={() => setPaymentBanner(false)} className="text-emerald-400/60 hover:text-emerald-400 p-1">
            ✕
          </button>
        </div>
      )}
      {renderContent()}
      {recap.isVisible && recap.data && (
        <DailyRecapModal
          data={recap.data}
          tier={recap.tier}
          onDismiss={recap.dismiss}
          onUpgrade={() => setCurrentPage('pricing')}
          onViewResults={() => setCurrentPage('live')}
        />
      )}
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
      onGetStarted={() => navigate('/signup')}
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

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

// --- MAIN APP ---

const AppContent: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/pricing" element={<PublicPricingPage />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/refund" element={<RefundPolicy />} />
      <Route path="/signup" element={<SignUpFlow />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <Platform />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <SubscriptionProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </SubscriptionProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
};

export default App;
