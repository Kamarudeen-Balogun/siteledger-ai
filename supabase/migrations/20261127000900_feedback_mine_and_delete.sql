begin;
-- The admin inbox and "My feedback" listed the same rows, and there was
-- no way to delete an entry. Two changes: a p_mine flag so "My feedback"
-- lists only the signed-in user's entries (the admin inbox keeps all
-- rows), and an admin-only delete branch. CREATE OR REPLACE cannot change
-- a function's signature, so the old 4-argument function is dropped.
drop function if exists public.account_feedback(text,text,uuid,jsonb);
create function public.account_feedback(p_hash text,p_admin_email text,p_id uuid default null,p_input jsonb default null,p_mine boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; person uuid; project uuid; admin boolean; row public.product_feedback%rowtype; result jsonb;
begin
  actor:=public.account_session(p_hash);
  if actor is null then return null; end if;
  person:=(actor->>'profile_id')::uuid;
  admin:=coalesce((actor->>'email_verified')::boolean and lower(actor->>'email')=lower(nullif(p_admin_email,'')),false);
  if p_input is not null and p_id is null then
    select active_project_id into project from public.account_sessions where secret_hash=p_hash;
    if public.account_project_access(p_hash,project) is null then project:=null; end if;
    insert into public.product_feedback(profile_id,project_id,name,email,kind,message,photo_path)
      values(person,project,coalesce(actor->>'professional_name','SiteLedger user'),actor->>'email',p_input->>'kind',p_input->>'message',p_input->>'photo_path') returning * into row;
    return jsonb_build_object('id',row.id);
  elsif p_id is not null then
    select * into row from public.product_feedback where id=p_id and (admin or public.account_person(profile_id)=person);
    if not found then return null; end if;
    if p_input is not null then
      if not admin then return null; end if;
      if p_input ? 'delete' then
        delete from public.product_feedback_replies where feedback_id=row.id;
        delete from public.product_feedback where id=row.id;
        return jsonb_build_object('saved',true,'deleted',true);
      end if;
      if p_input ? 'status' then update public.product_feedback set status=p_input->>'status' where id=row.id; end if;
      if p_input ? 'reply' then insert into public.product_feedback_replies(feedback_id,author,message) values(row.id,person,p_input->>'reply'); end if;
      return jsonb_build_object('saved',true,'recipient',row.email);
    end if;
    return jsonb_build_object('photo_path',row.photo_path);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'kind',f.kind,'message',f.message,'status',f.status,'date',f.created_at,
    'project',p.name,'has_photo',f.photo_path is not null,'replies',(select coalesce(jsonb_agg(jsonb_build_object('text',r.message,'date',r.created_at) order by r.created_at),'[]'::jsonb) from public.product_feedback_replies r where r.feedback_id=f.id)) order by f.created_at desc),'[]'::jsonb)
    into result from (select * from public.product_feedback where (admin and not p_mine) or public.account_person(profile_id)=person order by created_at desc limit 200) f left join public.projects p on p.id=f.project_id;
  return jsonb_build_object('admin',admin,'items',result);
end; $$;
revoke all on function public.account_feedback(text,text,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.account_feedback(text,text,uuid,jsonb,boolean) to service_role;
notify pgrst,'reload schema';
commit;
