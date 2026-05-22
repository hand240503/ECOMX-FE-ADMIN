import type { UserAddress } from '../../api/types/auth.types';

export function formatAddressDetail(addr: UserAddress): string {
  const parts = [addr.addressLine, addr.state, addr.city, addr.country].filter(Boolean);
  let line = parts.join(', ');
  if (addr.zipCode) line = `${line} · ${addr.zipCode}`;
  return line;
}
