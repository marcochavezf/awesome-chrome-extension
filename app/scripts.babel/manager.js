chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  var loading = document.getElementById('loading');
  var content = document.getElementById('content');
  var status = document.getElementById('status');
  status.innerHTML = 'Loading...';
  sendResponse('received');
  
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
});

function generateJstreeNodes(projectNodes) {
  return _.map(projectNodes, function(projectNode){
    var text = projectNode.callFrame.url;
    return {
      'text' : text,
      'type' : 'controller',
      'children' : generateJstreeNodes(projectNode.childrenNodes),
      'data': _.omit(projectNode, ['childrenNodes'])
    };
  });
}

function displayContent(content, tabContent){
  //TODO: merge generated debugger data with project semantics
  var projectNodes = tabContent.projectNodes;
  if (_.isEmpty(projectNodes)) {
    content.innerHTML = 'No data registered';
    return;
  }

  var ctlrsJstreeData = generateJstreeNodes(projectNodes);
  var jstreeConfig = createJstreeConfig(ctlrsJstreeData);

  content.innerHTML = '';
  $('#code-nodes')
    .on('select_node.jstree', function (e, data) {
      console.log(e,data);
    }).jstree(jstreeConfig);
}

function createJstreeConfig(data){
  return {
    'core' : {
      'data' : data
    },
    'types' : {
      'controller' : { 'icon' : './images/circle_red.png' },
      'property' : { 'icon' : './images/circle_purple.png' },
      'function' : { 'icon' : './images/circle_yellow.png' }
    },
    'plugins' : [ 'types' ]
  };
}

document.addEventListener('DOMContentLoaded', function() {

});
