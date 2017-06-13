chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  var loading = document.getElementById('loading');
  var content = document.getElementById('content');
  var status = document.getElementById('status');
  status.innerHTML = 'Loading...';
  $('#code-nodes').jstree('destroy').empty();
  sendResponse('received');
  
  switch (msg.action) {
    case 'update_status':
      loading.style.display = 'block';
      content.style.display = 'none';
      status.innerHTML = msg.status;
      break;

    case 'jstree_data':
      displayContent(content, msg.jsTreeData)
      loading.style.display = 'none';
      content.style.display = 'block';
      console.log('data', msg, sender);
      break;
  }
});

function displayContent(content, jsTreeData){
  if (_.isEmpty(jsTreeData)) {
    content.innerHTML = 'No data registered';
    return;
  }

  var jstreeConfig = createJstreeConfig(jsTreeData);
  content.innerHTML = '';
  $('#code-nodes')
  .on('select_node.jstree', function (e, data) {
    console.log(e,data);
  })
  .on('ready.jstree', function() {
    $('#code-nodes').jstree('open_all');
  }).jstree(jstreeConfig);
}

function createJstreeConfig(data){
  return {
    'core' : {
      'data' : data
    },
    'types' : {
      'controllers' : { 'icon' : './images/circle_red.png' },
      'services' : { 'icon' : './images/circle_purple.png' },
      'directives' : { 'icon' : './images/circle_blue.png' },
      'filters' : { 'icon' : './images/circle_yellow.png' },
      'none' : { 'icon' : './images/circle_orange.png' },
      'default' : { 'icon' : './images/circle_orange.png' }
    },
    'plugins' : [ 'types' ]
  };
}

document.addEventListener('DOMContentLoaded', function() {

});
