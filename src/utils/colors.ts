/**
 * Unified Color System for CutToTech
 * 
 * This file defines the color palette used throughout the application
 * for consistency and easy maintenance.
 */

export const colors = {
  // Primary Brand Colors
  primary: {
    blue: '#2563EB',      // blue-600 - Trust, professionalism
    blueLight: '#3B82F6', // blue-500 - Lighter variant
    blueDark: '#1D4ED8',  // blue-700 - Darker variant
    purple: '#7C3AED',    // purple-600 - Innovation, creativity
    purpleLight: '#8B5CF6', // purple-500
    purpleDark: '#6D28D9',  // purple-700
    pink: '#EC4899',      // pink-500 - Energy, action
    pinkLight: '#F472B6', // pink-400
    pinkDark: '#DB2777',  // pink-600
  },

  // Semantic Colors
  semantic: {
    success: '#10B981',   // emerald-500 - More modern than green-600
    successLight: '#34D399', // emerald-400
    successDark: '#059669',  // emerald-600
    warning: '#F59E0B',  // amber-500 - Better visibility
    warningLight: '#FBBF24', // amber-400
    warningDark: '#D97706',  // amber-600
    error: '#EF4444',    // red-500 - Softer than red-600
    errorLight: '#F87171', // red-400
    errorDark: '#DC2626',  // red-600
    info: '#3B82F6',     // blue-500 - Lighter, friendlier
    infoLight: '#60A5FA', // blue-400
    infoDark: '#2563EB',  // blue-600
  },

  // Neutral Colors
  neutral: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Gradient Combinations
  gradients: {
    // Primary brand gradient - Modern, vibrant
    primary: 'from-violet-600 via-purple-600 to-fuchsia-600',
    primaryHover: 'from-violet-700 via-purple-700 to-fuchsia-700',
    
    // Softer, professional gradient
    professional: 'from-blue-500 via-indigo-600 to-purple-600',
    professionalHover: 'from-blue-600 via-indigo-700 to-purple-700',
    
    // Elegant, subtle gradient
    elegant: 'from-slate-700 via-blue-600 to-indigo-700',
    elegantHover: 'from-slate-800 via-blue-700 to-indigo-800',
    
    // Hero section gradient
    hero: 'from-blue-500 via-purple-600 to-pink-500',
    
    // Success gradient
    success: 'from-emerald-400 via-emerald-500 to-emerald-600',
    
    // Background gradients
    backgroundLight: 'from-gray-50 to-blue-50',
    backgroundCard: 'from-blue-50 to-purple-50',
  },
} as const;

/**
 * Get Tailwind class for gradient
 */
export function getGradientClass(type: keyof typeof colors.gradients): string {
  return `bg-gradient-to-r ${colors.gradients[type]}`;
}

/**
 * Get hover gradient class
 */
export function getGradientHoverClass(type: 'primary' | 'professional' | 'elegant'): string {
  const hoverMap = {
    primary: colors.gradients.primaryHover,
    professional: colors.gradients.professionalHover,
    elegant: colors.gradients.elegantHover,
  };
  return `bg-gradient-to-r ${hoverMap[type]}`;
}



