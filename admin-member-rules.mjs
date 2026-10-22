/** UI validation, not authorization. All permissions are verified by Supabase RPC. */
export function canEditMemberDisplayName(adminId,memberId){
 return Boolean(adminId&&memberId&&adminId!==memberId);
}
export function normalizeMemberDisplayName(value){
 const name=String(value??'').trim().replace(/ +/g,' ');
 if(name.length<2||name.length>80||/[\u0000-\u001f\u007f]/.test(name))
  return {valid:false,value:null,message:'Le nom doit contenir entre 2 et 80 caractères, sans caractères de contrôle.'};
 return {valid:true,value:name,message:''};
}
export function isProfileNameChanged(before,after){
 const parsed=normalizeMemberDisplayName(after);
 return parsed.valid&&parsed.value!==before;
}
