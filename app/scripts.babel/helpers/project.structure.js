/**
 * Created by marcochavezf on 6/13/17.
 */

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
	_.forIn(contentGroupedByLevel, function (value, key) {
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
	var largestProbability = -1;
	for (var index = shortestLevel; index <= largestLevel; index++) {
		var scriptsContentByLevel = contentGroupedByLevel[index];
		var scriptsByProbability = _.groupBy(scriptsContentByLevel, (fileContent) => {
			return setProbabiltySrcFile(fileContent);
		});

		_.forIn(scriptsByProbability, function (value, key) {
			var level = parseInt(key);
			if (level > largestProbability) {
				largestProbability = level;
			}
		});

		var scriptsWithHigerProbability = scriptsByProbability[largestProbability];
		if (scriptsWithHigerProbability) {
			if (scriptsWithHigerProbability.length > 1) {
				trackEventAnlytics('WARNING', 'more than one script with higher priority');
				debugger;
				//TODO: set another heuristic (probably at parse level) to compare these files (or ask to the user)
			}
			angularContentWithShortestPath = scriptsWithHigerProbability[0];
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
		if (content.path.indexOf(srcFolder) <= 1) {
			srcContent.push(content);
		} else {
			thirdPartyContent.push(content);
		}
	});

	return {srcFolder, srcContent, thirdPartyContent};
}

function setProbabiltySrcFile(fileContent) {
	var content = fileContent.content;
	var pathArray = fileContent.path.split('/');
	var pathFile = pathArray.length > 0 ? pathArray[pathArray.length - 1] : '';
	var probability = 0;

	if (content.includes('angular.module')) {
		probability++;
	} else {
		probability--;
	}

	if (pathArray.length <= 3) {
		probability++;
	}

	//check if the name of the file is 'app.js'
	if (pathFile === 'app.js') {
		probability++;
	}

	//check if file name doesn't contain hyphens, underscores, numbers or capital letters
	if (pathFile.replace('.', '').match(/[^a-z]/)) {
		probability--;
	}

	if (content.includes('.config')) {
		probability++;
	}

	if (content.includes('.run')) {
		probability++;
	}

	if (content.includes('ngCordova')) {
		probability++;
	}

	if (content.includes('ui.router')) {
		probability++;
	}

	if (content.includes('import')) {
		probability++;
	}

	if (content.includes('Google, Inc.')) {
		probability--;
	}

	if (content.includes('Drifty Co.')) {
		probability--;
	}

	if (content.includes('MIT')) {
		probability--;
	}

	return probability;
}

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