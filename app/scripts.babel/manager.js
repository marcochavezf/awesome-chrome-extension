chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  var loading = document.getElementById('loading');
  var content = document.getElementById('content');
  var status = document.getElementById('status');
  status.innerHTML = 'Loading...';
  
  switch (msg.action) {
    case 'update_status':
      loading.style.display = 'block';
      content.style.display = 'none';
      status.innerHTML = msg.status;
      break;

    case 'data':
      displayContent(content, msg.tabContent)
      loading.style.display = 'none';
      content.style.display = 'block';
      console.log('data', msg, sender);
      break;
  }

  sendResponse('received');
});

function displayContent(content, tabContent){
  //TODO: merge generated debugger data with project semantics
  content.innerHTML = 'Data received';
}

document.addEventListener('DOMContentLoaded', function() {
});
