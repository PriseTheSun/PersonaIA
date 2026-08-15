import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

const variants = {
  ACTIVE: 'success', PENDING: 'warning', INVITED: 'warning', SUSPENDED: 'destructive', ARCHIVED: 'secondary',
} as const;

export function StatusBadge({ status }: { status: keyof typeof variants }) {
  const { t } = useTranslation();
  const key = status.toLowerCase();
  return <Badge variant={variants[status]}>{t(`common.${key}`)}</Badge>;
}
