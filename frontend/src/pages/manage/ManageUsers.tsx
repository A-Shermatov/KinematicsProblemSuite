import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type Role, type User } from "../../api";
import { displayName, roleLabel, useAuth } from "../../auth/AuthContext";
import { Avatar, Badge, Button, Card, EmptyState, ErrorMessage, Input, Loading, PageHeader, cx } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { errorText, useAsync, useDocumentTitle } from "../../lib/hooks";

const ROLE_FILTERS: (Role | null)[] = [null, "student", "teacher", "admin"];

export function ManageUsers() {
  useDocumentTitle("Пользователи");
  const { user: me } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading, setData } = useAsync(() => api.users.list({ role: role ?? undefined, search: query || undefined }), [role, query]);

  const apply = (updated: User) => setData((prev) => (prev ?? []).map((item) => (item.id === updated.id ? updated : item)));

  const act = async (action: () => Promise<User>) => {
    try {
      apply(await action());
    } catch (err) {
      window.alert(errorText(err));
    }
  };

  return (
    <>
      <PageHeader title="Пользователи" subtitle="Назначайте учителей и блокируйте нарушителей" />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <form
          className="w-full sm:w-80"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
        >
          <Input placeholder="Поиск по имени или логину, Enter" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск пользователей" />
        </form>
        <div className="flex flex-wrap gap-1.5">
          {ROLE_FILTERS.map((item) => (
            <button
              key={item ?? "all"}
              onClick={() => setRole(item)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                role === item ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-muted hover:text-fg",
              )}
            >
              {item ? roleLabel[item] : "Все"}
            </button>
          ))}
        </div>
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && <EmptyState title="Никого не нашли" />}
      {data && data.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden">
          {data.map((user) => {
            const self = user.id === me?.id;
            return (
              <div key={user.id} className={cx("flex flex-wrap items-center gap-4 px-5 py-3.5", !user.is_active && "opacity-60")}>
                <Avatar src={user.avatar_url} name={displayName(user)} />
                <div className="min-w-0 flex-1">
                  <Link to={`/users/${user.id}`} className="font-medium text-fg hover:text-primary">
                    {displayName(user)}
                  </Link>
                  <p className="text-xs text-muted">
                    @{user.username} · с {formatDate(user.created_at)}
                  </p>
                </div>
                {!user.is_active && <Badge tone="danger">Заблокирован</Badge>}
                <select
                  value={user.role}
                  disabled={self}
                  onChange={(e) => act(() => api.users.setRole(user.id, e.target.value as Role))}
                  className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-fg disabled:opacity-50"
                  aria-label={`Роль ${user.username}`}
                >
                  {(["student", "teacher", "admin"] as Role[]).map((item) => (
                    <option key={item} value={item}>
                      {roleLabel[item]}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant={user.is_active ? "danger" : "secondary"}
                  disabled={self}
                  onClick={() => act(() => api.users.setActive(user.id, !user.is_active))}
                >
                  {user.is_active ? "Заблокировать" : "Разблокировать"}
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
