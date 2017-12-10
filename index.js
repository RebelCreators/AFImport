var fs = require("fs");
var path = require("path");
var glob = require("glob");

var includes = /** @type {nameSpacedName : {className: string, clazz: Function, namespace: string, options: {}}} */ {};
var includeQueue = /** @type Array.<{nameSpacedClassName:string, classPath: string, options: object}> */ [];

/**
 * @private
 * @param classPaths: Array.<string>
 * @param options: {namespace: string, override: boolean}
 */
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
        var nameSpacedClassName = getOption(options, "namespace") + "." + className;
        includeQueue.push({nameSpacedClassName: nameSpacedClassName, classPath: classPaths[i], options: options});
    }
}

/**
 * @private
 * @param className: string
 * @param options: {namespace: string, override: boolean}
 * @returns {?string}
 */
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
    var namespace = getOption(options, "namespace");
    var nameSpacedClassName = namespace + "." + className;
    includeQueue = includeQueue.filter(function (includedClass) {
        return includedClass.nameSpacedClassName != nameSpacedClassName;
    });
    if (includes[nameSpacedClassName] && getOption(includes[nameSpacedClassName].options, "override") == true) {
        return className;
    } else if (includes[nameSpacedClassName]) {
        throw new Error("AFImport: Class already included.");
    }
    var clazz = require(path.resolve(basePath) + path.sep + className + ".js");
    if (!clazz) {
        throw new Error("AFImport: Class " + className + " Not found");
    }
    includes[nameSpacedClassName] = {clazz: clazz, className: className, namespace: namespace, options: options};

    return className;
}

/**
 *
 * @type {{namespace: string, override: boolean}}
 */
var optionsDefaults = {
    namespace: "com.afimport.default",
    override: false
};

/**
 * @private
 * @param option: {namespace: string, override: boolean}
 * @param key: string
 * @returns {*}
 */
function getOption(option, key) {
    if (!option) {
        return optionsDefaults[key];
    }
    return option[key] || optionsDefaults[key];
}

/**
 *
 * @param filePattern: string
 * @param options: {namespace: string, override: boolean}
 * @returns {?Array.<string>}
 */
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

/**
 *
 * @param clazz: Object
 * @param className: string
 * @param options: {namespace: string, override: boolean}
 */
module.exports.provide = function (clazz, className, options) {
    className = path.basename(className, '.js');
    var namespace = getOption(options, "namespace");
    var nameSpacedClassName = namespace + "." + className;
    if (includes[nameSpacedClassName]) {
        throw new Error("AFImport: Class " + className + " already provided.");
        return;
    }
    includes[nameSpacedClassName] = {clazz: clazz, className: className, namespace: namespace, options: options};
};

/**
 *
 * @param className: string
 * @param options: {namespace: string, override: boolean}
 * @returns {Object}
 */
module.exports.require = function (className, options) {
    className = path.basename(className, '.js');
    var nameSpacedClassName = getOption(options, "namespace") + "." + className;
    var clazz = (includes[nameSpacedClassName] || {})["clazz"];
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

/**
 *
 * @constructor
 */
function AFImortModule() {
};
AFImortModule.prototype.property;
AFImortModule.prototype.previous;

/**
 *
 * @returns {?AFImortModule}
 */
module.exports.exportModule = function () {
    var exports = new AFImortModule();
    for (var key in includes) {
        exports.property = includes[key];
        var newExports = new AFImortModule();
        newExports.previous = exports;
        exports = newExports;
    }
    exports = exports.previous;

    if (!exports.property) {
        return null;
    }
    return exports;
};

/**
 *
 * @param afModule: AFImortModule
 */
module.exports.importModule = function (afModule) {
    if (!(afModule.constructor.name == "AFImortModule")) {
        throw new Error("incorrect type in module");
    }
    var exports = afModule;
    while (exports) {
        if (!(afModule.constructor.name == "AFImortModule")) {
            throw new Error("incorrect type in module");
        }
        includes[exports.property.namespace + "." + exports.property.className] = exports.property;
        exports = exports.previous;
    }
};
