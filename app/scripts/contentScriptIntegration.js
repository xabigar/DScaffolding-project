const Modes = require('./background/Modes')

window.addEventListener('load', () => {
  chrome.runtime.sendMessage({scope:"extension",cmd:"getCurrentMode"},function(response){
    if(response==null||response.id==null) return;
    if(response.id==Modes['annotation'].id){
      chrome.runtime.sendMessage({scope:"dscaffolding",cmd:"annotationEnabled"});
      chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
        if(request.scope=='extension'&&request.cmd=='browserActionClicked'){
          chrome.runtime.sendMessage({
            scope: 'extension',
            cmd: 'setMode',
            params: {mode: Modes['original'], reload: true}
          });
        }
      })
    }
    else if(response.id==Modes['original'].id){
      chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
        if(request.scope=='extension'&&request.cmd=='browserActionClicked'){
          chrome.runtime.sendMessage({
            scope: 'extension',
            cmd: 'setMode',
            params: {mode: Modes['annotation'], reload: true}
          });
        }
      })
    }
  })
})
