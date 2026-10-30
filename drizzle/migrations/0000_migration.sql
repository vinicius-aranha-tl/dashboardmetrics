create type public.app_role as enum ('admin', 'viewer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users read own roles; admins read all" on public.user_roles
for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create or replace function public.is_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  api_executions_url text,
  api_evolution_url text,
  ui_executions_url text,
  ui_evolution_url text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "Members read projects" on public.projects for select to authenticated using (public.is_member(auth.uid()));
create policy "Admins insert projects" on public.projects for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update projects" on public.projects for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete projects" on public.projects for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  product text not null check (product in ('api','ui')),
  widget_type text not null,
  title text not null,
  width text not null default 'half' check (width in ('half','full')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.dashboard_widgets to authenticated;
grant all on public.dashboard_widgets to service_role;
alter table public.dashboard_widgets enable row level security;
create policy "Members read widgets" on public.dashboard_widgets for select to authenticated using (public.is_member(auth.uid()));
create policy "Admins insert widgets" on public.dashboard_widgets for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update widgets" on public.dashboard_widgets for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete widgets" on public.dashboard_widgets for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
create index on public.dashboard_widgets (project_id, product, position);

insert into public.projects (name, slug, description) values
  ('Recomenda', 'recomenda', 'Motor de recomendações — automação de API e UI');