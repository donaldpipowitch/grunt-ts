/// <reference path="../../defs/tsd.d.ts"/>
var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var os = require('os');

var utils = require('./utils');

var eol = os.EOL;

/////////////////////////////////////////////////////////////////////
// AngularJS templateCache
////////////////////////////////////////////////////////////////////
// templateCache processing function
function generateTemplateCache(src, dest, basePath) {
    if (!src.length) {
        return;
    }

    // Resolve the relative path from basePath to each src file
    var relativePaths = _.map(src, function (anHtmlFile) {
        return 'text!' + utils.makeRelativePath(basePath, anHtmlFile);
    });
    var fileNames = _.map(src, function (anHtmlFile) {
        return path.basename(anHtmlFile);
    });
    var fileVarialbeName = function (anHtmlFile) {
        return anHtmlFile.split('.').join('_').split('-').join('_');
    };
    var fileVariableNames = _.map(fileNames, fileVarialbeName);

    var templateCacheTemplate = _.template('// You must have requirejs + text plugin loaded for this to work.' + eol + 'define([<%=relativePathSection%>],function(<%=fileNameVariableSection%>){' + eol + 'angular.module("ng").run(["$templateCache",function($templateCache) {' + eol + '<%=templateCachePut%>' + eol + '}]);' + eol + '});');

    var relativePathSection = '"' + relativePaths.join('",' + eol + '"') + '"';
    var fileNameVariableSection = fileVariableNames.join(',' + eol);

    var templateCachePutTemplate = _.template('$templateCache.put("<%= fileName %>", <%=fileVariableName%>);');
    var templateCachePut = _.map(fileNames, function (fileName) {
        return templateCachePutTemplate({
            fileName: fileName,
            fileVariableName: fileVarialbeName(fileName)
        });
    }).join(eol);

    var fileContent = templateCacheTemplate({
        relativePathSection: relativePathSection,
        fileNameVariableSection: fileNameVariableSection,
        templateCachePut: templateCachePut
    });
    fs.writeFileSync(dest, fileContent);
}
exports.generateTemplateCache = generateTemplateCache;
//# sourceMappingURL=templateCache.js.map
