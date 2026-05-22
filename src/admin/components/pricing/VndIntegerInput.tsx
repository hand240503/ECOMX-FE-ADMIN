import { useState } from 'react';
import { formatIntegerViVN } from '../../../lib/formatPrice';

type VndIntegerInputProps = {
  value: number;
  onChange: (next: number) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-invalid'?: boolean;
};

function clampNonNegativeInt(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return 0;
  let n = Number(digits);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > Number.MAX_SAFE_INTEGER) n = Number.MAX_SAFE_INTEGER;
  return Math.round(n);
}

/**
 * Ô nhập số nguyên VNĐ: khi không focus hiển thị nhóm nghìn kiểu vi-VN; khi focus chỉ nhập chữ số.
 */
export function VndIntegerInput({
  value,
  onChange,
  className,
  disabled,
  id,
  'aria-invalid': ariaInvalid,
}: VndIntegerInputProps) {
  const [focused, setFocused] = useState(false);
  const [draftDigits, setDraftDigits] = useState('');

  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const display = focused ? draftDigits : formatIntegerViVN(rounded);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      aria-invalid={ariaInvalid}
      className={className}
      value={display}
      onFocus={() => {
        setFocused(true);
        setDraftDigits(String(Math.max(0, rounded)));
      }}
      onBlur={() => {
        const next = clampNonNegativeInt(draftDigits);
        onChange(next);
        setFocused(false);
      }}
      onChange={(e) => {
        const digitsOnly = e.target.value.replace(/\D/g, '');
        setDraftDigits(digitsOnly);
      }}
    />
  );
}
