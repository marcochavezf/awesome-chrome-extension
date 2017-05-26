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

    case 'data':
      displayContent(content, msg.tabContent)
      loading.style.display = 'none';
      content.style.display = 'block';
      console.log('data', msg, sender);
      break;
  }
});

function generateJstreeNodes(projectNodes, path) {
  return _.map(projectNodes, function(projectNode){
    var callFrame = projectNode.callFrame;
    var url = callFrame.url.replace(path, '');
    var functionName = callFrame.functionName + '()';
    if (_.isEmpty(callFrame.functionName)) {
      functionName = 'Anonymous Fn';
    }
    var text = functionName + ' - ' + url + ':' + callFrame.lineNumber;
    return {
      'text' : text,
      'type' : 'controller',
      'children' : generateJstreeNodes(projectNode.childrenNodes, path),
      'data': _.omit(projectNode, ['childrenNodes'])
    };
  });
}

function displayContent(content, tabContent){
  //TODO: merge generated debugger data with project semantics
  console.log(tabContent);
  var projectNodes = tabContent.projectNodes;
  if (_.isEmpty(projectNodes)) {
    content.innerHTML = 'No data registered';
    return;
  }

  var tabContent = tabContent.tabContent;
  var path = tabContent.location.origin;

  var ctlrsJstreeData = generateJstreeNodes(projectNodes, path);
  var jstreeConfig = createJstreeConfig(ctlrsJstreeData);

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
      'controller' : { 'icon' : './images/circle_red.png' },
      'property' : { 'icon' : './images/circle_purple.png' },
      'function' : { 'icon' : './images/circle_yellow.png' }
    },
    'plugins' : [ 'types' ]
  };
}

document.addEventListener('DOMContentLoaded', function() {

});
