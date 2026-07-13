alter table if exists public.ponto_states
rename to bot_ponto;

alter trigger set_ponto_states_updated_at
on public.bot_ponto
rename to set_bot_ponto_updated_at;

create or replace function public.set_bot_ponto_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_bot_ponto_updated_at on public.bot_ponto;
create trigger set_bot_ponto_updated_at
before update on public.bot_ponto
for each row
execute function public.set_bot_ponto_updated_at();

drop function if exists public.set_ponto_states_updated_at();
