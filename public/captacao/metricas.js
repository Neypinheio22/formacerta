/* Atribuição de primeira parte, sem cookies nem dados pessoais. */
(()=>{
  const root="https://zyxftkspkerttjqvepbg.supabase.co/functions/v1/captacao-metricas";
  const form=document.getElementById("captacao-form");
  if(!form)return;
  const perfil=form.dataset.perfil==="profissional"?"profissional":"aluno";
  const id=crypto.randomUUID();
  const params=new URLSearchParams(location.search);
  const pick=name=>(params.get(name)||"").slice(0,100).replace(/[^a-zA-Z0-9_.-]/g,"");
  const post=(payload,keepalive=false)=>fetch(root,{
    method:"POST",headers:{"Content-Type":"application/json"},
    keepalive,body:JSON.stringify(payload)
  });
  const visit=post({
    acao:"visita",visita_id:id,perfil,
    utm_source:pick("utm_source"),utm_medium:pick("utm_medium"),
    utm_campaign:pick("utm_campaign"),utm_content:pick("utm_content")
  }).then(async r=>{if(!r.ok)throw new Error("Medição indisponível");return true;}).catch(()=>false);
  window.FormaCertaMetricas={
    visita_id:id,
    pronta:visit,
    registrar:async destino=>{
      if(destino!=="whatsapp"&&destino!=="aplicativo")return;
      if(!await visit)return;
      try{await post({acao:"clique",visita_id:id,destino},true);}catch{}
    }
  };
  document.addEventListener("click",e=>{
    const a=e.target.closest?.("a");
    if(!a)return;
    if(a.id==="continuar-whatsapp")void window.FormaCertaMetricas.registrar("whatsapp");
    if(a.closest("#depois")&&a.id!=="continuar-whatsapp")void window.FormaCertaMetricas.registrar("aplicativo");
  });
})();