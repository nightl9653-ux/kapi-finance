-- Plus 会员到期日：null 表示终身（或历史已开通未写到期日，按终身兼容）
alter table public.profiles
  add column if not exists plus_expires_at timestamptz;

comment on column public.profiles.plus_expires_at is
  'Plus 到期时间；null + is_plus_member 表示终身；到期后校验时应关会员';

-- 目标数量限制：过期会员按免费用户计
create or replace function public.enforce_goal_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_plus boolean;
  goal_count integer;
begin
  select coalesce(p.is_plus_member, false)
    and (p.plus_expires_at is null or p.plus_expires_at > now())
  into is_plus
  from public.profiles p
  where p.id = new.user_id;

  if is_plus then
    return new;
  end if;

  select count(*) into goal_count
  from public.financial_goals g
  where g.user_id = new.user_id;

  if goal_count >= 2 then
    raise exception 'Free plan goal limit reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
