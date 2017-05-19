'use strict';
// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var statusAttachedTabs = {};
var tabsContent = {};
var version = '1.0';

chrome.debugger.onEvent.addListener(onEvent);
chrome.debugger.onDetach.addListener(onDetach);

chrome.tabs.onCreated.addListener(function(tab){
  var tabId = tab.id;
  if (isAChromeExtensionTab(tab)){
    setTimeout(function() {
      chrome.browserAction.disable(tabId);
    }, 500);
  }
});
chrome.windows.getAll({'populate':true}, function(windows) {
  var existing_tab = null;
  for (var i in windows) {
    var tabs = windows[i].tabs;
    for (var j in tabs) {
      var tab = tabs[j];
      if (isAChromeExtensionTab(tab)){
        chrome.browserAction.disable(tab.id);
      }
    }
  }
});

function isAChromeExtensionTab(tab){
  var url = tab.url;
  return  url.indexOf('chrome-extension://') >= 0
       || url.indexOf('chrome://extensions/') >= 0;
}

chrome.browserAction.onClicked.addListener(function(tab) {
  if (tab.url.indexOf('chrome://newtab') >= 0) {
    return alert('This tab doesn\'t have content to be processed');
  }

  if (isAChromeExtensionTab(tab)) {
    chrome.browserAction.disable(tab.id);
    return alert('This tab can\'t be processed');
  }

  var tabId = tab.id;
  var debuggeeId = {tabId:tabId};

  for (var statusTabId in statusAttachedTabs) {
    var status = statusAttachedTabs[statusTabId];
    var isAnotherTab = parseInt(statusTabId) !== tabId;
    var isAnotherTabBusy = isBusy(status) || status === 'recording';
    if (isAnotherTab && isAnotherTabBusy) {
      return alert('Another tab is being processed');
    }
  }

  var status = statusAttachedTabs[tabId];
  if (isBusy(status)) {
    if (tabsContent[tabId].managerTab) {
      chrome.tabs.update(tabsContent[tabId].managerTab.id, {'selected': true});
    } else {
      chrome.notifications.create('notification-tabId-'+ tabId, {
        type: 'basic',
        title: 'Loading...',
        message: 'Please wait',
        iconUrl: 'images/ripple.gif'
      }, function() {});
    }
    return;
  }

  tabsContent[tabId] = {};

  if (!statusAttachedTabs[tabId]) {
    initializeDebugger(tabId);
  } else if (statusAttachedTabs[tabId]) {
    var manager_url = chrome.extension.getURL('manager.html');
    focusOrCreateTab(manager_url, tabId);

    statusAttachedTabs[tabId] = 'stoping';
    updateManagerStatus('Loading...', tabId);

    chrome.debugger.sendCommand(debuggeeId, 'Profiler.stop', function (profile) {
      tabsContent[tabId].profile = profile;
      chrome.debugger.detach(debuggeeId, onDetach.bind(null, debuggeeId));
    });
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  var tabId = sender.tab.id;

  switch (request.type) {
    case 'tab_content':
      processTabContent(request.tabContent, tabId);
      break;

    case 'ack':
      statusAttachedTabs[tabId] = 'enabling_debugger';
      updateManagerStatus('Enabling debugger...', tabId);

      var debuggeeId = {tabId:tabId};
      chrome.debugger.attach(debuggeeId, version, onAttach.bind(null, debuggeeId));
      break;
  }

  sendResponse('received');
});

function isBusy(status){
  switch(status){
    case 'checking_contentscript':
    case 'stoping':
    case 'generating_project':
    case 'enabling_debugger':
      return true;
  }
  return false;
}

function processTabContent(tabContent, tabId){
  statusAttachedTabs[tabId] = 'generating_project';
  updateManagerStatus('Generating project...', tabId);

  tabsContent[tabId].tabContent = tabContent;
  var projectStructure = getProjectStructure(tabContent);
  angularEsprimaFun.createSemanticsFromSrc({
    pathAndSrcFiles: projectStructure.srcContent
  }, function (projectSemantics) {
    updateManagerStatus('Getting profile nodes..', tabId);

    tabsContent[tabId].projectSemantics = projectSemantics;
    var pathToFilter = tabsContent[tabId].tabContent.location.href + projectStructure.srcFolder;
    angularEsprimaFun.getProjectNodesFromProfile({
      cpuProfileJson: tabsContent[tabId].profile.profile,
      pathToFilter: pathToFilter
    }, function(projectNodes){
      tabsContent[tabId].projectNodes = projectNodes;
      renderDataInManagerTab(tabId);
    });
  });
}

function renderDataInManagerTab(tabId) {
  chrome.runtime.sendMessage({action: 'data', tabContent: tabsContent[tabId] }, function(response){
    chrome.tabs.update(tabsContent[tabId].managerTab.id, {'selected':true});
    resetToStartState(tabId);
  });
}

function updateManagerStatus(status, tabId){
  chrome.runtime.sendMessage({action: 'update_status', status: status});
}

function initializeDebugger(tabId){
  statusAttachedTabs[tabId] = 'checking_contentscript';
  updateManagerStatus('Checking content script...', tabId);

  var oneSecond = 1000;
  var timeout = setTimeout(function(){
    if (statusAttachedTabs[tabId] === 'checking_contentscript') {
      confirmRestartTab(tabId);
    }
  }, oneSecond)

  chrome.tabs.sendMessage(tabId, {action: 'ack'}, function(response){
    clearTimeout(timeout);
  });
}

function confirmRestartTab(tabId){
  var problemMessage = 'There was a problem to get scripts content, please refresh the tab and click in "Record" button again. Do you want to refresh the tab?';
  if (confirm(problemMessage)) {
    var code = 'window.location.reload();';
    chrome.tabs.executeScript(tabId, {code: code});
  }
  resetToStartState(tabId);
}

function resetToStartState(tabId){
  chrome.browserAction.setIcon({tabId:tabId, path:'images/record-ng.png'});
  chrome.browserAction.setTitle({tabId:tabId, title:'Record AngularJs project'});
  delete tabsContent[tabId];
  delete statusAttachedTabs[tabId];
}

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

  return { srcFolder, srcContent, thirdPartyContent };
}

function onAttach(debuggeeId) {
  var tabId = debuggeeId.tabId;

  if (chrome.runtime.lastError) {
    var errorMsg = chrome.runtime.lastError.message;
    var debuggerMsg = 'Another debugger is already attached';
    if (errorMsg.indexOf(debuggerMsg) >= 0) {
      alert(debuggerMsg + ' to this tab, please close the debugger and try again.');
    } else {
      alert(errorMsg);
    }
    resetToStartState(tabId);
    return;
  }

  chrome.browserAction.setIcon({tabId: tabId, path:'images/stop.png'});
  chrome.browserAction.setTitle({tabId: tabId, title:'Recording AngularJs project...'});
  statusAttachedTabs[tabId] = 'recording';
  updateManagerStatus('Recording...', tabId);
  
  chrome.debugger.sendCommand(debuggeeId, 'Profiler.enable', {}, onDebuggerEnabled.bind(null, debuggeeId));
}

function onDebuggerEnabled(debuggeeId) {
  chrome.debugger.sendCommand(debuggeeId, 'Profiler.setSamplingInterval', { interval: 100 });
  chrome.debugger.sendCommand(debuggeeId, 'Profiler.start');
}

function onEvent(debuggeeId, method) {
  var tabId = debuggeeId.tabId;
  if (method == 'Debugger.paused') {
    debugger;
  }
}

function onDetach(debuggeeId) {
  var tabId = debuggeeId.tabId;
  var tenSeconds = 10 * 1000;
  var timeout = setTimeout(function(){
    if (statusAttachedTabs[tabId] === 'stoping') {
      confirmRestartTab(tabId);
    }
  }, tenSeconds);

  chrome.browserAction.setIcon({tabId:tabId, path:'images/stoping.png'});
  chrome.browserAction.setTitle({tabId:tabId, title:'Getting tab content...'});
  chrome.tabs.sendMessage(tabId, {action: 'get_tab_content'}, function(){
    clearTimeout(timeout);
  });
}

function focusOrCreateTab(url, tabId) {
  chrome.windows.getAll({'populate':true}, function(windows) {
    var existing_tab = null;
    for (var i in windows) {
      var tabs = windows[i].tabs;
      for (var j in tabs) {
        var tab = tabs[j];
        if (tab.url == url) {
          existing_tab = tab;
          break;
        }
      }
    }
    if (existing_tab) {
      tabsContent[tabId].managerTab = existing_tab;
      chrome.tabs.update(existing_tab.id, {'selected':true});
    } else {
      chrome.tabs.create({'url':url, 'selected':true}, function(tab){
        tabsContent[tabId].managerTab = tab;
      });
    }
  });
}