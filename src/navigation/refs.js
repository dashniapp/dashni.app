// Shared module-level refs used across navigation and screens.
// Kept in a separate file to avoid circular imports between
// RootNavigator (which imports screens) and screens (which need these refs).

export const onProfileCompleteRef   = { current: null };
export const ignoreAuthChangeRef    = { current: false };
export const setSignupInProgressRef = { current: null };

export const clearLikesBadgeRef    = { current: null };
export const clearMessagesBadgeRef = { current: null };
