/**
 * Created by marcochavezf on 6/13/17.
 */

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

function getAngularDataFromCallFrame({ fileSemantic, callFrame, semanticsUsed }){
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

function generateJstreeProfileNodes({ projectNodes, projectSemantics, semanticsUsed, basePath }) {
	return _.map(projectNodes, function(projectNode){

		var callFrame = projectNode.callFrame;
		var path = callFrame.url.replace(basePath, '');
		var fileParsed = _.find(projectSemantics.filesParsed, {pathFile: path});
		var functionAngularData = getAngularDataFromCallFrame({ fileSemantic: fileParsed.fileSemantic, callFrame });

		appendSemanticUsed({ semanticsUsed, functionAngularData, callFrame, path });

		var text = getTextNode(functionAngularData, callFrame, path);
		var type = getType(functionAngularData);
		return {
			'text' : text,
			'type' : type,
			'children' : generateJstreeProfileNodes({ projectNodes: projectNode.childrenNodes, projectSemantics, semanticsUsed, basePath }),
			'data' : { callFrame, path, angularCompName: functionAngularData.angularComponent.name }
		};
	});
}

function appendSemanticUsed({ semanticsUsed, functionAngularData, callFrame, path }) {
	var types = getType(functionAngularData);
	var nameNgComponent = _.has(functionAngularData, 'angularComponent') ? functionAngularData.angularComponent.name : '';
	var nameFunction = callFrame.functionName || 'Anonymous';
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

function generateJstreeSemantics(semanticsUsed) {
	var jsTreeSemantics = [];
	_.each(semanticsUsed, (semantics, types) => {
		jsTreeSemantics.push({
			'text' : _.upperFirst(types),
			'type' : types,
			'children' : _.map(semantics, (angularComp, angularCompName) => {
				var firstPropertyAngComp = angularComp[Object.keys(angularComp)[0]];
				var textAngularComp = angularCompName + ' - ' + firstPropertyAngComp.relativePath;
				return  {
					'text': textAngularComp,
					'type': types,
					'data': { path: firstPropertyAngComp.relativePath, angularCompName },
					'children' : _.map(angularComp, (functionComp, functionName) => {
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