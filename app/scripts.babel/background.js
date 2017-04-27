'use strict';
// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var attachedTabs = {};
var tabsContent = {};
var version = '1.0';

chrome.debugger.onEvent.addListener(onEvent);
chrome.debugger.onDetach.addListener(onDetach);

chrome.browserAction.onClicked.addListener(function(tab) {
  var tabId = tab.id;
  toggleDebugger(tabId);
  /*
  if (!tabsContent[tabId]) {
    chrome.browserAction.setIcon({tabId: tabId, path:'images/debuggerPausing.png'});
    chrome.browserAction.setTitle({tabId: tabId, title:'Pausing JavaScript'});

    chrome.tabs.sendMessage(tab.id, {action: 'get_tab_content'});
  } else {
    toggleDebugger(tabId);
  }
  */
});

chrome.runtime.onMessage.addListener(function(request, sender) {
  var tabId = sender.tab.id;
  if (request.type == 'tab_content') {
    tabsContent[tabId] = request.tabContent;
    var projectStructure = getProjectStructure(request.tabContent);
    angularEsprimaFun.createSemanticsFromSrc({
      pathAndSrcFiles: projectStructure.srcContent
    }, function(projectSemantics){
      console.log(projectSemantics);
      chrome.browserAction.setIcon({tabId:tabId, path:'images/record.png'});
      chrome.browserAction.setTitle({tabId:tabId, title:'Record AngularJs project'});
      debugger;
      //TODO: merge generated debugger data with project semantics
    });
  }
});

function getProjectStructure(tabContent) {
  var scriptsContent = tabContent.scriptsContent;
  var contentOnlyJs = _.filter(scriptsContent, (content) => {
    return content.path.includes('.js');
  });
  var contentGroupedByLevel = _.groupBy(contentOnlyJs, (content) => {
    return content.path.split('/').length;
  });

  var shortestLevel = 0;
  var largestLevel = 0;
  _.forIn(contentGroupedByLevel, function(value, key) {
    var level = parseInt(key);
    if (shortestLevel) {
      if (level < shortestLevel) {
        shortestLevel = level;
      }
    } else {
      shortestLevel = level;
    }

    if (level > largestLevel) {
      largestLevel = level;
    }
  });

  var angularContentWithShortestPath = null;
  for (var index = shortestLevel; index <= largestLevel; index++) {
    var scriptsContentByLevel = contentGroupedByLevel[index];
    var fileWithAngular = _.find(scriptsContentByLevel, (content) => {
      var isAngularFile = content.content.includes('angular.module');
      var isGoogleProperty = content.content.includes('(c) 2010-2015 Google, Inc.');
      return isAngularFile && !isGoogleProperty
    });
    if (fileWithAngular) {
      angularContentWithShortestPath = fileWithAngular;
      break;
    }
  }

  if (!angularContentWithShortestPath) {
    throw new Error('There\'s no Angular path!');
  }

  //TODO: we could ask if this is the project path

  var pathArrayProjectFile = angularContentWithShortestPath.path.split('/');
  var srcFolder = pathArrayProjectFile[0];
  if (_.isEmpty(srcFolder)) {
    srcFolder = pathArrayProjectFile[1];
  }
  var srcContent = [];
  var thirdPartyContent = [];
  scriptsContent.forEach(content => {
    if (content.path.includes(srcFolder)) {
      srcContent.push(content);
    } else {
      thirdPartyContent.push(content);
    }
  });

  return { srcContent, thirdPartyContent };
}

function toggleDebugger(tabId){
  var debuggeeId = {tabId:tabId};

  if (attachedTabs[tabId] == 'pausing')
    return;

  if (!attachedTabs[tabId]) {
    chrome.debugger.attach(debuggeeId, version, onAttach.bind(null, debuggeeId));
  } else if (attachedTabs[tabId]) {
    chrome.debugger.sendCommand(debuggeeId, 'Profiler.stop', function (profile) {
      console.log(profile);
      chrome.debugger.detach(debuggeeId, onDetach.bind(null, debuggeeId));
      chrome.tabs.sendMessage(tabId, {action: 'get_tab_content'});
    });
  }
}

function onAttach(debuggeeId) {
  if (chrome.runtime.lastError) {
    alert(chrome.runtime.lastError.message);
    return;
  }

  var tabId = debuggeeId.tabId;
  chrome.browserAction.setIcon({tabId: tabId, path:'images/stop.png'});
  chrome.browserAction.setTitle({tabId: tabId, title:'Recording AngularJs project'});
  attachedTabs[tabId] = 'recording';
  chrome.debugger.sendCommand(
    debuggeeId, 'Profiler.enable', {},
    onDebuggerEnabled.bind(null, debuggeeId));
}

function onDebuggerEnabled(debuggeeId) {
  chrome.debugger.sendCommand(debuggeeId, 'Profiler.start');
}

function onEvent(debuggeeId, method) {
  var tabId = debuggeeId.tabId;
  if (method == 'Debugger.paused') {
    attachedTabs[tabId] = 'paused';
    chrome.browserAction.setIcon({tabId:tabId, path:'images/debuggerContinue.png'});
    chrome.browserAction.setTitle({tabId:tabId, title:'Resume JavaScript'});
  }
}

function onDetach(debuggeeId) {
  var tabId = debuggeeId.tabId;
  delete attachedTabs[tabId];
  chrome.browserAction.setIcon({tabId:tabId, path:'images/stoping.png'});
  chrome.browserAction.setTitle({tabId:tabId, title:'Generating project structure'});
}