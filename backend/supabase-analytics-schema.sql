-- Apply before enabling ANALYTICS_ENABLED. No public client can read/write this table.
begin;
create table public.analytics_events (
 id uuid primary key,
 created_at timestamptz not null default now(),
 event text not null check(event in ('page_view','add_to_cart','checkout_start')),
 visitor_id uuid not null,
 session_id uuid not null,
 path text not null check(length(path)<=250),
 previous_path text check(length(previous_path)<=250),
 referrer text not null default '' check(length(referrer)<=150),
 product_code text check(length(product_code)<=100),
 device text not null check(device in ('mobile','tablet','desktop','unknown'))
);
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from public, anon, authenticated;
grant select, insert on public.analytics_events to service_role;
create index analytics_events_created_idx on public.analytics_events(created_at,id);
create index analytics_events_session_idx on public.analytics_events(session_id,created_at);
commit;
