
import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'es' | 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const translations: Record<Language, Record<string, string>> = {
    es: {
        'nav.main': 'PANEL MASTER',
        'nav.suite': 'Suite de Gestión',
        'nav.launchpad': 'Launchpad',
        'nav.dashboard': 'Tablero Principal',
        'nav.clients': 'Cartera de Clientes',
        'nav.analytics': 'Analítica Global',
        'nav.settings': 'Configuración',
        'header.admin': 'Administración',
        'header.clients': 'Gestión de Clientes',
        'btn.new_client': '+ Nuevo Cliente',
        'modal.create_client': 'Registrar Nuevo Cliente',
        'modal.subtitle': 'Configura los detalles de la cuenta y el usuario administrador.',
        'modal.section.info': 'Información de la Cuenta',
        'modal.section.admin': 'Administrador (Dueño)',
        'modal.label.name': 'Nombre de Referencia / Equipo *',
        'modal.ph.name': 'Ej. Equipo Alpha',
        'modal.label.address': 'Dirección',
        'modal.label.city': 'Ciudad',
        'modal.label.country': 'País',
        'modal.label.timezone': 'Zona Horaria',
        'modal.label.firstname': 'Nombre',
        'modal.label.lastname': 'Apellido',
        'modal.label.email': 'Correo Electrónico',
        'modal.label.phone': 'Teléfono',
        'modal.btn.cancel': 'Cancelar',
        'modal.btn.create': 'Registrar Cliente',
        'page.search_ph': 'Buscar por nombre, ID...',
        'page.showing': 'Mostrando',
        'page.items': 'clientes',
        'page.no_results': 'No se encontraron clientes',
        'page.no_results_sub': 'Intenta con otro término o registra uno nuevo.',
        'card.plan': 'Plan Actual',
        'card.created': 'Registrado',
        'card.access': 'Acceder',
        'detail.title': 'Detalles de Cliente',
        'detail.general': 'Detalles Generales',
        'detail.limits': 'Configuración y Límites',
        'detail.info': 'Información de Cuenta',
        'detail.stats': 'Estadísticas de Uso',
        'detail.actions': 'Acciones Rápidas',
        'detail.reset_pass': 'Resetear Password',
        'detail.suspend': 'Suspender Cuenta',
        'launchpad.title': 'Bienvenido al Launchpad',
        'launchpad.desc': 'Resumen de actividad y tareas pendientes de tus clientes.',
    },
    en: {
        'nav.main': 'MASTER SUITE',
        'nav.suite': 'Management Suite',
        'nav.launchpad': 'Launchpad',
        'nav.dashboard': 'Main Dashboard',
        'nav.clients': 'Client Portfolio',
        'nav.analytics': 'Global Analytics',
        'nav.settings': 'Settings',
        'header.admin': 'Administration',
        'header.clients': 'Client Management',
        'btn.new_client': '+ New Client',
        'modal.create_client': 'Register New Client',
        'modal.subtitle': 'Configure account details and admin user.',
        'modal.section.info': 'Account Information',
        'modal.section.admin': 'Administrator (Owner)',
        'modal.label.name': 'Reference Name / Team *',
        'modal.ph.name': 'Ex. Alpha Team',
        'modal.label.address': 'Address',
        'modal.label.city': 'City',
        'modal.label.country': 'Country',
        'modal.label.timezone': 'Timezone',
        'modal.label.firstname': 'First Name',
        'modal.label.lastname': 'Last Name',
        'modal.label.email': 'Email',
        'modal.label.phone': 'Phone',
        'modal.btn.cancel': 'Cancel',
        'modal.btn.create': 'Register Client',
        'page.search_ph': 'Search by name, ID...',
        'page.showing': 'Showing',
        'page.items': 'clients',
        'page.no_results': 'No clients found',
        'page.no_results_sub': 'Try another term or register a new one.',
        'card.plan': 'Current Plan',
        'card.created': 'Registered',
        'card.access': 'Access',
        'detail.title': 'Client Details',
        'detail.general': 'General Details',
        'detail.limits': 'Settings & Limits',
        'detail.info': 'Account Information',
        'detail.stats': 'Usage Stats',
        'detail.actions': 'Quick Actions',
        'detail.reset_pass': 'Reset Password',
        'detail.suspend': 'Suspend Account',
        'launchpad.title': 'Welcome to Launchpad',
        'launchpad.desc': 'Activity summary and pending tasks for your clients.',
    }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>('es');

    useEffect(() => {
        // Simple geo-location check based on public API
        // Fallback to Spanish if fetch fails or country is Hispanic
        const checkLocation = async () => {
            // Only auto-detect if not already manually set in session/local storage
            const savedLang = localStorage.getItem('app_language');
            if (savedLang === 'en' || savedLang === 'es') {
                setLanguage(savedLang);
                return;
            }

            try {
                // Short timeout to avoid blocking UI feel
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
                const data = await res.json();
                clearTimeout(timeoutId);

                // List of Spanish speaking country codes (simplified)
                const hispanicCountries = ['ES', 'MX', 'CO', 'AR', 'PE', 'VE', 'CL', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'GQ'];

                if (data && data.country_code) {
                    if (hispanicCountries.includes(data.country_code)) {
                        setLanguage('es');
                    } else {
                        // Default to English for non-hispanic countries (e.g. US)
                        setLanguage('en');
                    }
                }
            } catch (error) {
                // console.warn("Could not detect location, defaulting to browser pref or ES");
                const browserLang = navigator.language.split('-')[0];
                if (browserLang === 'en') setLanguage('en');
                else setLanguage('es');
            }
        };

        checkLocation();
    }, []);

    const updateLanguage = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem('app_language', lang);
    }

    const t = (key: string): string => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: updateLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
