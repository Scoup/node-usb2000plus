var global = Function("return this;")();
/*!
  * Ender: open module JavaScript framework (client-lib)
  * copyright Dustin Diaz & Jacob Thornton 2011 (@ded @fat)
  * http://ender.no.de
  * License MIT
  */
!function (context) {

  // a global object for node.js module compatiblity
  // ============================================

  context['global'] = context

  // Implements simple module system
  // losely based on CommonJS Modules spec v1.1.1
  // ============================================

  var modules = {}
    , old = context.$

  function require (identifier) {
    // modules can be required from ender's build system, or found on the window
    var module = modules[identifier] || window[identifier]
    if (!module) throw new Error("Requested module '" + identifier + "' has not been defined.")
    return module
  }

  function provide (name, what) {
    return (modules[name] = what)
  }

  context['provide'] = provide
  context['require'] = require

  function aug(o, o2) {
    for (var k in o2) k != 'noConflict' && k != '_VERSION' && (o[k] = o2[k])
    return o
  }

  function boosh(s, r, els) {
    // string || node || nodelist || window
    if (typeof s == 'string' || s.nodeName || (s.length && 'item' in s) || s == window) {
      els = ender._select(s, r)
      els.selector = s
    } else els = isFinite(s.length) ? s : [s]
    return aug(els, boosh)
  }

  function ender(s, r) {
    return boosh(s, r)
  }

  aug(ender, {
      _VERSION: '0.3.6'
    , fn: boosh // for easy compat to jQuery plugins
    , ender: function (o, chain) {
        aug(chain ? boosh : ender, o)
      }
    , _select: function (s, r) {
        return (r || document).querySelectorAll(s)
      }
  })

  aug(boosh, {
    forEach: function (fn, scope, i) {
      // opt out of native forEach so we can intentionally call our own scope
      // defaulting to the current item and be able to return self
      for (i = 0, l = this.length; i < l; ++i) i in this && fn.call(scope || this[i], this[i], i, this)
      // return self for chaining
      return this
    },
    $: ender // handy reference to self
  })

  ender.noConflict = function () {
    context.$ = old
    return this
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = ender
  // use subscript notation as extern for Closure compilation
  context['ender'] = context['$'] = context['ender'] || ender

}(this);
// pakmanager:bindings-shyp
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  
    /**
     * Module dependencies.
     */
    
    // process.versions.modules added in >= v0.10.4 and v0.11.7
    // https://github.com/joyent/node/commit/ccabd4a6fa8a6eb79d29bc3bbe9fe2b6531c2d8e
    function nodeABI () {
      return process.versions.modules
        ? 'node-v' + (+process.versions.modules)
        : process.versions.v8.match(/^3\.14\./)
          ? 'node-v11'
          : 'v8-' + process.versions.v8.split('.').slice(0,2).join('.');
    }
    
    var fs = require('fs')
      , path = require('path')
      , join = path.join
      , dirname = path.dirname
      , exists = fs.existsSync || path.existsSync
      , defaults = {
            arrow: process.env.NODE_BINDINGS_ARROW || ' → '
          , compiled: process.env.NODE_BINDINGS_COMPILED_DIR || 'compiled'
          , platform: process.platform
          , arch: process.arch
          , version: process.versions.node
          , bindings: 'bindings.node'
          , try: [
              // node-gyp's linked version in the "build" dir
              [ 'module_root', 'build', 'bindings' ]
              // node-waf and gyp_addon (a.k.a node-gyp)
            , [ 'module_root', 'build', 'Debug', 'bindings' ]
            , [ 'module_root', 'build', 'Release', 'bindings' ]
              // Debug files, for development (legacy behavior, remove for node v0.9)
            , [ 'module_root', 'out', 'Debug', 'bindings' ]
            , [ 'module_root', 'Debug', 'bindings' ]
              // Release files, but manually compiled (legacy behavior, remove for node v0.9)
            , [ 'module_root', 'out', 'Release', 'bindings' ]
            , [ 'module_root', 'Release', 'bindings' ]
              // Legacy from node-waf, node <= 0.4.x
            , [ 'module_root', 'build', 'default', 'bindings' ]
              // Production "Release" buildtype binary (meh...)
            , [ 'module_root', 'compiled', 'version', 'platform', 'arch', 'bindings' ]
              // shyp-compiled module
            , [ 'module_root', 'node_modules', 'shyp', nodeABI(), 'bindings' ]
            , [ 'module_root', 'node_modules', 'shyp', 'bindings' ]
            ]
        }
    
    /**
     * The main `bindings()` function loads the compiled bindings for a given module.
     * It uses V8's Error API to determine the parent filename that this function is
     * being invoked from, which is then used to find the root directory.
     */
    
    function bindings (opts) {
    
      // Argument surgery
      if (typeof opts == 'string') {
        opts = { bindings: opts }
      } else if (!opts) {
        opts = {}
      }
      opts.__proto__ = defaults
    
      // Get the module root
      if (!opts.module_root) {
        opts.module_root = exports.getRoot(exports.getFileName())
      }
    
      // Ensure the given bindings name ends with .node
      if (path.extname(opts.bindings) != '.node') {
        opts.bindings += '.node'
      }
    
      // shyp binding
      opts.shyp = opts.shyp || require(path.join(opts.module_root, 'package.json')).name + '-shyp-' + process.platform + '-' + process.arch;
    
      var tries = []
        , i = 0
        , l = opts.try.length
        , n
        , b
        , err
    
      for (; i<l; i++) {
        n = join.apply(null, opts.try[i].map(function (p) {
          return opts[p] || p
        }))
        tries.push(n)
        try {
          b = opts.path ? require.resolve(n) : require(n)
          if (!opts.path) {
            b.path = n
          }
          return b
        } catch (e) {
          if (!/not find/i.test(e.message)) {
            throw e
          }
        }
      }
    
      err = new Error('Could not locate the bindings file. Tried:\n'
        + tries.map(function (a) { return opts.arrow + a }).join('\n'))
      err.tries = tries
      throw err
    }
    module.exports = exports = bindings
    
    
    /**
     * Gets the filename of the JavaScript file that invokes this function.
     * Used to help find the root directory of a module.
     */
    
    exports.getFileName = function getFileName () {
      var origPST = Error.prepareStackTrace
        , origSTL = Error.stackTraceLimit
        , dummy = {}
        , fileName
    
      Error.stackTraceLimit = 10
    
      Error.prepareStackTrace = function (e, st) {
        for (var i=0, l=st.length; i<l; i++) {
          fileName = st[i].getFileName()
          if (fileName !== __filename) {
            return
          }
        }
      }
    
      // run the 'prepareStackTrace' function above
      Error.captureStackTrace(dummy)
      dummy.stack
    
      // cleanup
      Error.prepareStackTrace = origPST
      Error.stackTraceLimit = origSTL
    
      return fileName
    }
    
    /**
     * Gets the root directory of a module, given an arbitrary filename
     * somewhere in the module tree. The "root directory" is the directory
     * containing the `package.json` file.
     *
     *   In:  /home/nate/node-native-module/lib/index.js
     *   Out: /home/nate/node-native-module
     */
    
    exports.getRoot = function getRoot (file) {
      var dir = dirname(file)
        , prev
      while (true) {
        if (dir === '.') {
          // Avoids an infinite loop in rare cases, like the REPL
          dir = process.cwd()
        }
        if (exists(join(dir, 'package.json')) || exists(join(dir, 'node_modules'))) {
          // Found the 'package.json' file or 'node_modules' dir; we're done
          return dir
        }
        if (prev === dir) {
          // Got to the top
          throw new Error('Could not find module root given file: "' + file
                        + '". Do you have a `package.json` file? ')
        }
        // Try the parent dir next
        prev = dir
        dir = join(dir, '..')
      }
    }
    
  provide("bindings-shyp", module.exports);
}(global));

// pakmanager:usb
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var usb = exports = module.exports = require("bindings-shyp")("usb_bindings")
    var events = require('events')
    var util = require('util')
    
    // convenience method for finding a device by vendor and product id
    exports.findByIds = function(vid, pid) {
    	var devices = usb.getDeviceList()
    	
    	for (var i = 0; i < devices.length; i++) {
    		var deviceDesc = devices[i].deviceDescriptor
    		if ((deviceDesc.idVendor == vid) && (deviceDesc.idProduct == pid)) {
    			return devices[i]
    		}
    	}
    }
    
    usb.Device.prototype.timeout = 1000
    
    usb.Device.prototype.open = function(){
    	this.__open()
    	this.interfaces = []
    	var len = this.configDescriptor.interfaces.length
    	for (var i=0; i<len; i++){
    		this.interfaces[i] = new Interface(this, i)
    	}
    }
    
    usb.Device.prototype.close = function(){
    	this.__close()
    	this.interfaces = null
    }
    
    Object.defineProperty(usb.Device.prototype, "configDescriptor", {
        get: function() {
            return this.configDescriptor = this.__getConfigDescriptor()
        }
    });
    
    usb.Device.prototype.interface = function(addr){
    	if (!this.interfaces){
    		throw new Error("Device must be open before searching for interfaces")
    	}
    	addr = addr || 0
    	for (var i=0; i<this.interfaces.length; i++){
    		if (this.interfaces[i].interfaceNumber == addr){
    			return this.interfaces[i]
    		}
    	}
    }
    
    var SETUP_SIZE = usb.LIBUSB_CONTROL_SETUP_SIZE
    
    usb.Device.prototype.controlTransfer =
    function(bmRequestType, bRequest, wValue, wIndex, data_or_length, callback){
    	var self = this
    	var isIn = !!(bmRequestType & usb.LIBUSB_ENDPOINT_IN)
    	var wLength
    
    	if (isIn){
    		if (!(data_or_length >= 0)){
    			throw new TypeError("Expected size number for IN transfer (based on bmRequestType)")
    		}
    		wLength = data_or_length
    	}else{
    		if (!Buffer.isBuffer(data_or_length)){
    			throw new TypeError("Expected buffer for OUT transfer (based on bmRequestType)")
    		}
    		wLength = data_or_length.length
    	}
    
    	// Buffer for the setup packet
    	// http://libusbx.sourceforge.net/api-1.0/structlibusb__control__setup.html
    	var buf = new Buffer(wLength + SETUP_SIZE)
    	buf.writeUInt8(   bmRequestType, 0)
    	buf.writeUInt8(   bRequest,      1)
    	buf.writeUInt16LE(wValue,        2)
    	buf.writeUInt16LE(wIndex,        4)
    	buf.writeUInt16LE(wLength,       6)
    
    	if (!isIn){
    		data_or_length.copy(buf, SETUP_SIZE)
    	}
    
    	var transfer = new usb.Transfer(this, 0, usb.LIBUSB_TRANSFER_TYPE_CONTROL, this.timeout,
    		function(error, buf, actual){
    			if (callback){
    				if (isIn){
    					callback.call(self, error, buf.slice(SETUP_SIZE, SETUP_SIZE + actual))
    				}else{
    					callback.call(self, error)
    				}
    			}
    		}
    	)
    	return transfer.submit(buf)
    }
    
    usb.Device.prototype.getStringDescriptor = function (desc_index, callback) {
    	var langid = 0x0409;
    	var length = 1024;
    	this.controlTransfer(
    		usb.LIBUSB_ENDPOINT_IN,
    		usb.LIBUSB_REQUEST_GET_DESCRIPTOR,
    		((usb.LIBUSB_DT_STRING << 8) | desc_index),
    		langid,
    		length,
    		function (error, buf) {
    			if (error) return callback(error);
    			callback(undefined, buf.toString('utf16le', 2));
    		}
    	);
    }
    
    function Interface(device, id){
    	this.device = device
    	this.id = id
    	this.altSetting = 0;
    	this.__refresh()
    }
    
    Interface.prototype.__refresh = function(){
    	this.descriptor = this.device.configDescriptor.interfaces[this.id][this.altSetting]
    	this.interfaceNumber = this.descriptor.bInterfaceNumber
    	this.endpoints = []
    	var len = this.descriptor.endpoints.length
    	for (var i=0; i<len; i++){
    		var desc = this.descriptor.endpoints[i]
    		var c = (desc.bEndpointAddress&usb.LIBUSB_ENDPOINT_IN)?InEndpoint:OutEndpoint
    		this.endpoints[i] = new c(this.device, desc)
    	}
    }
    
    Interface.prototype.claim = function(){
    	this.device.__claimInterface(this.id)
    }
    
    Interface.prototype.release = function(cb){
    	var self = this;
    	this.device.__releaseInterface(this.id, function(err){
    		if (!err){
    			self.altSetting = 0;
    			self.__refresh()
    		}
    		cb.call(self, err)
    	})
    }
    
    Interface.prototype.isKernelDriverActive = function(){
    	return this.device.__isKernelDriverActive(this.id)
    }
    
    Interface.prototype.detachKernelDriver = function() {
    	return this.device.__detachKernelDriver(this.id)
    };
    
    Interface.prototype.attachKernelDriver = function() {
    	return this.device.__attachKernelDriver(this.id)
    };
    
    
    Interface.prototype.setAltSetting = function(altSetting, cb){
    	var self = this;
    	this.device.__setInterface(this.id, altSetting, function(err){
    		if (!err){
    			self.altSetting = altSetting;
    			self.__refresh();
    		}
    		cb.call(self, err)
    	})
    
    }
    
    Interface.prototype.endpoint = function(addr){
    	for (var i=0; i<this.endpoints.length; i++){
    		if (this.endpoints[i].address == addr){
    			return this.endpoints[i]
    		}
    	}
    }
    
    function Endpoint(device, descriptor){
    	this.device = device
    	this.descriptor = descriptor
    	this.address = descriptor.bEndpointAddress
    	this.transferType = descriptor.bmAttributes&0x03
    }
    util.inherits(Endpoint, events.EventEmitter)
    
    Endpoint.prototype.makeTransfer = function(timeout, callback){
    	return new usb.Transfer(this.device, this.address, this.transferType, timeout, callback)
    }
    
    Endpoint.prototype.startStream = function(nTransfers, transferSize, callback){
    	if (this.streamTransfers){
    		throw new Error("Stream already active")
    	}
    
    	nTransfers = nTransfers || 3;
    	this.streamTransferSize = transferSize || this.maxPacketSize;
    	this.streamActive = true
    	this.streamPending = 0
    
    	var transfers = []
    	for (var i=0; i<nTransfers; i++){
    		transfers[i] = this.makeTransfer(0, callback)
    	}
    	return transfers;
    }
    
    Endpoint.prototype.stopStream = function(){
    	for (var i=0; i<this.streamTransfers.length; i++){
    		this.streamTransfers[i].cancel()
    	}
    	this.streamActive = false
    }
    
    function InEndpoint(device, descriptor){
    	Endpoint.call(this, device, descriptor)
    }
    
    exports.InEndpoint = InEndpoint
    util.inherits(InEndpoint, Endpoint)
    InEndpoint.prototype.direction = "in"
    
    InEndpoint.prototype.transfer = function(length, cb){
    	var self = this
    	var buffer = new Buffer(length)
    
    	function callback(error, buf, actual){
    		cb.call(self, error, buffer.slice(0, actual))
    	}
    
    	return this.makeTransfer(this.device.timeout, callback).submit(buffer)
    }
    
    InEndpoint.prototype.startStream = function(nTransfers, transferSize){
    	var self = this
    	this.streamTransfers = InEndpoint.super_.prototype.startStream.call(this, nTransfers, transferSize, transferDone)
    	
    	function transferDone(error, buf, actual){
    		if (!error){
    			self.emit("data", buf.slice(0, actual))
    		}else if (error.errno != usb.LIBUSB_TRANSFER_CANCELLED){
    			self.emit("error", error)
    			self.stopStream()
    		}
    
    		if (self.streamActive){
    			startTransfer(this)
    		}else{
    			self.streamPending--
    
    			if (self.streamPending == 0){
    				self.emit('end')
    			}
    		}
    	}
    
    	function startTransfer(t){
    		t.submit(new Buffer(self.streamTransferSize), transferDone)
    	}
    
    	this.streamTransfers.forEach(startTransfer)
    	self.streamPending = this.streamTransfers.length
    }
    
    
    
    function OutEndpoint(device, descriptor){
    	Endpoint.call(this, device, descriptor)
    }
    exports.OutEndpoint = OutEndpoint
    util.inherits(OutEndpoint, Endpoint)
    OutEndpoint.prototype.direction = "out"
    
    OutEndpoint.prototype.transfer = function(buffer, cb){
    	var self = this
    	if (!buffer){
    		buffer = new Buffer(0)
    	}else if (!Buffer.isBuffer(buffer)){
    		buffer = new Buffer(buffer)
    	}
    
    	function callback(error, buf, actual){
    		if (cb) cb.call(self, error)
    	}
    
    	return this.makeTransfer(this.device.timeout, callback).submit(buffer)
    }
    
    
    
    OutEndpoint.prototype.startStream = function startStream(n_transfers, transfer_size){
    	n_transfers = n_transfers || 3;
    	transfer_size = transfer_size || this.maxPacketSize;
    	this._streamTransfers = n_transfers;
    	this._pendingTransfers = 0;
    	var self = this
    	process.nextTick(function(){
    		for (var i=0; i<n_transfers; i++) self.emit('drain')
    	})
    }
    
    function out_ep_callback(err, d){
    	if (err) this.emit('error', err);
    	this._pendingTransfers--;
    	if (this._pendingTransfers < this._streamTransfers){
    		this.emit('drain');
    	}
    	if (this._pendingTransfers <= 0 && this._streamTransfers == 0){
    		this.emit('end');
    	}
    }
    
    usb.OutEndpoint.prototype.write = function write(data){
    	this.transfer(data, out_ep_callback);
    	this._pendingTransfers++;
    }
    
    usb.OutEndpoint.prototype.stopStream = function stopStream(){
    	this._streamTransfers = 0;
    	if (this._pendingTransfers == 0) this.emit('end');
    }
    
  provide("usb", module.exports);
}(global));

// pakmanager:underscore
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  //     Underscore.js 1.6.0
    //     http://underscorejs.org
    //     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
    //     Underscore may be freely distributed under the MIT license.
    
    (function() {
    
      // Baseline setup
      // --------------
    
      // Establish the root object, `window` in the browser, or `exports` on the server.
      var root = this;
    
      // Save the previous value of the `_` variable.
      var previousUnderscore = root._;
    
      // Establish the object that gets returned to break out of a loop iteration.
      var breaker = {};
    
      // Save bytes in the minified (but not gzipped) version:
      var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;
    
      // Create quick reference variables for speed access to core prototypes.
      var
        push             = ArrayProto.push,
        slice            = ArrayProto.slice,
        concat           = ArrayProto.concat,
        toString         = ObjProto.toString,
        hasOwnProperty   = ObjProto.hasOwnProperty;
    
      // All **ECMAScript 5** native function implementations that we hope to use
      // are declared here.
      var
        nativeForEach      = ArrayProto.forEach,
        nativeMap          = ArrayProto.map,
        nativeReduce       = ArrayProto.reduce,
        nativeReduceRight  = ArrayProto.reduceRight,
        nativeFilter       = ArrayProto.filter,
        nativeEvery        = ArrayProto.every,
        nativeSome         = ArrayProto.some,
        nativeIndexOf      = ArrayProto.indexOf,
        nativeLastIndexOf  = ArrayProto.lastIndexOf,
        nativeIsArray      = Array.isArray,
        nativeKeys         = Object.keys,
        nativeBind         = FuncProto.bind;
    
      // Create a safe reference to the Underscore object for use below.
      var _ = function(obj) {
        if (obj instanceof _) return obj;
        if (!(this instanceof _)) return new _(obj);
        this._wrapped = obj;
      };
    
      // Export the Underscore object for **Node.js**, with
      // backwards-compatibility for the old `require()` API. If we're in
      // the browser, add `_` as a global object via a string identifier,
      // for Closure Compiler "advanced" mode.
      if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
          exports = module.exports = _;
        }
        exports._ = _;
      } else {
        root._ = _;
      }
    
      // Current version.
      _.VERSION = '1.6.0';
    
      // Collection Functions
      // --------------------
    
      // The cornerstone, an `each` implementation, aka `forEach`.
      // Handles objects with the built-in `forEach`, arrays, and raw objects.
      // Delegates to **ECMAScript 5**'s native `forEach` if available.
      var each = _.each = _.forEach = function(obj, iterator, context) {
        if (obj == null) return obj;
        if (nativeForEach && obj.forEach === nativeForEach) {
          obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
          for (var i = 0, length = obj.length; i < length; i++) {
            if (iterator.call(context, obj[i], i, obj) === breaker) return;
          }
        } else {
          var keys = _.keys(obj);
          for (var i = 0, length = keys.length; i < length; i++) {
            if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
          }
        }
        return obj;
      };
    
      // Return the results of applying the iterator to each element.
      // Delegates to **ECMAScript 5**'s native `map` if available.
      _.map = _.collect = function(obj, iterator, context) {
        var results = [];
        if (obj == null) return results;
        if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
        each(obj, function(value, index, list) {
          results.push(iterator.call(context, value, index, list));
        });
        return results;
      };
    
      var reduceError = 'Reduce of empty array with no initial value';
    
      // **Reduce** builds up a single result from a list of values, aka `inject`,
      // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
      _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
        var initial = arguments.length > 2;
        if (obj == null) obj = [];
        if (nativeReduce && obj.reduce === nativeReduce) {
          if (context) iterator = _.bind(iterator, context);
          return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
        }
        each(obj, function(value, index, list) {
          if (!initial) {
            memo = value;
            initial = true;
          } else {
            memo = iterator.call(context, memo, value, index, list);
          }
        });
        if (!initial) throw new TypeError(reduceError);
        return memo;
      };
    
      // The right-associative version of reduce, also known as `foldr`.
      // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
      _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
        var initial = arguments.length > 2;
        if (obj == null) obj = [];
        if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
          if (context) iterator = _.bind(iterator, context);
          return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
        }
        var length = obj.length;
        if (length !== +length) {
          var keys = _.keys(obj);
          length = keys.length;
        }
        each(obj, function(value, index, list) {
          index = keys ? keys[--length] : --length;
          if (!initial) {
            memo = obj[index];
            initial = true;
          } else {
            memo = iterator.call(context, memo, obj[index], index, list);
          }
        });
        if (!initial) throw new TypeError(reduceError);
        return memo;
      };
    
      // Return the first value which passes a truth test. Aliased as `detect`.
      _.find = _.detect = function(obj, predicate, context) {
        var result;
        any(obj, function(value, index, list) {
          if (predicate.call(context, value, index, list)) {
            result = value;
            return true;
          }
        });
        return result;
      };
    
      // Return all the elements that pass a truth test.
      // Delegates to **ECMAScript 5**'s native `filter` if available.
      // Aliased as `select`.
      _.filter = _.select = function(obj, predicate, context) {
        var results = [];
        if (obj == null) return results;
        if (nativeFilter && obj.filter === nativeFilter) return obj.filter(predicate, context);
        each(obj, function(value, index, list) {
          if (predicate.call(context, value, index, list)) results.push(value);
        });
        return results;
      };
    
      // Return all the elements for which a truth test fails.
      _.reject = function(obj, predicate, context) {
        return _.filter(obj, function(value, index, list) {
          return !predicate.call(context, value, index, list);
        }, context);
      };
    
      // Determine whether all of the elements match a truth test.
      // Delegates to **ECMAScript 5**'s native `every` if available.
      // Aliased as `all`.
      _.every = _.all = function(obj, predicate, context) {
        predicate || (predicate = _.identity);
        var result = true;
        if (obj == null) return result;
        if (nativeEvery && obj.every === nativeEvery) return obj.every(predicate, context);
        each(obj, function(value, index, list) {
          if (!(result = result && predicate.call(context, value, index, list))) return breaker;
        });
        return !!result;
      };
    
      // Determine if at least one element in the object matches a truth test.
      // Delegates to **ECMAScript 5**'s native `some` if available.
      // Aliased as `any`.
      var any = _.some = _.any = function(obj, predicate, context) {
        predicate || (predicate = _.identity);
        var result = false;
        if (obj == null) return result;
        if (nativeSome && obj.some === nativeSome) return obj.some(predicate, context);
        each(obj, function(value, index, list) {
          if (result || (result = predicate.call(context, value, index, list))) return breaker;
        });
        return !!result;
      };
    
      // Determine if the array or object contains a given value (using `===`).
      // Aliased as `include`.
      _.contains = _.include = function(obj, target) {
        if (obj == null) return false;
        if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
        return any(obj, function(value) {
          return value === target;
        });
      };
    
      // Invoke a method (with arguments) on every item in a collection.
      _.invoke = function(obj, method) {
        var args = slice.call(arguments, 2);
        var isFunc = _.isFunction(method);
        return _.map(obj, function(value) {
          return (isFunc ? method : value[method]).apply(value, args);
        });
      };
    
      // Convenience version of a common use case of `map`: fetching a property.
      _.pluck = function(obj, key) {
        return _.map(obj, _.property(key));
      };
    
      // Convenience version of a common use case of `filter`: selecting only objects
      // containing specific `key:value` pairs.
      _.where = function(obj, attrs) {
        return _.filter(obj, _.matches(attrs));
      };
    
      // Convenience version of a common use case of `find`: getting the first object
      // containing specific `key:value` pairs.
      _.findWhere = function(obj, attrs) {
        return _.find(obj, _.matches(attrs));
      };
    
      // Return the maximum element or (element-based computation).
      // Can't optimize arrays of integers longer than 65,535 elements.
      // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
      _.max = function(obj, iterator, context) {
        if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
          return Math.max.apply(Math, obj);
        }
        var result = -Infinity, lastComputed = -Infinity;
        each(obj, function(value, index, list) {
          var computed = iterator ? iterator.call(context, value, index, list) : value;
          if (computed > lastComputed) {
            result = value;
            lastComputed = computed;
          }
        });
        return result;
      };
    
      // Return the minimum element (or element-based computation).
      _.min = function(obj, iterator, context) {
        if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
          return Math.min.apply(Math, obj);
        }
        var result = Infinity, lastComputed = Infinity;
        each(obj, function(value, index, list) {
          var computed = iterator ? iterator.call(context, value, index, list) : value;
          if (computed < lastComputed) {
            result = value;
            lastComputed = computed;
          }
        });
        return result;
      };
    
      // Shuffle an array, using the modern version of the
      // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
      _.shuffle = function(obj) {
        var rand;
        var index = 0;
        var shuffled = [];
        each(obj, function(value) {
          rand = _.random(index++);
          shuffled[index - 1] = shuffled[rand];
          shuffled[rand] = value;
        });
        return shuffled;
      };
    
      // Sample **n** random values from a collection.
      // If **n** is not specified, returns a single random element.
      // The internal `guard` argument allows it to work with `map`.
      _.sample = function(obj, n, guard) {
        if (n == null || guard) {
          if (obj.length !== +obj.length) obj = _.values(obj);
          return obj[_.random(obj.length - 1)];
        }
        return _.shuffle(obj).slice(0, Math.max(0, n));
      };
    
      // An internal function to generate lookup iterators.
      var lookupIterator = function(value) {
        if (value == null) return _.identity;
        if (_.isFunction(value)) return value;
        return _.property(value);
      };
    
      // Sort the object's values by a criterion produced by an iterator.
      _.sortBy = function(obj, iterator, context) {
        iterator = lookupIterator(iterator);
        return _.pluck(_.map(obj, function(value, index, list) {
          return {
            value: value,
            index: index,
            criteria: iterator.call(context, value, index, list)
          };
        }).sort(function(left, right) {
          var a = left.criteria;
          var b = right.criteria;
          if (a !== b) {
            if (a > b || a === void 0) return 1;
            if (a < b || b === void 0) return -1;
          }
          return left.index - right.index;
        }), 'value');
      };
    
      // An internal function used for aggregate "group by" operations.
      var group = function(behavior) {
        return function(obj, iterator, context) {
          var result = {};
          iterator = lookupIterator(iterator);
          each(obj, function(value, index) {
            var key = iterator.call(context, value, index, obj);
            behavior(result, key, value);
          });
          return result;
        };
      };
    
      // Groups the object's values by a criterion. Pass either a string attribute
      // to group by, or a function that returns the criterion.
      _.groupBy = group(function(result, key, value) {
        _.has(result, key) ? result[key].push(value) : result[key] = [value];
      });
    
      // Indexes the object's values by a criterion, similar to `groupBy`, but for
      // when you know that your index values will be unique.
      _.indexBy = group(function(result, key, value) {
        result[key] = value;
      });
    
      // Counts instances of an object that group by a certain criterion. Pass
      // either a string attribute to count by, or a function that returns the
      // criterion.
      _.countBy = group(function(result, key) {
        _.has(result, key) ? result[key]++ : result[key] = 1;
      });
    
      // Use a comparator function to figure out the smallest index at which
      // an object should be inserted so as to maintain order. Uses binary search.
      _.sortedIndex = function(array, obj, iterator, context) {
        iterator = lookupIterator(iterator);
        var value = iterator.call(context, obj);
        var low = 0, high = array.length;
        while (low < high) {
          var mid = (low + high) >>> 1;
          iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
        }
        return low;
      };
    
      // Safely create a real, live array from anything iterable.
      _.toArray = function(obj) {
        if (!obj) return [];
        if (_.isArray(obj)) return slice.call(obj);
        if (obj.length === +obj.length) return _.map(obj, _.identity);
        return _.values(obj);
      };
    
      // Return the number of elements in an object.
      _.size = function(obj) {
        if (obj == null) return 0;
        return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
      };
    
      // Array Functions
      // ---------------
    
      // Get the first element of an array. Passing **n** will return the first N
      // values in the array. Aliased as `head` and `take`. The **guard** check
      // allows it to work with `_.map`.
      _.first = _.head = _.take = function(array, n, guard) {
        if (array == null) return void 0;
        if ((n == null) || guard) return array[0];
        if (n < 0) return [];
        return slice.call(array, 0, n);
      };
    
      // Returns everything but the last entry of the array. Especially useful on
      // the arguments object. Passing **n** will return all the values in
      // the array, excluding the last N. The **guard** check allows it to work with
      // `_.map`.
      _.initial = function(array, n, guard) {
        return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
      };
    
      // Get the last element of an array. Passing **n** will return the last N
      // values in the array. The **guard** check allows it to work with `_.map`.
      _.last = function(array, n, guard) {
        if (array == null) return void 0;
        if ((n == null) || guard) return array[array.length - 1];
        return slice.call(array, Math.max(array.length - n, 0));
      };
    
      // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
      // Especially useful on the arguments object. Passing an **n** will return
      // the rest N values in the array. The **guard**
      // check allows it to work with `_.map`.
      _.rest = _.tail = _.drop = function(array, n, guard) {
        return slice.call(array, (n == null) || guard ? 1 : n);
      };
    
      // Trim out all falsy values from an array.
      _.compact = function(array) {
        return _.filter(array, _.identity);
      };
    
      // Internal implementation of a recursive `flatten` function.
      var flatten = function(input, shallow, output) {
        if (shallow && _.every(input, _.isArray)) {
          return concat.apply(output, input);
        }
        each(input, function(value) {
          if (_.isArray(value) || _.isArguments(value)) {
            shallow ? push.apply(output, value) : flatten(value, shallow, output);
          } else {
            output.push(value);
          }
        });
        return output;
      };
    
      // Flatten out an array, either recursively (by default), or just one level.
      _.flatten = function(array, shallow) {
        return flatten(array, shallow, []);
      };
    
      // Return a version of the array that does not contain the specified value(s).
      _.without = function(array) {
        return _.difference(array, slice.call(arguments, 1));
      };
    
      // Split an array into two arrays: one whose elements all satisfy the given
      // predicate, and one whose elements all do not satisfy the predicate.
      _.partition = function(array, predicate) {
        var pass = [], fail = [];
        each(array, function(elem) {
          (predicate(elem) ? pass : fail).push(elem);
        });
        return [pass, fail];
      };
    
      // Produce a duplicate-free version of the array. If the array has already
      // been sorted, you have the option of using a faster algorithm.
      // Aliased as `unique`.
      _.uniq = _.unique = function(array, isSorted, iterator, context) {
        if (_.isFunction(isSorted)) {
          context = iterator;
          iterator = isSorted;
          isSorted = false;
        }
        var initial = iterator ? _.map(array, iterator, context) : array;
        var results = [];
        var seen = [];
        each(initial, function(value, index) {
          if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
            seen.push(value);
            results.push(array[index]);
          }
        });
        return results;
      };
    
      // Produce an array that contains the union: each distinct element from all of
      // the passed-in arrays.
      _.union = function() {
        return _.uniq(_.flatten(arguments, true));
      };
    
      // Produce an array that contains every item shared between all the
      // passed-in arrays.
      _.intersection = function(array) {
        var rest = slice.call(arguments, 1);
        return _.filter(_.uniq(array), function(item) {
          return _.every(rest, function(other) {
            return _.contains(other, item);
          });
        });
      };
    
      // Take the difference between one array and a number of other arrays.
      // Only the elements present in just the first array will remain.
      _.difference = function(array) {
        var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
        return _.filter(array, function(value){ return !_.contains(rest, value); });
      };
    
      // Zip together multiple lists into a single array -- elements that share
      // an index go together.
      _.zip = function() {
        var length = _.max(_.pluck(arguments, 'length').concat(0));
        var results = new Array(length);
        for (var i = 0; i < length; i++) {
          results[i] = _.pluck(arguments, '' + i);
        }
        return results;
      };
    
      // Converts lists into objects. Pass either a single array of `[key, value]`
      // pairs, or two parallel arrays of the same length -- one of keys, and one of
      // the corresponding values.
      _.object = function(list, values) {
        if (list == null) return {};
        var result = {};
        for (var i = 0, length = list.length; i < length; i++) {
          if (values) {
            result[list[i]] = values[i];
          } else {
            result[list[i][0]] = list[i][1];
          }
        }
        return result;
      };
    
      // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
      // we need this function. Return the position of the first occurrence of an
      // item in an array, or -1 if the item is not included in the array.
      // Delegates to **ECMAScript 5**'s native `indexOf` if available.
      // If the array is large and already in sort order, pass `true`
      // for **isSorted** to use binary search.
      _.indexOf = function(array, item, isSorted) {
        if (array == null) return -1;
        var i = 0, length = array.length;
        if (isSorted) {
          if (typeof isSorted == 'number') {
            i = (isSorted < 0 ? Math.max(0, length + isSorted) : isSorted);
          } else {
            i = _.sortedIndex(array, item);
            return array[i] === item ? i : -1;
          }
        }
        if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
        for (; i < length; i++) if (array[i] === item) return i;
        return -1;
      };
    
      // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
      _.lastIndexOf = function(array, item, from) {
        if (array == null) return -1;
        var hasIndex = from != null;
        if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
          return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
        }
        var i = (hasIndex ? from : array.length);
        while (i--) if (array[i] === item) return i;
        return -1;
      };
    
      // Generate an integer Array containing an arithmetic progression. A port of
      // the native Python `range()` function. See
      // [the Python documentation](http://docs.python.org/library/functions.html#range).
      _.range = function(start, stop, step) {
        if (arguments.length <= 1) {
          stop = start || 0;
          start = 0;
        }
        step = arguments[2] || 1;
    
        var length = Math.max(Math.ceil((stop - start) / step), 0);
        var idx = 0;
        var range = new Array(length);
    
        while(idx < length) {
          range[idx++] = start;
          start += step;
        }
    
        return range;
      };
    
      // Function (ahem) Functions
      // ------------------
    
      // Reusable constructor function for prototype setting.
      var ctor = function(){};
    
      // Create a function bound to a given object (assigning `this`, and arguments,
      // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
      // available.
      _.bind = function(func, context) {
        var args, bound;
        if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
        if (!_.isFunction(func)) throw new TypeError;
        args = slice.call(arguments, 2);
        return bound = function() {
          if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
          ctor.prototype = func.prototype;
          var self = new ctor;
          ctor.prototype = null;
          var result = func.apply(self, args.concat(slice.call(arguments)));
          if (Object(result) === result) return result;
          return self;
        };
      };
    
      // Partially apply a function by creating a version that has had some of its
      // arguments pre-filled, without changing its dynamic `this` context. _ acts
      // as a placeholder, allowing any combination of arguments to be pre-filled.
      _.partial = function(func) {
        var boundArgs = slice.call(arguments, 1);
        return function() {
          var position = 0;
          var args = boundArgs.slice();
          for (var i = 0, length = args.length; i < length; i++) {
            if (args[i] === _) args[i] = arguments[position++];
          }
          while (position < arguments.length) args.push(arguments[position++]);
          return func.apply(this, args);
        };
      };
    
      // Bind a number of an object's methods to that object. Remaining arguments
      // are the method names to be bound. Useful for ensuring that all callbacks
      // defined on an object belong to it.
      _.bindAll = function(obj) {
        var funcs = slice.call(arguments, 1);
        if (funcs.length === 0) throw new Error('bindAll must be passed function names');
        each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
        return obj;
      };
    
      // Memoize an expensive function by storing its results.
      _.memoize = function(func, hasher) {
        var memo = {};
        hasher || (hasher = _.identity);
        return function() {
          var key = hasher.apply(this, arguments);
          return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
        };
      };
    
      // Delays a function for the given number of milliseconds, and then calls
      // it with the arguments supplied.
      _.delay = function(func, wait) {
        var args = slice.call(arguments, 2);
        return setTimeout(function(){ return func.apply(null, args); }, wait);
      };
    
      // Defers a function, scheduling it to run after the current call stack has
      // cleared.
      _.defer = function(func) {
        return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
      };
    
      // Returns a function, that, when invoked, will only be triggered at most once
      // during a given window of time. Normally, the throttled function will run
      // as much as it can, without ever going more than once per `wait` duration;
      // but if you'd like to disable the execution on the leading edge, pass
      // `{leading: false}`. To disable execution on the trailing edge, ditto.
      _.throttle = function(func, wait, options) {
        var context, args, result;
        var timeout = null;
        var previous = 0;
        options || (options = {});
        var later = function() {
          previous = options.leading === false ? 0 : _.now();
          timeout = null;
          result = func.apply(context, args);
          context = args = null;
        };
        return function() {
          var now = _.now();
          if (!previous && options.leading === false) previous = now;
          var remaining = wait - (now - previous);
          context = this;
          args = arguments;
          if (remaining <= 0) {
            clearTimeout(timeout);
            timeout = null;
            previous = now;
            result = func.apply(context, args);
            context = args = null;
          } else if (!timeout && options.trailing !== false) {
            timeout = setTimeout(later, remaining);
          }
          return result;
        };
      };
    
      // Returns a function, that, as long as it continues to be invoked, will not
      // be triggered. The function will be called after it stops being called for
      // N milliseconds. If `immediate` is passed, trigger the function on the
      // leading edge, instead of the trailing.
      _.debounce = function(func, wait, immediate) {
        var timeout, args, context, timestamp, result;
    
        var later = function() {
          var last = _.now() - timestamp;
          if (last < wait) {
            timeout = setTimeout(later, wait - last);
          } else {
            timeout = null;
            if (!immediate) {
              result = func.apply(context, args);
              context = args = null;
            }
          }
        };
    
        return function() {
          context = this;
          args = arguments;
          timestamp = _.now();
          var callNow = immediate && !timeout;
          if (!timeout) {
            timeout = setTimeout(later, wait);
          }
          if (callNow) {
            result = func.apply(context, args);
            context = args = null;
          }
    
          return result;
        };
      };
    
      // Returns a function that will be executed at most one time, no matter how
      // often you call it. Useful for lazy initialization.
      _.once = function(func) {
        var ran = false, memo;
        return function() {
          if (ran) return memo;
          ran = true;
          memo = func.apply(this, arguments);
          func = null;
          return memo;
        };
      };
    
      // Returns the first function passed as an argument to the second,
      // allowing you to adjust arguments, run code before and after, and
      // conditionally execute the original function.
      _.wrap = function(func, wrapper) {
        return _.partial(wrapper, func);
      };
    
      // Returns a function that is the composition of a list of functions, each
      // consuming the return value of the function that follows.
      _.compose = function() {
        var funcs = arguments;
        return function() {
          var args = arguments;
          for (var i = funcs.length - 1; i >= 0; i--) {
            args = [funcs[i].apply(this, args)];
          }
          return args[0];
        };
      };
    
      // Returns a function that will only be executed after being called N times.
      _.after = function(times, func) {
        return function() {
          if (--times < 1) {
            return func.apply(this, arguments);
          }
        };
      };
    
      // Object Functions
      // ----------------
    
      // Retrieve the names of an object's properties.
      // Delegates to **ECMAScript 5**'s native `Object.keys`
      _.keys = function(obj) {
        if (!_.isObject(obj)) return [];
        if (nativeKeys) return nativeKeys(obj);
        var keys = [];
        for (var key in obj) if (_.has(obj, key)) keys.push(key);
        return keys;
      };
    
      // Retrieve the values of an object's properties.
      _.values = function(obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var values = new Array(length);
        for (var i = 0; i < length; i++) {
          values[i] = obj[keys[i]];
        }
        return values;
      };
    
      // Convert an object into a list of `[key, value]` pairs.
      _.pairs = function(obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var pairs = new Array(length);
        for (var i = 0; i < length; i++) {
          pairs[i] = [keys[i], obj[keys[i]]];
        }
        return pairs;
      };
    
      // Invert the keys and values of an object. The values must be serializable.
      _.invert = function(obj) {
        var result = {};
        var keys = _.keys(obj);
        for (var i = 0, length = keys.length; i < length; i++) {
          result[obj[keys[i]]] = keys[i];
        }
        return result;
      };
    
      // Return a sorted list of the function names available on the object.
      // Aliased as `methods`
      _.functions = _.methods = function(obj) {
        var names = [];
        for (var key in obj) {
          if (_.isFunction(obj[key])) names.push(key);
        }
        return names.sort();
      };
    
      // Extend a given object with all the properties in passed-in object(s).
      _.extend = function(obj) {
        each(slice.call(arguments, 1), function(source) {
          if (source) {
            for (var prop in source) {
              obj[prop] = source[prop];
            }
          }
        });
        return obj;
      };
    
      // Return a copy of the object only containing the whitelisted properties.
      _.pick = function(obj) {
        var copy = {};
        var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
        each(keys, function(key) {
          if (key in obj) copy[key] = obj[key];
        });
        return copy;
      };
    
       // Return a copy of the object without the blacklisted properties.
      _.omit = function(obj) {
        var copy = {};
        var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
        for (var key in obj) {
          if (!_.contains(keys, key)) copy[key] = obj[key];
        }
        return copy;
      };
    
      // Fill in a given object with default properties.
      _.defaults = function(obj) {
        each(slice.call(arguments, 1), function(source) {
          if (source) {
            for (var prop in source) {
              if (obj[prop] === void 0) obj[prop] = source[prop];
            }
          }
        });
        return obj;
      };
    
      // Create a (shallow-cloned) duplicate of an object.
      _.clone = function(obj) {
        if (!_.isObject(obj)) return obj;
        return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
      };
    
      // Invokes interceptor with the obj, and then returns obj.
      // The primary purpose of this method is to "tap into" a method chain, in
      // order to perform operations on intermediate results within the chain.
      _.tap = function(obj, interceptor) {
        interceptor(obj);
        return obj;
      };
    
      // Internal recursive comparison function for `isEqual`.
      var eq = function(a, b, aStack, bStack) {
        // Identical objects are equal. `0 === -0`, but they aren't identical.
        // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
        if (a === b) return a !== 0 || 1 / a == 1 / b;
        // A strict comparison is necessary because `null == undefined`.
        if (a == null || b == null) return a === b;
        // Unwrap any wrapped objects.
        if (a instanceof _) a = a._wrapped;
        if (b instanceof _) b = b._wrapped;
        // Compare `[[Class]]` names.
        var className = toString.call(a);
        if (className != toString.call(b)) return false;
        switch (className) {
          // Strings, numbers, dates, and booleans are compared by value.
          case '[object String]':
            // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
            // equivalent to `new String("5")`.
            return a == String(b);
          case '[object Number]':
            // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
            // other numeric values.
            return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
          case '[object Date]':
          case '[object Boolean]':
            // Coerce dates and booleans to numeric primitive values. Dates are compared by their
            // millisecond representations. Note that invalid dates with millisecond representations
            // of `NaN` are not equivalent.
            return +a == +b;
          // RegExps are compared by their source patterns and flags.
          case '[object RegExp]':
            return a.source == b.source &&
                   a.global == b.global &&
                   a.multiline == b.multiline &&
                   a.ignoreCase == b.ignoreCase;
        }
        if (typeof a != 'object' || typeof b != 'object') return false;
        // Assume equality for cyclic structures. The algorithm for detecting cyclic
        // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
        var length = aStack.length;
        while (length--) {
          // Linear search. Performance is inversely proportional to the number of
          // unique nested structures.
          if (aStack[length] == a) return bStack[length] == b;
        }
        // Objects with different constructors are not equivalent, but `Object`s
        // from different frames are.
        var aCtor = a.constructor, bCtor = b.constructor;
        if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                                 _.isFunction(bCtor) && (bCtor instanceof bCtor))
                            && ('constructor' in a && 'constructor' in b)) {
          return false;
        }
        // Add the first object to the stack of traversed objects.
        aStack.push(a);
        bStack.push(b);
        var size = 0, result = true;
        // Recursively compare objects and arrays.
        if (className == '[object Array]') {
          // Compare array lengths to determine if a deep comparison is necessary.
          size = a.length;
          result = size == b.length;
          if (result) {
            // Deep compare the contents, ignoring non-numeric properties.
            while (size--) {
              if (!(result = eq(a[size], b[size], aStack, bStack))) break;
            }
          }
        } else {
          // Deep compare objects.
          for (var key in a) {
            if (_.has(a, key)) {
              // Count the expected number of properties.
              size++;
              // Deep compare each member.
              if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
            }
          }
          // Ensure that both objects contain the same number of properties.
          if (result) {
            for (key in b) {
              if (_.has(b, key) && !(size--)) break;
            }
            result = !size;
          }
        }
        // Remove the first object from the stack of traversed objects.
        aStack.pop();
        bStack.pop();
        return result;
      };
    
      // Perform a deep comparison to check if two objects are equal.
      _.isEqual = function(a, b) {
        return eq(a, b, [], []);
      };
    
      // Is a given array, string, or object empty?
      // An "empty" object has no enumerable own-properties.
      _.isEmpty = function(obj) {
        if (obj == null) return true;
        if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
        for (var key in obj) if (_.has(obj, key)) return false;
        return true;
      };
    
      // Is a given value a DOM element?
      _.isElement = function(obj) {
        return !!(obj && obj.nodeType === 1);
      };
    
      // Is a given value an array?
      // Delegates to ECMA5's native Array.isArray
      _.isArray = nativeIsArray || function(obj) {
        return toString.call(obj) == '[object Array]';
      };
    
      // Is a given variable an object?
      _.isObject = function(obj) {
        return obj === Object(obj);
      };
    
      // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
      each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
        _['is' + name] = function(obj) {
          return toString.call(obj) == '[object ' + name + ']';
        };
      });
    
      // Define a fallback version of the method in browsers (ahem, IE), where
      // there isn't any inspectable "Arguments" type.
      if (!_.isArguments(arguments)) {
        _.isArguments = function(obj) {
          return !!(obj && _.has(obj, 'callee'));
        };
      }
    
      // Optimize `isFunction` if appropriate.
      if (typeof (/./) !== 'function') {
        _.isFunction = function(obj) {
          return typeof obj === 'function';
        };
      }
    
      // Is a given object a finite number?
      _.isFinite = function(obj) {
        return isFinite(obj) && !isNaN(parseFloat(obj));
      };
    
      // Is the given value `NaN`? (NaN is the only number which does not equal itself).
      _.isNaN = function(obj) {
        return _.isNumber(obj) && obj != +obj;
      };
    
      // Is a given value a boolean?
      _.isBoolean = function(obj) {
        return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
      };
    
      // Is a given value equal to null?
      _.isNull = function(obj) {
        return obj === null;
      };
    
      // Is a given variable undefined?
      _.isUndefined = function(obj) {
        return obj === void 0;
      };
    
      // Shortcut function for checking if an object has a given property directly
      // on itself (in other words, not on a prototype).
      _.has = function(obj, key) {
        return hasOwnProperty.call(obj, key);
      };
    
      // Utility Functions
      // -----------------
    
      // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
      // previous owner. Returns a reference to the Underscore object.
      _.noConflict = function() {
        root._ = previousUnderscore;
        return this;
      };
    
      // Keep the identity function around for default iterators.
      _.identity = function(value) {
        return value;
      };
    
      _.constant = function(value) {
        return function () {
          return value;
        };
      };
    
      _.property = function(key) {
        return function(obj) {
          return obj[key];
        };
      };
    
      // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
      _.matches = function(attrs) {
        return function(obj) {
          if (obj === attrs) return true; //avoid comparing an object to itself.
          for (var key in attrs) {
            if (attrs[key] !== obj[key])
              return false;
          }
          return true;
        }
      };
    
      // Run a function **n** times.
      _.times = function(n, iterator, context) {
        var accum = Array(Math.max(0, n));
        for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
        return accum;
      };
    
      // Return a random integer between min and max (inclusive).
      _.random = function(min, max) {
        if (max == null) {
          max = min;
          min = 0;
        }
        return min + Math.floor(Math.random() * (max - min + 1));
      };
    
      // A (possibly faster) way to get the current timestamp as an integer.
      _.now = Date.now || function() { return new Date().getTime(); };
    
      // List of HTML entities for escaping.
      var entityMap = {
        escape: {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;'
        }
      };
      entityMap.unescape = _.invert(entityMap.escape);
    
      // Regexes containing the keys and values listed immediately above.
      var entityRegexes = {
        escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
        unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
      };
    
      // Functions for escaping and unescaping strings to/from HTML interpolation.
      _.each(['escape', 'unescape'], function(method) {
        _[method] = function(string) {
          if (string == null) return '';
          return ('' + string).replace(entityRegexes[method], function(match) {
            return entityMap[method][match];
          });
        };
      });
    
      // If the value of the named `property` is a function then invoke it with the
      // `object` as context; otherwise, return it.
      _.result = function(object, property) {
        if (object == null) return void 0;
        var value = object[property];
        return _.isFunction(value) ? value.call(object) : value;
      };
    
      // Add your own custom functions to the Underscore object.
      _.mixin = function(obj) {
        each(_.functions(obj), function(name) {
          var func = _[name] = obj[name];
          _.prototype[name] = function() {
            var args = [this._wrapped];
            push.apply(args, arguments);
            return result.call(this, func.apply(_, args));
          };
        });
      };
    
      // Generate a unique integer id (unique within the entire client session).
      // Useful for temporary DOM ids.
      var idCounter = 0;
      _.uniqueId = function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
      };
    
      // By default, Underscore uses ERB-style template delimiters, change the
      // following template settings to use alternative delimiters.
      _.templateSettings = {
        evaluate    : /<%([\s\S]+?)%>/g,
        interpolate : /<%=([\s\S]+?)%>/g,
        escape      : /<%-([\s\S]+?)%>/g
      };
    
      // When customizing `templateSettings`, if you don't want to define an
      // interpolation, evaluation or escaping regex, we need one that is
      // guaranteed not to match.
      var noMatch = /(.)^/;
    
      // Certain characters need to be escaped so that they can be put into a
      // string literal.
      var escapes = {
        "'":      "'",
        '\\':     '\\',
        '\r':     'r',
        '\n':     'n',
        '\t':     't',
        '\u2028': 'u2028',
        '\u2029': 'u2029'
      };
    
      var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;
    
      // JavaScript micro-templating, similar to John Resig's implementation.
      // Underscore templating handles arbitrary delimiters, preserves whitespace,
      // and correctly escapes quotes within interpolated code.
      _.template = function(text, data, settings) {
        var render;
        settings = _.defaults({}, settings, _.templateSettings);
    
        // Combine delimiters into one regular expression via alternation.
        var matcher = new RegExp([
          (settings.escape || noMatch).source,
          (settings.interpolate || noMatch).source,
          (settings.evaluate || noMatch).source
        ].join('|') + '|$', 'g');
    
        // Compile the template source, escaping string literals appropriately.
        var index = 0;
        var source = "__p+='";
        text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
          source += text.slice(index, offset)
            .replace(escaper, function(match) { return '\\' + escapes[match]; });
    
          if (escape) {
            source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
          }
          if (interpolate) {
            source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
          }
          if (evaluate) {
            source += "';\n" + evaluate + "\n__p+='";
          }
          index = offset + match.length;
          return match;
        });
        source += "';\n";
    
        // If a variable is not specified, place data values in local scope.
        if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';
    
        source = "var __t,__p='',__j=Array.prototype.join," +
          "print=function(){__p+=__j.call(arguments,'');};\n" +
          source + "return __p;\n";
    
        try {
          render = new Function(settings.variable || 'obj', '_', source);
        } catch (e) {
          e.source = source;
          throw e;
        }
    
        if (data) return render(data, _);
        var template = function(data) {
          return render.call(this, data, _);
        };
    
        // Provide the compiled function source as a convenience for precompilation.
        template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';
    
        return template;
      };
    
      // Add a "chain" function, which will delegate to the wrapper.
      _.chain = function(obj) {
        return _(obj).chain();
      };
    
      // OOP
      // ---------------
      // If Underscore is called as a function, it returns a wrapped object that
      // can be used OO-style. This wrapper holds altered versions of all the
      // underscore functions. Wrapped objects may be chained.
    
      // Helper function to continue chaining intermediate results.
      var result = function(obj) {
        return this._chain ? _(obj).chain() : obj;
      };
    
      // Add all of the Underscore functions to the wrapper object.
      _.mixin(_);
    
      // Add all mutator Array functions to the wrapper.
      each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
          var obj = this._wrapped;
          method.apply(obj, arguments);
          if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
          return result.call(this, obj);
        };
      });
    
      // Add all accessor Array functions to the wrapper.
      each(['concat', 'join', 'slice'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
          return result.call(this, method.apply(this._wrapped, arguments));
        };
      });
    
      _.extend(_.prototype, {
    
        // Start chaining a wrapped Underscore object.
        chain: function() {
          this._chain = true;
          return this;
        },
    
        // Extracts the result from a wrapped and chained object.
        value: function() {
          return this._wrapped;
        }
    
      });
    
      // AMD registration happens at the end for compatibility with AMD loaders
      // that may not enforce next-turn semantics on modules. Even though general
      // practice for AMD registration is to be anonymous, underscore registers
      // as a named module because, like jQuery, it is a base library that is
      // popular enough to be bundled in a third party lib, but not be part of
      // an AMD load request. Those cases could generate an error when an
      // anonymous define() is called outside of a loader request.
      if (typeof define === 'function' && define.amd) {
        define('underscore', [], function() {
          return _;
        });
      }
    }).call(this);
    
  provide("underscore", module.exports);
}(global));

// pakmanager:hr2000
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /*
     * node-hr2000
     * https://github.com/leo/node-hr2000
     *
     * Copyright (c) 2014 Leo Haddad Carneiro
     * Licensed under the MIT license.
     */
    
    /****
     * How to use:
     * var HR2000 = require('HR2000').HR2000
     * var lib = new HR2000()
     *
     * List of HR2000+ endpoints
     * EP1Out = 0x01
     * EP2In = 0x82
     * EP6In = 0x86
     * EP1In = 0x81
     */
     /*jshint -W117 */
     /*jshint -W083 */
    var us = require('underscore')
    var usb = require("usb")
    
    var HR2000Factory = function() {
    
    	var factory = this
    
    	var _options = {
    		VID: 0x2457,
    		PID: 0x101E,
    		integrationTime: 3000,
    		strobleEnableStatus: 0,
    		shutdownMode: 0,
    		triggerMode: 0,
    	}
    
    
    	function HR2000(options) {
    		this._internal = {
    			claimed: false
    		}
    
    		// this.endpoints = new Endpoints()
    		this.funcs = new HR2000Funcs()
    		this.spectroData = new HR2000Data(function(){})
    
    		this.options = us.defaults(options || {}, _options);
    
    		var VID = this.options.VID, PID = this.options.PID
    		this.device = usb.findByIds(VID, PID)
    		this.device.open()
    
    		this.iface = this.device.interfaces[0]
    
    		this.configEndPoints()
    
    		//configure generic functions to send data
    		//ex: this.requestSpectra()
    		var funcs = this.funcs.getFuncs()
    
    		for(var i = 0; i < funcs.length; i++) {
    			var func = funcs[i]
    			if(typeof(HR2000.prototype[func.name]) === 'undefined') {
    				HR2000.prototype[func.name] = function(callback, extraData) {
    					this.genericFunction(callback, func.data, extraData)
    				}
    			}
    		}
    
    		this.claim()
    	}
    
    	HR2000.prototype.requestSpectra = function(callback) {
    		var func = this.funcs.getByName('requestSpectra')
    
    		this.spectroData = new HR2000Data(callback)
    		this.genericFunction.call(this, callback, func)
    	}
    
    	/**
    	 * Set the settings of Endpoints
    	 */
    	HR2000.prototype.configEndPoints = function() {
    		var self = this
    		var iface = this.iface
    		this.EP1In = iface.endpoint(0x81)
    		this.EP1Out = iface.endpoint(0x01)
    		this.EP2In = iface.endpoint(0x82)
    
    		//spectro data
    		this.EP2In.on("data", function(data) {
    			console.log("EP2In data")
    			self.spectroData.addData(data)
    		})
    
    		//all others data
    		this.EP1In.on("data", function(data) {
    			console.log("EP1In data")
    			if(self.callback !== null)
    				self.callback(data)
    		})
    	}
    
    	/**
    	 * Claim for device and start the stream of endpoints
    	 */
    	HR2000.prototype.claim = function() {
    		if(this._internal.claimed) return
    
    		var iface = this.iface
    		if(iface.isKernelDriverActive()) iface.detachKernelDriver()
    		iface.claim()
    
    		this.EP1In.startStream(1, 512)
    		this.EP2In.startStream(1, 512)
    
    		this._internal.claimed = true
    	}
    
    	/**
    	 * Stop streams and release device
    	 */
    	HR2000.prototype.release = function() {
    		if(!this._internal.claimed) return
    
    		this.EP1In.stopStream()
    		this.EP2In.stopStream()
    		this.iface.release()
    
    		this._internal.claimed = false
    	}
    
    	/**
    	 * Provide a generic function to send data to spectrometer
    	 * @callback - Function(data) - a function to callback, receive a data 
    	 * @data - Int - integer referenced to the internal method of spectrometer
    	 * @extraData - ByteArray - a array of extra datas, some functions need it
    	 */
    	HR2000.prototype.genericFunction = function(callback, data, extraData) {
    		var EP1Out = this.EP1Out
    		var buffer = new Buffer(1)
    		buffer[0] = data
    		if(extraData !== null) {
    			buffer = new Buffer(extraData.length + 1)
    			buffer[0] = data
    			buffer.push(extraData)
    		}
    
    		if(callback !== null) 
    			this.callback = callback
    		else
    			this.callback = null
    
    		EP1Out.write(buffer)
    	}
    
    	factory.HR2000 = HR2000
    }
    
    var factory = new HR2000Factory()
    module.exports = factory;
    	
    /**
     * HR2000Data is used to receive and convert the data of spectros
     * All Spectometer specifications can be found on Oceanoptics site
     * @link http://www.oceanoptics.com/technical/engineering/OEM%20Data%20Sheet%20--%20HR2000+.pdf
     */
    function HR2000Data(callback) {
    	this.totalFrames = 8
    	this.output = []
    	this.callback = callback ? callback : function() {};
    	this.counter = 0
    }
    
    /**
     * Clear cache
     */
    HR2000Data.prototype.clear = function() {
    	this.output = []
    	this.counter = 0
    }
    
    /**
     * Add data to cache
     * All calls is asynchronous and the data has to be merged
     */
    HR2000Data.prototype.addData = function(data) {
    	var self = this
    	data = this.convertData(data)
    	this.output.push(data)
    	this.counter++
    	if(this.counter === this.totalFrames)
    		this.callback(self.getData())
    }
    
    /**
     * Return the data output
     */
    HR2000Data.prototype.getData = function() {
    	return this.output
    }
    
    /**
     * Convert the data to output
     *
     * * Removed from documentation:
     * All pixel values are 16-bit values organized in LSB | MSB order. Bit 13 has 
     * to be flipped for every pixel before converting to an integer. This is 
     * equivalent to performing a xor 0x20 with MSB. There is an additional
     * packet containing one value that is used as a flag to insure proper 
     * synchronization between the PC and HR2000+ */
    HR2000Data.prototype.convertData = function(data) {
    	data = data.toString('hex')
    	var size = data.length / 2
    	var output = [size]
    	console.log('size', size)
    	for(var i = 0; i < size; i+=2) {
    		var part = data.substring(i,i+2)
    		output[i/2] = parseInt(part ^0x20, 16)
    	}
    	return output
    }
    /**
     * HR2000Funcs is responsible for the internal functions of spectrometer
     * All functions can be found on Oceanoptics site
     * @link http://www.oceanoptics.com/technical/engineering/OEM%20Data%20Sheet%20--%20HR2000+.pdf
     */
    function HR2000Funcs() {
    	function HR2000Func(data, name, version) {
    		this.name = name
    		this.data = data
    		this.version = version
    	}
    
    	this.pfuncs = [
    		new HR2000Func(0x01, 'intialize', 0.9),
    		new HR2000Func(0x02, 'setIntegrationTime', 0.9),
    		new HR2000Func(0x03, 'setStrobeEnableStatus', 0.9),
    		new HR2000Func(0x04, 'setShutdownMode', 0.9),
    		new HR2000Func(0x05, 'queryInformation', 0.9),
    		new HR2000Func(0x06, 'writeInformation', 0.9),
    
    		new HR2000Func(0x09, 'requestSpectra', 0.9),
    		new HR2000Func(0x0A, 'setTriggerMode', 0.9),
    		new HR2000Func(0x0B, 'queryNumberPlugins', 0.9),
    		new HR2000Func(0x0C, 'queryPluginIdentifiers', 0.9),
    		new HR2000Func(0x0D, 'detectPlugins', 0.9),
    
    		new HR2000Func(0x60, 'generalICRead', 0.9),
    		new HR2000Func(0x61, 'generalICWrite', 0.9),
    		new HR2000Func(0x62, 'generalSpiIo', 0.9),
    		new HR2000Func(0x68, 'pscoRead', 0.9),
    		new HR2000Func(0x69, 'pscoWrite', 0.9),
    		new HR2000Func(0x6A, 'writeRegisterInformation', 0.9),
    		new HR2000Func(0x6B, 'readRegisterInformation', 0.9),
    		new HR2000Func(0x6C, 'readPcbTemperature', 0.9),
    		new HR2000Func(0x6D, 'readIrradianceCalibrationFactors', 0.9),
    		new HR2000Func(0x6E, 'writeIrradianceCalibrationFactors', 0.9),
    
    		new HR2000Func(0xFE, 'queryStatus', 0.9),
    	]
    }
    
    HR2000Funcs.prototype.getByType = function(type, name) {
    	var size = this.pfuncs.length
    	for(var i = 0; i < size; i++) {
    		if(name === this.pfuncs[i][type])
    			return this.pfuncs[i]
    	}
    	return null
    }
    
    HR2000Funcs.prototype.getByName = function(name) {
    	return this.getByType('name', name)
    }
    HR2000Funcs.prototype.getByData = function(data) {
    	return this.getByType('data', data)
    }
    HR2000Funcs.prototype.getFuncs = function() {
    	return this.pfuncs
    }
    
  provide("hr2000", module.exports);
}(global));