type UserBadgeInput = {
  fullName?: string | null;
  email?: string | null;
  avatar?: string | null;
};
type UserBadgeOutput = {
  label: string;
  initial: string;
  avatarUrl: string | null;
};

export const buildUserBadge = (u: UserBadgeInput, fallback: string): UserBadgeOutput => {
  const fullName = u.fullName?.trim() || '';
  const email = u.email?.trim() ?? '';
  const label = fullName || (email ? email.replace(/^(.{1,8}).*(@.*)$/, '$1...$2') : fallback);
  return {
    label,
    initial: (label.trim().charAt(0) || 'U').toUpperCase(),
    avatarUrl: u.avatar?.trim() || null
  };
}


