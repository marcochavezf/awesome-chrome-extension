'use strict';

chrome.extension.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action == 'get_scripts_content') {
    getScriptsContent()
      .then(function(values){
        chrome.runtime.sendMessage({type: 'scripts_content', scriptsContent: values });
      })
  }
});

/* We wrap this function just in case we need another library instead of jQuery */
function httpGet(script) {
  return $.get(script.src).then(content => {
    return {script, content};
  }).catch(error => {
    debugger;
  })
}

function getScriptsContent() {
  var scripts = document.getElementsByTagName('script');
  var promises = [];

  for (var i = 0; i < scripts.length; i++) {
    var script = scripts[i];
    if (script.src) {
      var isFromDifferentHost = script.src.indexOf(window.location.host) === -1;
      if (isFromDifferentHost) {
        continue;
      }

      var promise = httpGet(script);
      promises.push(promise);
    } else {
      //console.log(i, script.innerHTML)
    }
  }

  return Promise.all(promises);
}