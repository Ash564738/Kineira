// src/styles/theme.ts
/* ============================================================================
 * COLOR PALETTE
 * ========================================================================== */
export const COLORS = {
  lightBlue: '#BBE1FA',
  darkBlue: '#0F4C75',

  white: '#FFFFFF',
  black: '#000000',
} as const;

/* ============================================================================
 * THEME COLORS
 * ========================================================================== */
export const themeColors = {
  /**
   * --------------------------------------------------------------------------
   * LIGHT THEME — trắng / đen / xám
   * Các trường hợp ngoại lệ (error, streak icon, badge cấp độ) được giữ màu
   * --------------------------------------------------------------------------
   */
  light: {
    // Page & Containers
    pageBg: 'bg-white',
    cardBg: 'bg-white',
    cardBorder: 'border-gray-300',
    cardHoverBg: 'hover:bg-gray-50',

    // Typography
    textPrimary: 'text-black',
    textMuted: 'text-gray-500',

    // Tabs
    tabActiveBg: 'bg-black',
    tabActiveText: 'text-white',
    tabInactiveBg: 'bg-gray-100',
    tabInactiveText: 'text-gray-500',
    tabHoverBg: 'hover:bg-gray-200',
    tabHoverText: 'hover:text-black',
    tabGroupBg: 'bg-white',
    tabGroupBorder: 'border-gray-300',
    tabGroupShadow: 'shadow-sm',

    // Icons & Rank
    iconContainerBg: 'bg-gray-100',
    iconContainerText: 'text-black',

    // Highlight
    highlightBg: 'bg-white',
    highlightBorder: 'border-black',
    highlightText: 'text-black',

    // Badge (chung)
    badgeBg: 'bg-gray-100',
    badgeText: 'text-black',
    badgeStreakColor: 'text-orange-500', // giữ nguyên cam

    // Charts
    gridColor: '#D1D5DB',   // gray-300
    lineColor: '#374151',   // gray-700
    tickColor: '#6B7280',   // gray-500
    tooltipBg: 'bg-white',
    tooltipBorder: 'border-gray-300',

    // Empty State
    emptyStateIconBg: 'bg-gray-100',
    emptyStateIconColor: 'text-gray-500',
    emptyStateBg: 'bg-white',
    emptyStateBorder: 'border-gray-300',

    // Loading
    spinnerBorder: 'border-gray-200',
    spinnerBorderTop: 'border-t-black',

    // Collect's Progress bg color for unfilled portion
    progressTrackBg: 'bg-gray-200',

    // Progress Fill Bar
    progressFillBg: 'bg-black',

    // States
    errorText: 'text-red-500', // giữ đỏ
    infoText: 'text-gray-700',

    // Actions
    actionButtonBg: 'bg-black',
    actionButtonText: 'text-white',
    actionButtonHoverBg: 'hover:bg-gray-800',
    actionButtonHoverText: 'hover:text-white',

    disabledButtonBg: 'bg-gray-200',
    disabledButtonText: 'text-gray-500',

    // Danger
    stopButtonBg: 'bg-red-500',
    stopButtonText: 'text-white',
    stopButtonHoverBg: 'hover:bg-red-600',

    // Camera
    cameraBg: 'bg-black',
    cameraOverlayBg: 'bg-black',
    cameraOverlayText: 'text-white',
    cameraSpinnerColor: 'border-white',

    // Difficulty Badges – mỗi cấp một màu riêng
    badgeBeginner:
      'bg-green-50 border border-green-500 text-green-700',
    badgeIntermediate:
      'bg-blue-50 border border-blue-500 text-blue-700',
    badgeAdvanced:
      'bg-red-50 border border-red-500 text-red-700',
    badgeExpert:
      'bg-purple-50 border border-purple-500 text-purple-700',

    //Token cho quiz option button (light)
    quizOptionBg: 'bg-gray-100',
    quizOptionBorder: 'border-gray-300',
    quizOptionText: 'text-black',
    quizOptionHoverBg: 'hover:bg-gray-200',
    quizOptionHoverText: 'hover:text-black',
  },
  /**
   * --------------------------------------------------------------------------
   * DARK THEME
   * --------------------------------------------------------------------------
   */
  dark: {
    // Page & Containers
    pageBg: 'bg-black',
    cardBg: 'bg-black',
    cardBorder: 'border-[#BBE1FA]/40',
    cardHoverBg: 'hover:bg-[#BBE1FA]/5',

    // Typography
    textPrimary: 'text-[#BBE1FA]',
    textMuted: 'text-[#BBE1FA]/70',

    // Tabs
    tabActiveBg: 'bg-[#BBE1FA]',
    tabActiveText: 'text-black',
    tabInactiveBg: 'bg-black',
    tabInactiveText: 'text-[#BBE1FA]/70',
    tabHoverBg: 'hover:bg-[#BBE1FA]/5',
    tabHoverText: 'hover:text-[#BBE1FA]',
    tabGroupBg: 'bg-black',
    tabGroupBorder: 'border-[#BBE1FA]/40',
    tabGroupShadow: 'shadow-sm',

    // Icons & Rank
    iconContainerBg: 'bg-[#BBE1FA]',
    iconContainerText: 'text-black',

    // Highlight
    highlightBg: 'bg-[#BBE1FA]/10',
    highlightBorder: 'border-[#BBE1FA]/40',
    highlightText: 'text-[#BBE1FA]',

    // Badge
    badgeBg: 'bg-[#BBE1FA]/20',
    badgeText: 'text-white',
    badgeStreakColor: 'text-orange-500',

    // Charts
    gridColor: '#BBE1FA',
    lineColor: '#BBE1FA',
    tickColor: '#BBE1FA',
    tooltipBg: 'bg-black',
    tooltipBorder: 'border-[#BBE1FA]/40',

    // Empty State
    emptyStateIconBg: 'bg-[#BBE1FA]/10',
    emptyStateIconColor: 'text-[#BBE1FA]',
    emptyStateBg: 'bg-[#BBE1FA]/5',
    emptyStateBorder: 'border-[#BBE1FA]/40',

    // Loading
    spinnerBorder: 'border-[#BBE1FA]',
    spinnerBorderTop: 'border-t-transparent',

    // Collect's Progress bg color for unfilled portion
    progressTrackBg: 'bg-[#BBE1FA]/20',
    
    // Progress Fill Bar
    progressFillBg: 'bg-[#BBE1FA]',

    // States
    errorText: 'text-red-500',
    infoText: 'text-[#BBE1FA]/70',

    // Actions
    actionButtonBg: 'bg-[#BBE1FA]',
    actionButtonText: 'text-black',
    actionButtonHoverBg: 'hover:bg-[#BBE1FA]/80',
    actionButtonHoverText: 'hover:text-black',

    disabledButtonBg: 'bg-[#BBE1FA]/15',
    disabledButtonText: 'text-[#BBE1FA]/40',

    // Danger
    stopButtonBg: 'bg-red-500',
    stopButtonText: 'text-black',
    stopButtonHoverBg: 'hover:bg-red-600',

    // Camera
    cameraBg: 'bg-black',
    cameraOverlayBg: 'bg-black',
    cameraOverlayText: 'text-[#BBE1FA]',
    cameraSpinnerColor: 'border-[#BBE1FA]',

    // Difficulty Badges
    badgeBeginner:
      'bg-[#BBE1FA]/15 text-[#BBE1FA] border-[#BBE1FA]/20',
    badgeIntermediate:
      'bg-[#BBE1FA]/15 text-[#BBE1FA] border-[#BBE1FA]/20',
    badgeAdvanced:
      'bg-[#BBE1FA]/15 text-[#BBE1FA] border-[#BBE1FA]/20',
    badgeExpert:
      'bg-[#BBE1FA]/15 text-[#BBE1FA] border-[#BBE1FA]/20',

    quizOptionBg: 'bg-transparent',
    quizOptionBorder: 'border-[#BBE1FA]/30',
    quizOptionText: 'text-[#BBE1FA]',
    quizOptionHoverBg: 'hover:bg-[#BBE1FA]/10',
    quizOptionHoverText: 'hover:text-[#BBE1FA]',
  },
} as const;

/* ============================================================================
 * TYPOGRAPHY TOKENS
 * ========================================================================== */
export const typography = {
  fontFamily: 'font-sans',

  heading: {
    pageTitle: 'text-3xl font-semibold tracking-tight',
    sectionTitle: 'text-2xl font-semibold tracking-tight',
    cardTitle: 'text-lg font-semibold',
  },

  body: {
    large: 'text-base leading-6',
    normal: 'text-sm leading-6',
    small: 'text-xs leading-5',
  },

  stat: {
    value: 'text-4xl font-semibold tracking-tight',
    label: 'text-sm font-medium',
  },

  accent: 'text-sm font-medium tracking-[0.18em] uppercase',
  predictionValue: 'text-xl font-semibold',
} as const;

/* ============================================================================
 * SPACING TOKENS
 * ========================================================================== */
export const spacing = {
  container: 'max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
  sectionGap: 'space-y-8',

  cardPadding: 'p-6',
  itemPadding: 'p-5',

  itemGap: 'gap-4',
  elementGap: 'gap-3',

  iconContainer: 'h-12 w-12',
  rankCircle: 'h-11 w-11',

  tabPadding: 'px-4 py-2.5',
  badgePadding: 'px-3 py-1.5',
  buttonPadding: 'px-5 py-3',

  emptyStatePadding: 'px-6 py-12',
} as const;

/* ============================================================================
 * BORDER RADIUS TOKENS
 * ========================================================================== */
export const borderRadius = {
  card: 'rounded-[28px]',
  item: 'rounded-[24px]',
  button: 'rounded-2xl',
  badge: 'rounded-full',

  iconContainer: 'rounded-2xl',
  tabGroup: 'rounded-full',

  progress: 'rounded-full',

  innerCard: 'rounded-xl',
  smallBox: 'rounded-lg',
} as const;

/* ============================================================================
 * EFFECTS & ANIMATIONS
 * ========================================================================== */
export const effects = {
  transition: 'transition-all',
} as const;