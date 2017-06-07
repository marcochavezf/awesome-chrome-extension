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

function getFunctionDataAndType(angularComp, callFrame, typesAngularComp){
  var maxToleranceLOC = 5;
  var functionData = null;

  switch (typesAngularComp) {
    case 'controllers':
      functionData = _.find(angularComp.scopeFunctions, (scopeFunction) => {
        return scopeFunction.name == callFrame.functionName &&
            Math.abs(scopeFunction.node.loc.start.line - callFrame.lineNumber) < maxToleranceLOC;
      });
      functionData = _.find(angularComp.scopeFunctions, (scopeFunction) => {
        return scopeFunction.name == callFrame.functionName &&
            Math.abs(scopeFunction.node.loc.start.line - callFrame.lineNumber) < maxToleranceLOC;
      });
      break;

    case 'directives':
      break;

    case 'services':
      break;

    case 'filters':
      break;

    case 'globalFunctions':
      break;

    case 'globalVariables':
      break;
  }

  if (_.isNil(functionData)) {
    //debugger;
    //throw new Error('function data not found');
  }
  return functionData;
}

function getAngularDataFromCallFrame(fileSemantic, callFrame){
  var angularData = null;
  _.each(fileSemantic, (angularCompArray, typesAngularComp) => {
    if (!_.isEmpty(angularData)){
      return;
    }

    _.each(angularCompArray, (angularComp) => {
      if (!_.isEmpty(angularData)){
        return;
      }

      if (_.isEmpty(callFrame.functionName)) {
        //TODO: verify the type of angular component, we're just retrieving the first one from the parsed file.
        angularData = {
          types: typesAngularComp,
          angularComponent: angularComp,
          functionData: functionData
        };
      } else {
        var functionData = getFunctionDataAndType(angularComp, callFrame, typesAngularComp);
        angularData = {
          types: typesAngularComp,
          angularComponent: angularComp,
          functionData: functionData
        };
      }
    });
  });

  return angularData;
}

function getTextNode(functionAngularData, callFrame, url) {

  var angularComponentName = '';
  if (_.has(functionAngularData, 'angularComponent')) {
    angularComponentName = functionAngularData.angularComponent.name;
  }
  var functionName = angularComponentName + ':' + callFrame.functionName + '()';
  if (_.isEmpty(angularComponentName)) {
    functionName = callFrame.functionName + '()';
  }
  if (_.isEmpty(callFrame.functionName)) {
    functionName = angularComponentName + ' ' + 'Anonymous Fn';
    if (_.isEmpty(angularComponentName)) {
      functionName = 'Anonymous Fn';
    }
  }
  var text = functionName + ' - ' + url + ':' + callFrame.lineNumber;
  return text;
}

function getType(functionAngularData) {
  if (_.has(functionAngularData, 'types')) {
    return functionAngularData.types;
  } else {
    return 'none';
  }
}

function generateJstreeNodes(projectNodes, projectSemantics, path) {
  return _.map(projectNodes, function(projectNode){

    var callFrame = projectNode.callFrame;
    var url = callFrame.url.replace(path, '');
    var fileParsed = _.find(projectSemantics.filesParsed, {pathFile: url});
    var functionAngularData = getAngularDataFromCallFrame(fileParsed.fileSemantic, callFrame);

    var text = getTextNode(functionAngularData, callFrame, url);
    var type = getType(functionAngularData);
    return {
      'text' : text,
      'type' : type,
      'children' : generateJstreeNodes(projectNode.childrenNodes, projectSemantics, path),
      'data': _.omit(projectNode, ['childrenNodes'])
    };
  });
}

function displayContent(content, tabContent){
  //TODO: merge generated debugger data with project semantics
  console.log(tabContent);
  var projectNodes = tabContent.projectNodes;
  var projectSemantics = tabContent.projectSemantics;
  if (_.isEmpty(projectNodes)) {
    content.innerHTML = 'No data registered';
    return;
  }

  var tabContent = tabContent.tabContent;
  var path = tabContent.location.origin;

  var ctlrsJstreeData = generateJstreeNodes(projectNodes, projectSemantics, path);
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
