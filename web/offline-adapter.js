/* Local edition UI adapter. External networking is denied by Android itself. */
(function(){
  'use strict';
  window.PS_OFFLINE=true;
  function local(url){try{return new URL(url,location.href).origin===location.origin;}catch(e){return false;}}
  var nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,options){var url=typeof input==='string'?input:input.url;if(!local(url))return Promise.reject(new TypeError('La edición offline no usa servicios externos'));return nativeFetch(input,options);};
  function apply(){
    var guest=document.getElementById('btn-guest');if(guest)guest.textContent='Jugar / continuar partida local';
    var note=document.getElementById('menu-guest');if(note)note.textContent='Edición offline parcial · guardado local automático';
    ['btn-google','btn-auth','f-forgot','menu-forum','menu-banner','btn-yt','btn-discord','btn-support','btn-logout'].forEach(function(id){var el=document.getElementById(id);if(el)el.hidden=true;});
    var login=document.getElementById('login-form');if(login)login.hidden=true;
    var tabs=document.querySelector('#scr-login .tabs');if(tabs)tabs.hidden=true;
    var mode=document.getElementById('login-mode');if(mode)mode.textContent='Partida local guardada en este dispositivo · sin conexión';
  }
  document.addEventListener('DOMContentLoaded',function(){
    var css=document.createElement('style');css.textContent='[hidden]{display:none!important}#menu-guest{color:#ffcf69!important}';document.head.appendChild(css);
    apply();setInterval(apply,1000);
  });
  document.addEventListener('visibilitychange',function(){if(document.hidden)window.dispatchEvent(new Event('ps-offline-save'));});
})();
