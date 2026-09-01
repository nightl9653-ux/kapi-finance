-- 帖/榜/赞迁回艺术站：咔账只保留付款记录。

create table if not exists public.art_post_payments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
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

alter table public.art_post_payments enable row level security;

drop policy if exists "art_post_payments_select_own" on public.art_post_payments;
create policy "art_post_payments_select_own"
on public.art_post_payments for select
using (user_id = auth.uid());

drop trigger if exists art_post_likes_sync_ins on public.art_post_likes;
drop trigger if exists art_post_likes_sync_del on public.art_post_likes;
drop function if exists public.art_post_likes_sync();

drop table if exists public.art_post_likes;

alter table if exists public.art_post_payments
  drop constraint if exists art_post_payments_post_id_fkey;

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
  if p_post_id is null then
    return jsonb_build_object('granted', false, 'reason', 'invalid_post');
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

  return jsonb_build_object('granted', true);
end;
$$;

revoke all on function public.apply_art_post_payment(uuid, uuid, integer, numeric, text, text) from public;
grant execute on function public.apply_art_post_payment(uuid, uuid, integer, numeric, text, text) to service_role;

drop table if exists public.art_posts;

drop policy if exists "art_posts_objects_select_public" on storage.objects;
drop policy if exists "art_posts_objects_insert_own" on storage.objects;
drop policy if exists "art_posts_objects_delete_own" on storage.objects;

delete from storage.objects where bucket_id = 'art-posts';
delete from storage.buckets where id = 'art-posts';
