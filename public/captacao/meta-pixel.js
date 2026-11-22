/* Meta Pixel: carrega apenas após autorização específica e somente com Pixel ID válido.
   Não envia nome, telefone, e-mail, objetivo, prazo, resultados de saúde ou outros dados do formulário. */
(() => {
  const pixelId=String(window.FormaCertaMetaConfig?.pixelId || "").trim();
  if (!/^\d{10,20}$/.test(pixelId)) return; // Sem um ID real da Meta, nenhuma requisição é feita.
  let ativo=false;
  function ativar() {
    if(ativo) return;
    if(document.querySelector("#meta_tracking")?.checked !== true) return;
    ativo=true;
    !function(f,b,e,v,n,t,s) {
      if(f.fbq)return;
      n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];
      t=b.createElement(e);t.async=!0;t.src=v;
      s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
    }(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init",pixelId);
    window.fbq("track","PageView");
  }
  window.FormaCertaMetaPixel={
    ativar,
    lead(qualificacao) {
      if(document.querySelector("#meta_tracking")?.checked!==true)return;
      ativar();
      if(!ativo)return;
      window.fbq("track","Lead");
      if(qualificacao==="quente")window.fbq("trackCustom","QualifiedLead");
    }
  };
  document.querySelector("#meta_tracking")?.addEventListener("change",(ev)=>{
    if(ev.target.checked)ativar();
  });
})();
