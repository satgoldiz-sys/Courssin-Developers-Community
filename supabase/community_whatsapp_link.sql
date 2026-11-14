-- Set the shared CCD community WhatsApp invite for every existing batch.
-- Run this in the Supabase SQL Editor after reviewing the invite URL.
begin;

update public.batches
set whatsapp_invite_url = 'https://chat.whatsapp.com/HLFmAATDowQKFLjhamkoh2';

select count(*) as batches_with_shared_community_invite
from public.batches
where whatsapp_invite_url = 'https://chat.whatsapp.com/HLFmAATDowQKFLjhamkoh2';

commit;
