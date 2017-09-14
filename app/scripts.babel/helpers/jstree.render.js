/**
 * Created by marcochavezf on 6/13/17.
 */

var EMPTY_ANGULAR_DATA = {
	types: 'others',
	angularComponent: { name: '' },
	functionData: null
};

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

function getAngularDataFromCallFrame({ fileSemantic, callFrame }){
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
				if (functionData || componentContainsFunction(angularComp, callFrame)) {
					angularData = {
						types: typesAngularComp,
						angularComponent: angularComp,
						functionData: functionData
					};
				}

			}
		});
	});

	if (_.isNil(angularData)) {
		angularData = _.cloneDeep(EMPTY_ANGULAR_DATA);
	}

	return angularData;
}

function componentContainsFunction(angularComp, callFrame){
	if (_.isNil(callFrame) || _.isNil(callFrame.functionName)) {
		return false;
	}

	var functionNameArray = callFrame.functionName.split('.');
	var realFunctionName = _.last(functionNameArray);
	var stringifiedAngComp = JSON.stringify(angularComp);
	return stringifiedAngComp.includes(realFunctionName);
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
		functionName = angularComponentName + ' ' + 'anonymous function';
		if (_.isEmpty(angularComponentName)) {
			functionName = 'anonymous function';
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

function generateJstreeProfileNodes({ projectNodes, projectSemantics, semanticsUsed, basePath }) {
	return _.map(projectNodes, function(projectNode){

		var callFrame = projectNode.callFrame;
		var path = callFrame.url.replace(basePath, '');
		var fileParsed = _.find(projectSemantics.filesParsed, {pathFile: path});
		var functionAngularData = getAngularDataFromCallFrame({ fileSemantic: fileParsed.fileSemantic, callFrame });

		callFrame.lineNumber = parseInt(callFrame.lineNumber) + 1;
		appendSemanticUsed({ semanticsUsed, functionAngularData, callFrame, path });

		var text = getTextNode(functionAngularData, callFrame, path);
		var type = getType(functionAngularData);
		var angularCompName = _.has(functionAngularData.angularComponent, 'name') ? functionAngularData.angularComponent.name : path;
		return {
			'text' : text,
			'type' : type,
			'children' : generateJstreeProfileNodes({ projectNodes: projectNode.childrenNodes, projectSemantics, semanticsUsed, basePath }),
			'data' : { callFrame, path, angularCompName }
		};
	});
}

function appendSemanticUsed({ semanticsUsed, functionAngularData, callFrame, path }) {
	var types = getType(functionAngularData);
	var nameNgComponent = functionAngularData.angularComponent.name;
	var nameFunction = callFrame.functionName || ('anonymous:' + callFrame.lineNumber);
	nameNgComponent = nameNgComponent ? nameNgComponent : path;
	semanticsUsed[types] = semanticsUsed[types] || {};
	semanticsUsed[types][nameNgComponent] = semanticsUsed[types][nameNgComponent] || {};
	if (semanticsUsed[types][nameNgComponent][nameFunction]) {
		semanticsUsed[types][nameNgComponent][nameFunction].timesCalled++;
	} else {
		semanticsUsed[types][nameNgComponent][nameFunction] = {
			relativePath: path,
			functionAngularData: functionAngularData,
			callFrame: callFrame,
			timesCalled: 1
		};
	}
}

function getSortedProperties(objectComponent){
	var keyProperties = [];
	for (var key in objectComponent) {
		if (objectComponent.hasOwnProperty(key)) {
			keyProperties.push(key);
		}
	}
	keyProperties.sort(function(a, b) {
		var nameA = a.toUpperCase(); // ignore upper and lowercase
		var nameB = b.toUpperCase(); // ignore upper and lowercase
		if (nameA < nameB) {
			return -1;
		}
		if (nameA > nameB) {
			return 1;
		}

		// names must be equal
		return 0;
	});
	return keyProperties;
}

function generateJstreeSemantics(semanticsUsed) {
	semanticsUsed['others'] = Object.assign({}, semanticsUsed['others'], semanticsUsed['globalVariables'], semanticsUsed['globalFunctions']);
	delete semanticsUsed['globalVariables'];
	delete semanticsUsed['globalFunctions'];
	if (_.isEmpty(semanticsUsed['others'])){
		delete semanticsUsed['others'];
	}

	var jsTreeSemantics = [];
	_.each(semanticsUsed, (semantics, types) => {

		var keysSematincs = getSortedProperties(semantics);
		var textGroups = _.upperFirst(types);
		jsTreeSemantics.push({
			'text' : textGroups,
			'type' : types,
			'children' : _.map(keysSematincs, (angularCompName) => {
				var angularComp = semantics[angularCompName];
				var firstPropertyAngComp = angularComp[Object.keys(angularComp)[0]];
				var textAngularComp = angularCompName;
				if (textAngularComp !== firstPropertyAngComp.relativePath) {
					textAngularComp += ' - ' + firstPropertyAngComp.relativePath;
				}

				var keysAngularComp = getSortedProperties(angularComp);
				return  {
					'text': textAngularComp,
					'type': types,
					'data': { path: firstPropertyAngComp.relativePath, angularCompName },
					'children' : _.map(keysAngularComp, (functionName) => {
						var functionComp = angularComp[functionName];
						var text = functionName + ' (' + functionComp.timesCalled + ') - ' + functionComp.relativePath + ':' + functionComp.callFrame.lineNumber;
						return  {
							'text': text,
							'type': types,
							'data': { callFrame: functionComp.callFrame, path: functionComp.relativePath, angularCompName }
						};
					})
				};
			})
		});
	});

	return jsTreeSemantics;
}

function createJsTreeData(tabContent){
	//TODO: merge generated debugger data with project semantics
	var projectNodes = tabContent.projectNodes;
	var projectSemantics = tabContent.projectSemantics;
	if (_.isEmpty(projectNodes)) {
		return null;
	}

	var semanticsUsed = {};
	var tabContent = tabContent.tabContent;
	var basePath = tabContent.location.origin;
	var scriptsContent = tabContent.scriptsContent;
	var profileJstreeData = generateJstreeProfileNodes({ projectNodes, projectSemantics, semanticsUsed, basePath });
	var semanticsUsedJstreeData = generateJstreeSemantics(semanticsUsed);

	return {
		profile: profileJstreeData,
		semanticsUsed: semanticsUsedJstreeData,
		scriptsContent
	};
}