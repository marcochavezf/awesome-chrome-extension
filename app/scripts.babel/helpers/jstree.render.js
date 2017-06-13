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

function createJsTreeData(tabContent){
	//TODO: merge generated debugger data with project semantics
	console.log(tabContent);
	var projectNodes = tabContent.projectNodes;
	var projectSemantics = tabContent.projectSemantics;
	if (_.isEmpty(projectNodes)) {
		return null;
	}

	var tabContent = tabContent.tabContent;
	var path = tabContent.location.origin;

	var jsTreeData = generateJstreeNodes(projectNodes, projectSemantics, path);
	return jsTreeData;
}