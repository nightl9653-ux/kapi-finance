-- 艺术站排行：帖、出钱记录、点赞（后续 20260831140000 会拆掉帖/赞，咔账只留付款记录）

create table if not exists public.art_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('nails', 'cook', 'any')),
  image_url text,
  swatch text not null default '#a84a62',
  social_url text not null,
  paid_total numeric(12, 2) not null default 0,
  last_paid_at timestamptz,
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint art_posts_paid_total_nonneg check (paid_total >= 0),
  constraint art_posts_likes_nonneg check (likes_count >= 0)
);

create index if not exists art_posts_category_idx on public.art_posts (category);
create index if not exists art_posts_paid_total_idx on public.art_posts (paid_total desc);
create index if not exists art_posts_last_paid_at_idx on public.art_posts (last_paid_at desc nulls last);
create index if not exists art_posts_likes_idx on public.art_posts (likes_count desc);
create index if not exists art_posts_created_at_idx on public.art_posts (created_at desc);

create table if not exists public.art_post_payments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.art_posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  units integer not null,
  amount numeric(12, 2) not null,
  provider text not null,
  external_order_id text not null,
  created_at timestamptz not null default now(),
  constraint art_post_payments_units_range check (units >= 1 and units <= 1000),
  constraint art_post_payments_amount_pos check (amount > 0),
  unique (provider, external_order_id)
);

create index if not exists art_post_payments_post_created_idx
  on public.art_post_payments (post_id, created_at desc);

create index if not exists art_post_payments_user_created_idx
  on public.art_post_payments (user_id, created_at desc);

create table if not exists public.art_post_likes (
  post_id uuid not null references public.art_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists art_post_likes_user_idx on public.art_post_likes (user_id);

-- 点赞计数跟 likes 表走，避免接口漏加减
create or replace function public.art_post_likes_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.art_posts
    set likes_count = likes_count + 1, updated_at = now()
    where id = new.post_id;
    return new;
  end if;
  if tg_op = 'DELETE' then
    update public.art_posts
    set likes_count = greatest(0, likes_count - 1), updated_at = now()
    where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists art_post_likes_sync_ins on public.art_post_likes;
create trigger art_post_likes_sync_ins
after insert on public.art_post_likes
for each row execute procedure public.art_post_likes_sync();

drop trigger if exists art_post_likes_sync_del on public.art_post_likes;
create trigger art_post_likes_sync_del
after delete on public.art_post_likes
for each row execute procedure public.art_post_likes_sync();

-- 付款成功入账（幂等：同一外部单号只加一次总额）
create or replace function public.apply_art_post_payment(
  p_post_id uuid,
  p_user_id uuid,
  p_units integer,
  p_amount numeric,
  p_provider text,
  p_external_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted uuid;
begin
  if p_units is null or p_units < 1 or p_units > 1000 then
    return jsonb_build_object('granted', false, 'reason', 'invalid_units');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('granted', false, 'reason', 'invalid_amount');
  end if;

  insert into public.art_post_payments (
    post_id, user_id, units, amount, provider, external_order_id
  ) values (
    p_post_id, p_user_id, p_units, p_amount, p_provider, p_external_order_id
  )
  on conflict (provider, external_order_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return jsonb_build_object('granted', false, 'reason', 'duplicate_order');
  end if;

  update public.art_posts
  set
    paid_total = paid_total + p_amount,
    last_paid_at = now(),
    updated_at = now()
  where id = p_post_id;

  if not found then
    raise exception 'art_post_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('granted', true);
end;
$$;

revoke all on function public.apply_art_post_payment(uuid, uuid, integer, numeric, text, text) from public;
grant execute on function public.apply_art_post_payment(uuid, uuid, integer, numeric, text, text) to service_role;

alter table public.art_posts enable row level security;
alter table public.art_post_payments enable row level security;
alter table public.art_post_likes enable row level security;

drop policy if exists "art_posts_select_public" on public.art_posts;
create policy "art_posts_select_public"
on public.art_posts for select
using (true);

drop policy if exists "art_posts_insert_own" on public.art_posts;
create policy "art_posts_insert_own"
on public.art_posts for insert
with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "art_posts_delete_own" on public.art_posts;
create policy "art_posts_delete_own"
on public.art_posts for delete
using (user_id = auth.uid());

drop policy if exists "art_post_payments_select_own" on public.art_post_payments;
create policy "art_post_payments_select_own"
on public.art_post_payments for select
using (user_id = auth.uid());

drop policy if exists "art_post_likes_select_public" on public.art_post_likes;
create policy "art_post_likes_select_public"
on public.art_post_likes for select
using (true);

drop policy if exists "art_post_likes_insert_own" on public.art_post_likes;
create policy "art_post_likes_insert_own"
on public.art_post_likes for insert
with check (user_id = auth.uid());

drop policy if exists "art_post_likes_delete_own" on public.art_post_likes;
create policy "art_post_likes_delete_own"
on public.art_post_likes for delete
using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('art-posts', 'art-posts', true)
on conflict (id) do nothing;

drop policy if exists "art_posts_objects_select_public" on storage.objects;
create policy "art_posts_objects_select_public"
on storage.objects for select
using (bucket_id = 'art-posts');

drop policy if exists "art_posts_objects_insert_own" on storage.objects;
create policy "art_posts_objects_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'art-posts'
  and auth.uid() is not null
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "art_posts_objects_delete_own" on storage.objects;
create policy "art_posts_objects_delete_own"
on storage.objects for delete
using (
  bucket_id = 'art-posts'
  and auth.uid() is not null
  and name like (auth.uid()::text || '/%')
);
