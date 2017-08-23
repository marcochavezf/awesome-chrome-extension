var editor = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  var loading = document.getElementById('loading');
  var content = document.getElementById('content');
  var status = document.getElementById('status');
  var openTreeBtn = document.getElementById('open_tree');
  var closeTreeBtn = document.getElementById('close_tree');

  cleanEditor();
  status.innerHTML = 'Loading, please wait...';
  $('#profile-nodes').jstree('destroy').empty();
  $('#semantic-nodes').jstree('destroy').empty();
  sendResponse('received');
  
  switch (msg.action) {
    case 'update_status':
      status.innerHTML = msg.status;
      loading.style.display = 'block';
      content.style.display = 'none';
      openTreeBtn.style.display = 'none';
      closeTreeBtn.style.display = 'none';
      break;

    case 'jstree_data':
      displayContent(content, msg.jsTreeData);
      loading.style.display = 'none';
      content.style.display = 'block';
      openTreeBtn.style.display = 'block';
      closeTreeBtn.style.display = 'block';
      break;
  }
});

function openScriptContent({ scriptsContent, nodeData }){
  if (!editor) {
    return;
  }

  if (!nodeData) {
    cleanEditor();
    return;
  }

  var scriptContent = _.find(scriptsContent, { path: nodeData.path });
  var editorSessionId = nodeData.path;

  if (editor.sessionId !== editorSessionId) {
    editor.sessionId = editorSessionId;
    editor.setValue(scriptContent.content);
  }

  var lineNumber = nodeData.callFrame ? nodeData.callFrame.lineNumber : 1;
  var columnNumber = nodeData.callFrame ? nodeData.callFrame.columnNumber : 0;
  editor.resize(true);
  editor.gotoLine(lineNumber, columnNumber);
  //editor.getSession().setUndoManager(new ace.UndoManager());
}

function cleanEditor(){
  if (editor) {
    editor.sessionId = '';
    editor.setValue('');
  }
}

function setHighlightNode(nodeDOM, highlight) {
  if (!nodeDOM[0].childNodes[1].originalStyle) {
    nodeDOM[0].childNodes[1].originalStyle = _.cloneDeep(nodeDOM[0].childNodes[1].style);
  }

  if (highlight) {
    nodeDOM[0].childNodes[1].style.backgroundColor = 'yellow';
  } else {
    nodeDOM[0].childNodes[1].style = nodeDOM[0].childNodes[1].originalStyle;
  }
}

function displayContent(content, jsTreeData){
  if (_.isEmpty(jsTreeData)) {
    content.innerHTML = 'No data registered';
    return;
  }
  
  var scriptsContent = jsTreeData.scriptsContent;
  var profileJstreeData = jsTreeData.profile;
  var profileJstreeConfig = createJstreeConfig(profileJstreeData);
  content.innerHTML = '';
  $('#profile-nodes')
  .on('select_node.jstree', function (e, data) {
    var profileNodeData = data.node.data;
    openScriptContent({ scriptsContent, nodeData: profileNodeData });
    var semanticNodes = null;
    try {
      semanticNodes = $('#semantic-nodes').jstree().get_json($('#semantic-nodes'), { flat: true });
    } catch (e) {
      return;
    }
    $('#semantic-nodes').jstree().deselect_node(semanticNodes);
  })
  .on('ready.jstree', function() {
    $('#profile-nodes').jstree('open_all');
  }).jstree(profileJstreeConfig);
  
  var semanticJstreeData = jsTreeData.semanticsUsed;
  var semanticJstreeConfig = createJstreeConfig(semanticJstreeData);
  content.innerHTML = '';
  $('#semantic-nodes')
  .on('select_node.jstree', function (e, data) {
    var semanticNodeData = data.node.data;
    openScriptContent({ scriptsContent, nodeData: semanticNodeData });
    var nodes = null;
    try {
      nodes = $('#profile-nodes').jstree().get_json($('#profile-nodes'), { flat: true });
    } catch (e) {
      return;
    }
    $('#profile-nodes').jstree().deselect_node(nodes);
    //get the nodes that match with this node (set an identifier like the angular component name and the name of the function)
    _.each(nodes, function(value) {
      var profileNodeDOM = $('#profile-nodes').jstree().get_node(value.id, true);
      var profileNodeData = value.data;
      setHighlightNode(profileNodeDOM, false);

      if (!semanticNodeData) {
        cleanEditor();
        return;
      }

      if (semanticNodeData.angularCompName == profileNodeData.angularCompName) {
        if (semanticNodeData.callFrame) {
          if (_.isEqual(semanticNodeData.callFrame, profileNodeData.callFrame)) {
            setHighlightNode(profileNodeDOM, true);
          }
        } else {
          setHighlightNode(profileNodeDOM, true);
        }
      }
    });
  })
  .bind('loaded.jstree', function (e, data) {
    /**
     * Open nodes on load (until 2nd level)
     */
    var depth = 2;
    data.instance.get_container().find('li').each(function (i) {
      if (data.instance.get_path($(this)).length <= depth) {
        data.instance.open_node($(this));
      }
    });
  })
  .jstree(semanticJstreeConfig);
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

  Split(['#a', '#b'], {
    direction: 'horizontal',
    sizes: [50, 50],
    gutterSize: 8,
    cursor: 'col-resize'
  });

  Split(['#c'], {
    direction: 'vertical',
    sizes: [100],
    gutterSize: 8,
    cursor: 'row-resize'
  });

  Split(['#d', '#e'], {
    direction: 'vertical',
    sizes: [60, 40],
    gutterSize: 8,
    cursor: 'row-resize'
  });

  editor = ace.edit('editor');
  editor.setTheme('ace/theme/chrome');
  editor.getSession().setMode('ace/mode/javascript');
});
