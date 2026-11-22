-- Task 10B: isolated, temporary trial data. No original project rows are changed.
begin;
create table public.trial_prices(id uuid primary key,item_code text unique not null,section text not null,description text not null,unit text not null,boq_quantity numeric not null,rate numeric not null);
insert into public.trial_prices values
('20000000-0000-4000-8000-000000000006','BLK-01','Blockwork','Sandcrete blocks 225mm hollow, laid','m2',420,14500),
('20000000-0000-4000-8000-000000000007','BLK-02','Blockwork','Sandcrete blocks 150mm hollow, laid','m2',240,11800),
('20000000-0000-4000-8000-000000000004','CON-01','Concrete','In-situ concrete, columns and beams','m3',35,145000),
('20000000-0000-4000-8000-000000000005','CON-02','Concrete','Reinforcement, high-yield bars, cut and fixed','tonne',4.5,1450000),
('20000000-0000-4000-8000-000000000010','FIN-01','Finishes','Plastering, walls, 12mm','m2',1100,4800),
('20000000-0000-4000-8000-000000000011','FIN-02','Finishes','Screeding, floors','m2',300,5500),
('20000000-0000-4000-8000-000000000012','FIN-03','Finishes','Ceramic floor tiles, supplied and laid','m2',280,16000),
('20000000-0000-4000-8000-000000000015','LAB-01','Labour (daywork)','Mason, per day','day',40,12000),
('20000000-0000-4000-8000-000000000016','LAB-02','Labour (daywork)','Labourer, per day','day',80,6000),
('20000000-0000-4000-8000-000000000008','ROF-01','Roofing','Timber roof structure, treated','m2',180,28000),
('20000000-0000-4000-8000-000000000009','ROF-02','Roofing','Aluminium roofing sheets, long span','m2',180,19500),
('20000000-0000-4000-8000-000000000013','SER-01','Services','Electrical first fix, conduit and wiring','point',75,35000),
('20000000-0000-4000-8000-000000000014','SER-02','Services','Plumbing first fix','point',48,42000),
('20000000-0000-4000-8000-000000000001','SUB-01','Substructure','Excavation, foundation trenches','m3',110,8500),
('20000000-0000-4000-8000-000000000002','SUB-02','Substructure','Hardcore filling, compacted','m3',70,18000),
('20000000-0000-4000-8000-000000000003','SUB-03','Substructure','Oversite concrete (German floor), 150mm','m2',180,22500);
create table public.trial_sessions(
 id uuid primary key default gen_random_uuid(),secret_hash text unique not null check(secret_hash ~ '^[a-f0-9]{64}$'),
 project_id uuid unique not null default gen_random_uuid(),note_id uuid unique not null default gen_random_uuid(),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '24 hours',
 manifest jsonb,transcript text,extraction jsonb,confirmed_values jsonb,confirmed_boq_ids jsonb,confirmed_at timestamptz,draft jsonb,
 status text not null default 'empty' check(status in ('empty','uploading','processing','ready')),
 processing_owner uuid,processing_until timestamptz,processing_attempted boolean not null default false,
 claimed_by uuid references public.account_profiles(id) on delete restrict,claimed_at timestamptz,cleaned_at timestamptz,
 check((claimed_by is null)=(claimed_at is null)),check(expires_at>created_at and expires_at<=created_at+interval '24 hours 1 second')
);
create table public.trial_assets(
 id uuid primary key default gen_random_uuid(),trial_id uuid not null references public.trial_sessions(id) on delete restrict,
 asset_index integer not null check(asset_index between 0 and 3),path text not null,meta jsonb not null,
 saved boolean not null default false,claim_owner uuid,lease_until timestamptz,ai_findings jsonb,note text not null default '',unique(trial_id,asset_index)
);
create function public.trial_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' and old.claimed_at is not null then raise exception 'Saved trial originals are preserved'; end if;
 if tg_op='UPDATE' then
  if old.claimed_at is not null then raise exception 'Saved trial originals are immutable'; end if;
  if old.transcript is not null and new.transcript is distinct from old.transcript then raise exception 'Trial transcript is immutable'; end if;
  if row(new.id,new.project_id,new.note_id,new.created_at,new.expires_at,new.secret_hash) is distinct from row(old.id,old.project_id,old.note_id,old.created_at,old.expires_at,old.secret_hash) then raise exception 'Trial identity is fixed'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end; $$;
create trigger trial_guard before update or delete on public.trial_sessions for each row execute function public.trial_guard();
create function public.trial_asset_guard() returns trigger language plpgsql set search_path='' as $$
declare tid uuid;
begin
 tid:=case when tg_op='INSERT' then new.trial_id else old.trial_id end;
 perform 1 from public.trial_sessions where id=tid for update;
 if exists(select 1 from public.trial_sessions where id=tid and claimed_at is not null) then raise exception 'Saved trial media is immutable'; end if;
 if tg_op='UPDATE' and row(new.trial_id,new.asset_index,new.meta,new.path,new.id) is distinct from row(old.trial_id,old.asset_index,old.meta,old.path,old.id) then raise exception 'Trial file identity is fixed'; end if;
 if tg_op='UPDATE' and old.ai_findings is not null and new.ai_findings is distinct from old.ai_findings then raise exception 'Raw photo findings are immutable'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end; $$;
create trigger trial_asset_guard before insert or update or delete on public.trial_assets for each row execute function public.trial_asset_guard();
-- Client-generated account upload IDs must not occupy a reserved guest identity.
-- Knowing/forwarding a trial note UUID cannot prevent its rightful handover.
create function public.trial_namespace_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.trial_sessions t where t.note_id=new.id and (t.project_id<>new.project_id or tg_table_name='web_intakes')) then raise exception 'This intake identity is reserved'; end if;
 return new;
end; $$;
create trigger trial_submission_namespace before insert on public.submissions for each row execute function public.trial_namespace_guard();
create trigger trial_web_namespace before insert on public.web_intakes for each row execute function public.trial_namespace_guard();
create function public.trial_lock(p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin select id into tid from public.trial_sessions where secret_hash=p_hash and expires_at>clock_timestamp() and claimed_at is null and cleaned_at is null for update; return tid; end; $$;
create function public.trial_read(p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.trial_sessions%rowtype; prices jsonb; review jsonb;
begin
 select * into s from public.trial_sessions where secret_hash=p_hash and expires_at>clock_timestamp() and claimed_at is null and cleaned_at is null;
 if not found then return null; end if;
 select jsonb_agg(jsonb_build_object('id',id,'description',description,'unit',unit,'section',section,'item_code',item_code,'rate',rate::text,'boq_quantity',boq_quantity::text,'cumulative_locked_quantity','0') order by item_code) into prices from public.trial_prices;
 if s.manifest is not null and s.status in ('processing','ready') then
  review:=jsonb_build_object('id',s.note_id,'project_id',s.project_id,'project_name','Private trial / illustrative NGN BoQ','submitted_by','Guest trial participant (unverified)','actor','Guest trial participant (unverified)','created_at',s.manifest->>'captured_at','status',case when s.confirmed_at is not null then 'confirmed' else 'extracted' end,'timezone','Africa/Lagos','currency','NGN','transcript',s.transcript,'extraction',s.extraction,'confirmed_extraction',s.confirmed_values,'confirmed_boq_ids',s.confirmed_boq_ids,'confirmed_by',case when s.confirmed_at is not null then 'Guest trial participant (unverified)' end,'confirmed_at',s.confirmed_at,'audio_url',(select 'site-evidence/'||path from public.trial_assets where trial_id=s.id and asset_index=0),'job_status',case when s.status='processing' and s.processing_until>clock_timestamp() then 'processing' when s.extraction is not null then 'extracted' else 'manual_entry' end,'pending_media',false,'pending_photo_analysis',false,'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'storage_url','site-evidence/'||path,'ai_findings',ai_findings,'confirmed_findings',jsonb_build_object('note',note)) order by asset_index),'[]'::jsonb) from public.trial_assets where trial_id=s.id and asset_index>0),'boq',prices);
 end if;
 return jsonb_build_object('id',s.id,'project_id',s.project_id,'note_id',s.note_id,'created_at',s.created_at,'expires_at',s.expires_at,'manifest',s.manifest,'status',case when s.status='processing' and s.processing_until<=clock_timestamp() then 'ready' else s.status end,'record',review,'draft',s.draft,'prices',prices,'missing',(select coalesce(jsonb_agg(asset_index order by asset_index),'[]'::jsonb) from public.trial_assets where trial_id=s.id and not saved));
end; $$;
create function public.trial_start(p_hash text,p_ip text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_hash !~ '^[a-f0-9]{64}$' or p_ip !~ '^[a-f0-9]{64}$' then return null; end if;
 if not public.account_limit('trial-start-global',20,86400) or not public.account_limit('trial-start-ip:'||p_ip,3,86400) then return '{"error":"rate_limited"}'::jsonb; end if;
 insert into public.trial_sessions(secret_hash) values(p_hash); return public.trial_read(p_hash);
end; $$;
create function public.trial_reserve(p_hash text,p_manifest jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid; s public.trial_sessions%rowtype; asset jsonb; idx integer:=0; ext text;
begin
 tid:=public.trial_lock(p_hash); if tid is null then return null; end if; select * into s from public.trial_sessions where id=tid;
 if s.manifest is not null then if s.manifest=p_manifest then return public.trial_read(p_hash); else return '{"error":"one_note"}'::jsonb; end if; end if;
 if jsonb_typeof(p_manifest) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_manifest))<>3 or not(p_manifest ?& array['captured_at','timezone','assets']) or p_manifest->>'timezone' is distinct from 'Africa/Lagos' or jsonb_typeof(p_manifest->'assets') is distinct from 'array' or jsonb_array_length(p_manifest->'assets') not between 1 and 4 then return '{"error":"invalid"}'::jsonb; end if;
 if (p_manifest->>'captured_at')::timestamptz not between s.created_at-interval '5 minutes' and clock_timestamp()+interval '5 minutes' then return '{"error":"invalid"}'::jsonb; end if;
 for asset in select value from jsonb_array_elements(p_manifest->'assets') loop
  if jsonb_typeof(asset) is distinct from 'object' or (select count(*) from jsonb_object_keys(asset))<>4 or not(asset ?& array['index','bytes','sha256','content_type']) or jsonb_typeof(asset->'bytes') is distinct from 'number' or jsonb_typeof(asset->'index') is distinct from 'number' or jsonb_typeof(asset->'sha256') is distinct from 'string' or (asset->>'index')::integer<>idx or asset->>'sha256' !~ '^[a-f0-9]{64}$' or (asset->>'bytes')::numeric<=0 or (asset->>'bytes')::numeric<>trunc((asset->>'bytes')::numeric) or (asset->>'bytes')::numeric>(case when idx=0 then 3145728 else 1048576 end) or (idx=0 and asset->>'content_type' not in ('audio/ogg','audio/mpeg','audio/mp4','audio/webm','audio/wav')) or (idx>0 and asset->>'content_type' is distinct from 'image/jpeg') then return '{"error":"invalid"}'::jsonb; end if;
  idx:=idx+1;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended('trial-storage-budget',0));
 if (select coalesce(sum((a.meta->>'bytes')::bigint),0) from public.trial_assets a join public.trial_sessions t on t.id=a.trial_id where t.claimed_at is null and t.cleaned_at is null)+(select sum((value->>'bytes')::bigint) from jsonb_array_elements(p_manifest->'assets'))>125829120 then return '{"error":"rate_limited"}'::jsonb; end if;
 update public.trial_sessions set manifest=p_manifest,status='uploading' where id=tid;
 for asset in select value from jsonb_array_elements(p_manifest->'assets') loop
  idx:=(asset->>'index')::integer; ext:=case asset->>'content_type' when 'audio/ogg' then 'ogg' when 'audio/mpeg' then 'mp3' when 'audio/mp4' then 'm4a' when 'audio/webm' then 'webm' when 'audio/wav' then 'wav' else 'jpg' end;
  insert into public.trial_assets(trial_id,asset_index,path,meta) values(tid,idx,s.project_id::text||'/'||s.note_id::text||'/'||idx::text||'.'||ext,asset);
 end loop; return public.trial_read(p_hash);
end; $$;
create function public.trial_claim_asset(p_hash text,p_index integer,p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid; asset public.trial_assets%rowtype;
begin tid:=public.trial_lock(p_hash); if tid is null then return null; end if;
 if not public.account_limit('trial-upload:'||tid::text,40,600) then return '{"error":"rate_limited"}'::jsonb; end if;
 select * into asset from public.trial_assets where trial_id=tid and asset_index=p_index for update;
 if not found then return '{"error":"invalid"}'::jsonb; end if;
 if asset.saved then return '{"uploaded":true}'::jsonb; end if;
 if asset.lease_until>clock_timestamp() then return '{"error":"busy"}'::jsonb; end if;
 update public.trial_assets set claim_owner=p_owner,lease_until=clock_timestamp()+interval '2 minutes' where id=asset.id;
 return jsonb_build_object('path',asset.path,'asset',asset.meta);
end; $$;
create function public.trial_finish_asset(p_hash text,p_index integer,p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin tid:=public.trial_lock(p_hash); if tid is null then return null; end if;
 update public.trial_assets set saved=true,claim_owner=null,lease_until=null where trial_id=tid and asset_index=p_index and claim_owner=p_owner and lease_until>clock_timestamp();
 if not found then return '{"error":"busy"}'::jsonb; end if; return '{"uploaded":true}'::jsonb;
end; $$;
create function public.trial_release_asset(p_hash text,p_index integer,p_owner uuid) returns void language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin tid:=public.trial_lock(p_hash); if tid is null then return; end if;
 update public.trial_assets set claim_owner=null,lease_until=null where trial_id=tid and asset_index=p_index and claim_owner=p_owner;
end; $$;
create function public.trial_finalize(p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin tid:=public.trial_lock(p_hash); if tid is null then return null; end if;
 if exists(select 1 from public.trial_assets where trial_id=tid and not saved) or not exists(select 1 from public.trial_assets where trial_id=tid) then return '{"error":"busy"}'::jsonb; end if;
 update public.trial_sessions set status='ready' where id=tid and status='uploading'; return public.trial_read(p_hash);
end; $$;
create function public.trial_claim_processing(p_hash text,p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin tid:=public.trial_lock(p_hash); if tid is null then return null; end if;
 if exists(select 1 from public.trial_sessions where id=tid and (processing_attempted or confirmed_at is not null or status<>'ready')) then return null; end if;
 -- Persist the attempt before any provider call; a timeout never repeats AI spend.
 update public.trial_sessions set processing_attempted=true where id=tid;
 if not public.account_limit('trial-ai-global',2,60) then return null; end if;
 update public.trial_sessions set status='processing',processing_owner=p_owner,processing_until=clock_timestamp()+interval '5 minutes' where id=tid;
 return public.trial_read(p_hash);
end; $$;
create function public.trial_save_transcript(p_hash text,p_owner uuid,p_text text) returns void language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin tid:=public.trial_lock(p_hash); if tid is null then return; end if;
 update public.trial_sessions set transcript=p_text where id=tid and processing_owner=p_owner and processing_until>clock_timestamp() and transcript is null and length(p_text) between 1 and 100000;
end; $$;
create function public.trial_finish_processing(p_hash text,p_owner uuid,p_extraction jsonb,p_findings jsonb) returns void language plpgsql security definer set search_path='' as $$
declare tid uuid; item jsonb;
begin tid:=public.trial_lock(p_hash); if tid is null then return; end if;
 if not exists(select 1 from public.trial_sessions where id=tid and processing_owner=p_owner and processing_until>clock_timestamp()) then return; end if;
 for item in select value from jsonb_array_elements(p_findings) loop
  if item->'findings' <> 'null'::jsonb and not public.valid_photo_analysis(item->'findings') then raise exception 'Invalid photo suggestions'; end if;
  update public.trial_assets set ai_findings=nullif(item->'findings','null'::jsonb) where trial_id=tid and id=(item->>'id')::uuid and asset_index>0 and ai_findings is null;
 end loop;
 update public.trial_sessions set extraction=p_extraction,status='ready',processing_owner=null,processing_until=null where id=tid;
end; $$;
create function public.trial_confirm(p_hash text,p_values jsonb,p_boq_ids jsonb,p_notes jsonb,p_draft jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid; s public.trial_sessions%rowtype; item jsonb; idx integer; price public.trial_prices%rowtype; total numeric:=0; confirmed_clock timestamptz:=clock_timestamp();
begin
 tid:=public.trial_lock(p_hash); if tid is null then return null; end if; select * into s from public.trial_sessions where id=tid;
 if s.status not in ('ready','processing') or s.processing_until>clock_timestamp() then return '{"error":"busy"}'::jsonb; end if;
 if jsonb_typeof(p_values->'work_items') is distinct from 'array' or jsonb_typeof(p_boq_ids) is distinct from 'array' or jsonb_typeof(p_notes) is distinct from 'array' or jsonb_array_length(p_values->'work_items')<>jsonb_array_length(p_boq_ids) or jsonb_array_length(p_values->'work_items')>100 then return '{"error":"invalid"}'::jsonb; end if;
 for item,idx in select value,ordinality::integer-1 from jsonb_array_elements(p_values->'work_items') with ordinality loop
  select * into price from public.trial_prices where id=(p_boq_ids->>idx)::uuid;
  if not found or item->>'unit' is distinct from price.unit or jsonb_typeof(item->'quantity') is distinct from 'number' or (item->>'quantity')::numeric<0 or (item->>'quantity')::numeric>=10000000000 or (item->>'quantity')::numeric<>round((item->>'quantity')::numeric,4) then return '{"error":"invalid"}'::jsonb; end if;
  if p_draft->'costing'->'items'->idx->>'rate' is distinct from price.rate::text or (p_draft->'costing'->'items'->idx->>'cost_today')::numeric is distinct from price.rate*(item->>'quantity')::numeric then return '{"error":"invalid"}'::jsonb; end if;
  total:=total+price.rate*(item->>'quantity')::numeric;
 end loop;
 if p_draft->>'currency' is distinct from 'NGN' or (p_draft->'costing'->>'total_cost')::numeric is distinct from total then return '{"error":"invalid"}'::jsonb; end if;
 if jsonb_array_length(p_notes)<>(select count(*) from public.trial_assets where trial_id=tid and asset_index>0) or (select count(distinct value->>'id') from jsonb_array_elements(p_notes))<>jsonb_array_length(p_notes) then return '{"error":"invalid"}'::jsonb; end if;
 for item in select value from jsonb_array_elements(p_notes) loop
  if not exists(select 1 from public.trial_assets where trial_id=tid and id=(item->>'id')::uuid and asset_index>0) or jsonb_typeof(item->'note') is distinct from 'string' or length(item->>'note')>5000 then return '{"error":"invalid"}'::jsonb; end if;
 end loop;
 for item in select value from jsonb_array_elements(p_notes) loop update public.trial_assets set note=item->>'note' where trial_id=tid and id=(item->>'id')::uuid; end loop;
 update public.trial_sessions set confirmed_values=p_values,confirmed_boq_ids=p_boq_ids,confirmed_at=confirmed_clock,draft=jsonb_set(p_draft,'{source,confirmed_at}',to_jsonb(confirmed_clock)),status='ready',processing_owner=null,processing_until=null where id=tid;
 return jsonb_build_object('confirmed_by','Guest trial participant (unverified)','confirmed_at',confirmed_clock);
end; $$;
create function public.trial_origin(p_id uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('id',id,'created_at',manifest->>'captured_at','confirmed_at',confirmed_at,'handover_at',claimed_at,'recorded_by','Guest trial participant (unverified)') from public.trial_sessions where note_id=p_id and claimed_at is not null;
$$;
create function public.trial_handover(p_guest_hash text,p_account_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.trial_sessions%rowtype; actor jsonb; person uuid; asset public.trial_assets%rowtype;
begin
 select * into s from public.trial_sessions where secret_hash=p_guest_hash for update;
 if not found or s.cleaned_at is not null then return null; end if;
 actor:=public.account_session(p_account_hash,true,false);
 if actor is null then return '{"error":"reauthenticate"}'::jsonb; end if;
 if actor->>'source' is distinct from 'browser' or not coalesce((actor->>'email_verified')::boolean,false) or actor->>'name_confirmed_at' is null then return '{"error":"verify_account"}'::jsonb; end if;
 person:=(actor->>'profile_id')::uuid;
 if s.claimed_at is not null then
  if public.account_person(s.claimed_by)=person and public.account_project_access(p_account_hash,s.project_id) is not null then return jsonb_build_object('project_id',s.project_id,'id',s.note_id,'already_saved',true); end if;
  return null;
 end if;
 if s.expires_at<=clock_timestamp() then return null; end if;
 if s.manifest is null or s.status='uploading' or s.processing_until>clock_timestamp() or exists(select 1 from public.trial_assets where trial_id=s.id and (not saved or lease_until>clock_timestamp())) then return '{"error":"busy"}'::jsonb; end if;
 if not public.account_limit('trial-handover:'||person::text,3,86400) then return '{"error":"rate_limited"}'::jsonb; end if;
 insert into public.projects(id,project_code,name,client,location,contract_sum,is_demo)
  values(s.project_id,'TRIAL-'||upper(replace(s.id::text,'-','')),'Private trial / Demo BoQ','Fictional demo client','Demo workspace / Africa/Lagos',(select sum(boq_quantity*rate) from public.trial_prices),true);
 insert into public.account_projects(project_id,owner_profile_id,currency,timezone) values(s.project_id,person,'NGN','Africa/Lagos');
 insert into public.account_memberships(project_id,profile_id,role) values(s.project_id,person,'pm');
 insert into public.account_project_events(project_id,actor_profile_id,action,details) values(s.project_id,person,'created',jsonb_build_object('source','guest_trial_handover','trial_id',s.id));
 insert into public.boq_items(project_id,item_code,section,description,unit,boq_quantity,rate) select s.project_id,item_code,section,description,unit,boq_quantity,rate from public.trial_prices;
 -- A verified claim is a new account intake action. Its original guest identity,
 -- confirmation and timestamps stay immutable in trial_sessions and trial_assets.
 insert into public.submissions(id,project_id,submitted_by,source,status,audio_url,transcript,extraction,created_at)
  values(s.note_id,s.project_id,(actor->>'professional_name')||' (saved from guest trial)','web','extracted',(select 'site-evidence/'||path from public.trial_assets where trial_id=s.id and asset_index=0),s.transcript,s.extraction,(s.manifest->>'captured_at')::timestamptz);
 insert into public.account_submission_people(submission_id,profile_id,role,name,currency,timezone,site_date)
  values(s.note_id,person,'pm',actor->>'professional_name','NGN','Africa/Lagos',((s.manifest->>'captured_at')::timestamptz at time zone 'Africa/Lagos')::date);
 for asset in select * from public.trial_assets where trial_id=s.id and asset_index>0 loop
  insert into public.submission_photos(id,submission_id,storage_url,ai_findings,confirmed_findings) values(asset.id,s.note_id,'site-evidence/'||asset.path,asset.ai_findings,jsonb_build_object('note',asset.note));
  -- Imported suggestions are preserved, including manual-entry results. They do
  -- not enqueue an extra provider request just because ownership changed.
  update public.photo_analysis_jobs set status='manual_entry',error_code='analysis_failed',finished_at=clock_timestamp() where photo_id=asset.id and status='queued';
 end loop;
 update public.account_sessions set active_project_id=s.project_id where secret_hash=p_account_hash;
 if s.expires_at<=clock_timestamp() then raise exception 'Trial expired before handover completed'; end if;
 update public.trial_sessions set claimed_by=person,claimed_at=clock_timestamp(),status='ready',processing_owner=null,processing_until=null where id=s.id;
 return jsonb_build_object('project_id',s.project_id,'id',s.note_id);
end; $$;
-- Existing readers keep their membership checks; append original guest provenance
-- only for handed-over records. Frozen old report snapshots are never changed.
create or replace function public.account_review(p_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor jsonb; s public.submissions%rowtype; result jsonb; trial public.trial_sessions%rowtype; ids jsonb;
begin
  actor := public.account_record_access(p_hash,p_id);
  if actor is null then return null; end if;
  select * into s from public.submissions where id=p_id;
  result:=jsonb_build_object('id',s.id,'project_id',s.project_id,'project_name',(select name from public.projects where id=s.project_id),
    'submitted_by',s.submitted_by,'actor',actor->>'professional_name','actor_role',actor->>'role','timezone',actor->>'timezone','currency',actor->>'currency',
    'archived_at',actor->>'archived_at','created_at',s.created_at,'status',s.status,'transcript',s.transcript,
    'extraction',s.extraction,'confirmed_extraction',s.confirmed_extraction,'confirmed_boq_ids',s.confirmed_boq_ids,
    'confirmed_by',s.confirmed_by,'confirmed_at',s.confirmed_at,'audio_url',s.audio_url,
    'job_status',(select status from public.submission_ai_jobs where submission_id=s.id),
    'pending_media',exists(select 1 from public.telegram_updates where submission_id=s.id and status='pending'),
    'pending_photo_analysis',exists(select 1 from public.photo_analysis_jobs j join public.submission_photos p on p.id=j.photo_id where p.submission_id=s.id and j.status in ('queued','processing')),
    'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'storage_url',p.storage_url,'ai_findings',p.ai_findings,'confirmed_findings',p.confirmed_findings,'analysis_status',j.status) order by p.created_at,p.id),'[]'::jsonb)
      from public.submission_photos p left join public.photo_analysis_jobs j on j.photo_id=p.id where p.submission_id=s.id),
    'boq',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'description',description,'unit',unit,'section',section,'item_code',item_code) order by item_code),'[]'::jsonb) from public.boq_items where project_id=s.project_id));
select * into trial from public.trial_sessions where note_id=p_id and claimed_at is not null;
 if found then
  select coalesce(jsonb_agg(b.id order by x.ordinality),'[]'::jsonb) into ids from jsonb_array_elements_text(trial.confirmed_boq_ids) with ordinality x(id,ordinality) join public.trial_prices t on t.id=x.id::uuid join public.boq_items b on b.project_id=trial.project_id and b.item_code=t.item_code;
  result:=result||jsonb_build_object('guest_origin',public.trial_origin(p_id),'trial_values',trial.confirmed_values,'trial_boq_ids',ids);
 end if; return result;
end; $$;
create or replace function public.account_report_input(p_hash text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; origin jsonb;
begin
 if public.account_record_access(p_hash,p_id) is null then return null; end if;
 result:=public.account_assemble_report(p_id); if result is null then return null; end if;
 origin:=public.trial_origin(p_id);
 if origin is not null and result->'report'->>'status' is distinct from 'locked' then result:=jsonb_set(result,'{source}',result->'source'||jsonb_build_object('guest_origin',origin)); end if;
 return result;
end; $$;
create function public.trial_original(p_hash text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.trial_sessions%rowtype;
begin
 if public.account_record_access(p_hash,p_id) is null then return null; end if;
 select * into s from public.trial_sessions where note_id=p_id and claimed_at is not null;
 if not found then return null; end if;
 return jsonb_build_object('origin',public.trial_origin(p_id),'draft',s.draft,'transcript',s.transcript,'confirmed_values',s.confirmed_values);
end; $$;
create function public.trial_cleanup_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare chosen uuid[]; paths jsonb;
begin
 select array_agg(id) into chosen from (select id from public.trial_sessions where claimed_at is null and cleaned_at is null and expires_at<clock_timestamp()-interval '10 minutes' and (processing_until is null or processing_until<clock_timestamp()) order by expires_at limit 20 for update skip locked) expired;
 if chosen is null then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(path),'[]'::jsonb) into paths from public.trial_assets where trial_id=any(chosen);
 -- Only unclaimed, expired temporary objects are eligible. Failed deletion stays
 -- retryable: the finish function marks cleanup only after storage acknowledges.
 return paths;
end; $$;
create function public.trial_cleanup_finish(p_paths jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.trial_sessions s set cleaned_at=clock_timestamp() where s.claimed_at is null and s.expires_at<clock_timestamp()-interval '10 minutes'
  and exists(select 1 from public.trial_assets a where a.trial_id=s.id)
  and not exists(select 1 from public.trial_assets a where a.trial_id=s.id and not (p_paths ? a.path));
end; $$;
-- Privileged server RPCs only. Guest cookies are never Supabase identities.
do $$ declare row record; begin
 for row in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('trial_prices','trial_sessions','trial_assets') loop execute format('alter table public.%I enable row level security',row.relname);execute format('revoke all on public.%I from public,anon,authenticated,service_role',row.relname); end loop;
 for row in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'trial_%' or p.proname in ('account_review','account_report_input')) loop execute format('revoke all on function %s from public,anon,authenticated,service_role',row.signature);execute format('grant execute on function %s to service_role',row.signature); end loop;
end; $$;
notify pgrst,'reload schema';
commit;
