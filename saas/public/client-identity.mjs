const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const sourceId=value=>String(value||'').replace(/^D2F-BS-CLIENT-/,'');
export function sameClientIdentity(mission,remote){
 const scope=mission.client_scope||{};
 if(scope.d2f_business_suite_client_id)return sourceId(scope.d2f_business_suite_client_id)===sourceId(remote.id);
 const country=String(mission.client_country||'').toUpperCase(),other=String(remote.country||'').toUpperCase();
 if(/^[A-Z]{2}$/.test(country)&&/^[A-Z]{2}$/.test(other)&&country!==other)return false;
 for(const [local,source] of [[mission.client_siren,remote.siren],[scope.client_legal_identifier,remote.legalIdentifier],[scope.client_vat_id,remote.vatId]])if(key(local)&&key(local)===key(source))return true;
 return Boolean(key(mission.client_name)&&key(mission.client_name)===key(remote.name));
}
