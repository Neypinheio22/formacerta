(()=>{
  const endpoint="https://zyxftkspkerttjqvepbg.supabase.co/functions/v1/captacao-lead";
  const form=document.querySelector("#captacao-form");
  if(!form)return;
  const started=Date.now();
  const params=new URLSearchParams(location.search);
  const perfil=form.dataset.perfil;
  const status=document.querySelector("#form-status");
  const btn=form.querySelector('button[type="submit"]');
  const after=document.querySelector("#depois");
  const get=id=>document.querySelector("#"+id);
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!form.reportValidity())return;
    btn.disabled=true;btn.textContent="Enviando seus dados…";
    status.className="feedback";status.textContent="";
    const nome=get("nome").value.trim();
    const raw=get("telefone").value.replace(/\D/g,"");
    const telefone=raw.startsWith("55")?raw:"55"+raw;
    if(!/^55[1-9][0-9][2-9][0-9]{7,8}$/.test(telefone)){
      status.textContent="Informe um número de WhatsApp brasileiro com DDD.";
      status.classList.add("error");btn.disabled=false;btn.textContent="Solicitar acesso gratuito";return;
    }
    const campanha=(params.get("utm_campaign")||"captacao_"+perfil).slice(0,120);
    try{
      const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        acao:"captar",nome,telefone,email:get("email")?.value.trim()||"",
        perfil,objetivo:get("objetivo").value,website:get("website").value,
        iniciado_em:started,consentimento_contato:get("consentimento").checked,
        consentimento_marketing:get("marketing")?.checked===true,campanha
      })});
      const payload=await res.json();
      if(!res.ok||!payload.ok)throw new Error(payload.erro||"Não foi possível registrar sua inscrição.");
      form.hidden=true;
      document.querySelector(".capture-intro").hidden=true;
      after.classList.add("show");
      after.setAttribute("tabindex","-1");after.focus();
      if(Array.isArray(window.dataLayer))window.dataLayer.push({event:"lead_formacerta_enviado",lead_perfil:perfil});
    }catch(err){
      status.classList.add("error");
      status.textContent=err instanceof Error?err.message:"Tente novamente.";
      btn.disabled=false;btn.textContent="Solicitar acesso gratuito";
    }
  });
})();