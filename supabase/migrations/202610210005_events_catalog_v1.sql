-- Boissy-UJ : public events catalogue only.
-- This migration is a design artifact until separately approved.
-- No reservation records, checkout, QR tickets, or real payments here.
begin;

create table if not exists public.club_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(btrim(title)) between 4 and 150),
  description text not null default '' check (char_length(description) <= 4000),
  category text not null default 'club'
    check (category in ('club','sport','community','other')),
  starts_at timestamptz,
  ends_at timestamptz,
  location_label text check (location_label is null or char_length(location_label) <= 160),
  access_kind text not null default 'public'
    check (access_kind in ('public','premium')),
  booking_kind text not null default 'free'
    check (booking_kind in ('free','paid')),
  price_cents integer not null default 0
    check (price_cents between 0 and 1000000),
  premium_price_cents integer
    check (premium_price_cents is null or premium_price_cents between 0 and 1000000),
  capacity integer check (capacity is null or capacity > 0),
  booking_status text not null default 'not_open'
    check (booking_status in ('not_open','open','full','closed')),
  priority_kind text not null default 'none'
    check (priority_kind in ('none','premium')),
  priority_starts_at timestamptz,
  priority_ends_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_chronology check (
    ends_at is null or starts_at is null or ends_at > starts_at
  ),
  constraint event_publication_date check (not published or starts_at is not null),
  constraint free_event_no_payment check (
    booking_kind <> 'free' or (price_cents = 0 and (premium_price_cents is null or premium_price_cents = 0))
  ),
  constraint discount_not_higher_than_regular check (
    premium_price_cents is null or premium_price_cents <= price_cents
  ),
  constraint priority_window_valid check (
    priority_kind <> 'premium' or
    (priority_starts_at is not null and priority_ends_at is not null
      and priority_starts_at < priority_ends_at)
  )
);

create index if not exists club_events_public_schedule_idx
  on public.club_events (starts_at, id)
  where published = true and access_kind = 'public';

alter table public.club_events enable row level security;

-- Important: an ordinary signed-in member is NOT automatically premium.
-- Premium-only events are not readable through the anonymous API.
revoke all on public.club_events from anon, authenticated;
grant select on public.club_events to anon, authenticated;

create policy club_events_public_list on public.club_events
  for select to anon, authenticated
  using (published = true and access_kind = 'public');

comment on table public.club_events is
  'Read-only public event catalogue. Reservations and private premium events require a separate audited backend.';

commit;
