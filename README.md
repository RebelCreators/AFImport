# AFImport 1.0.0

A Node module to allow simple namespaces imports for project files

Methods:
* provide(clazz: function, className: string, options: {})
* require(className: string, options: {})
* include(filepattern: string | [filepattern: string], options: {})

Options: {}

* namespace: string


```Javascript
 var afimport = require("afimport");
 
 afimport.include(path.join(__dirname, 'lib/**/*'));
 afimport.include(path.join(__dirname, 'models/**/*'));
 
 var mymodel = afimport.require("mymodel");
```

Supports custom proving of classes.

```Javascript
 var afimport = require("afimport");
 
  afimport.provide(function (number) {
      return number + 2;
  }, "addsTwo");
  
...
  var addsTwo = afimport.require("addsTwo");
    
```

Supports namespacing

```Javascript
 var afimport = require("afimport");
 //standard namespace
 afimport.include(path.join(__dirname, 'models/user.js'));
 //custome namespace
 afimport.include(path.join(__dirname, 'models/v2/user.js'),{
 namespace: "com.some.namespace"
 });
 
...

 var userV1 = afimport.require("user");
 var userV2 = afimport.require("user",{
 namespace: "com.some.namespace"
 });
    
```