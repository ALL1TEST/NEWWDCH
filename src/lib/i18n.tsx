'use client';

import { create } from 'zustand';
import React, { createContext, useContext, useCallback, useMemo } from 'react';

// -------------------- Types --------------------

type Locale = 'en' | 'fr';

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

// -------------------- Translations --------------------

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Common
    'common.save': 'Save',
    'common.saveChanges': 'Save Changes',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search...',
    'common.loading': 'Loading...',
    'common.noData': 'No data',
    'common.actions': 'Actions',
    'common.status': 'Status',
    'common.name': 'Name',
    'common.email': 'Email',
    'common.back': 'Back',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.manage': 'Manage',

    // Navigation Groups
    'nav.overview': 'Overview',
    'nav.content': 'Content',
    'nav.media': 'Media',
    'nav.users': 'Users',
    'nav.engagement': 'Engagement',
    'nav.platform': 'Platform',
    'nav.ai': 'AI',
    'nav.system': 'System',

    // Navigation Items
    'nav.dashboard': 'Dashboard',
    'nav.allContent': 'All Content',
    'nav.categories': 'Categories',
    'nav.tags': 'Tags',
    'nav.comments': 'Comments',
    'nav.newsletter': 'Newsletter',
    'nav.emailTemplates': 'Email Templates',
    'nav.seo': 'SEO',
    'nav.navigation': 'Navigation',
    'nav.analytics': 'Analytics',
    'nav.notifications': 'Notifications',
    'nav.webhooks': 'Webhooks',
    'nav.backups': 'Backups',
    'nav.monitoring': 'Monitoring',
    'nav.api': 'API',
    'nav.settings': 'Settings',
    'nav.profile': 'Profile',
    'nav.billing': 'Billing',

    // Topbar
    'topbar.search': 'Search...',
    'topbar.toggleTheme': 'Toggle theme',
    'topbar.notifications': 'Notifications',
    'topbar.switchSite': 'Switch Site',
    'topbar.allSites': 'All Sites',
    'topbar.createSite': 'Create New Site',
    'topbar.editSite': 'Edit site',
    'topbar.noSites': 'No sites yet',

    // Profile
    'profile.title': 'Profile',
    'profile.personalInfo': 'Personal Information',
    'profile.fullName': 'Full Name',
    'profile.emailAddress': 'Email Address',
    'profile.saveChanges': 'Save Changes',
    'profile.subscription': 'Subscription',
    'profile.currentPlan': 'Current Plan',
    'profile.price': 'Price',
    'profile.trialStatus': 'Trial Status',
    'profile.manageSubscription': 'Manage Subscription',
    'profile.account': 'Account',
    'profile.memberSince': 'Member Since',
    'profile.verified': 'Verified',
    'profile.notVerified': 'Not Verified',
    'profile.nameSaved': 'Profile updated successfully',
    'profile.memberSinceUnknown': 'N/A',

    // Billing
    'billing.title': 'Billing & Subscription',
    'billing.description': 'Manage your subscription and billing information',
    'billing.subscription': 'Subscription',
    'billing.currentPlan': 'Current Plan',
    'billing.price': 'Price',
    'billing.trial': 'Trial',
    'billing.trialActive': 'Trial Active',
    'billing.trialExpired': 'Trial Expired',
    'billing.managePayment': 'Manage Payment Method',
    'billing.cancelSubscription': 'Cancel Subscription',
    'billing.paymentHistory': 'Payment History',
    'billing.noPayments': 'No payment history yet. When you make a payment, it will appear here.',
    'billing.date': 'Date',
    'billing.description': 'Description',
    'billing.amount': 'Amount',
    'billing.status': 'Status',
    'billing.invoice': 'Invoice',
    'billing.manage': 'Manage',
    'billing.otherPlans': 'Other Plans',
    'billing.upgrade': 'Upgrade',
    'billing.downgrade': 'Downgrade',
    'billing.changePlan': 'Change Plan',
    'billing.free': 'Free',

    // Auth
    'auth.login': 'Log in',
    'auth.logout': 'Log out',
    'auth.email': 'Email',
    'auth.password': 'Password',

    // Language
    'language.title': 'Language',
    'language.set': 'Language set to',
  },
  fr: {
    // Common
    'common.save': 'Enregistrer',
    'common.saveChanges': 'Enregistrer les modifications',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.create': 'Créer',
    'common.search': 'Rechercher...',
    'common.loading': 'Chargement...',
    'common.noData': 'Aucune donnée',
    'common.actions': 'Actions',
    'common.status': 'Statut',
    'common.name': 'Nom',
    'common.email': 'E-mail',
    'common.back': 'Retour',
    'common.close': 'Fermer',
    'common.confirm': 'Confirmer',
    'common.manage': 'Gérer',

    // Navigation Groups
    'nav.overview': 'Aperçu',
    'nav.content': 'Contenu',
    'nav.media': 'Médias',
    'nav.users': 'Utilisateurs',
    'nav.engagement': 'Engagement',
    'nav.platform': 'Plateforme',
    'nav.ai': 'IA',
    'nav.system': 'Système',

    // Navigation Items
    'nav.dashboard': 'Tableau de bord',
    'nav.allContent': 'Tout le contenu',
    'nav.categories': 'Catégories',
    'nav.tags': 'Tags',
    'nav.comments': 'Commentaires',
    'nav.newsletter': 'Newsletter',
    'nav.emailTemplates': 'Modèles d\'e-mail',
    'nav.seo': 'SEO',
    'nav.navigation': 'Navigation',
    'nav.analytics': 'Analytique',
    'nav.notifications': 'Notifications',
    'nav.webhooks': 'Webhooks',
    'nav.backups': 'Sauvegardes',
    'nav.monitoring': 'Surveillance',
    'nav.api': 'API',
    'nav.settings': 'Paramètres',
    'nav.profile': 'Profil',
    'nav.billing': 'Facturation',

    // Topbar
    'topbar.search': 'Rechercher...',
    'topbar.toggleTheme': 'Changer le thème',
    'topbar.notifications': 'Notifications',
    'topbar.switchSite': 'Changer de site',
    'topbar.allSites': 'Tous les sites',
    'topbar.createSite': 'Créer un nouveau site',
    'topbar.editSite': 'Modifier le site',
    'topbar.noSites': 'Aucun site',

    // Profile
    'profile.title': 'Profil',
    'profile.personalInfo': 'Informations personnelles',
    'profile.fullName': 'Nom complet',
    'profile.emailAddress': 'Adresse e-mail',
    'profile.saveChanges': 'Enregistrer les modifications',
    'profile.subscription': 'Abonnement',
    'profile.currentPlan': 'Plan actuel',
    'profile.price': 'Prix',
    'profile.trialStatus': 'Statut de l\'essai',
    'profile.manageSubscription': 'Gérer l\'abonnement',
    'profile.account': 'Compte',
    'profile.memberSince': 'Membre depuis',
    'profile.verified': 'Vérifié',
    'profile.notVerified': 'Non vérifié',
    'profile.nameSaved': 'Profil mis à jour avec succès',
    'profile.memberSinceUnknown': 'N/A',

    // Billing
    'billing.title': 'Facturation et abonnement',
    'billing.description': 'Gérez votre abonnement et vos informations de facturation',
    'billing.subscription': 'Abonnement',
    'billing.currentPlan': 'Plan actuel',
    'billing.price': 'Prix',
    'billing.trial': 'Essai',
    'billing.trialActive': 'Essai actif',
    'billing.trialExpired': 'Essai expiré',
    'billing.managePayment': 'Gérer le moyen de paiement',
    'billing.cancelSubscription': 'Annuler l\'abonnement',
    'billing.paymentHistory': 'Historique des paiements',
    'billing.noPayments': 'Aucun historique de paiement. Lorsque vous effectuez un paiement, il apparaîtra ici.',
    'billing.date': 'Date',
    'billing.description': 'Description',
    'billing.amount': 'Montant',
    'billing.status': 'Statut',
    'billing.invoice': 'Facture',
    'billing.manage': 'Gérer',
    'billing.otherPlans': 'Autres plans',
    'billing.upgrade': 'Passer à la version supérieure',
    'billing.downgrade': 'Rétrograder',
    'billing.changePlan': 'Changer de plan',
    'billing.free': 'Gratuit',

    // Auth
    'auth.login': 'Connexion',
    'auth.logout': 'Déconnexion',
    'auth.email': 'E-mail',
    'auth.password': 'Mot de passe',

    // Language
    'language.title': 'Langue',
    'language.set': 'Langue définie sur',
  },
};

// -------------------- Store --------------------

const STORAGE_KEY = 'cms_locale';

const getInitialLocale = (): Locale => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'fr') return stored;
  }
  return 'en';
};

export const useLocaleStore = create<I18nState>((set) => ({
  locale: 'en' as Locale,
  setLocale: (locale: Locale) => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    set({ locale });
  },
}));

// Initialize from storage on client
if (typeof window !== 'undefined') {
  const initial = getInitialLocale();
  useLocaleStore.setState({ locale: initial });
  document.documentElement.lang = initial;
}

// -------------------- Hook --------------------

const I18nContext = createContext<{ locale: Locale; t: (key: string) => string } | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocaleStore((s) => s.locale);

  const t = useCallback(
    (key: string): string => {
      return translations[locale]?.[key] ?? translations['en']?.[key] ?? key;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): { locale: Locale; t: (key: string) => string } {
  const ctx = useContext(I18nContext);
  const storeLocale = useLocaleStore((s) => s.locale);

  const locale = ctx?.locale ?? storeLocale;

  const t = useCallback(
    (key: string): string => {
      return translations[locale]?.[key] ?? translations['en']?.[key] ?? key;
    },
    [locale]
  );

  if (ctx) return ctx;
  return { locale, t };
}

export type { Locale };
