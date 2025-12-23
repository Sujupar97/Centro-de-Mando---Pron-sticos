
import React, { useState, useRef, useEffect } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../hooks/useAuth';
import { ChevronDownIcon, CheckIcon, PlusIcon, BuildingOfficeIcon } from './icons/Icons';

interface OrganizationSwitcherProps {
    onCreateClick?: () => void;
}

export const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({ onCreateClick }) => {
    const { currentOrg, userOrganizations, switchOrganization, isLoading } = useOrganization();
    const { profile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    if (isLoading) {
        return <div className="h-10 w-full animate-pulse bg-white/10 rounded-lg"></div>;
    }

    if (!currentOrg) {
        return null; // Should ideally always have an org or handle empty state elsewhere
    }

    return (
        <div className="relative mb-6" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 hover:border-brand/50 transition-all duration-300 group"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center text-brand shrink-0">
                        {/* Fallback icon or organization logo if available later */}
                        <BuildingOfficeIcon className="w-5 h-5" />
                    </div>
                    <div className="text-left truncate">
                        <div className="text-sm font-bold text-white truncate group-hover:text-brand transition-colors">
                            {currentOrg.name}
                        </div>
                        <div className="text-xs text-slate-400 capitalize">
                            {/* Show user role in this org */}
                            {userOrganizations.find(o => o.org.id === currentOrg.id)?.role || 'Miembro'}
                        </div>
                    </div>
                </div>
                <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-scale-in origin-top">
                    <div className="p-2 space-y-1">
                        <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Tus Organizaciones
                        </div>
                        {userOrganizations.map((item) => (
                            <button
                                key={item.org.id}
                                onClick={() => {
                                    switchOrganization(item.org.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm ${currentOrg.id === item.org.id
                                    ? 'bg-brand/10 text-brand'
                                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <span className="truncate">{item.org.name}</span>
                                </div>
                                {currentOrg.id === item.org.id && (
                                    <CheckIcon className="w-4 h-4 shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>

                    {profile?.role === 'superadmin' && (
                        <div className="p-2 border-t border-white/5">
                            <button
                                onClick={() => {
                                    if (onCreateClick) {
                                        onCreateClick();
                                    } else {
                                        alert("Crear organización: Próximamente");
                                    }
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <PlusIcon className="w-4 h-4" />
                                <span>Crear Organización</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
