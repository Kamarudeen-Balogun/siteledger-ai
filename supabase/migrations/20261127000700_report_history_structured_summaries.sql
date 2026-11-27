-- Round-2 audit fix: project-history summary lines now read from the
-- structured report items (quantity + unit + BoQ description snapshot)
-- instead of the raw spoken description. A mis-heard transcript
-- ("thin square metre of two hundred and twenty-five millimetre
-- blockwork…") can never be recovered by normalising words, but the
-- quantity, unit and BoQ name stored on the locked line item are exact.
-- Money totals are untouched; only the summary text changes.
-- Apply to the live database via the Supabase dashboard SQL editor
-- after this branch is merged, like 20261127000600.
create or replace function public.account_project_history(p_hash text,p_project uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb;
begin
  actor := public.account_project_access(p_hash,p_project);
  if actor is null then return null; end if;
  return jsonb_build_object('access',actor,
    'project',(select jsonb_build_object('id',id,'name',name,'client',client,'location',location,'project_code',project_code,'contract_sum',contract_sum::text) from public.projects where id=p_project),
    'submissions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'date',coalesce(sp.site_date,s.site_date),'captured_at',s.created_at,'total_cost',r.total_cost::text,'summary_items',(select coalesce(jsonb_agg(case when i.quantity_done is null then coalesce(i.description_snapshot,i.description) else rtrim(rtrim(i.quantity_done::text,'0'),'.')||' '||case i.unit_snapshot when 'm2' then 'm²' when 'm3' then 'm³' else coalesce(i.unit_snapshot,'') end||' '||coalesce(i.description_snapshot,i.description) end order by i.id),'[]'::jsonb) from public.report_items i where i.report_id=r.id),'submitted_by',s.submitted_by,'status',s.status,'report_id',r.id,'report_status',r.status) order by s.created_at desc,s.id),'[]'::jsonb)
      from public.submissions s left join public.account_submission_people sp on sp.submission_id=s.id left join public.account_legacy_actors l on l.telegram_id=s.telegram_id left join public.reports r on r.submission_id=s.id
      where s.project_id=p_project and ((public.account_has_project_permission(actor,'view_reports') and r.status='locked') or
        (public.account_has_project_permission(actor,'record_notes') and (public.account_has_project_permission(actor,'approve_lock') or public.account_person(coalesce(sp.profile_id,l.profile_id))=(actor->>'profile_id')::uuid)))),
    'transfers',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'expires_at',expires_at) order by created_at desc),'[]'::jsonb) from public.account_owner_transfers
      where project_id=p_project and accepted_at is null and expires_at>clock_timestamp() and public.account_person(target_profile_id)=(actor->>'profile_id')::uuid));
end; $$;
