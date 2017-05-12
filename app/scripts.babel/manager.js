chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  document.getElementById('status').innerHTML = 'Loading...';
  switch (msg.action) {
    case 'update_status':
      console.log('update_status', msg, sender);
      document.getElementById('status').innerHTML = msg.status;
      break;

    case 'data':
      document.getElementById('status').innerHTML = 'DATA RECEIVED!';
      console.log('data', msg, sender);
      break;
  }
  sendResponse('received');
});

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('status').innerHTML = 'Loading...';
  debugger;
});
