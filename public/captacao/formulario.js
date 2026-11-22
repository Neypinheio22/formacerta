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
  const whatsappNumero="551153040224"; // Número oficial conectado ao agente FormaCerta
  const prazoRotulo={agora:"Quero começar agora","7_dias":"Nos próximos 7 dias",pesquisando:"Ainda estou pesquisando"};
  function textoWhatsApp(nome, objetivo, prazo, perfil) {
    const primeiro=nome.split(/\s+/)[0].slice(0,40);
    const origem=perfil==="profissional"?"personal trainer":"aluno(a)";
    return "Olá, equipe FormaCerta! Meu nome é "+primeiro+". Acabei de preencher o formulário como "+origem+
      ". Meu objetivo é "+objetivo+". "+(prazoRotulo[prazo]||"")+"."+
      " Gostaria de ajuda para começar.";
  }
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
    const prazo_inicio=get("prazo_inicio").value;
    if(!["agora","7_dias","pesquisando"].includes(prazo_inicio)){
      status.textContent="Escolha quando pretende começar.";
      status.classList.add("error");btn.disabled=false;btn.textContent="Solicitar acesso gratuito";return;
    }
    try{
      const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        acao:"captar",nome,telefone,email:get("email")?.value.trim()||"",
        perfil,objetivo:get("objetivo").value,prazo_inicio,website:get("website").value,
        iniciado_em:started,consentimento_contato:get("consentimento").checked,
        consentimento_marketing:get("marketing")?.checked===true,campanha
      })});
      const payload=await res.json();
      if(!res.ok||!payload.ok)throw new Error(payload.erro||"Não foi possível registrar sua inscrição.");
      form.hidden=true;
      document.querySelector(".capture-intro").hidden=true;
      const wa=get("continuar-whatsapp");
      const mensagem=textoWhatsApp(nome,get("objetivo").value,prazo_inicio,perfil);
      if(wa){wa.href="https://wa.me/"+whatsappNumero+"?text="+encodeURIComponent(mensagem);wa.hidden=false;}
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