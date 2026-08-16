import { Ban, CircleX, MoreHorizontal, RotateCcw, UserRoundCog } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/shared/avatar';
import { DataRegion } from '@/components/shared/data-region';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClientMembership, PlatformIdentity } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';
import { isPendingAccess } from './access-control-utils';

type QueryStatus = 'loading' | 'success' | 'error';
type MembershipStatusChange = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

function ClientActions({ membership, disabled, onEdit, onApprove, onStatusChange }: {
  membership: ClientMembership;
  disabled: boolean;
  onEdit: (id: string) => void;
  onApprove: (id: string) => void;
  onStatusChange: (membership: ClientMembership, status: MembershipStatusChange) => void;
}) {
  const { t } = useTranslation();
  const pending = isPendingAccess(membership.status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled} aria-label={`${t('common.actions')}: ${membership.user.name}`}><MoreHorizontal aria-hidden="true" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(membership.userId)}><UserRoundCog aria-hidden="true" />{t('accessControl.editAccess')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        {membership.status !== 'ACTIVE' ? (
          <DropdownMenuItem onSelect={() => pending ? onApprove(membership.userId) : onStatusChange(membership, 'ACTIVE')}><RotateCcw aria-hidden="true" />{pending ? t('accessControl.approve') : t('accessControl.activate')}</DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="text-destructive" onSelect={() => onStatusChange(membership, 'SUSPENDED')}><Ban aria-hidden="true" />{t('accessControl.deactivate')}</DropdownMenuItem>
        )}
        {pending ? <DropdownMenuItem className="text-destructive" onSelect={() => onStatusChange(membership, 'REMOVED')}><CircleX aria-hidden="true" />{t('accessControl.reject')}</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ClientAccessTable({ items, currentUserId, mutatingId, onEdit, onApprove, onStatusChange }: {
  items: ClientMembership[];
  currentUserId: string;
  mutatingId: string | null;
  onEdit: (id: string) => void;
  onApprove: (id: string) => void;
  onStatusChange: (membership: ClientMembership, status: MembershipStatusChange) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader><TableRow><TableHead>{t('accessControl.columns.user')}</TableHead><TableHead>{t('accessControl.columns.role')}</TableHead><TableHead>{t('common.status')}</TableHead><TableHead>{t('accessControl.columns.requestedProject')}</TableHead><TableHead>{t('accessControl.columns.created')}</TableHead><TableHead className="w-16 text-right"><span className="sr-only">{t('common.actions')}</span></TableHead></TableRow></TableHeader>
          <TableBody>{items.map((membership) => {
            const isSelf = currentUserId === membership.userId;
            return (
              <TableRow key={membership.userId}>
                <TableCell><div className="flex min-w-0 items-center gap-3"><Avatar name={membership.user.name} /><div className="min-w-0"><p className="max-w-64 truncate font-medium">{membership.user.name}{isSelf ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t('accessControl.you')}</span> : null}</p><p className="max-w-64 truncate text-xs text-muted-foreground">{membership.user.email}</p></div></div></TableCell>
                <TableCell><Badge variant="outline">{t(`roles.${membership.role}`)}</Badge></TableCell>
                <TableCell><StatusBadge status={membership.status} /></TableCell>
                <TableCell>{membership.requestedProject ? <span className="block max-w-52 truncate text-sm">{membership.requestedProject.name}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{membership.createdAt ? <time dateTime={membership.createdAt}>{formatDate(membership.createdAt, i18n.language)}</time> : '—'}</TableCell>
                <TableCell className="text-right"><ClientActions membership={membership} disabled={isSelf || mutatingId === membership.userId} onEdit={onEdit} onApprove={onApprove} onStatusChange={onStatusChange} /></TableCell>
              </TableRow>
            );
          })}</TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden" aria-label={t('accessControl.clientAccess')}>
        {items.map((membership) => {
          const isSelf = currentUserId === membership.userId;
          return (
            <li key={membership.userId} className="space-y-3 p-4">
              <div className="flex min-w-0 items-start gap-3"><Avatar name={membership.user.name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{membership.user.name}{isSelf ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t('accessControl.you')}</span> : null}</p><p className="truncate text-xs text-muted-foreground">{membership.user.email}</p></div><ClientActions membership={membership} disabled={isSelf || mutatingId === membership.userId} onEdit={onEdit} onApprove={onApprove} onStatusChange={onStatusChange} /></div>
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{t(`roles.${membership.role}`)}</Badge><StatusBadge status={membership.status} /></div>
              {membership.requestedProject ? <p className="text-xs text-muted-foreground">{t('accessControl.requestedProject', { name: membership.requestedProject.name })}</p> : null}
              {membership.createdAt ? <time className="block text-xs text-muted-foreground" dateTime={membership.createdAt}>{formatDate(membership.createdAt, i18n.language)}</time> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function PlatformActions({ identity, disabled, onEdit }: { identity: PlatformIdentity; disabled: boolean; onEdit: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={disabled} aria-label={`${t('common.actions')}: ${identity.name}`}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onEdit(identity.id)}><UserRoundCog aria-hidden="true" />{t('accessControl.editAccess')}</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PlatformAccessTable({ items, status, toolbar, currentUserId, mutatingId, onRetry, onEdit }: {
  items: PlatformIdentity[];
  status: QueryStatus;
  toolbar?: ReactNode;
  currentUserId: string;
  mutatingId: string | null;
  onRetry: () => void;
  onEdit: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  if (status === 'loading') return <DataRegion toolbar={toolbar}><LoadingRows /></DataRegion>;
  if (status === 'error') return <DataRegion toolbar={toolbar}><ErrorState onRetry={onRetry} /></DataRegion>;
  if (items.length === 0) return <DataRegion toolbar={toolbar}><EmptyState title={t('accessControl.empty')} description={t('accessControl.platformEmptyDescription')} /></DataRegion>;
  return (
    <DataRegion toolbar={toolbar}>
      <div className="hidden md:block">
        <Table>
          <TableHeader><TableRow><TableHead>{t('accessControl.columns.identity')}</TableHead><TableHead>{t('accessControl.columns.globalRole')}</TableHead><TableHead>{t('common.status')}</TableHead><TableHead>{t('accessControl.columns.memberships')}</TableHead><TableHead>{t('accessControl.columns.created')}</TableHead><TableHead className="w-16 text-right"><span className="sr-only">{t('common.actions')}</span></TableHead></TableRow></TableHeader>
          <TableBody>{items.map((identity) => {
            const isSelf = identity.id === currentUserId;
            return <TableRow key={identity.id}><TableCell><div className="flex min-w-0 items-center gap-3"><Avatar name={identity.name} /><div className="min-w-0"><p className="max-w-64 truncate font-medium">{identity.name}{isSelf ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t('accessControl.you')}</span> : null}</p><p className="max-w-64 truncate text-xs text-muted-foreground">{identity.email}</p></div></div></TableCell><TableCell><Badge variant="outline">{t(`roles.${identity.role}`)}</Badge></TableCell><TableCell><StatusBadge status={identity.status} /></TableCell><TableCell className="text-sm text-muted-foreground">{t('accessControl.membershipCount', { count: identity.membershipCount })}</TableCell><TableCell className="whitespace-nowrap text-sm text-muted-foreground">{identity.createdAt ? <time dateTime={identity.createdAt}>{formatDate(identity.createdAt, i18n.language)}</time> : '—'}</TableCell><TableCell className="text-right"><PlatformActions identity={identity} disabled={isSelf || mutatingId === identity.id} onEdit={onEdit} /></TableCell></TableRow>;
          })}</TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden" aria-label={t('accessControl.platformIdentities')}>
        {items.map((identity) => {
          const isSelf = identity.id === currentUserId;
          return <li key={identity.id} className="space-y-3 p-4"><div className="flex min-w-0 items-start gap-3"><Avatar name={identity.name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{identity.name}{isSelf ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t('accessControl.you')}</span> : null}</p><p className="truncate text-xs text-muted-foreground">{identity.email}</p></div><PlatformActions identity={identity} disabled={isSelf || mutatingId === identity.id} onEdit={onEdit} /></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{t(`roles.${identity.role}`)}</Badge><StatusBadge status={identity.status} /></div><p className="text-xs text-muted-foreground">{t('accessControl.membershipCount', { count: identity.membershipCount })}</p>{identity.createdAt ? <time className="block text-xs text-muted-foreground" dateTime={identity.createdAt}>{formatDate(identity.createdAt, i18n.language)}</time> : null}</li>;
        })}
      </ul>
    </DataRegion>
  );
}
