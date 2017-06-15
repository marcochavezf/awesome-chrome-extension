chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  var loading = document.getElementById('loading');
  var content = document.getElementById('content');
  var status = document.getElementById('status');
  var openTreeBtn = document.getElementById('open_tree');
  var closeTreeBtn = document.getElementById('close_tree');

  status.innerHTML = 'Loading, please wait...';
  $('#profile-nodes').jstree('destroy').empty();
  $('#semantic-nodes').jstree('destroy').empty();
  sendResponse('received');
  
  switch (msg.action) {
    case 'update_status':
      loading.style.display = 'block';
      content.style.display = 'none';
      openTreeBtn.style.display = 'none';
      closeTreeBtn.style.display = 'none';
      status.innerHTML = msg.status;
      break;

    case 'jstree_data':
      displayContent(content, msg.jsTreeData)
      loading.style.display = 'none';
      content.style.display = 'block';
      openTreeBtn.style.display = 'block';
      closeTreeBtn.style.display = 'block';
      console.log('data', msg, sender);
      break;
  }
});

function displayContent(content, jsTreeData){
  if (_.isEmpty(jsTreeData)) {
    content.innerHTML = 'No data registered';
    return;
  }

  var profileJstreeData = jsTreeData.profile;
  var profileJstreeConfig = createJstreeConfig(profileJstreeData);
  content.innerHTML = '';
  $('#profile-nodes')
  .on('select_node.jstree', function (e, data) {
    console.log(e,data);
  })
  .on('ready.jstree', function() {
    $('#profile-nodes').jstree('open_all');
  }).jstree(profileJstreeConfig);
  
  var semanticJstreeData = jsTreeData.semanticsUsed;
  var semanticJstreeConfig = createJstreeConfig(semanticJstreeData);
  content.innerHTML = '';
  $('#semantic-nodes')
  .on('select_node.jstree', function (e, data) {
    console.log(e,data);
  })
  .on('ready.jstree', function() {
    $('#semantic-nodes').jstree('open_all');
  }).jstree(semanticJstreeConfig);
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
  console.log('DOMContentLoaded');
});

$(function() {
  $('#open_tree').click(function(event) {
    $('#profile-nodes').jstree('open_all');
  });

  $('#close_tree').click(function(event) {
    $('#profile-nodes').jstree('close_all');
  });
});
