-- Banquet party optional budget ceiling (same idea as renovation_projects.budget_cap)

alter table public.banquet_parties
  add column if not exists budget_cap decimal(12, 2);
