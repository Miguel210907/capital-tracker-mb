import { Text, type TextProps } from 'react-native';

import { colors } from '../theme/colors';
import { formatEuro } from '../utils/money';

interface MoneyTextProps extends TextProps {
  value: number;
  tone?: 'auto' | 'default';
}

export function MoneyText({ value, tone = 'default', style, ...props }: MoneyTextProps) {
  const color =
    tone === 'auto'
      ? value > 0
        ? colors.success
        : value < 0
          ? colors.danger
          : colors.text
      : colors.text;

  return (
    <Text style={[{ color, fontVariant: ['tabular-nums'] }, style]} {...props}>
      {formatEuro(value)}
    </Text>
  );
}
