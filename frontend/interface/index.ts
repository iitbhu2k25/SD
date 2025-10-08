export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
}

export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

export type Locale = 'en' | 'hi';

export interface PageProps {
  locale: Locale;
}