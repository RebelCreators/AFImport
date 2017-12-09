var fs = require("fs");
var path = require("path");
var glob = require("glob");

var includes = {};

var includeQueue = /** @type {nameSpacedClassName:string, classPath: string, options: object} */ [];

function addToIncludedQueue(classPaths, options) {
    for (var i = 0; i < classPaths.length; i++) {
        var className = classPaths[i];
        if (path.extname(className) != ".js" || className.startsWith(".")) {
            continue;
        }
        var basePath = path.dirname(className);
        if (!basePath) {
            continue;
        }
        className = path.basename(className, '.js');
        var nameSpacedClassName = getOption(options, "namespace") + className;
        includeQueue.push({nameSpacedClassName: nameSpacedClassName, classPath: classPaths[i], options: options});
    }
}

function includeClass(className, options) {
    if (path.extname(className) != ".js") {
        return null;
    }
    var basePath = path.dirname(className);
    if (!basePath) {
        throw new Error("AFImport: Could not resolve base path.");
    }

    className = path.basename(className, '.js');
    if (className.startsWith(".")) {
        //ignore hidden files
        return null;
    }
    var nameSpacedClassName = getOption(options, "namespace") + className;
    includeQueue = includeQueue.filter(function (includedClass) {
        return includedClass.nameSpacedClassName != nameSpacedClassName;
    });
    if (includes[nameSpacedClassName]) {
        throw new Error("AFImport: Class already included.");
    }
    var clazz = require(path.resolve(basePath) + path.sep + className + ".js");
    if (!clazz) {
        throw new Error("AFImport: Class " + className + " Not found");
    }
    includes[nameSpacedClassName] = clazz;

    return className;
}

var optionsDefaults = {
    namespace: "."
};

function getOption(option, key) {
    if (!option) {
        return optionsDefaults[key];
    }
    return option[key] || optionsDefaults[key];
}

module.exports.include = function (filePattern, options) {
    if (Array.isArray(filePattern)) {
        var included = [];
        for (var i = 0; i < filePattern.length; i++) {
            included.concat(module.exports.include(filePattern[i], options) || []);
        }
        return included;
    }

    function includeFiles(files) {
        addToIncludedQueue(files, options);
        var included = [];
        while (includeQueue.length > 0) {
            var queued = includeQueue[0];
            var className = includeClass(queued.classPath, options);
            if (className) {
                included.push(className);
            }
        }

        return included;
    }

    try {
        var files = glob.sync(filePattern, null);
        return includeFiles(files);
    } catch (err) {
        throw err;
        return null;
    }
};

module.exports.provide = function (clazz, className, options) {
    className = path.basename(className, '.js');
    var nameSpacedClassName = getOption(options, "namespace") + className;
    if (includes[nameSpacedClassName]) {
        throw new Error("AFImport: Class " + className + " already provided.");
        return;
    }
    includes[nameSpacedClassName] = clazz;
}

module.exports.require = function (className, options) {
    className = path.basename(className, '.js');
    var nameSpacedClassName = getOption(options, "namespace") + className;
    var clazz = includes[nameSpacedClassName];
    if (!clazz) {
        for (var i = 0; i < includeQueue.length; i++) {
            if (includeQueue[i].nameSpacedClassName == nameSpacedClassName) {
                includeClass(includeQueue[i].classPath, includeQueue[i].options);
                return module.exports.require(className, options);
            }
        }
        throw new Error("AFImport: Class " + className + " Not inlcuded.");
    }
    return clazz;
};