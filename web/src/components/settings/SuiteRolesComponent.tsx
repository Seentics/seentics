'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Loader2, Plus, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  assignSuiteRole,
  createSuiteRole,
  deleteSuiteRole,
  describePermission,
  getPermissionCatalogue,
  getSuiteAccess,
  listSuiteMembers,
  listSuiteRoles,
  listSuiteTeams,
  updateSuiteRole,
  type CustomRole,
  type PermissionCatalogue,
  type Role,
} from '@/lib/suite-roles-api';
import { cn } from '@/lib/utils';

/**
 * Suite roles and permissions.
 *
 * Separate from the website members screen beside it, and worded to say so. A
 * website member is who may open *this site*, which this app owns. A suite
 * role decides what someone may do across Analytics, Uptime and Observability
 * together — and it narrows their website role rather than replacing it, since
 * both checks run on every request.
 */

const PRODUCT_LABELS: Record<string, string> = {
  observability: 'Observability',
  uptime: 'Uptime',
  analytics: 'Analytics',
  team: 'Team',
};

const BASE_ROLES: Role[] = ['admin', 'member', 'viewer'];
const FIVE_MINUTES = 5 * 60_000;

/** The gateway explains its refusals; those sentences are why anyone understands a failure. */
function reason(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return typeof message === 'string' && message ? message : fallback;
}

export function SuiteRolesComponent() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CustomRole | 'new' | null>(null);

  const { data: teams = [], isError, isLoading } = useQuery({
    queryKey: ['suite-roles', 'teams'],
    queryFn: listSuiteTeams,
    staleTime: FIVE_MINUTES,
    // A standalone run has no gateway; one attempt is enough to learn that.
    retry: false,
  });

  const teamId = teams[0]?.id ?? '';

  const { data: access } = useQuery({
    queryKey: ['suite-roles', 'access', teamId],
    queryFn: () => getSuiteAccess(teamId),
    enabled: Boolean(teamId),
    staleTime: FIVE_MINUTES,
    retry: false,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['suite-roles', 'roles', teamId],
    queryFn: () => listSuiteRoles(teamId),
    enabled: Boolean(teamId),
    staleTime: FIVE_MINUTES,
    retry: false,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['suite-roles', 'members', teamId],
    queryFn: () => listSuiteMembers(teamId),
    enabled: Boolean(teamId),
    staleTime: FIVE_MINUTES,
    retry: false,
  });

  const { data: catalogue } = useQuery({
    queryKey: ['suite-roles', 'catalogue'],
    queryFn: getPermissionCatalogue,
    staleTime: Infinity,
    retry: false,
  });

  const invalidate = () => {
    for (const key of ['roles', 'members', 'access']) {
      queryClient.invalidateQueries({ queryKey: ['suite-roles', key, teamId] });
    }
  };

  const create = useMutation({
    mutationFn: (input: { name: string; baseRole: Role; permissions: string[] }) =>
      createSuiteRole(teamId, input),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success('Role created');
    },
    onError: (error) => toast.error(reason(error, 'Could not create that role')),
  });

  const update = useMutation({
    mutationFn: ({ roleId, ...input }: { roleId: string; name: string; baseRole: Role; permissions: string[] }) =>
      updateSuiteRole(teamId, roleId, input),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success('Role saved');
    },
    onError: (error) => toast.error(reason(error, 'Could not save that role')),
  });

  const remove = useMutation({
    mutationFn: (roleId: string) => deleteSuiteRole(teamId, roleId),
    onSuccess: () => {
      invalidate();
      toast.success('Role deleted');
    },
    onError: (error) => toast.error(reason(error, 'Could not delete that role')),
  });

  const assign = useMutation({
    mutationFn: ({ userId, customRoleId }: { userId: string; customRoleId: string | null }) =>
      assignSuiteRole(teamId, userId, customRoleId),
    onSuccess: () => {
      invalidate();
      toast.success('Role assigned');
    },
    onError: (error) => toast.error(reason(error, 'Could not assign that role')),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading suite roles…
      </div>
    );
  }

  // Nothing to administer without a gateway, and an empty panel that can never
  // fill is worse than no panel.
  if (isError || !teamId) return null;

  const mayManage = access ? ['owner', 'admin'].includes(access.role) : false;

  if (editing && catalogue) {
    return (
      <RoleEditor
        catalogue={catalogue}
        granted={access?.permissions ?? []}
        initial={editing === 'new' ? undefined : editing}
        isSaving={create.isPending || update.isPending}
        onCancel={() => setEditing(null)}
        onSave={(input) =>
          editing === 'new' ? create.mutate(input) : update.mutate({ roleId: editing.id, ...input })
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Suite roles
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What people may do across Analytics, Uptime and Observability. Separate from this
            site&rsquo;s members — a suite role narrows what someone can do, it does not decide which
            sites they can open.
          </p>
        </div>
        {mayManage && (
          <Button size="sm" onClick={() => setEditing('new')} disabled={!catalogue}>
            <Plus className="mr-1.5 h-4 w-4" />
            New role
          </Button>
        )}
      </div>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No custom roles. The four presets — owner, admin, member, viewer — cover most teams; make
          one when you need to say something they cannot, like an analyst who sees dashboards and
          nothing else.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {roles.map((role) => (
            <li key={role.id} className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{role.name}</span>
                  <Badge variant="outline">as {role.baseRole}</Badge>
                </div>
                <RoleSummary role={role} />
              </div>
              {mayManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(role)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${role.name}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(role.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {mayManage && members.length > 0 && roles.length > 0 && (
        <div className="border-t pt-5">
          <h3 className="text-sm font-semibold">Who holds what</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Assigning a custom role replaces that person&rsquo;s preset permissions entirely.
          </p>
          <ul className="mt-4 space-y-2">
            {members.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <Select
                  defaultValue="preset"
                  disabled={assign.isPending}
                  onValueChange={(value) =>
                    assign.mutate({
                      userId: member.userId,
                      customRoleId: value === 'preset' ? null : value,
                    })
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preset">Preset ({member.role})</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RoleSummary({ role }: { role: CustomRole }) {
  const [open, setOpen] = useState(false);
  const counts = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const key of role.permissions) {
      const { product } = describePermission(key);
      byProduct.set(product, (byProduct.get(product) ?? 0) + 1);
    }
    return [...byProduct];
  }, [role.permissions]);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        {counts.map(([product, count]) => `${PRODUCT_LABELS[product] ?? product} ${count}`).join(' · ') ||
          'no permissions'}
      </button>
      {open && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {role.permissions.map((key) => (
            <li key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {key}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Build a role by saying what it may do.
 *
 * Grouped by product and then subject, because that is how the decision is
 * actually made — "they should see Analytics but not Uptime" is one click on a
 * heading, not eleven on individual keys.
 */
function RoleEditor({
  catalogue,
  granted,
  initial,
  isSaving,
  onSave,
  onCancel,
}: {
  catalogue: PermissionCatalogue;
  granted: string[];
  initial?: CustomRole;
  isSaving: boolean;
  onSave: (input: { name: string; baseRole: Role; permissions: string[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [baseRole, setBaseRole] = useState<Role>(initial?.baseRole ?? 'member');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial?.permissions ?? catalogue.presets.member),
  );

  const grantable = useMemo(() => new Set(granted), [granted]);

  const groups = useMemo(() => {
    const byProduct = new Map<string, Map<string, string[]>>();
    for (const key of catalogue.permissions) {
      const { product, subject } = describePermission(key);
      const subjects = byProduct.get(product) ?? new Map<string, string[]>();
      subjects.set(subject, [...(subjects.get(subject) ?? []), key]);
      byProduct.set(product, subjects);
    }
    return byProduct;
  }, [catalogue.permissions]);

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const setMany = (keys: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const key of keys) {
        // Never select something the editor cannot grant: the server refuses
        // it, and a checkbox that cannot be saved is a lie.
        if (on && grantable.has(key)) next.add(key);
        if (!on) next.delete(key);
      }
      return next;
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Role name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Marketing analyst"
            maxLength={60}
          />
        </label>
        <label className="w-[190px]">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Administered as
          </span>
          <Select value={baseRole} onValueChange={(value) => setBaseRole(value as Role)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <p className="text-sm text-muted-foreground">
        The rank decides who may edit someone holding this role. It does not decide what they can do
        — that is the list below, and it replaces the preset entirely.
      </p>

      <div className="space-y-3">
        {[...groups].map(([product, subjects]) => {
          const productKeys = [...subjects.values()].flat();
          const grantableKeys = productKeys.filter((key) => grantable.has(key));
          const allOn = grantableKeys.length > 0 && grantableKeys.every((key) => selected.has(key));

          return (
            <section key={product} className="rounded-lg border">
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <h3 className="text-sm font-semibold">{PRODUCT_LABELS[product] ?? product}</h3>
                <span className="text-xs text-muted-foreground">
                  {productKeys.filter((key) => selected.has(key)).length} of {productKeys.length}
                </span>
                <button
                  type="button"
                  onClick={() => setMany(productKeys, !allOn)}
                  disabled={grantableKeys.length === 0}
                  className="ml-auto text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                >
                  {allOn ? 'Clear all' : 'Select all'}
                </button>
              </div>

              <div className="divide-y">
                {[...subjects].map(([subject, keys]) => (
                  <div key={subject} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                    <span className="w-[130px] shrink-0 font-mono text-xs text-muted-foreground">
                      {subject}
                    </span>
                    {keys.map((key) => {
                      const { action } = describePermission(key);
                      const on = selected.has(key);
                      const allowed = grantable.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => allowed && toggle(key)}
                          disabled={!allowed}
                          title={
                            allowed
                              ? key
                              : `${key} — you do not hold this permission, so you cannot grant it`
                          }
                          className={cn(
                            'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors',
                            on ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted',
                            !allowed && 'cursor-not-allowed opacity-40',
                          )}
                        >
                          {on && <Check className="h-3 w-3" />}
                          {action}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Button
          disabled={!name.trim() || isSaving}
          onClick={() => onSave({ name: name.trim(), baseRole, permissions: [...selected] })}
        >
          {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {initial ? 'Save role' : 'Create role'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">{selected.size} permissions</span>
      </div>
    </div>
  );
}
