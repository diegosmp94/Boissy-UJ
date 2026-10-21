begin;
create table if not exists public.club_identity_sections (
 id uuid primary key default gen_random_uuid(),
 section text not null check(section in ('history','values','governance','projects')),
 title text not null check(char_length(btrim(title)) between 4 and 160),
 body text not null check(char_length(btrim(body)) between 10 and 6000),
 sort_order integer not null default 0 check(sort_order between 0 and 10000),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists club_identity_public_idx on public.club_identity_sections(section,sort_order,id) where published=true;
alter table public.club_identity_sections enable row level security;
revoke all on public.club_identity_sections from public,anon,authenticated;
grant select on public.club_identity_sections to anon,authenticated;
create policy club_identity_public_read on public.club_identity_sections
 for select to anon,authenticated using (published=true);
comment on table public.club_identity_sections is 'Approved public club identity content only; no fictional history or personnel seeded.';
commit;
