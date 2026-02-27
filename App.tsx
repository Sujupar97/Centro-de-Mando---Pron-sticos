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
  const { plan, isAdmin } = useSubscription();
  const { isImpersonating } = useOrganization();
  const [currentPage, setCurrentPage] = React.useState<Page>('live');

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
