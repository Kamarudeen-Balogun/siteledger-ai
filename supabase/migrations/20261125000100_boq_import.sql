-- Task 13: reviewed new-item import, atomic rollback and existing BoQ audit visibility.
begin;
create function public.account_boq_import(p_hash text,p_project uuid,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; item jsonb; result jsonb; failure jsonb; row_number integer:=0; saved integer:=0;
begin
 perform 1 from public.account_projects where project_id=p_project for update;
 actor:=public.account_project_access(p_hash,p_project,true);
 if actor is null then return null; end if;
 if actor ? 'error' then return actor; end if;
 if actor->>'role'<>'pm' then return null; end if;
 if jsonb_typeof(p_items) is distinct from 'array' then return jsonb_build_object('error','invalid'); end if;
 if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>200 then return jsonb_build_object('error','invalid'); end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items)
 or (select count(distinct btrim(value->>'item_code')) from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then return jsonb_build_object('error','invalid'); end if;
 -- The subtransaction rolls back both rows and audit entries on any failure.
 begin
  for item in select value from jsonb_array_elements(p_items) loop
   row_number:=row_number+1;
   if item->'revision' is distinct from 'null'::jsonb then failure:=jsonb_build_object('error','invalid'); raise sqlstate 'P0002'; end if;
   result:=public.account_boq_save(p_hash,p_project,item);
   if result is null or result ? 'error' then failure:=coalesce(result,jsonb_build_object('error','unavailable')); raise sqlstate 'P0002'; end if;
   if not coalesce((result->>'already_saved')::boolean,false) then saved:=saved+1; end if;
  end loop;
 exception when sqlstate 'P0002' then return failure||jsonb_build_object('row',row_number);
 end;
 return jsonb_build_object('saved',saved,'already_saved',saved=0);
end; $$;

create function public.account_boq_history(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
 actor:=public.account_project_access(p_hash,p_project);
 if actor is null or actor->>'role'<>'pm' then return null; end if;
 return (select coalesce(jsonb_agg(entry order by created_at desc,id desc),'[]'::jsonb) from
  (select e.id,e.created_at,jsonb_build_object('id',e.id,'timestamp',e.created_at,'action',e.action,
    'actor',coalesce(p.professional_name,'Project member'),'currency',e.details->>'currency',
    'before',e.details->'before','after',e.details->'after') entry
   from public.account_project_events e left join public.account_profiles p on p.id=e.actor_profile_id
   where e.project_id=p_project and e.action in ('boq_item_added','boq_item_updated') order by e.created_at desc,e.id desc limit 100) recent);
end; $$;
revoke all on function public.account_boq_import(text,uuid,jsonb),public.account_boq_history(text,uuid) from public,anon,authenticated;
grant execute on function public.account_boq_import(text,uuid,jsonb),public.account_boq_history(text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
