-- Task 11: authorized BoQ editing and snapshot-based private progress.
begin;
alter table public.account_project_events drop constraint account_project_events_action_check;
alter table public.account_project_events add constraint account_project_events_action_check check (action in ('created','legacy_authorized_import','invited','invite_cancelled','invite_accepted','role_changed','member_removed','ownership_requested','ownership_transferred','archived','restored','boq_item_added','boq_item_updated'));

create function public.account_boq_identity_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id is distinct from old.id or new.project_id is distinct from old.project_id then raise exception 'BoQ identity and project are fixed'; end if;
 if new.unit is distinct from old.unit and (exists(select 1 from public.report_items where boq_item_id=old.id) or exists(select 1 from public.submissions where project_id=old.project_id and confirmed_boq_ids ? old.id::text)) then raise exception 'A unit used in confirmed work is fixed'; end if;
 return new;
end; $$;
create trigger account_boq_identity_fixed before update on public.boq_items for each row execute function public.account_boq_identity_guard();

create function public.account_dashboard_input(p_hash text,p_project uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor jsonb; notes uuid[];
begin
 actor:=public.account_project_access(p_hash,p_project); if actor is null then return null; end if;
 select coalesce(array_agg(s.id),'{}'::uuid[]) into notes from public.submissions s
 left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id
 where s.project_id=p_project and (actor->>'role'='pm' or public.account_person(coalesce(sp.profile_id,l.profile_id))=(actor->>'profile_id')::uuid);
 return jsonb_build_object('access',actor,'as_of',clock_timestamp(),
  'project',(select jsonb_build_object('id',id,'name',name,'client',client,'location',location,'contract_sum',contract_sum::text,'is_demo',is_demo or exists(select 1 from public.trial_sessions t where t.project_id=p_project and t.claimed_at is not null)) from public.projects where id=p_project),
  'boq',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'item_code',b.item_code,'section',b.section,'description',b.description,'unit',b.unit,'boq_quantity',b.boq_quantity::text,'rate',b.rate::text,'revision',md5(to_jsonb(b)::text),'used',
    exists(select 1 from public.report_items where boq_item_id=b.id) or exists(select 1 from public.submissions where project_id=p_project and confirmed_boq_ids ? b.id::text)) order by b.section,b.item_code,b.id),'[]'::jsonb) from public.boq_items b where b.project_id=p_project),
  'locked_count',(select count(*) from public.reports where submission_id=any(notes) and status='locked'),
  'draft_count',(select count(*) from public.reports where submission_id=any(notes) and status='draft'),
  'locked_items',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'boq_item_id',i.boq_item_id,'quantity',i.quantity_done::text,'rate',i.rate_snapshot::text,'unit',i.unit_snapshot,'confirmed_by',i.confirmed_by,'currency',coalesce(r.content_snapshot->>'currency',sp.currency,actor->>'currency')) order by r.date,i.id),'[]'::jsonb)
    from public.report_items i join public.reports r on r.id=i.report_id left join public.account_submission_people sp on sp.submission_id=r.submission_id
    where r.project_id=p_project and r.status='locked' and r.submission_id=any(notes)));
end; $$;

create function public.account_boq_save(p_hash text,p_project uuid,p_item jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor jsonb; item public.boq_items%rowtype; identifier uuid; qty numeric; supplied_rate numeric; is_new boolean;
begin
 perform 1 from public.account_projects where project_id=p_project for update;
 actor:=public.account_project_access(p_hash,p_project,true);
 if actor is null then return null; end if; if actor ? 'error' then return actor; end if; if actor->>'role'<>'pm' then return null; end if;
 if jsonb_typeof(p_item) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_item))<>8 or not(p_item ?& array['id','revision','item_code','section','description','unit','boq_quantity','rate']) then return jsonb_build_object('error','invalid'); end if;
 if p_item->>'id' !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' or (p_item->'revision'<>'null'::jsonb and p_item->>'revision' !~ '^[a-f0-9]{32}$')
  or p_item->>'unit' not in ('m3','m2','tonne','point','day') or coalesce(p_item->>'boq_quantity','') !~ '^[0-9]{1,10}(\.[0-9]{1,4})?$' or coalesce(p_item->>'rate','') !~ '^[0-9]+(\.[0-9]+)?$' or length(p_item->>'rate')>40
  or exists(select 1 from unnest(array[p_item->>'item_code',p_item->>'section',p_item->>'description']) value where nullif(btrim(value),'') is null or length(value)>200 or value ~ '[[:cntrl:]]') then return jsonb_build_object('error','invalid'); end if;
 identifier:=(p_item->>'id')::uuid; qty:=(p_item->>'boq_quantity')::numeric; supplied_rate:=(p_item->>'rate')::numeric;
 if qty<=0 or qty>=10000000000 then return jsonb_build_object('error','invalid'); end if;
 select * into item from public.boq_items where id=identifier for update; is_new:=not found;
 if not is_new then
  if item.project_id<>p_project then return null; end if;
  if item.item_code=btrim(p_item->>'item_code') and item.section=btrim(p_item->>'section') and item.description=btrim(p_item->>'description') and item.unit=p_item->>'unit' and item.boq_quantity=qty and item.rate=supplied_rate then return jsonb_build_object('id',item.id,'already_saved',true); end if;
  if p_item->>'revision' is distinct from md5(to_jsonb(item)::text) then return jsonb_build_object('error','stale'); end if;
  if item.unit<>p_item->>'unit' and (exists(select 1 from public.report_items where boq_item_id=item.id) or exists(select 1 from public.submissions where project_id=p_project and confirmed_boq_ids ? item.id::text)) then return jsonb_build_object('error','unit_in_use'); end if;
 else
  if p_item->'revision' is distinct from 'null'::jsonb then return jsonb_build_object('error','stale'); end if;
 end if;
 if exists(select 1 from public.boq_items where project_id=p_project and item_code=btrim(p_item->>'item_code') and id<>identifier) then return jsonb_build_object('error','duplicate_code'); end if;
 if is_new then
  insert into public.boq_items(id,project_id,item_code,section,description,unit,boq_quantity,rate) values(identifier,p_project,btrim(p_item->>'item_code'),btrim(p_item->>'section'),btrim(p_item->>'description'),p_item->>'unit',qty,supplied_rate);
 else
  update public.boq_items set item_code=btrim(p_item->>'item_code'),section=btrim(p_item->>'section'),description=btrim(p_item->>'description'),unit=p_item->>'unit',boq_quantity=qty,rate=supplied_rate where id=identifier;
 end if;
 insert into public.account_project_events(project_id,actor_profile_id,action,details) values(p_project,(actor->>'profile_id')::uuid,case when is_new then 'boq_item_added' else 'boq_item_updated' end,jsonb_build_object('item_id',identifier,'currency',actor->>'currency','before',case when is_new then null else to_jsonb(item) end,'after',(select to_jsonb(b) from public.boq_items b where id=identifier)));
 return jsonb_build_object('id',identifier);
end; $$;
revoke all on function public.account_boq_identity_guard() from public,anon,authenticated,service_role;
revoke all on function public.account_dashboard_input(text,uuid),public.account_boq_save(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.account_dashboard_input(text,uuid),public.account_boq_save(text,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
