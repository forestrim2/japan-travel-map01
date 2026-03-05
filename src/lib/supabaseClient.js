import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://ozvslszvfpbebxmidcev.supabase.co"
const supabaseKey = "sb_publishable_eeVPdCJ5pftoKKMvOek8fw_RigagVd4"

export const supabase = createClient(supabaseUrl, supabaseKey)